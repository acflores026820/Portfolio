/* OperA — guided telemetry onboarding (4 steps: Identify · Signals · Connect & check · Review) */
(function () {
  'use strict';
  const OperA = window.OperA;
  const { html, raw, fmt, reg, tel, requests, validation, store, ui } = OperA;
  const D = OperA.data;
  const STEPS = ['Identify', 'Choose signals', 'Connect and check', 'Review and submit'];
  const PREREQ = {
    metrics: { need: 'Your service uses an OpenTelemetry SDK or exposes a Prometheus /metrics endpoint.',
      check: 'Look for an “opentelemetry” dependency in your build file (pom.xml, package.json or requirements.txt), or open /metrics on the running service.' },
    logs: { need: 'Your service writes logs to standard output as JSON, with timestamp, level and message.',
      check: 'Run the service locally and look at the console. JSON log lines start with “{”.' },
    traces: { need: 'Your service uses an OpenTelemetry SDK, and calls between services pass trace headers.',
      check: 'OpenTelemetry auto-instrumentation agents usually handle this for you. Look for a “-javaagent:opentelemetry” flag or an @opentelemetry/auto-instrumentations package.' },
  };

  const draft = () => store.state.draft;
  function newDraft(prefill = {}) {
    store.state.draft = Object.assign({ step: 0, camrId: null, service: null, component: null, env: null, signals: [], method: 'kubernetes',
      checks: null, attempts: {}, scenario: null, query: '', startedAt: Date.now() }, prefill);
    store.save();
    return store.state.draft;
  }
  function touch() { draft().savedAt = Date.now(); store.save(); }
  const ctx = (d) => { const app = reg.app(d.camrId); return { app, service: d.service, component: d.component, env: d.env, signals: d.signals }; };

  /* ---------- step 1: identify ---------- */
  function appResults(q) {
    const parsed = reg.parseCamr(q);
    const list = q.trim() ? reg.searchApps(q, { includeRetired: true }) : [];
    let msg = '';
    if (q.trim() && parsed.looksLike && !parsed.valid && parsed.suggestion && !list.length) {
      msg = html`<p class="error-msg" style="font-weight:500">CAMR IDs look like CAMR-104233: the letters CAMR, a dash, then 6 digits. Did you mean <button type="button" class="link-btn" data-action="ob-suggest" data-value="${parsed.suggestion}">${parsed.suggestion}</button>?</p>`;
    } else if (q.trim() && parsed.looksLike && !parsed.valid && parsed.suggestion && list.length) {
      msg = html`<p class="hint">Showing results for <strong>${parsed.suggestion}</strong>. CAMR IDs are written with a dash after “CAMR”.</p>`;
    } else if (q.trim() && !list.length) {
      msg = html`${ui.callout('info', `No application found for “${q.trim()}”`, html`<p>Check for a typo, or try the application name instead. If your application isn’t registered yet, your app owner needs to register it before telemetry can be onboarded. Registration is usually same-day.</p>`)}`;
    }
    return html`${msg}${list.length ? html`<fieldset style="margin:0"><legend class="sr-only">Matching applications</legend><div class="choice-list">${list.slice(0, 6).map((a) => html`
      <label class="choice"><input type="radio" name="ob-app" value="${a.camrId}" data-change="ob-pick-app" />
        <span class="choice-body"><span class="choice-title">${a.name} <span class="mono small">${a.camrId}</span>${a.status === 'retired' ? html`<span class="chip chip-neutral">${ui.icon('minus')}Retired</span>` : ''}</span>
          <span class="choice-meta">${a.owningTeam} · App owner ${a.appOwner} · ${fmt.plural(a.services.length, 'service')}</span></span></label>`)}</div></fieldset>` : ''}
      <p class="sr-only" aria-live="polite">${q.trim() ? (list.length ? `${fmt.plural(list.length, 'application')} found` : 'No applications found') : ''}</p>`;
  }

  function stepIdentify(d, errors) {
    const app = d.camrId ? reg.app(d.camrId) : null;
    const me = D.personas[store.state.role];
    if (!app) {
      const mine = reg.myApps();
      return html`
        <h2>Which application are you onboarding?</h2>
        <p class="step-lead">Choose your application first. Everything else comes from the application registry, so you won’t need to type any configuration.</p>
        ${store.state.role === 'app' ? html`<p class="field-label">Your applications</p><div class="quick-picks">${mine.map((a) => html`<button type="button" class="quick-pick" data-action="ob-pick-quick" data-camr="${a.camrId}">${a.name} · ${a.camrId}</button>`)}</div>` : ''}
        <div class="field">
          <label for="ob-app-q">Search by application name or CAMR ID</label>
          <p class="hint" id="ob-app-hint">For example “Rewards Engine” or “CAMR-108840”. ${ui.help('camr')}</p>
          <input id="ob-app-q" type="search" autocomplete="off" aria-describedby="ob-app-hint${errors.app ? ' ob-app-err' : ''}" ${errors.app ? raw('aria-invalid="true"') : ''} data-input="ob-app-search" value="${d.query || ''}" />
          ${errors.app ? html`<p class="error-msg" id="ob-app-err">${errors.app}</p>` : ''}
        </div>
        <div id="ob-app-results">${appResults(d.query || '')}</div>`;
    }
    const svc = d.service ? reg.service(app, d.service) : null;
    const member = reg.isMember(app, me.name);
    return html`
      <h2>Which part of ${app.name}?</h2>
      <p class="step-lead">Pick the service, component and environment you’re setting up. You can repeat this for other components later.</p>
      <div class="selected-app" id="ob-selected" tabindex="-1">
        <div><div class="choice-title">${ui.icon('check')}${app.name} <span class="mono small">${app.camrId}</span></div>
          <div class="choice-meta">${app.owningTeam} · App owner ${app.appOwner} · Tier ${app.tier}</div></div>
        <button type="button" class="btn btn-sm" data-action="ob-change-app">Change application</button>
      </div>
      ${app.status === 'retired' ? ui.callout('danger', 'This application is retired', html`<p>Telemetry can’t be onboarded for retired applications. If it’s still running, ask ${app.appOwner} to reactivate it in the registry, then come back.</p>`) : ''}
      ${!member && app.status === 'active' ? ui.callout('warn', `You’re not listed on ${app.owningTeam}`, html`<p>You can continue, but ${app.appOwner} (app owner) will need to approve this request, even for dev and qa. If you should be on this team, ask them to add you in the registry.</p>`) : ''}
      ${app.status === 'active' ? html`
      <fieldset class="field" ${errors.service ? raw('aria-describedby="ob-svc-err"') : ''}>
        <legend>Service</legend>
        <p class="hint">${ui.help('service')}</p>
        <div class="choice-list">${app.services.map((s, i) => html`<label class="choice"><input type="radio" id="ob-svc-${i}" name="ob-svc" value="${s.name}" data-change="ob-set" data-key="service" ${d.service === s.name ? raw('checked') : ''} />
          <span class="choice-body"><span class="choice-title mono">${s.name}</span><span class="choice-desc">${s.description}</span><span class="choice-meta">Environments: ${s.envs.join(', ')}</span></span></label>`)}</div>
        ${errors.service ? html`<p class="error-msg" id="ob-svc-err">${errors.service}</p>` : ''}
        <details class="small" style="margin-top:8px"><summary class="link-btn">My service isn’t listed</summary>
          <p style="margin-top:6px">Services come from the application registry so that alerts, owners and dashboards stay linked. Ask ${app.appOwner} to add the service to ${app.camrId} in the registry. It shows up here within a few minutes. OperA doesn’t let you onboard unregistered services, because their data can’t be linked to an owner.</p></details>
      </fieldset>
      ${svc ? componentField(svc, d, errors) : ''}
      ${svc && d.component ? envField(app, svc, d, errors) : ''}` : ''}`;
  }
  function componentField(svc, d, errors) {
    if (svc.components.length === 1) {
      const c = svc.components[0];
      if (d.component !== c.name) { d.component = c.name; touch(); }
      return html`<div class="field"><p class="field-label">Component</p><p><span class="mono">${c.name}</span> · ${c.description} <span class="muted small">(the only component of ${svc.name}, so it’s selected for you)</span></p></div>`;
    }
    return html`<fieldset class="field"><legend>Component</legend><p class="hint">${ui.help('component')}</p>
      <div class="choice-list">${svc.components.map((c, i) => html`<label class="choice"><input type="radio" id="ob-cmp-${i}" name="ob-cmp" value="${c.name}" data-change="ob-set" data-key="component" ${d.component === c.name ? raw('checked') : ''} />
        <span class="choice-body"><span class="choice-title mono">${c.name}</span><span class="choice-desc">${c.description}</span></span></label>`)}</div>
      ${errors.component ? html`<p class="error-msg" id="ob-cmp-err">${errors.component}</p>` : ''}</fieldset>`;
  }
  function envField(app, svc, d, errors) {
    return html`<fieldset class="field"><legend>Environment</legend><p class="hint">${ui.help('environment')}</p>
      <div class="choice-list">${svc.envs.map((e, i) => {
        const cv = reg.coverage(app, svc.name, d.component, e);
        const active = D.signals.filter((s) => cv[s] === 'active');
        const onb = D.signals.filter((s) => cv[s] === 'onboarding');
        const full = active.length === 3;
        const status = full ? 'Fully set up. Nothing to do here.' : active.length ? `Already active: ${active.join(', ')}.` : 'Nothing set up yet.';
        return html`<label class="choice"><input type="radio" id="ob-env-${i}" name="ob-env" value="${e}" data-change="ob-set" data-key="env" ${d.env === e ? raw('checked') : ''} ${full ? raw('disabled') : ''} />
          <span class="choice-body"><span class="choice-title">${ui.envTag(e)}${e === 'prod' ? html`<span class="chip chip-info">${ui.icon('shield')}Needs app owner approval</span>` : ''}</span>
            <span class="choice-desc">${status}${onb.length ? ` Onboarding in progress: ${onb.join(', ')}.` : ''}</span>
            ${e === 'prod' && !full ? html`<span class="choice-meta">Tip: set up qa first. Problems are faster to fix there.</span>` : ''}</span></label>`;
      })}</div>
      ${errors.env ? html`<p class="error-msg" id="ob-env-err">${errors.env}</p>` : ''}</fieldset>`;
  }

  /* ---------- step 2: signals ---------- */
  const recommended = (app) => (app.tier <= 2 ? D.signals : ['metrics', 'logs']);
  function stepSignals(d, errors) {
    const { app } = ctx(d);
    const cv = reg.coverage(app, d.service, d.component, d.env);
    const available = D.signals.filter((s) => cv[s] !== 'active' && cv[s] !== 'onboarding');
    return html`
      <h2>What do you want to collect?</h2>
      <p class="step-lead">We’ve selected what we recommend for a Tier ${app.tier} application${app.tier <= 2 ? ' (all three)' : ''}. Each signal helps responders in a different way. Untick anything you don’t want. You can add more later.</p>
      <fieldset class="field"><legend class="sr-only">Signals</legend>
        <div class="choice-list">${D.signals.map((s) => {
          const already = cv[s] === 'active' || cv[s] === 'onboarding';
          const g = D.glossary[s];
          return html`<label class="choice"><input type="checkbox" id="ob-sig-${s}" value="${s}" data-change="ob-signal" ${already || d.signals.includes(s) ? raw('checked') : ''} ${already ? raw('disabled') : ''} />
            <span class="choice-body"><span class="choice-title">${g.term}${already ? html`<span class="chip chip-success">${ui.icon('check')}${cv[s] === 'active' ? 'Already active' : 'Onboarding already'}</span>` : recommended(app).includes(s) ? html`<span class="chip chip-info">Recommended</span>` : ''}</span>
              <span class="choice-desc">${g.text}</span>
              ${!already ? html`<span class="prereq" style="display:block"><span class="prereq-title" style="display:block">You’ll need</span>${PREREQ[s].need}
                <details style="margin-top:4px"><summary class="link-btn">How do I check?</summary><span style="display:block;margin-top:4px">${PREREQ[s].check}</span></details></span>` : ''}</span></label>`;
        })}</div>
        ${errors.signals ? html`<p class="error-msg" id="ob-sig-err">${errors.signals}</p>` : ''}
      </fieldset>
      ${available.length ? ui.callout('info', 'Not sure if you meet these?', html`<p>That’s fine. The next step checks your setup automatically and tells you exactly what to change if something’s missing.</p>`) : ''}`;
  }

  /* ---------- step 3: connect & check ---------- */
  function configs(d) {
    const { app } = ctx(d);
    const endpoint = `https://${D.telemetry.collectorEndpoint(d.env, app.region)}`;
    const attrs = `camr.id=${app.camrId},deployment.environment=${d.env},app.component=${d.component}`;
    const on = (s) => d.signals.includes(s);
    const k8s = [
      '# Add to your Deployment (Helm values or manifest)',
      'metadata:', '  annotations:',
      `    opera.example/collect-logs: "${on('logs') ? 'json' : 'false'}"`,
      'spec:', '  template:', '    spec:', '      containers:', `        - name: ${d.service}`, '          env:',
      '            - name: OTEL_SERVICE_NAME', `              value: "${d.service}"`,
      '            - name: OTEL_RESOURCE_ATTRIBUTES', `              value: "${attrs}"`,
      '            - name: OTEL_EXPORTER_OTLP_ENDPOINT', `              value: "${endpoint}"`,
      '            - name: OTEL_METRICS_EXPORTER', `              value: "${on('metrics') ? 'otlp' : 'none'}"`,
      '            - name: OTEL_TRACES_EXPORTER', `              value: "${on('traces') ? 'otlp' : 'none'}"`,
      ...(on('traces') ? [ '            - name: OTEL_TRACES_SAMPLER', '              value: "parentbased_traceidratio"', '            - name: OTEL_TRACES_SAMPLER_ARG', `              value: "${d.env === 'prod' ? '0.1' : '1.0'}"` ] : []),
    ].join('\n');
    const env = [
      `export OTEL_SERVICE_NAME=${d.service}`,
      `export OTEL_RESOURCE_ATTRIBUTES=${attrs}`,
      `export OTEL_EXPORTER_OTLP_ENDPOINT=${endpoint}`,
      `export OTEL_METRICS_EXPORTER=${on('metrics') ? 'otlp' : 'none'}`,
      `export OTEL_TRACES_EXPORTER=${on('traces') ? 'otlp' : 'none'}`,
      `export OTEL_LOGS_EXPORTER=${on('logs') ? 'otlp' : 'none'}`,
    ].join('\n');
    const vm = [ 'sudo opera-agent enroll \\', `  --camr-id ${app.camrId} \\`, `  --service ${d.service} \\`, `  --component ${d.component} \\`, `  --env ${d.env} \\`, `  --signals ${d.signals.join(',')}` ].join('\n');
    return { k8s, env, vm, endpoint, attrs };
  }
  function checkItem(c, where) {
    const showDetail = c.state === 'fail' || c.state === 'waiting';
    return html`<li class="check check-${c.state}" id="check-${c.id}">
      <div class="check-head"><span class="check-name">${ui.icon(c.state === 'pass' ? 'check' : c.state === 'fail' ? 'x' : c.state === 'waiting' ? 'clock' : 'minus')}${c.label}</span>${ui.checkChip(c.state)}</div>
      <p class="check-detail"><strong class="sr-only">What happened: </strong>${c.detail}</p>
      ${showDetail && (c.cause || c.fix) ? html`<div class="check-block">
        ${c.cause ? html`<div><p class="check-sub">Why</p><p class="small">${c.cause}</p></div>` : ''}
        ${c.fix ? html`<div><p class="check-sub">${c.state === 'waiting' ? 'What to do' : 'How to fix it'}</p><p class="small">${c.fix.text}</p>${c.fix.code ? ui.codeBlock(c.fix.code, 'Fix') : ''}${c.fix.more ? html`<p class="small muted">${c.fix.more}</p>` : ''}</div>` : ''}
      </div>` : ''}
      ${c.note ? html`<p class="check-note">${ui.icon('info')} ${c.note}</p>` : ''}
      ${showDetail ? html`<div class="check-actions">
        <button type="button" class="btn btn-sm btn-primary" data-action="${where}-recheck" data-check="${c.id}" id="recheck-${c.id}">${ui.icon('refresh')}${c.state === 'waiting' ? 'Check again' : 'I’ve fixed it, check again'}</button>
        ${c.state === 'fail' ? html`<button type="button" class="btn btn-sm" data-action="${where}-help" data-check="${c.id}">${ui.icon('help')}Get help</button>` : ''}
      </div>` : ''}
    </li>`;
  }
  function resultsBlock(checks, where) {
    const s = validation.summary(checks);
    return html`<div class="val-summary" role="status">
        ${s.pass ? html`<span class="chip chip-success">${ui.icon('check')}${s.pass} passed</span>` : ''}
        ${s.fail ? html`<span class="chip chip-danger">${ui.icon('x')}${s.fail} need${s.fail === 1 ? 's' : ''} your action</span>` : ''}
        ${s.waiting ? html`<span class="chip chip-info">${ui.icon('clock')}${s.waiting} waiting for data</span>` : ''}
        ${s.skipped ? html`<span class="chip chip-neutral">${ui.icon('minus')}${s.skipped} not checked yet</span>` : ''}
      </div>
      ${where === 'req'
        ? (s.blocked ? ui.callout('danger', 'Blocked: no data can reach OperA yet', html`<p>Fix the problem below. Everything else is checked once it’s fixed.</p>`)
          : s.fail ? ui.callout('warn', 'This request is waiting on your fix', html`<p>Once the failed check passes, the request moves on by itself. You don’t need to resubmit.</p>`)
          : s.waiting ? ui.callout('info', 'Waiting for data', html`<p>OperA keeps checking and updates this request when data arrives.</p>`)
          : '')
        : (s.blocked ? ui.callout('danger', 'Fix the blocking problem before you submit', html`<p>Without this, no data can reach OperA. Everything else is checked once it’s fixed.</p>`)
          : s.fail ? ui.callout('warn', 'You can submit now, or fix this first', html`<p>Your request will be marked “Needs your action” until the failed check passes. You can fix it at any time from the request page.</p>`)
          : s.waiting ? ui.callout('info', 'Almost there', html`<p>Some data hasn’t arrived yet. That’s normal right after a deploy. You can submit now. OperA keeps checking for 30 minutes and updates your request.</p>`)
          : ui.callout('success', 'Everything is working', html`<p>All checks passed. Continue to review and submit.</p>`))}
      <ol class="checks" aria-label="Validation checks">${checks.map((c) => checkItem(c, where))}</ol>`;
  }
  OperA.resultsBlock = resultsBlock;

  /** Tabs with the generated configuration and an explanation of each line. Used by both layouts. */
  function configBlock(d) {
    const { app } = ctx(d);
    const cfg = configs(d);
    const methods = [ ['kubernetes', 'Kubernetes', cfg.k8s, 'YAML'], ['env', 'Environment variables', cfg.env, 'Shell'], ['vm', 'Virtual machine agent', cfg.vm, 'Shell'] ];
    const rec = app.platform === 'kubernetes' ? 'kubernetes' : 'vm';
    if (!d.methodChosen && d.method !== rec) { d.method = rec; touch(); }
    return html`
      <p class="small">Registry says ${app.name} runs on ${app.platform === 'kubernetes' ? 'Kubernetes' : 'virtual machines'}, so that tab is selected.</p>
      <div class="tabs" role="tablist" aria-label="Deployment type">${methods.map(([k, label]) => html`<button type="button" role="tab" id="tab-m-${k}" aria-controls="panel-m-${k}" aria-selected="${d.method === k}" tabindex="${d.method === k ? 0 : -1}" data-action="ob-method" data-method="${k}">${label}${k === rec ? ' (recommended)' : ''}</button>`)}</div>
      ${methods.map(([k, label, code, lang]) => html`<div role="tabpanel" id="panel-m-${k}" aria-labelledby="tab-m-${k}" class="tab-panel" ${d.method === k ? '' : raw('hidden')}>${ui.codeBlock(code, `${label} · ${lang}`)}</div>`)}
      <details class="small"><summary class="link-btn">What does this configuration do?</summary>
        <ul style="margin-top:6px">
          <li><strong>OTEL_SERVICE_NAME</strong>: names your service in dashboards and alerts.</li>
          <li><strong>OTEL_RESOURCE_ATTRIBUTES</strong>: labels every piece of data with your CAMR ID, environment and component, so it’s linked to ${app.name} and its owners. ${ui.help('attributes', 'Why this matters')}</li>
          <li><strong>OTEL_EXPORTER_OTLP_ENDPOINT</strong>: where to send data. This is the ${d.env} collector for ${tel.region(app.region).name}. ${ui.help('collector', 'What’s a collector?')}</li>
          <li><strong>*_EXPORTER</strong>: turns each signal on or off to match what you chose.</li>
          ${d.signals.includes('traces') ? html`<li><strong>OTEL_TRACES_SAMPLER</strong> and <strong>_ARG</strong>: how many traces to keep. ${d.env === 'prod' ? '10% in prod keeps costs predictable, and errors are always kept.' : '100% outside prod, so you see every request while testing.'}</li>` : ''}
          ${d.signals.includes('logs') ? html`<li><strong>opera.example/collect-logs</strong>: tells the platform’s log agent to collect this pod’s output as JSON.</li>` : ''}
        </ul></details>`;
  }
  /** Results area plus the Run button. The ids are what the run/recheck handlers look for. */
  function checksBlock(d, errors) {
    return html`<div id="ob-results" tabindex="-1">${d.checks ? resultsBlock(d.checks, 'ob') : ''}</div>
      <div class="btn-row" style="margin-top:12px">
        <button type="button" class="btn ${d.checks ? '' : 'btn-primary'}" data-action="ob-run-checks" id="ob-run">${ui.icon('refresh')}${d.checks ? 'Run all checks again' : 'Run checks'}</button>
        ${errors.checks ? html`<p class="error-msg" id="ob-checks-err" style="margin:0">${errors.checks}</p>` : ''}
      </div>`;
  }

  function stepConnect(d, errors) {
    return html`
      <h2>Connect your service</h2>
      <p class="step-lead">Add the configuration, deploy as you normally do, then let OperA check that data arrives. We filled in every value for you.</p>
      <ol class="numbered">
        <li><h3>Add this configuration</h3>${configBlock(d)}</li>
        <li><h3>Deploy to ${d.env}</h3><p class="small">Deploy the way you normally do. OperA doesn’t change your pipeline or your code.</p></li>
        <li><h3>Check that data arrives</h3>
          <p class="small">Takes about 10 seconds. Run it as many times as you like.</p>
          ${checksBlock(d, errors)}
        </li>
      </ol>`;
  }

  /* ---------- step 4: review ---------- */
  function stepReview(d) {
    const { app } = ctx(d);
    const me = D.personas[store.state.role];
    const member = reg.isMember(app, me.name);
    const needsApproval = d.env === 'prod' || !member;
    const s = validation.summary(d.checks || []);
    const nonPass = (d.checks || []).filter((c) => c.state !== 'pass');
    const row = (label, value, step) => html`<dt>${label}</dt><dd style="display:flex;justify-content:space-between;gap:10px">${value}<button type="button" class="link-btn small" data-action="ob-goto" data-step="${step}">Change<span class="sr-only"> ${label.toLowerCase()}</span></button></dd>`;
    return html`
      <h2>Review and submit</h2>
      <p class="step-lead">Check the details. You can change anything before you submit.</p>
      <dl class="kv" style="grid-template-columns:150px 1fr">
        ${row('Application', html`${app.name} <span class="mono small">${app.camrId}</span>`, 0)}
        ${row('Service', html`<span class="mono">${d.service}</span>`, 0)}
        ${row('Component', html`<span class="mono">${d.component}</span>`, 0)}
        ${row('Environment', ui.envTag(d.env), 0)}
        ${row('Signals', d.signals.map(fmt.cap).join(', '), 1)}
        ${row('Checks', html`${s.pass} of ${s.total} passed${s.fail ? `, ${s.fail} need your action` : ''}${s.waiting ? `, ${s.waiting} waiting for data` : ''}`, 2)}
      </dl>
      ${nonPass.length ? html`<ul class="plain small" style="margin-bottom:14px">${nonPass.map((c) => html`<li>${ui.checkChip(c.state)} <strong>${c.label}</strong>: ${c.detail}</li>`)}</ul>` : ''}
      <section class="card" style="box-shadow:none;background:var(--surface-2)" aria-labelledby="h-what-next">
        <h3 id="h-what-next" style="margin-bottom:8px">What happens after you submit</h3>
        <ol class="small">
          ${needsApproval ? html`<li><strong>${app.appOwner}</strong> (app owner) is asked to approve. ${d.env === 'prod' ? 'Production requests always need owner approval.' : 'You’re not on the owning team, so the owner approves.'} Usually within 1 business day. You can send a reminder from the request page.</li>`
            : html`<li>Approved automatically. dev and qa requests from the owning team don’t need approval.</li>`}
          <li>OperA sets up storage, retention and a starter dashboard, “${app.name} · ${d.service}”. This takes about 15 minutes and you don’t need to do anything.</li>
          ${s.fail ? html`<li>Your request stays at <strong>Needs your action</strong> until the failed check passes.</li>` : ''}
          ${s.waiting ? html`<li>OperA keeps checking for data for 30 minutes and updates the request.</li>` : ''}
          <li>You’ll get a notification when data is flowing. Track progress on <a href="#/requests">Onboarding requests</a>.</li>
        </ol>
      </section>`;
  }

  /* ---------- the view ---------- */
  OperA.views.onboard = {
    title: () => 'Onboard telemetry',
    render(_, q) {
      let d = draft();
      // Prefill from links like #/onboard?app=CAMR-108840&service=rewards-api&env=prod
      if (q.app) {
        if (d && d.camrId && d.camrId !== q.app && !q.fresh) {
          const cur = reg.app(d.camrId); const next = reg.app(q.app);
          return html`${ui.pageHead({ title: 'Onboard telemetry' })}
            ${ui.callout('info', 'You have an unfinished draft', html`<p>You started onboarding <strong>${cur ? cur.name : d.camrId}</strong>${d.service ? ` · ${d.service}` : ''}${d.env ? ` (${d.env})` : ''}. Starting a new one for ${next ? next.name : q.app} replaces it.</p>`,
              html`<a class="btn btn-primary" href="#/onboard" data-action="nav" data-href="#/onboard?continue=1">Continue my draft</a><a class="btn" href="#/onboard?${new URLSearchParams(Object.assign({}, q, { fresh: '1' }))}">Start new for ${next ? next.name : q.app}</a>`)}`;
        }
        const app = reg.app(q.app);
        const svc = app && q.service ? reg.service(app, q.service) : null;
        const cmp = svc && q.component && svc.components.some((c) => c.name === q.component) ? q.component : (svc && svc.components.length === 1 ? svc.components[0].name : null);
        const env = svc && q.env && svc.envs.includes(q.env) ? q.env : null;
        const prefill = { camrId: app ? app.camrId : null, query: app ? '' : q.app, service: svc ? svc.name : (app && app.services.length === 1 ? app.services[0].name : null), component: cmp, env };
        if (!d || d.camrId !== prefill.camrId || q.fresh) d = newDraft(prefill);
        else if (d.step === 0) { Object.assign(d, { service: prefill.service || d.service, component: prefill.component || d.component, env: prefill.env || d.env, checks: null }); }
        preselectSignals(d);
        touch();
        history.replaceState(null, '', '#/onboard');
      }
      if (!d) d = newDraft();
      const errors = OperA.views.onboard.errors || {};
      OperA.views.onboard.errors = null;
      if (OperA.design() === 'console') return OperA.views.onboardConsole.render(d, errors);
      const errList = Object.entries(errors).filter(([, v]) => v);
      const body = [stepIdentify, stepSignals, stepConnect, stepReview][d.step](d, errors);
      const app = d.camrId ? reg.app(d.camrId) : null;
      const isLast = d.step === 3;
      const canProceed = !(app && app.status === 'retired');
      return html`
        ${ui.pageHead({ title: 'Onboard telemetry', lead: 'About 15 minutes per component. Your progress saves automatically, so you can leave and come back.' })}
        <div class="wizard">
          ${ui.stepper(STEPS, d.step, { label: 'Onboarding steps' })}
          ${errList.length ? html`<div class="error-summary" role="alert" tabindex="-1" id="ob-errors"><h2>There’s a problem</h2><ul>${errList.map(([k, v]) => html`<li><a href="#" data-action="focus-field" data-field="${OperA.views.onboard.fieldFor[k]}">${v}</a></li>`)}</ul></div>` : ''}
          <div class="wizard-card">${body}
            <div class="wizard-nav">
              <div class="btn-row">
                ${d.step > 0 ? html`<button type="button" class="btn" data-action="ob-back">Back</button>` : ''}
                <button type="button" class="btn btn-ghost" data-action="ob-later">Save and finish later</button>
              </div>
              <div class="btn-row">
                <span class="draft-note">${d.savedAt ? html`${ui.icon('check')}Draft saved ${fmt.rel(d.savedAt)}` : ''}</span>
                ${canProceed ? html`<button type="button" class="btn btn-primary" data-action="${isLast ? 'ob-submit' : 'ob-next'}" id="ob-next">${isLast ? 'Submit request' : 'Continue'}${isLast ? '' : ui.icon('arrow')}</button>` : ''}
              </div>
            </div>
          </div>
          <p style="margin-top:14px"><button type="button" class="link-btn small" data-action="ob-reset">Start over</button></p>
        </div>`;
    },
    mount() {
      const errs = document.getElementById('ob-errors');
      if (errs) { errs.focus(); return true; }
      return false;
    },
    fieldFor: { app: 'ob-app-q', service: 'ob-svc-0', component: 'ob-cmp-0', env: 'ob-env-0', signals: 'ob-sig-metrics', checks: 'ob-run' },
  };
  OperA.route(/^\/onboard$/, OperA.views.onboard);

  /* ---------- interactions ---------- */
  OperA.inputs['ob-app-search'] = (el) => {
    draft().query = el.value; store.save();
    document.getElementById('ob-app-results').innerHTML = String(appResults(el.value));
  };
  OperA.actions['ob-suggest'] = (el) => {
    const input = document.getElementById('ob-app-q'); input.value = el.dataset.value;
    OperA.inputs['ob-app-search'](input); input.focus();
  };
  function pickApp(camrId) {
    const d = draft();
    Object.assign(d, { camrId, service: null, component: null, env: null, signals: [], checks: null, attempts: {} });
    const app = reg.app(camrId);
    const only = app.services.length === 1 ? app.services[0].name : null;
    if (only) d.service = only;
    touch(); OperA.refresh();
    const sel = document.getElementById('ob-selected'); if (sel) sel.focus();
    OperA.announce(`Selected ${app.name}.${only ? ` Service ${only} selected automatically because it is the only one.` : ''}`);
  }
  OperA.changes['ob-pick-app'] = (el) => pickApp(el.value);
  OperA.actions['ob-pick-quick'] = (el) => pickApp(el.dataset.camr);
  OperA.actions['ob-change-app'] = () => {
    Object.assign(draft(), { camrId: null, service: null, component: null, env: null, signals: [], checks: null });
    touch(); OperA.refresh(); const i = document.getElementById('ob-app-q'); if (i) i.focus();
  };
  /** Recommended signals that aren't set up yet, unless the person has already chosen their own. */
  function preselectSignals(d) {
    if (d.signalsTouched || !d.camrId || !d.service || !d.component || !d.env) return;
    const app = reg.app(d.camrId);
    const cv = reg.coverage(app, d.service, d.component, d.env);
    d.signals = recommended(app).filter((s) => cv[s] === 'none' || cv[s] === 'partial');
  }
  OperA.changes['ob-set'] = (el) => {
    const d = draft(); const key = el.dataset.key;
    d[key] = el.value || null;
    if (key === 'service') {
      d.component = null; d.env = null;
      const svc = d.service && reg.service(reg.app(d.camrId), d.service);
      if (svc && svc.components.length === 1) d.component = svc.components[0].name;
    }
    if (key === 'component') d.env = null;
    if (key === 'env') preselectSignals(d);
    d.checks = null; touch(); OperA.refresh();
  };
  OperA.changes['ob-signal'] = (el) => {
    const d = draft();
    d.signals = D.signals.filter((s) => (s === el.value ? el.checked : d.signals.includes(s)));
    d.signalsTouched = true; d.checks = null; touch();
    if (OperA.design() === 'console') OperA.refresh(); // the readiness panel and configuration update live
  };
  OperA.actions['ob-method'] = (btn) => { OperA.ui.activateTab(btn); draft().method = btn.dataset.method; draft().methodChosen = true; touch(); };
  OperA.actions['focus-field'] = (el) => { const f = document.getElementById(el.dataset.field); if (f) f.focus(); };

  function validateStep(d, step = d.step) {
    const e = {};
    if (step === 0) {
      const app = d.camrId && reg.app(d.camrId);
      if (!app) e.app = 'Choose your application. Search by name or CAMR ID.';
      else if (app.status === 'retired') e.app = 'This application is retired and can’t be onboarded.';
      else {
        if (!d.service) e.service = 'Choose a service.';
        else if (!d.component) e.component = 'Choose a component.';
        else if (!d.env) e.env = 'Choose an environment.';
      }
    } else if (step === 1) {
      if (!d.signals.length) {
        const cv = reg.coverage(reg.app(d.camrId), d.service, d.component, d.env);
        e.signals = D.signals.every((s) => cv[s] === 'active' || cv[s] === 'onboarding')
          ? 'Everything is already set up or in progress for this component. Go back and choose another environment or component.'
          : 'Choose at least one signal to collect.';
      }
    } else if (step === 2) {
      if (!d.checks) e.checks = 'Run the checks first so you know your setup works.';
      else if (validation.summary(d.checks).blocked) e.checks = 'Fix the blocking problem before you continue. Use “Get help” if you’re stuck.';
    }
    return e;
  }
  OperA.actions['ob-next'] = () => {
    const d = draft();
    if (d.step === 1) syncSignalsFromPage(d); // pick up checkbox state even if the change event didn't fire
    const e = validateStep(d);
    if (Object.keys(e).length) { OperA.views.onboard.errors = e; OperA.render(); return; }
    if (d.step === 0) preselectSignals(d);
    d.step += 1; touch(); OperA.render();
  };
  OperA.actions['ob-back'] = () => { const d = draft(); d.step = Math.max(0, d.step - 1); touch(); OperA.render(); };
  OperA.actions['ob-goto'] = (el) => { const d = draft(); d.step = Number(el.dataset.step); touch(); OperA.render(); };
  OperA.actions['ob-later'] = () => { touch(); OperA.toast('Draft saved. You’ll find it under “Your next actions” on your home page.'); OperA.go('#/home'); };
  OperA.actions['ob-reset'] = () => {
    OperA.confirm({ title: 'Start over?', label: 'Delete draft and start over',
      body: html`<p>Your onboarding draft will be deleted. Requests you’ve already submitted are not affected.</p>` },
    () => { store.state.draft = null; store.save(); OperA.go('#/onboard'); });
  };

  /* Run checks with visible, announced progress. */
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function runChecks(onDone) {
    const d = draft();
    const scenario = store.state.proto.validation;
    const result = validation.run(ctx(d), scenario, d.attempts);
    const box = document.getElementById('ob-results');
    const btn = document.getElementById('ob-run'); if (btn) btn.disabled = true;
    let i = 0;
    const tick = () => {
      if (i >= result.length) {
        d.checks = result; d.scenario = scenario; touch(); OperA.refresh();
        const s = validation.summary(result);
        OperA.announce(`Checks finished. ${s.pass} passed${s.fail ? `, ${s.fail} need your action` : ''}${s.waiting ? `, ${s.waiting} waiting for data` : ''}.`);
        const r = document.getElementById('ob-results'); if (r) r.focus();
        if (onDone) onDone();
        return;
      }
      box.innerHTML = String(html`<p class="small" role="status">Checking ${i + 1} of ${result.length}: ${result[i].label}…</p><div class="progress-line"><div style="width:${((i + 1) / result.length) * 100}%"></div></div>`);
      i += 1; setTimeout(tick, reduced() ? 30 : 320);
    };
    tick();
  }
  OperA.actions['ob-run-checks'] = () => {
    const d = draft();
    if (OperA.design() === 'console') {
      // On the single page nothing stops you pressing Run early, so say what's missing.
      syncSignalsFromPage(d);
      const e = Object.assign({}, validateStep(d, 0));
      if (!Object.keys(e).length) Object.assign(e, validateStep(d, 1));
      if (Object.keys(e).length) { OperA.views.onboard.errors = e; touch(); OperA.render(); return; }
    }
    if (d.checks) d.checks.forEach((c) => { if (c.state !== 'pass') d.attempts[c.id] = (d.attempts[c.id] || 0) + 1; });
    runChecks();
  };
  OperA.actions['ob-recheck'] = (el) => {
    const d = draft(); const id = el.dataset.check;
    d.attempts[id] = (d.attempts[id] || 0) + 1;
    el.disabled = true; el.lastChild.textContent = 'Checking…';
    setTimeout(() => {
      d.checks = validation.run(ctx(d), store.state.proto.validation, d.attempts); touch(); OperA.refresh();
      const c = d.checks.find((x) => x.id === id);
      OperA.announce(`${c.label}: ${({ pass: 'passed', fail: 'still failing', waiting: 'still waiting for data', skipped: 'not checked yet' })[c.state]}. ${c.detail}`);
      const li = document.getElementById(`check-${id}`); if (li) { li.setAttribute('tabindex', '-1'); li.focus(); }
    }, reduced() ? 50 : 700);
  };
  function helpModal(context, check) {
    const app = context.app;
    const packet = [
      `Application:       ${app.name} (${app.camrId})`,
      `Service/component: ${context.service}/${context.component}`,
      `Environment:       ${context.env}`,
      `Signals:           ${context.signals.join(', ')}`,
      `Failed check:      ${check.label}`,
      `What happened:     ${check.detail}`,
      `Attempts so far:   ${(context.attempts && context.attempts[check.id] || 0) + 1}`,
      `Requested by:      ${D.personas[store.state.role].name}`,
    ].join('\n');
    OperA.modal.open({
      title: 'Get help from the Telemetry Platform team', form: 'ob-help', submitLabel: 'Send help request', wide: true,
      body: html`<p>We’ll send these diagnostics with your request, so nobody has to ask you for the details again.</p>
        <pre class="packet" tabindex="0" aria-label="Diagnostics that will be attached">${packet}</pre>
        <div class="field" style="margin-top:14px"><label for="help-note">Anything else we should know? <span class="optional">(optional)</span></label>
          <textarea id="help-note" name="note" rows="3" placeholder="For example: we don’t manage the network policy for this namespace."></textarea></div>`,
    });
  }
  OperA.actions['ob-help'] = (el) => {
    const d = draft(); const c = d.checks.find((x) => x.id === el.dataset.check);
    helpModal(Object.assign(ctx(d), { attempts: d.attempts }), c);
  };
  OperA.helpModal = helpModal;
  OperA.forms['ob-help'] = () => {
    OperA.modal.close();
    const id = `HLP-${Math.floor(4000 + Math.random() * 999)}`;
    OperA.toast(`Help request ${id} sent to Telemetry Platform with your diagnostics. Typical first reply: within 2 business hours in #telemetry-platform.`);
  };

  /** Create the request from the draft. Returns the new request id. */
  function submitDraft() {
    const d = draft(); const c = ctx(d); const app = c.app;
    const me = D.personas[store.state.role];
    const member = reg.isMember(app, me.name);
    const s = validation.summary(d.checks || []);
    let status;
    const id = store.nextId('REQ');
    const now = Date.now();
    const hist = [ { at: now, text: `Request submitted by ${me.name}.` } ];
    if (s.fail) { status = 'action-needed'; hist.push({ at: now, text: `Validation: ${d.checks.filter((x) => x.state === 'fail').map((x) => x.label).join(', ')} failed. Waiting for a fix.` }); }
    else if (d.env === 'prod' || !member) { status = 'awaiting-approval'; hist.push({ at: now, text: `All required checks passed. Waiting for approval from ${app.appOwner}.` }); }
    else { status = 'provisioning'; hist.push({ at: now, text: 'All required checks passed. Approved automatically.' }, { at: now, text: 'Setting up storage, retention and dashboard (automated).' }); }
    store.state.requests.push({ id, camrId: app.camrId, service: d.service, component: d.component, env: d.env, signals: d.signals.slice(),
      status, requester: me.name, createdAt: now, approver: app.appOwner, etaMinutes: 15, scenario: d.scenario, attempts: Object.assign({}, d.attempts),
      needsApproval: d.env === 'prod' || !member, history: hist, mine: true });
    store.state.draft = null; store.save();
    return id;
  }
  OperA.actions['ob-submit'] = () => {
    const d = draft();
    if (OperA.design() === 'console') {
      // One page, so check everything at once and show every problem together.
      syncSignalsFromPage(d);
      const e = Object.assign({}, validateStep(d, 0));
      if (!Object.keys(e).length) Object.assign(e, validateStep(d, 1));
      if (!Object.keys(e).length) Object.assign(e, validateStep(d, 2));
      if (Object.keys(e).length) { OperA.views.onboard.errors = e; touch(); OperA.render(); return; }
    } else if (!d.checks || validation.summary(d.checks).blocked) {
      d.step = 2; OperA.views.onboard.errors = { checks: 'Run the checks and fix any blocking problem before submitting.' }; touch(); OperA.render(); return;
    }
    OperA.go(`#/requests/${submitDraft()}?new=1`);
  };
  function syncSignalsFromPage(d) {
    const boxes = D.signals.map((s) => document.getElementById(`ob-sig-${s}`)).filter(Boolean);
    if (boxes.length) d.signals = D.signals.filter((s) => { const el = document.getElementById(`ob-sig-${s}`); return el && el.checked && !el.disabled; });
  }

  /* Pieces the Console layout's single-page onboarding reuses. */
  OperA.onboard = { PREREQ, draft, ctx, appResults, recommended, configBlock, checksBlock };
})();
