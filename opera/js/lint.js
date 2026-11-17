/*
 * OperA — Fix-it rule engine.
 *
 * Checks pasted OpenTelemetry settings or log lines against the application
 * registry and says what's wrong and how to fix it, before anything is deployed.
 * These are deterministic rules, not AI. The file depends only on the registry
 * data (no DOM, no storage), so it runs under Node for unit tests.
 */
(function () {
  'use strict';
  const OperA = (window.OperA = window.OperA || {});
  const D = OperA.data;
  const SIGNALS = ['metrics', 'logs', 'traces'];
  const ENVS = ['dev', 'qa', 'prod'];

  const appById = (id) => D.applications.find((a) => a.camrId === id) || null;
  const appsWithService = (name) => D.applications.filter((a) => a.status === 'active' && a.services.some((s) => s.name === name));
  const serviceOf = (app, name) => (app ? app.services.find((s) => s.name === name) || null : null);
  const regionName = (id) => (D.telemetry.regions.find((r) => r.id === id) || { name: id }).name;
  const list = (items) => items.join(', ');

  /** Closest registered name, for "did you mean" (edit distance, small inputs only). */
  function nearest(word, candidates) {
    const dist = (a, b) => {
      const m = Array.from({ length: a.length + 1 }, (_, i) => [i]);
      for (let j = 1; j <= b.length; j++) m[0][j] = j;
      for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      return m[a.length][b.length];
    };
    let best = null;
    candidates.forEach((c) => { const d = dist(String(word).toLowerCase(), c.toLowerCase()); if (d <= 3 && (!best || d < best.d)) best = { c, d }; });
    return best ? best.c : null;
  }

  /* =====================================================================
   * Generating settings (used by onboarding and to show corrected versions)
   * ===================================================================== */
  function endpointFor(app, env) { return `https://${D.telemetry.collectorEndpoint(env, app.region)}`; }
  function generate(ctx) {
    const { app, service, component, env } = ctx;
    const signals = ctx.signals && ctx.signals.length ? ctx.signals : SIGNALS;
    const endpoint = endpointFor(app, env);
    const attrs = `camr.id=${app.camrId},deployment.environment=${env},app.component=${component}`;
    const on = (s) => signals.includes(s);
    const sample = env === 'prod' ? '0.1' : '1.0';
    const k8s = [
      '# Add to your Deployment (Helm values or manifest)',
      'metadata:', '  annotations:',
      `    opera.example/collect-logs: "${on('logs') ? 'json' : 'false'}"`,
      'spec:', '  template:', '    spec:', '      containers:', `        - name: ${service}`, '          env:',
      '            - name: OTEL_SERVICE_NAME', `              value: "${service}"`,
      '            - name: OTEL_RESOURCE_ATTRIBUTES', `              value: "${attrs}"`,
      '            - name: OTEL_EXPORTER_OTLP_ENDPOINT', `              value: "${endpoint}"`,
      '            - name: OTEL_METRICS_EXPORTER', `              value: "${on('metrics') ? 'otlp' : 'none'}"`,
      '            - name: OTEL_TRACES_EXPORTER', `              value: "${on('traces') ? 'otlp' : 'none'}"`,
      ...(on('traces') ? [ '            - name: OTEL_TRACES_SAMPLER', '              value: "parentbased_traceidratio"', '            - name: OTEL_TRACES_SAMPLER_ARG', `              value: "${sample}"` ] : []),
    ].join('\n');
    const envText = [
      `export OTEL_SERVICE_NAME=${service}`,
      `export OTEL_RESOURCE_ATTRIBUTES=${attrs}`,
      `export OTEL_EXPORTER_OTLP_ENDPOINT=${endpoint}`,
      `export OTEL_METRICS_EXPORTER=${on('metrics') ? 'otlp' : 'none'}`,
      `export OTEL_TRACES_EXPORTER=${on('traces') ? 'otlp' : 'none'}`,
      `export OTEL_LOGS_EXPORTER=${on('logs') ? 'otlp' : 'none'}`,
      ...(on('traces') ? [ 'export OTEL_TRACES_SAMPLER=parentbased_traceidratio', `export OTEL_TRACES_SAMPLER_ARG=${sample}` ] : []),
    ].join('\n');
    const vm = [ 'sudo opera-agent enroll \\', `  --camr-id ${app.camrId} \\`, `  --service ${service} \\`, `  --component ${component} \\`, `  --env ${env} \\`, `  --signals ${signals.join(',')}` ].join('\n');
    const manifest = [
      '# opera.yaml: commit this beside your service. Your pipeline applies it.',
      'apiVersion: opera.example/v1', 'kind: TelemetryOnboarding',
      `camrId: ${app.camrId}`, `service: ${service}`, `component: ${component}`, `environment: ${env}`,
      `signals: [${signals.join(', ')}]`,
    ].join('\n');
    const cli = `opera onboard --camr-id ${app.camrId} --service ${service} --component ${component} --env ${env} --signals ${signals.join(',')}`;
    return { k8s, env: envText, vm, manifest, cli, endpoint, attrs };
  }

  /* =====================================================================
   * Recognising what was pasted
   * ===================================================================== */
  const CONFIG_HINT = /OTEL_[A-Z_]+|camr\.id\s*=|deployment\.environment|opera-agent\s+enroll|opera\s+onboard|^\s*camrId\s*:|kind:\s*TelemetryOnboarding/m;
  const LOG_HINT = /^\s*\{.*\}\s*$|^\s*\[?\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}|\b(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL)\b/m;
  function detect(text) {
    const t = String(text || '').trim();
    if (!t) return 'unknown';
    if (CONFIG_HINT.test(t)) return 'config';
    if (LOG_HINT.test(t)) return 'log';
    return 'unknown';
  }

  /** Read key/value settings from shell exports, .env files, Kubernetes YAML, opera.yaml or the agent command. */
  function parseConfig(text) {
    const t = String(text || '');
    const kv = {};
    let style = 'env';
    const unq = (v) => String(v).trim().replace(/^["']|["']$/g, '').trim();
    // Kubernetes env list:  - name: KEY  /  value: "VALUE"
    const k8s = /-\s*name:\s*([A-Z][A-Z0-9_]+)\s*\n\s*value:\s*(.+)/g;
    let m;
    while ((m = k8s.exec(t))) { kv[m[1]] = unq(m[2]); style = 'k8s'; }
    // agent / CLI flags:  --camr-id X --service Y
    if (/opera-agent\s+enroll|opera\s+onboard/.test(t)) {
      style = /opera-agent/.test(t) ? 'vm' : 'cli';
      const flag = /--([a-z-]+)[ =]+([^\s\\]+)/g;
      while ((m = flag.exec(t))) kv[`--${m[1]}`] = unq(m[2]);
    }
    // KEY=VALUE and KEY: VALUE lines (shell, .env, compose, opera.yaml, annotations)
    t.split('\n').forEach((line) => {
      const l = line.trim().replace(/^export\s+/, '').replace(/^-\s+/, '');
      const eq = l.match(/^([A-Za-z_][A-Za-z0-9_./-]*)\s*=\s*(.*)$/);
      const colon = l.match(/^([A-Za-z_][A-Za-z0-9_./-]*)\s*:\s+(.+)$/);
      if (eq && /^[A-Z0-9_]+$/.test(eq[1])) kv[eq[1]] = unq(eq[2]);
      else if (colon && !/^(name|value)$/.test(colon[1])) kv[colon[1]] = unq(colon[2]);
    });
    if (/kind:\s*TelemetryOnboarding/.test(t) || (kv.camrId && !kv.OTEL_SERVICE_NAME)) style = 'manifest';

    const attrs = {};
    String(kv.OTEL_RESOURCE_ATTRIBUTES || '').split(',').forEach((pair) => { const i = pair.indexOf('='); if (i > 0) attrs[pair.slice(0, i).trim()] = pair.slice(i + 1).trim(); });
    const direct = style === 'vm' || style === 'cli' || style === 'manifest'; // these name things directly, without OTEL_* variables
    const signalList = kv['--signals'] || (kv.signals ? kv.signals.replace(/[\[\]]/g, '') : null);
    const explicit = signalList ? signalList.split(',').map((x) => x.trim()).filter(Boolean) : null;
    const exporter = (key) => (kv[key] === undefined ? null : kv[key].toLowerCase() !== 'none');
    const logsOn = kv['opera.example/collect-logs'] !== undefined ? kv['opera.example/collect-logs'] !== 'false' : exporter('OTEL_LOGS_EXPORTER');
    return {
      style, direct, kv,
      service: kv.OTEL_SERVICE_NAME || kv['--service'] || kv.service || null,
      camr: attrs['camr.id'] || kv['--camr-id'] || kv.camrId || null,
      env: attrs['deployment.environment'] || kv['--env'] || kv.environment || null,
      component: attrs['app.component'] || kv['--component'] || kv.component || null,
      endpoint: kv.OTEL_EXPORTER_OTLP_ENDPOINT || null,
      signals: explicit ? SIGNALS.filter((s) => explicit.includes(s))
        : SIGNALS.filter((s) => (s === 'metrics' ? exporter('OTEL_METRICS_EXPORTER') : s === 'traces' ? exporter('OTEL_TRACES_EXPORTER') : logsOn)),
      allOff: !explicit && exporter('OTEL_METRICS_EXPORTER') === false && exporter('OTEL_TRACES_EXPORTER') === false && logsOn === false,
      sampler: kv.OTEL_TRACES_SAMPLER_ARG || null,
    };
  }

  /* =====================================================================
   * Checking settings
   * ===================================================================== */
  function config(text) {
    const p = parseConfig(text);
    const out = [];
    const add = (id, state, title, detail, fix) => out.push({ id, state, title, detail, fix: fix || null });
    const camrVar = p.direct ? 'the CAMR ID' : 'camr.id';

    /* --- which application? -------------------------------------------- */
    let app = null;
    const raw = p.camr ? p.camr.trim() : null;
    const id = raw ? raw.toUpperCase() : null;
    const owners = p.service ? appsWithService(p.service) : [];
    if (!raw) {
      app = owners.length === 1 ? owners[0] : null;
      add('camr', 'fail', 'Application ID (camr.id)',
        `There is no ${camrVar} in these settings, so OperA can’t link the data to an application or its owners.${app ? ` From the service name this looks like ${app.name} (${app.camrId}).` : ''}`,
        { text: app ? `Add camr.id=${app.camrId} to OTEL_RESOURCE_ATTRIBUTES.` : 'Add camr.id=<your CAMR ID> to OTEL_RESOURCE_ATTRIBUTES. Find the ID on your application’s registry page, or search for the application in OperA.' });
    } else if (!/^CAMR-\d{6}$/.test(id)) {
      const digits = (id.match(/\d{6}/) || [])[0];
      const guess = digits ? `CAMR-${digits}` : null;
      app = guess ? appById(guess) : null;
      add('camr', 'fail', 'Application ID (camr.id)',
        `“${raw}” isn’t a CAMR ID. They look like CAMR-104233: the letters CAMR, a dash, then 6 digits.${guess ? ` Did you mean ${guess}${app ? ` (${app.name})` : ''}?` : ''}`,
        guess ? { text: `Use ${guess}.` } : null);
    } else if (!appById(id)) {
      app = owners.length === 1 ? owners[0] : null;
      add('camr', 'fail', 'Application ID (camr.id)',
        `${id} isn’t in the application registry.${app ? ` The service ${p.service} belongs to ${app.name} (${app.camrId}).` : ' Check for a typo. If the application is new, your app owner needs to register it first.'}`,
        app ? { text: `Use ${app.camrId}.` } : null);
    } else if (appById(id).status === 'retired') {
      add('camr', 'fail', 'Application ID (camr.id)', `${id} is ${appById(id).name}, which is retired. Telemetry can’t be onboarded for a retired application. If it’s still running, ask ${appById(id).appOwner} to reactivate it in the registry.`);
    } else {
      app = appById(id);
      add('camr', 'pass', 'Application ID (camr.id)', `${id} is ${app.name}, owned by ${app.owningTeam}.`);
    }

    /* --- service -------------------------------------------------------- */
    let svc = null;
    if (!p.service) {
      add('service', 'fail', 'Service name', `${p.direct ? 'No service is named' : 'OTEL_SERVICE_NAME is not set'}, so your data would show up without a service name.`,
        { text: app ? `Set it to one of ${app.name}’s registered services: ${list(app.services.map((s) => s.name))}.` : 'Set OTEL_SERVICE_NAME to your service’s registered name.' });
    } else if (app) {
      svc = serviceOf(app, p.service);
      if (svc) add('service', 'pass', 'Service name', `${p.service} is a registered service of ${app.name}.`);
      else {
        const near = nearest(p.service, app.services.map((s) => s.name));
        add('service', 'fail', 'Service name',
          `${p.service} isn’t a registered service of ${app.name}. Registered: ${list(app.services.map((s) => s.name))}.${near ? ` Did you mean ${near}?` : ''}`,
          { text: near ? `Use ${near}. If ${p.service} is a new service, ask ${app.appOwner} to add it to ${app.camrId} in the registry first.` : `Ask ${app.appOwner} to add the service to ${app.camrId} in the registry, or use a registered name.` });
        if (near) svc = serviceOf(app, near);
      }
    } else if (owners.length > 1) {
      add('service', 'warn', 'Service name', `${p.service} exists in more than one application (${list(owners.map((a) => a.name))}). The CAMR ID decides which one this is.`);
    } else {
      add('service', 'warn', 'Service name', `${p.service} can’t be checked until the application ID is right.`);
    }

    /* --- component ------------------------------------------------------ */
    let component = null;
    const compVar = p.direct ? 'a component' : 'app.component';
    if (svc) {
      const names = svc.components.map((c) => c.name);
      if (!p.component) {
        component = names.length === 1 ? names[0] : null;
        add('component', 'fail', 'Component (app.component)', `There is no ${compVar}, so OperA can’t tell which part of ${svc.name} the data comes from.`,
          { text: names.length === 1 ? `Add app.component=${names[0]}.` : `Add app.component with one of: ${list(names)}.` });
      } else if (!names.includes(p.component)) {
        component = names.length === 1 ? names[0] : nearest(p.component, names);
        add('component', 'fail', 'Component (app.component)', `${p.component} isn’t a component of ${svc.name}. Registered: ${list(names)}.`,
          { text: component ? `Use ${component}.` : `Use one of: ${list(names)}.` });
      } else { component = p.component; add('component', 'pass', 'Component (app.component)', `${p.component} is a component of ${svc.name}.`); }
    } else if (!p.component) {
      add('component', 'fail', 'Component (app.component)', `There is no ${compVar}.`, { text: 'Add app.component=<component> to OTEL_RESOURCE_ATTRIBUTES.' });
    }

    /* --- environment ---------------------------------------------------- */
    let env = null;
    const envVar = p.direct ? 'an environment' : 'deployment.environment';
    if (!p.env) {
      add('environment', 'fail', 'Environment (deployment.environment)', `There is no ${envVar}, so dev, qa and prod data would be mixed together.`, { text: `Add deployment.environment with one of: ${list(svc ? svc.envs : ENVS)}.` });
    } else if (!ENVS.includes(p.env)) {
      add('environment', 'fail', 'Environment (deployment.environment)', `“${p.env}” isn’t an environment OperA knows. Use one of: ${list(ENVS)}.`, { text: `Use one of: ${list(svc ? svc.envs : ENVS)}.` });
    } else if (svc && !svc.envs.includes(p.env)) {
      add('environment', 'fail', 'Environment (deployment.environment)', `${svc.name} isn’t registered in ${p.env}. It’s registered in: ${list(svc.envs)}.`,
        { text: `Use one of ${list(svc.envs)}, or ask ${app.appOwner} to register ${p.env} for ${svc.name}.` });
    } else { env = p.env; add('environment', 'pass', 'Environment (deployment.environment)', `${p.env} is ${svc ? `registered for ${svc.name}` : 'a valid environment'}.`); }

    /* --- collector address (not part of the agent command or opera.yaml) -- */
    if (!p.direct) {
      const want = app && env ? endpointFor(app, env) : null;
      const em = p.endpoint ? p.endpoint.match(/^(https?):\/\/otlp\.([a-z]+)\.([a-z0-9-]+)\.opera\.example(?::(\d+))?\/?$/) : null;
      const fix = want ? { text: 'Set the address to:', code: `OTEL_EXPORTER_OTLP_ENDPOINT=${want}` } : { text: 'The address looks like https://otlp.<environment>.<region>.opera.example:4317.' };
      if (!p.endpoint) add('endpoint', 'fail', 'Collector address', 'OTEL_EXPORTER_OTLP_ENDPOINT is not set, so your service has nowhere to send data.', fix);
      else if (!em) add('endpoint', 'fail', 'Collector address', `${p.endpoint} isn’t an OperA collector address.`, fix);
      else if (em[1] !== 'https') add('endpoint', 'fail', 'Collector address', 'The address uses http. Collectors only accept https.', fix);
      else if (em[4] !== '4317') add('endpoint', 'fail', 'Collector address', em[4] ? `Port ${em[4]} is not the collector port. Use 4317.` : 'The address has no port. Collectors listen on port 4317.', fix);
      else if (env && em[2] !== env) add('endpoint', 'fail', 'Collector address', `The settings say ${env}, but the address is the ${em[2]} collector. Your ${env} data would land in ${em[2]}.`, fix);
      else if (app && em[3] !== app.region) add('endpoint', 'fail', 'Collector address', `${app.name} sends telemetry through ${regionName(app.region)} (${app.region}), but this address is ${em[3]}.`, fix);
      else add('endpoint', 'pass', 'Collector address', `${want ? 'This is the right collector' : 'The address is well-formed'}${app && env ? ` for ${env} in ${regionName(app.region)}` : ''}.`);
    }

    /* --- what is switched on -------------------------------------------- */
    if (p.allOff) add('signals', 'warn', 'What is switched on', 'Metrics, logs and traces are all switched off, so nothing would be sent.', { text: 'Set at least one exporter to otlp.' });
    else if (p.signals.length) add('signals', 'pass', 'What is switched on', `On: ${list(p.signals)}.${p.signals.length < 3 ? ` Off: ${list(SIGNALS.filter((s) => !p.signals.includes(s)))}.` : ''}`);
    if (env === 'prod' && p.signals.includes('traces') && p.sampler && Number(p.sampler) >= 1) {
      add('sampling', 'warn', 'Trace sampling', 'This keeps every trace in production, which is costly at volume. OperA recommends 10%; errors are always kept.', { text: 'Set:', code: 'OTEL_TRACES_SAMPLER_ARG=0.1' });
    }

    /* --- corrected version ---------------------------------------------- */
    const ok = !out.some((f) => f.state === 'fail');
    const context = app ? { app, service: svc ? svc.name : null, component, env, signals: p.signals.length ? p.signals : SIGNALS } : null;
    let corrected = null;
    if (!ok && context && context.service && context.component && context.env) {
      const g = generate(context);
      corrected = { k8s: g.k8s, vm: g.vm, cli: g.cli, manifest: g.manifest, env: g.env }[p.style];
    }
    return { kind: 'config', style: p.style, ok, context, findings: out, corrected, complete: !!(context && context.service && context.component && context.env) };
  }

  /* =====================================================================
   * Checking log lines
   * ===================================================================== */
  const FIELD = {
    timestamp: ['timestamp', 'time', 'ts', '@timestamp'],
    level: ['level', 'severity', 'lvl', 'log.level'],
    message: ['message', 'msg'],
    trace: ['trace_id', 'traceId', 'trace.id'],
  };
  const JSON_FIX = {
    text: 'Switch your logger to JSON. For Spring Boot with Logback, add this encoder to logback-spring.xml and redeploy:',
    code: '<appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">\n  <encoder class="net.logstash.logback.encoder.LogstashEncoder"/>\n</appender>',
    more: 'Using Node.js or Python? Use pino (Node.js) or python-json-logger (Python). Any JSON with timestamp, level and message works.',
  };
  function log(text) {
    const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 50);
    const parsed = lines.map((l) => { try { const o = JSON.parse(l); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch (e) { return null; } });
    const json = parsed.filter(Boolean);
    const out = [];
    const add = (id, state, title, detail, fix) => out.push({ id, state, title, detail, fix: fix || null });

    if (!json.length) {
      add('format', 'fail', 'JSON format', `${lines.length === 1 ? 'This line is' : `None of these ${lines.length} lines are`} plain text, not JSON, so it can’t be searched by field (for example, by level or order ID).`, JSON_FIX);
    } else if (json.length < lines.length) {
      add('format', 'fail', 'JSON format', `${lines.length - json.length} of ${lines.length} lines are not JSON. This often means stack traces are printed on their own lines.`,
        { text: 'Log the exception as a field of the JSON line (most JSON encoders do this when you pass the exception to the logger), so each event is one line.' });
    } else {
      add('format', 'pass', 'JSON format', `${lines.length === 1 ? 'The line is' : `All ${lines.length} lines are`} valid JSON.`);
    }
    if (json.length) {
      const first = json[0];
      ['timestamp', 'level', 'message'].forEach((f) => {
        const key = FIELD[f].find((k) => first[k] !== undefined);
        const missing = json.filter((o) => !FIELD[f].some((k) => o[k] !== undefined)).length;
        if (!key || missing) add(f, 'fail', `Field: ${f}`, `${missing === json.length ? 'There is no' : `${missing} of ${json.length} lines have no`} ${f} field. OperA looks for ${list(FIELD[f])}.`,
          { text: `Add a "${f}" field to every log line.${f === 'level' ? ' Without it, you can’t filter for errors.' : f === 'timestamp' ? ' Without it, events are ordered by arrival time, which is less accurate.' : ''}` });
        else add(f, 'pass', `Field: ${f}`, key === f ? `Found "${f}".` : `Found as "${key}", which OperA reads as ${f}.`);
      });
      const tsKey = FIELD.timestamp.find((k) => first[k] !== undefined);
      if (tsKey && typeof first[tsKey] === 'string' && Number.isNaN(Date.parse(first[tsKey]))) {
        add('timestamp-format', 'warn', 'Timestamp format', `“${first[tsKey]}” isn’t a standard date and time. Use ISO 8601, for example 2026-11-06T09:14:02Z.`);
      }
      if (FIELD.trace.some((k) => first[k] !== undefined)) add('trace', 'pass', 'Link to traces', 'A trace ID is present, so each log line links to its request trace.');
      else add('trace', 'info', 'Link to traces', 'Tip: add a trace_id field and each log line will link to its request trace. OpenTelemetry logging instrumentation adds it for you.');
    }
    return { kind: 'log', ok: !out.some((f) => f.state === 'fail'), findings: out, lines: lines.length };
  }

  function run(text) {
    const kind = detect(text);
    if (kind === 'config') return config(text);
    if (kind === 'log') return log(text);
    return { kind: 'unknown', ok: false, findings: [] };
  }

  OperA.lint = { detect, parseConfig, config, log, run, generate, endpointFor };
})();
