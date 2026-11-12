/*
 * OperA prototype — core: safe templating, store, router, delegation, domain logic.
 */
(function () {
  'use strict';
  const OperA = window.OperA;
  const D = OperA.data;

  /* =====================================================================
   * Safe templating. Every interpolated value is HTML-escaped unless it is
   * already a Raw fragment produced by html``. User input (search queries,
   * notes, change records) therefore can never inject markup.
   * ===================================================================== */
  class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
  function renderVal(v) {
    if (v == null || v === false) return '';
    if (v instanceof Raw) return v.s;
    if (Array.isArray(v)) return v.map(renderVal).join('');
    return esc(v);
  }
  function html(strings, ...vals) {
    let out = '';
    strings.forEach((s, i) => { out += s; if (i < vals.length) out += renderVal(vals[i]); });
    return new Raw(out);
  }
  const raw = (s) => new Raw(s);
  OperA.html = html; OperA.raw = raw; OperA.esc = esc;

  /* =====================================================================
   * Formatting helpers
   * ===================================================================== */
  const fmt = {
    rel(ts) {
      const diff = Math.round((Date.now() - ts) / 60000);
      if (diff < -1) return `in ${fmt.dur(-diff)}`;
      if (diff <= 0) return 'just now';
      return `${fmt.dur(diff)} ago`;
    },
    dur(min) {
      if (min < 60) return `${min} min`;
      const h = Math.floor(min / 60);
      if (h < 24) { const m = min % 60; return m ? `${h} h ${m} min` : `${h} h`; }
      const d = Math.floor(h / 24);
      return `${d} day${d === 1 ? '' : 's'}`;
    },
    minsSince(ts) { return Math.max(0, Math.round((Date.now() - ts) / 60000)); },
    clock(ts) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); },
    date(ts) { return new Date(ts).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }); },
    iso(ts) { return new Date(ts).toISOString(); },
    num(n) { return n == null ? '—' : Number(n).toLocaleString(); },
    cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); },
    plural(n, one, many) { return `${n} ${n === 1 ? one : (many || one + 's')}`; },
  };
  OperA.fmt = fmt;

  /* =====================================================================
   * Store — only user actions are persisted. Seed data is regenerated on
   * load so times stay realistic.
   * ===================================================================== */
  const KEY = 'opera.prototype.v1';
  const defaults = () => ({
    role: 'app',
    draft: null,
    requests: [],
    requestOverrides: {},
    alerts: {},
    proto: { validation: 'realistic', dataSource: 'normal' },
    seq: 3110,
    // Layout preferences. Each role picks its own layout: 'guided' or 'console'.
    design: { app: 'guided', ops: 'guided' },
    chosen: false,          // has the person picked a layout on the chooser page?
    shortcuts: true,        // single-key shortcuts in the Console layout (can be turned off)
    triage: { status: 'open', scope: '' },
  });
  const PREFS = ['design', 'chosen', 'shortcuts'];
  let state;
  function load(saved) {
    const d = defaults();
    state = Object.assign(d, saved);
    state.design = Object.assign({ app: 'guided', ops: 'guided' }, saved && saved.design);
    state.triage = Object.assign({ status: 'open', scope: '' }, saved && saved.triage);
  }
  try { load(JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch (e) { load({}); }
  const store = {
    get state() { return state; },
    save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode: keep in memory */ } },
    /** Clear prototype data. keepPrefs keeps the layout choices (used by scenario launchers). */
    reset({ keepPrefs = false } = {}) {
      const keep = {};
      if (keepPrefs) PREFS.forEach((k) => { keep[k] = state[k]; });
      load(keep); store.save();
    },
    nextId(prefix) { state.seq += 1; store.save(); return `${prefix}-${state.seq}`; },
  };
  OperA.store = store;

  /* Layout ("design") for the current role, reflected on <html> so CSS can theme it. */
  OperA.design = () => (state.design[state.role] === 'console' ? 'console' : 'guided');
  OperA.applyDesign = () => {
    const el = document.documentElement;
    el.dataset.design = OperA.design();
    el.dataset.role = state.role;
  };
  OperA.applyDesign();

  /* =====================================================================
   * Registry lookups
   * ===================================================================== */
  const reg = {
    app(camrId) { return D.applications.find((a) => a.camrId === camrId) || null; },
    activeApps() { return D.applications.filter((a) => a.status === 'active'); },
    persona() { return D.personas[state.role]; },
    myApps() { const p = D.personas.app; return p.apps.map(reg.app).filter(Boolean); },
    isMember(app, name) { return app.members.includes(name) || (app.onCall && (app.onCall.primary === name || app.onCall.secondary === name)); },
    service(app, name) { return app.services.find((s) => s.name === name) || null; },
    coverage(app, service, component, env) {
      const c = app.coverage[`${service}/${component}`];
      return (c && c[env]) || { metrics: 'none', logs: 'none', traces: 'none' };
    },
    runbook(id) { return D.runbooks.find((r) => r.id === id) || null; },
    runbookStale(rb) { return (Date.now() - new Date(rb.lastReviewed).getTime()) / 86400000 > 180; },
    /** Normalise free-text CAMR input and offer a correction when it is close. */
    parseCamr(input) {
      const v = String(input || '').trim().toUpperCase();
      if (/^CAMR-\d{6}$/.test(v)) return { valid: true, id: v };
      const m = v.match(/^(?:CAMR[\s_:]*)?-?(\d{6})$/);
      if (m) return { valid: false, looksLike: true, suggestion: `CAMR-${m[1]}` };
      if (/^CAMR/i.test(v) || /^\d{3,}$/.test(v)) return { valid: false, looksLike: true, suggestion: null };
      return { valid: false, looksLike: false };
    },
    searchApps(q, { includeRetired = false } = {}) {
      const s = String(q || '').trim().toLowerCase();
      const pool = D.applications.filter((a) => includeRetired || a.status === 'active');
      if (!s) return pool;
      const digits = s.replace(/\D/g, '');
      return pool.filter((a) =>
        a.name.toLowerCase().includes(s) ||
        a.camrId.toLowerCase().includes(s) ||
        (digits.length >= 3 && a.camrId.includes(digits)) ||
        a.owningTeam.toLowerCase().includes(s) ||
        a.services.some((sv) => sv.name.includes(s)));
    },
  };
  OperA.reg = reg;

  /* =====================================================================
   * Telemetry freshness and the "application or telemetry?" assessment
   * ===================================================================== */
  const tel = {
    incidentsFor(app, signal) {
      return D.telemetry.incidents.filter((i) =>
        (!signal || i.signal === signal) &&
        ((i.scope.pool && i.scope.pool === app.pool) || (i.scope.region && i.scope.region === app.region)));
    },
    region(id) { return D.telemetry.regions.find((r) => r.id === id); },
    /** Per-signal state for one component in one environment. */
    freshness(app, service, component, env) {
      const c = reg.coverage(app, service, component, env);
      const out = {};
      D.signals.forEach((sig, idx) => {
        const status = c[sig];
        const inc = tel.incidentsFor(app, sig)[0];
        if (status === 'none' || status === 'onboarding') {
          out[sig] = { state: 'not-onboarded', label: status === 'onboarding' ? 'Onboarding' : 'Not set up',
            detail: status === 'onboarding' ? 'Onboarding request in progress.' : `${fmt.cap(sig)} are not set up for ${service}/${component} in ${env}.` };
        } else if (inc && inc.effect === 'missing') {
          out[sig] = { state: 'missing', label: 'Missing or partial', detail: `${inc.id}: ${inc.title}.`, incident: inc };
        } else if (inc && inc.effect === 'delayed') {
          out[sig] = { state: 'delayed', label: `Delayed ~${inc.lagMinutes} min`, detail: `${inc.id}: ${inc.title}. Recent events may be missing.`, incident: inc };
        } else if (status === 'partial') {
          out[sig] = { state: 'partial', label: 'Arriving, attributes missing',
            detail: 'Data is arriving but some required attributes are missing, so part of it may not link to this application.' };
        } else {
          out[sig] = { state: 'fresh', label: 'Arriving normally', detail: `Last data ${18 + idx * 11} seconds ago.` };
        }
      });
      return out;
    },
    assess(alert) {
      const app = reg.app(alert.camrId);
      const f = tel.freshness(app, alert.service, alert.component, alert.env);
      const src = f[alert.signal];
      const evidence = [];
      const sigName = fmt.cap(alert.signal);

      if (src.state === 'missing') evidence.push({ type: 'bad', text: `${sigName} for ${alert.service} are missing or partial because of telemetry incident ${src.incident.id} (${src.incident.title.toLowerCase()}).`, href: '#/health' });
      else if (src.state === 'delayed') evidence.push({ type: 'warn', text: `${sigName} are delayed about ${src.incident.lagMinutes} minutes (${src.incident.id}).`, href: '#/health' });
      else evidence.push({ type: 'good', text: `${sigName} for ${alert.service} are arriving normally, so the alert is based on current data.` });

      D.signals.filter((s) => s !== alert.signal).forEach((s) => {
        const x = f[s];
        if (x.state === 'fresh') evidence.push({ type: 'good', text: `${fmt.cap(s)}: arriving normally.` });
        else if (x.state === 'delayed') evidence.push({ type: 'warn', text: `${fmt.cap(s)}: delayed about ${x.incident.lagMinutes} minutes (${x.incident.id}). Recent events may be missing from search.`, href: '#/health' });
        else if (x.state === 'missing') evidence.push({ type: 'bad', text: `${fmt.cap(s)}: missing or partial (${x.incident.id}).`, href: '#/health' });
        else if (x.state === 'partial') evidence.push({ type: 'warn', text: `${fmt.cap(s)}: arriving, but some data is missing required attributes.` });
        else evidence.push({ type: 'info', text: `${fmt.cap(s)}: not set up for this component in ${alert.env}, so there is less evidence to go on.`, gap: s });
      });

      alert.changes.forEach((c) => {
        const before = Math.round((alert.startedAt - c.at) / 60000);
        evidence.push({ type: c.correlated ? 'bad' : 'info', text: `${c.text} ${fmt.rel(c.at)} — ${before} minutes before the alert started. ${c.by}.` });
      });
      if (!alert.changes.length) evidence.push({ type: 'info', text: 'No deploys or config changes in the last 24 hours.' });
      alert.findings.forEach((x) => evidence.push(x));

      let verdict; let confidence;
      if (src.state === 'missing' && alert.kind === 'no-data') { verdict = 'telemetry'; confidence = 'high'; }
      else if (src.state === 'missing' || src.state === 'delayed') { verdict = 'inconclusive'; confidence = 'low'; }
      else {
        verdict = 'application';
        const weak = D.signals.some((s) => s !== alert.signal && f[s].state !== 'fresh');
        confidence = weak ? 'medium' : 'high';
      }
      const freshOthers = D.signals.filter((s) => s !== alert.signal && f[s].state === 'fresh');
      const incident = src.incident || null;
      let headline; let guidance;
      if (verdict === 'telemetry') {
        headline = 'Likely a telemetry problem, not the application';
        guidance = `The data stopped because of ${incident.id}, and other signals show ${app.name} working normally. Link this alert to ${incident.id} and don’t page ${app.owningTeam}.`;
      } else if (verdict === 'inconclusive') {
        headline = 'Can’t tell yet: the data behind this alert is unreliable';
        guidance = `${sigName} for ${app.name} are affected by ${incident.id}, so this alert’s value may be wrong. Check ${freshOthers.join(' and ') || 'another signal'} before paging ${app.owningTeam}.`;
      } else {
        headline = confidence === 'high' ? 'Likely an application problem' : 'Likely an application problem (some evidence is missing)';
        guidance = confidence === 'high'
          ? 'Telemetry is healthy, so this alert reflects real application behaviour. Follow the handling procedure.'
          : 'The alert’s own data is healthy, but some other signals are delayed or not set up. Treat it as an application problem and rely on the signals that are healthy.';
      }
      return { verdict, confidence, headline, guidance, evidence, freshness: f, incident };
    },
  };
  OperA.tel = tel;

  /* =====================================================================
   * Alerts: merged seed + user state, escalation, next step
   * ===================================================================== */
  const alerts = {
    st(id) { return (state.alerts[id] = state.alerts[id] || { timeline: [], escalations: [], approvals: [], stepsDone: [] }); },
    get(id) {
      const seed = D.alerts.find((a) => a.id === id);
      if (!seed) return null;
      const s = state.alerts[id] || {};
      return Object.assign({}, seed, {
        status: s.status || seed.status,
        assignee: s.assignee !== undefined ? s.assignee : seed.assignee,
        timeline: [ ...(seed.seedTimeline || []), ...(s.timeline || []) ].sort((a, b) => b.at - a.at),
        escalations: s.escalations || [], approvals: s.approvals || [], stepsDone: s.stepsDone || [],
        linkedIncident: s.linkedIncident || null, holdPaging: !!s.holdPaging, resolution: s.resolution || seed.resolution || null,
      });
    },
    all() { return D.alerts.map((a) => alerts.get(a.id)); },
    open() { return alerts.all().filter((a) => a.status !== 'resolved'); },
    log(id, text, who) { alerts.st(id).timeline.push({ at: Date.now(), who: who || reg.persona().name, text }); store.save(); },
    sevRank: { critical: 0, high: 1, medium: 2, low: 3 },
    sort(list) {
      const needs = (a) => (a.status === 'new' ? 0 : 1);
      return list.slice().sort((a, b) => alerts.sevRank[a.severity] - alerts.sevRank[b.severity] || needs(a) - needs(b) || a.startedAt - b.startedAt);
    },
    resolveTarget(app, target, assess) {
      const tc = D.telemetry.telemetryOnCall;
      switch (target) {
        case 'noc': return { key: 'noc', who: 'Production Operations', role: 'On-shift triage using the handling procedure', contact: '#prod-ops' };
        case 'telemetry': return { key: 'telemetry', who: tc.person, role: `${tc.team} on-call`, contact: tc.chat };
        case 'primary':
        case 'secondary':
          if (!app.onCall) return { key: target, who: app.supportGroup, role: `No ${target} on-call registered. Support group, business hours only.`, contact: app.chat, gap: true };
          return { key: target, who: app.onCall[target], role: `${app.owningTeam} ${target} on-call`, contact: `Pager: ${app.onCall.schedule}` };
        case 'support': return { key: 'support', who: app.supportGroup, role: `${app.owningTeam} support group (business hours)`, contact: app.chat };
        case 'ic': return { key: 'ic', who: 'Incident commander', role: 'Major Incident Management', contact: '#major-incident' };
        default: return { key: target, who: target, role: '' };
      }
    },
    escalation(alert, assess) {
      const app = reg.app(alert.camrId);
      assess = assess || tel.assess(alert);
      const age = fmt.minsSince(alert.startedAt);
      const policy = assess.verdict === 'telemetry'
        ? [ { after: 0, target: 'noc' }, { after: 0, target: 'telemetry' } ]
        : D.escalationPolicies[app.tier];
      const steps = policy.map((p) => {
        const t = alerts.resolveTarget(app, p.target, assess);
        const sent = alert.escalations.find((e) => e.target === p.target);
        const ackedBy = alert.assignee && alert.assignee === t.who && alert.status !== 'new';
        let st;
        if (p.target === 'noc') st = 'done';
        else if (sent || ackedBy) st = 'done';
        else if (alert.status === 'resolved') st = 'skipped';
        else if (p.target === 'telemetry' && assess.incident) st = 'engaged';
        else if (p.after <= age) st = 'due';
        else st = 'upcoming';
        return Object.assign({}, t, { after: p.after, state: st, inMin: Math.max(0, p.after - age), sent, ackedBy });
      });
      // Only the first due step is "due now"; later overdue steps are shown as overdue but not actionable yet.
      let seenDue = false;
      steps.forEach((s) => { if (s.state === 'due') { if (seenDue) s.state = 'overdue-later'; seenDue = true; } });
      return { steps, age, due: steps.find((s) => s.state === 'due') || null, gap: steps.some((s) => s.gap) };
    },
    nextStep(alert) {
      const a = tel.assess(alert);
      const esc = alerts.escalation(alert, a);
      const rb = reg.runbook(alert.runbook) || reg.runbook(a.verdict === 'telemetry' ? 'RB-900' : 'RB-000');
      const pending = alert.approvals.find((x) => x.state === 'pending');
      if (alert.status === 'resolved') return { tone: 'success', text: `Resolved. ${alert.resolution || ''}` };
      if (a.verdict === 'telemetry' && !alert.linkedIncident) {
        return { tone: 'info', text: `Link this alert to ${a.incident.id} so the ${reg.app(alert.camrId).owningTeam} team isn’t paged for a telemetry problem.`, action: 'link-incident', label: `Link to ${a.incident.id}` };
      }
      const fresh = D.signals.filter((s) => s !== alert.signal && a.freshness[s].state === 'fresh');
      if (a.verdict === 'inconclusive') {
        const team = reg.app(alert.camrId).owningTeam;
        if (alert.status === 'new') return { tone: 'warn', text: `Acknowledge, then check ${fresh.join(' and ') || 'another signal'} before paging ${team}. This alert’s own data is unreliable (${a.incident.id}).`, action: 'ack', label: 'Acknowledge' };
        if (esc.due && !alert.stepsDone.includes(1)) return { tone: 'info', text: `Check ${fresh.join(' and ') || 'another signal'} first. If they confirm a real problem, page ${esc.due.who}. If they look normal, link this alert to ${a.incident.id}.`, action: 'link-incident', label: `Link to ${a.incident.id}` };
      }
      if (alert.status === 'new') {
        return { tone: 'warn', text: esc.due ? `Acknowledge to take ownership. Escalation is due now: ${esc.due.who} (${esc.due.role}).` : 'Acknowledge to take ownership, then follow the handling procedure.', action: 'ack', label: 'Acknowledge' };
      }
      if (pending) return { tone: 'info', text: `Waiting for ${pending.approver} to approve “${pending.title}”. Nothing runs until they approve.` };
      if (esc.due) return { tone: 'warn', text: `Escalation is due: ${esc.due.who} (${esc.due.role}).`, action: 'escalate', label: `Page ${esc.due.who}` };
      if (a.verdict === 'telemetry' && alert.linkedIncident) return { tone: 'info', text: `Linked to ${alert.linkedIncident}. Re-check when the telemetry incident is resolved. If the alert still fires with fresh data, follow the application procedure.` };
      const idx = rb.steps.findIndex((_, i) => !alert.stepsDone.includes(i));
      if (idx === -1) return { tone: 'info', text: 'All procedure steps are done. Resolve the alert with a short note when the problem is gone.', action: 'resolve', label: 'Resolve' };
      return { tone: 'info', text: `Follow step ${idx + 1} of the handling procedure: ${rb.steps[idx].title}.`, step: idx };
    },
  };
  OperA.alerts = alerts;

  /* =====================================================================
   * Onboarding validation engine (simulated; deterministic per scenario)
   * ===================================================================== */
  const CHECK_LABEL = {
    identity: 'Application identity', attributes: 'Required attributes', connection: 'Collector connection',
    metrics: 'Metrics received', logs: 'Logs received', traces: 'Traces received',
  };
  const validation = {
    label: CHECK_LABEL,
    blocking: ['identity', 'attributes', 'connection'],
    /** ctx: { app, service, component, env, signals } ; attempts: { checkId: n } */
    run(ctx, scenario, attempts) {
      attempts = attempts || {};
      const { app, service, component, env } = ctx;
      const endpoint = D.telemetry.collectorEndpoint(env, app.region);
      const logInc = tel.incidentsFor(app, 'logs').find((i) => i.effect === 'delayed');
      const n = (id) => attempts[id] || 0;
      const out = [];

      out.push({ id: 'identity', state: 'pass', detail: `${app.camrId} is active in the registry, and ${service} belongs to ${app.name}.` });

      if (scenario === 'misconfigured' && n('attributes') < 1) {
        out.push({ id: 'attributes', state: 'fail',
          detail: `Data is arriving without camr.id, so OperA can’t link it to ${app.name}.`,
          short: 'Add camr.id to OTEL_RESOURCE_ATTRIBUTES and redeploy',
          cause: 'OTEL_RESOURCE_ATTRIBUTES was probably replaced instead of added to. It must include all three values below.',
          fix: { text: 'Set the variable to exactly this, then redeploy:', code: `OTEL_RESOURCE_ATTRIBUTES=camr.id=${app.camrId},deployment.environment=${env},app.component=${component}` } });
      } else {
        out.push({ id: 'attributes', state: 'pass', detail: 'All four required attributes are present: service.name, deployment.environment, camr.id and app.component.' });
      }

      if (scenario === 'blocked') {
        const tries = n('connection');
        out.push({ id: 'connection', state: 'fail',
          detail: `Your service couldn’t reach the collector at ${endpoint}. The connection timed out after 10 seconds.`,
          short: 'Allow outbound traffic to the collector on port 4317',
          cause: `A network policy in your ${env} namespace is probably blocking outbound traffic on port 4317.`,
          fix: { text: 'Allow outbound traffic to the collector. Add this to your namespace’s network policy:',
            code: `egress:\n  - to:\n      - namespaceSelector:\n          matchLabels:\n            opera.example/collector: "true"\n    ports:\n      - protocol: TCP\n        port: 4317` },
          note: tries >= 2 ? 'Still failing after several checks. Network policies are often managed by your namespace admin. Use “Get help” to send them these diagnostics. You won’t need to explain the problem again.' : null });
      } else {
        out.push({ id: 'connection', state: 'pass', detail: `Your service connected to the collector at ${endpoint}.` });
      }

      const upstreamOk = out.every((c) => c.state === 'pass');
      ctx.signals.forEach((sig) => {
        if (!upstreamOk) { out.push({ id: sig, state: 'skipped', detail: 'Not checked yet. Fix the problem above first, because data can’t arrive until it’s fixed.' }); return; }
        if (scenario === 'no-data' && n(sig) < 1) {
          out.push({ id: sig, state: 'waiting', detail: 'No data yet. It can take up to 5 minutes after you deploy.',
            fix: { text: 'Check again in a few minutes. If you submit now, OperA keeps checking for 30 minutes and updates your request.' } });
          return;
        }
        if (sig === 'metrics') {
          out.push({ id: 'metrics', state: 'pass', detail: 'Received 48 metric series in the last 5 minutes.' });
        } else if (sig === 'logs') {
          if (scenario === 'realistic' && n('logs') < 1) {
            out.push({ id: 'logs', state: 'fail',
              detail: 'Received 1,204 log lines, but none are valid JSON, so they can’t be searched by field (for example, level or order ID).',
              short: 'Switch your logger to JSON output and redeploy',
              cause: 'Your logger is writing plain text, like this line we received: 2026-11-06 09:14:02 INFO Accrual batch 8812 complete',
              fix: { text: 'Switch your logger to JSON. For Spring Boot with Logback, add this encoder to logback-spring.xml and redeploy:',
                code: '<appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">\n  <encoder class="net.logstash.logback.encoder.LogstashEncoder"/>\n</appender>',
                more: 'Using Node.js or Python? Use pino (Node.js) or python-json-logger (Python). Any JSON with timestamp, level and message works.' } });
          } else {
            out.push({ id: 'logs', state: 'pass', detail: 'Received 1,180 log lines. All of them are valid JSON with timestamp, level and message.',
              note: logInc ? `Heads-up: log search in ${tel.region(app.region).name} is running about ${logInc.lagMinutes} minutes behind (${logInc.id}). Your logs are fine and nothing needs fixing, but they may take longer to show up in search.` : null });
          }
        } else if (sig === 'traces') {
          if (scenario === 'realistic' && n('traces') < 1) {
            out.push({ id: 'traces', state: 'waiting', detail: 'No traces yet.',
              cause: 'Traces only appear when real requests go through your service. Health checks aren’t traced.',
              fix: { text: 'Send a few real requests (for example, run your qa smoke tests), then check again.' } });
          } else {
            out.push({ id: 'traces', state: 'pass', detail: 'Received 37 traces. Trace context is passing between 2 services.' });
          }
        }
      });
      out.forEach((c) => { c.label = CHECK_LABEL[c.id]; c.blocking = validation.blocking.includes(c.id); });
      return out;
    },
    summary(checks) {
      const count = (s) => checks.filter((c) => c.state === s).length;
      return { pass: count('pass'), fail: count('fail'), waiting: count('waiting'), skipped: count('skipped'),
        blocked: checks.some((c) => c.blocking && c.state === 'fail'), total: checks.length };
    },
  };
  OperA.validation = validation;

  /* =====================================================================
   * Onboarding requests: merged seed + user requests, next action model
   * ===================================================================== */
  const STAGES = ['Submitted', 'Validated', 'Approved', 'Set up', 'Data flowing'];
  const requests = {
    STAGES,
    all() {
      const merge = (r) => {
        const o = state.requestOverrides[r.id] || {};
        const m = Object.assign({}, r, o, { history: [ ...r.history, ...(o.historyAdd || []) ] });
        m.attempts = Object.assign({}, r.attempts || {}, o.attempts || {});
        const app = reg.app(m.camrId);
        m.checks = app ? validation.run({ app, service: m.service, component: m.component, env: m.env, signals: m.signals }, m.scenario, m.attempts) : [];
        return m;
      };
      return [ ...state.requests.map(merge), ...D.requests.map(merge) ].sort((a, b) => b.createdAt - a.createdAt);
    },
    get(id) { return requests.all().find((r) => r.id === id) || null; },
    override(id, patch, historyText) {
      const o = (state.requestOverrides[id] = state.requestOverrides[id] || {});
      Object.assign(o, patch);
      if (historyText) (o.historyAdd = o.historyAdd || []).push({ at: Date.now(), text: historyText });
      store.save();
    },
    stageIndex(r) {
      return { 'action-needed': 1, 'awaiting-approval': 2, rejected: 2, provisioning: 3, receiving: 4, complete: 5 }[r.status] ?? 0;
    },
    /** Who has to do what next — the single most important line on any request. */
    next(r) {
      const failing = (r.checks || []).filter((c) => c.state === 'fail');
      const waiting = (r.checks || []).filter((c) => c.state === 'waiting');
      switch (r.status) {
        case 'action-needed':
          return { owner: 'you', tone: 'danger', text: `${failing.map((c) => c.short || `Fix ${CHECK_LABEL[c.id].toLowerCase()}`).join('. ') || 'Fix the failed check'}, then choose “check again”.` };
        case 'awaiting-approval': {
          // Reminders: allowed once the request has waited a day, then at most once every 24 hours.
          const DAY_MIN = 60 * 24;
          const sinceRemind = r.reminderAt ? fmt.minsSince(r.reminderAt) : null;
          return { owner: 'approver', tone: 'info', text: `Waiting for ${r.approver} to approve. ${r.env === 'prod' ? 'Production requests need app owner approval.' : 'The requester isn’t on the owning team, so the app owner approves.'} Waiting ${fmt.dur(fmt.minsSince(r.createdAt))}.`,
            canRemind: fmt.minsSince(r.createdAt) > DAY_MIN && (sinceRemind === null || sinceRemind > DAY_MIN), reminded: sinceRemind !== null && sinceRemind <= DAY_MIN };
        }
        case 'rejected':
          return { owner: 'you', tone: 'danger', text: `${r.approver} didn’t approve this request: “${r.rejectReason}”. Update it and resubmit, or reply to ${r.approver}.` };
        case 'provisioning':
          return { owner: 'platform', tone: 'info', text: `Nothing for you to do. The platform is creating storage and dashboards automatically (about ${r.etaMinutes || 15} minutes).` +
            (waiting.length ? ` OperA will also keep checking for ${waiting.map((c) => c.id).join(' and ')}.` : '') };
        case 'receiving':
          return { owner: 'platform', tone: 'info', text: 'Set up is done. Waiting to see data flow steadily for 15 minutes.' };
        case 'complete':
          return { owner: 'none', tone: 'success', text: 'Done. Data is flowing and your dashboard is ready.' };
        default:
          return { owner: 'you', tone: 'info', text: 'Finish and submit your request.' };
      }
    },
    ownerLabel: { you: 'You', approver: 'Approver', platform: 'Platform (automatic)', none: 'No one' },
  };
  OperA.requests = requests;

  /* =====================================================================
   * Router
   * ===================================================================== */
  const routes = [];
  OperA.route = (pattern, view) => routes.push([pattern, view]);
  OperA.views = {};
  OperA.current = { path: '/home', params: [], query: {} };

  function parseHash() {
    const h = (location.hash || '#/home').slice(1);
    const [path, qs] = h.split('?');
    const query = {};
    new URLSearchParams(qs || '').forEach((v, k) => { query[k] = v; });
    return { path: path || '/home', query };
  }
  OperA.go = (hash) => { if (location.hash === hash) OperA.render(); else location.hash = hash; };

  /* Wide tables scroll sideways inside their own box on small screens. When one does,
     make the box focusable and named so keyboard and screen-reader users can scroll it. */
  OperA.markScrollable = function (root = document.getElementById('main')) {
    root.querySelectorAll('.table-wrap').forEach((el) => {
      if (el.scrollWidth > el.clientWidth + 1) {
        el.tabIndex = 0; el.setAttribute('role', 'region');
        const cap = el.querySelector('caption');
        el.setAttribute('aria-label', `${cap ? cap.textContent.trim() : 'Table'} (scrolls sideways)`);
      } else if (el.hasAttribute('tabindex')) {
        el.removeAttribute('tabindex'); el.removeAttribute('role'); el.removeAttribute('aria-label');
      }
    });
  };
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => OperA.markScrollable(), 150); });

  let firstRender = true;
  OperA.render = function ({ keepFocus = false } = {}) {
    const { path, query } = parseHash();
    let match = null;
    for (const [re, view] of routes) { const m = path.match(re); if (m) { match = { view, params: m.slice(1) }; break; } }
    const main = document.getElementById('main');
    OperA.applyDesign();
    const scrollY = window.scrollY;
    // Panes that scroll on their own (Console layout) keep their position across re-renders.
    const paneScroll = {};
    main.querySelectorAll('[data-scroll-key]').forEach((el) => { paneScroll[el.dataset.scrollKey] = el.scrollTop; });
    const activeId = document.activeElement && document.activeElement.id;
    let focusHandled = false;
    if (!match) {
      main.innerHTML = String(OperA.ui.notFound(path));
      document.title = 'Page not found · OperA';
    } else {
      OperA.current = { path, params: match.params, query, view: match.view };
      main.innerHTML = String(match.view.render(match.params, query));
      document.title = `${match.view.title(match.params, query)} · OperA`;
      // A view's mount() returns true when it has moved focus itself (e.g. to an error summary).
      if (match.view.mount) focusHandled = match.view.mount(main, match.params, query) === true;
    }
    OperA.ui.renderNav();
    if (OperA.assistant) OperA.assistant.onRoute();
    OperA.markScrollable(main);
    main.querySelectorAll('[data-scroll-key]').forEach((el) => {
      const y = paneScroll[el.dataset.scrollKey];
      if (y && (keepFocus || el.dataset.scrollKeep === 'route')) el.scrollTop = y;
    });
    if (focusHandled) {
      // leave focus where the view put it
    } else if (keepFocus) {
      window.scrollTo(0, scrollY);
      const el = activeId && document.getElementById(activeId);
      if (el) el.focus({ preventScroll: true });
    } else {
      window.scrollTo(0, 0);
      const h1 = main.querySelector('h1');
      if (h1) h1.setAttribute('tabindex', '-1');
      // On route changes, move focus to the new page's heading so screen readers announce it.
      // On first load, leave focus at the top of the document so the skip link comes first.
      if (h1 && !firstRender) h1.focus({ preventScroll: true });
    }
    firstRender = false;
  };
  OperA.refresh = () => OperA.render({ keepFocus: true });

  /* =====================================================================
   * Event delegation: data-action (click), data-form (submit),
   * data-input (input), data-change (change)
   * ===================================================================== */
  OperA.actions = {}; OperA.forms = {}; OperA.inputs = {}; OperA.changes = {};
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    const fn = OperA.actions[el.dataset.action];
    if (!fn) return;
    if (el.tagName === 'A') e.preventDefault();
    fn(el, e);
  });
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    const fn = OperA.forms[form.dataset.form];
    if (fn) fn(form, e);
  });
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]');
    if (el && OperA.inputs[el.dataset.input]) OperA.inputs[el.dataset.input](el, e);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (el && OperA.changes[el.dataset.change]) OperA.changes[el.dataset.change](el, e);
  });

  /* =====================================================================
   * Feedback: toast + screen-reader announcements
   * ===================================================================== */
  OperA.toast = function (message, tone = 'success') {
    const region = document.getElementById('toast-region');
    const t = document.createElement('div');
    t.className = `toast toast-${tone}`;
    t.textContent = message;
    region.appendChild(t);
    setTimeout(() => { t.classList.add('toast-out'); setTimeout(() => t.remove(), 400); }, 6000);
  };
  OperA.announce = function (message) {
    const el = document.getElementById('sr-announcer');
    el.textContent = '';
    setTimeout(() => { el.textContent = message; }, 50);
  };

  /* =====================================================================
   * Modal (native <dialog>: focus trap + Esc for free; we restore focus)
   * ===================================================================== */
  let lastFocus = null; let lastFocusSel = null;
  OperA.modal = {
    open({ title, body, form, submitLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'primary', wide = false, data = {} }) {
      const dlg = document.getElementById('modal');
      lastFocus = document.activeElement;
      lastFocusSel = lastFocus ? { id: lastFocus.id, action: lastFocus.dataset && lastFocus.dataset.action, alert: lastFocus.dataset && lastFocus.dataset.alert } : null;
      const dataAttrs = Object.entries(data).map(([k, v]) => ` data-${esc(k)}="${esc(v)}"`).join('');
      dlg.className = wide ? 'modal-wide' : '';
      dlg.innerHTML = String(html`
        <form class="modal-form" data-form="${form || 'noop'}" novalidate${raw(dataAttrs)}>
          <div class="modal-head">
            <h2 id="modal-title">${title}</h2>
            <button type="button" class="icon-btn" data-action="modal-close"><span class="sr-only">Close dialog</span>${OperA.ui.icon('x')}</button>
          </div>
          <div class="modal-body">${body}</div>
          <div class="modal-foot">
            <button type="button" class="btn" data-action="modal-close">${cancelLabel}</button>
            ${form ? html`<button type="submit" class="btn btn-${tone}">${submitLabel}</button>` : ''}
          </div>
        </form>`);
      dlg.showModal();
      const first = dlg.querySelector('.modal-body input:not([type=hidden]), .modal-body textarea, .modal-body select');
      (first || dlg.querySelector('[type=submit]') || dlg.querySelector('button')).focus();
    },
    close() {
      const dlg = document.getElementById('modal');
      if (dlg.open) dlg.close();
    },
    restoreFocus() {
      let el = lastFocus && document.contains(lastFocus) ? lastFocus : null;
      const sel = lastFocusSel;
      if (!el && sel && sel.id) el = document.getElementById(sel.id);
      if (!el && sel && sel.action) el = document.querySelector(`#main [data-action="${CSS.escape(sel.action)}"]${sel.alert ? `[data-alert="${CSS.escape(sel.alert)}"]` : ''}`);
      if (!el) el = document.querySelector('#main h1');
      if (el) el.focus();
      lastFocus = null; lastFocusSel = null;
    },
    /** Show a field error inside the modal and focus the field. */
    fieldError(form, name, message) {
      const field = form.elements[name];
      const err = form.querySelector(`[data-error-for="${name}"]`);
      if (err) { err.textContent = message; err.hidden = !message; }
      if (field && field.setAttribute) { field.setAttribute('aria-invalid', message ? 'true' : 'false'); if (message) field.focus(); }
      return !message;
    },
  };
  OperA.actions['modal-close'] = () => OperA.modal.close();
  OperA.forms.noop = () => OperA.modal.close();
})();
