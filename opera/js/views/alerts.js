/* OperA — alert queue and alert detail */
(function () {
  'use strict';
  const OperA = window.OperA;
  const { html, raw, fmt, reg, tel, alerts, store, ui } = OperA;
  const D = OperA.data;

  /* ---------------- queue ---------------- */
  OperA.views.alerts = {
    title: () => 'Alerts',
    render(_, q) {
      const role = store.state.role;
      const ds = store.state.proto.dataSource;
      const scope = q.scope || (role === 'app' ? 'mine' : 'all');
      const status = q.status || 'open';
      const verdict = q.verdict || 'any';
      const appF = q.app || '';
      const envF = q.env || '';
      let list = alerts.all();
      if (status === 'open') list = list.filter((a) => a.status !== 'resolved');
      if (status === 'new') list = list.filter((a) => a.status === 'new');
      if (scope === 'mine') list = list.filter((a) => D.personas.app.apps.includes(a.camrId));
      if (appF) list = list.filter((a) => a.camrId === appF);
      if (envF) list = list.filter((a) => a.env === envF);
      const rows = alerts.sort(list).map((a) => ({ a, as: tel.assess(a) }));
      let filtered = rows;
      if (verdict === 'app') filtered = rows.filter((x) => x.as.verdict === 'application');
      if (verdict === 'not-app') filtered = rows.filter((x) => x.as.verdict !== 'application');
      if (q.gap) filtered = filtered.filter((x) => !reg.app(x.a.camrId).onCall || !x.a.runbook);
      const qs = (patch) => '#/alerts?' + new URLSearchParams(Object.entries(Object.assign({ scope, status, verdict, app: appF, env: envF }, patch)).filter(([, v]) => v)).toString();
      const sel = (id, label, name, opts, value) => html`<div class="field"><label for="${id}">${label}</label><select id="${id}" data-change="alerts-filter" data-key="${name}">${opts.map(([v, l]) => html`<option value="${v}" ${v === value ? raw('selected') : ''}>${l}</option>`)}</select></div>`;

      let body;
      if (ds === 'error') body = ui.errorState({ title: 'We couldn’t load alerts', body: 'The alerting service didn’t respond. Paging still works. On-call engineers are notified directly.', cached: 'If this continues, use the incident channel #prod-ops and check Telemetry health.' });
      else if (ds === 'empty' || !filtered.length) body = ui.emptyState({ title: rows.length && !filtered.length ? 'No alerts match these filters' : 'No open alerts', body: rows.length && !filtered.length ? 'Try clearing a filter.' : 'Nothing is alerting right now.',
        action: rows.length && !filtered.length ? html`<a class="btn" href="#/alerts">Clear filters</a>` : '' });
      else body = html`<div class="table-wrap"><table class="table">
        <caption class="sr-only">Alerts, most urgent first</caption>
        <thead><tr><th scope="col">Severity</th><th scope="col">Alert</th><th scope="col">Responsible team</th><th scope="col">App or telemetry?</th><th scope="col">Status</th><th scope="col">Next step</th></tr></thead>
        <tbody>${filtered.map(({ a, as }) => {
          const app = reg.app(a.camrId);
          const n = alerts.nextStep(a);
          return html`<tr>
            <td>${ui.sev(a.severity)}</td>
            <td style="min-width:240px"><a class="row-title" href="#/alerts/${a.id}">${a.title}</a>
              <div class="row-sub">${a.id} · ${app.name} · <span class="mono">${a.service}/${a.component}</span> · ${ui.envTag(a.env)} · ${a.status === 'resolved' ? `resolved ${fmt.rel(a.resolvedAt || a.startedAt)}` : html`started ${ui.timeAgo(a.startedAt)}`}</div></td>
            <td><div class="row-title" style="font-weight:600">${app.owningTeam}</div><div class="row-sub">${app.onCall ? `On-call: ${app.onCall.primary}` : html`<span class="chip chip-warn">${ui.icon('alert')}No on-call registered</span>`}</div></td>
            <td>${ui.verdictChip(as.verdict)}${a.linkedIncident ? html`<div class="row-sub">Linked to ${a.linkedIncident}</div>` : ''}</td>
            <td><div class="cell-stack">${ui.alertStatus(a.status)}${a.assignee ? html`<span class="row-sub">${a.assignee}</span>` : ''}</div></td>
            <td class="small" style="min-width:200px">${n.text}</td></tr>`;
        })}</tbody></table></div>`;

      const apps = D.applications.filter((a) => a.status === 'active');
      return html`
        ${ui.pageHead({ title: role === 'app' && scope === 'mine' ? 'Alerts on my applications' : 'Alerts',
          lead: 'Most urgent first. Each alert shows who owns it, whether it’s likely the application or the telemetry, and what to do next.' })}
        ${ui.incidentBanner()}
        <div class="toolbar">
          <div class="field"><span class="field-label" id="lbl-scope">Applications</span><div class="seg" role="group" aria-labelledby="lbl-scope">
            <button type="button" data-action="nav" data-href="${qs({ scope: 'mine' })}" aria-pressed="${scope === 'mine'}">Mine</button>
            <button type="button" data-action="nav" data-href="${qs({ scope: 'all' })}" aria-pressed="${scope === 'all'}">All</button></div></div>
          ${sel('f-status', 'Status', 'status', [ ['open', 'Open'], ['new', 'New (not acknowledged)'], ['all', 'All, including resolved'] ], status)}
          ${sel('f-verdict', 'App or telemetry?', 'verdict', [ ['any', 'Any'], ['app', 'Likely application'], ['not-app', 'Telemetry or unclear'] ], verdict)}
          ${sel('f-app', 'Application', 'app', [ ['', 'Any application'], ...apps.map((a) => [a.camrId, a.name]) ], appF)}
          ${sel('f-env', 'Environment', 'env', [ ['', 'Any'], ...D.envs.map((e) => [e, e]) ], envF)}
          ${q.gap ? html`<a class="btn btn-sm" href="${qs({})}">${ui.icon('x')}Showing gaps only</a>` : ''}
        </div>
        <p class="muted small" aria-live="polite">${fmt.plural(ds === 'normal' ? filtered.length : 0, 'alert')}</p>
        ${body}`;
    },
  };
  OperA.changes['alerts-filter'] = (el) => {
    const q = Object.assign({}, OperA.current.query, { [el.dataset.key]: el.value });
    Object.keys(q).forEach((k) => { if (!q[k]) delete q[k]; });
    location.hash = '#/alerts?' + new URLSearchParams(q).toString();
    setTimeout(() => { const s = document.getElementById(el.id); if (s) s.focus(); }, 0);
  };
  OperA.route(/^\/alerts$/, OperA.views.alerts);

  /* ---------------- detail ---------------- */
  const EV_ICON = { good: 'check', bad: 'x', warn: 'alert', info: 'info' };
  const evidenceList = (items) => html`<ul class="evidence">${items.map((e) => html`<li class="ev-${e.type}"><span class="ev-icon">${ui.icon(EV_ICON[e.type])}<span class="sr-only">${{ good: 'Healthy:', bad: 'Problem:', warn: 'Caution:', info: 'Note:' }[e.type]}</span></span><span>${e.text}${e.href ? html` <a href="${e.href}">Details</a>` : ''}</span></li>`)}</ul>`;

  function runbookCard(a, as) {
    let rb = reg.runbook(a.runbook);
    const fallback = !rb;
    if (!rb) rb = reg.runbook(as.verdict === 'telemetry' ? 'RB-900' : 'RB-000');
    const app = reg.app(a.camrId);
    const stale = reg.runbookStale(rb);
    const nextIdx = rb.steps.findIndex((_, i) => !a.stepsDone.includes(i));
    const linkBtn = (kind) => {
      const label = { metrics: 'Open metrics', logs: 'Open logs', traces: 'Open traces', changes: 'Recent changes', health: 'Telemetry health' }[kind];
      if (kind === 'health') return html`<a class="btn btn-sm" href="#/health">${ui.icon('activity')}${label}</a>`;
      return html`<button type="button" class="btn btn-sm" data-action="explore" data-alert="${a.id}" data-signal="${kind}">${ui.icon(kind === 'changes' ? 'commit' : 'search')}${label}</button>`;
    };
    const actBtn = (act) => {
      if (act.type === 'remediation') return alerts.get(a.id).approvals.some((p) => p.state === 'pending') ? html`<span class="chip chip-info">${ui.icon('shield')}Approval requested</span>`
        : html`<button type="button" class="btn btn-sm btn-primary" data-action="remediate" data-alert="${a.id}">${ui.icon('shield')}${act.label}</button>`;
      if (act.type === 'escalate') return html`<button type="button" class="btn btn-sm" data-action="escalate" data-alert="${a.id}">${ui.icon('bell')}${act.label}</button>`;
      if (act.type === 'link-incident') return as.incident ? html`<button type="button" class="btn btn-sm" data-action="link-incident" data-alert="${a.id}" ${a.linkedIncident ? raw('disabled') : ''}>${ui.icon('link')}${a.linkedIncident ? `Linked to ${a.linkedIncident}` : `Link to ${as.incident.id}`}</button>` : '';
      return '';
    };
    return html`<section class="card" aria-labelledby="h-rb">
      <div class="card-head"><h2 class="card-title" id="h-rb">${ui.icon('book')}Handling procedure</h2><span class="small muted">${a.stepsDone.length} of ${rb.steps.length} steps done</span></div>
      ${fallback ? ui.callout('warn', 'No procedure is linked to this alert', html`<p>Using <strong>${rb.title}</strong> instead. Generic steps are slower, so ask ${app.owningTeam} to add a procedure once this is handled.</p>`,
        html`<button type="button" class="btn btn-sm" data-action="request-runbook" data-alert="${a.id}">Ask ${app.owningTeam} for a procedure</button>`) : ''}
      <p><a href="#/runbooks/${rb.id}"><strong>${rb.title}</strong></a> <span class="muted small">· Owner ${rb.owner} · Reviewed ${fmt.date(new Date(rb.lastReviewed).getTime())}</span></p>
      ${stale ? ui.callout('warn', 'This procedure is overdue for review', html`<p>It was last reviewed more than 6 months ago, so some steps may be out of date. Follow it, but confirm anything risky with ${rb.owner}.</p>`) : ''}
      <p class="small">${rb.summary}</p>
      <ol class="rb-steps">${rb.steps.map((s, i) => {
        const done = a.stepsDone.includes(i);
        return html`<li class="rb-step ${done ? 'is-done' : ''} ${i === nextIdx && a.status !== 'resolved' ? 'is-next' : ''}">
          <input type="checkbox" class="rb-check" id="rb-${a.id}-${i}" data-change="rb-step" data-alert="${a.id}" data-idx="${i}" ${done ? raw('checked') : ''} aria-describedby="rb-${a.id}-${i}-body" />
          <div><label for="rb-${a.id}-${i}" class="rb-title"><span class="rb-num">${i + 1}.</span>${s.title}</label>${i === nextIdx && a.status !== 'resolved' ? html`<span class="next-tag">Next</span>` : ''}
            <p class="rb-body" id="rb-${a.id}-${i}-body">${s.body}</p>
            ${s.decision ? html`<p class="rb-decision"><strong>Decision:</strong> ${s.decision}</p>` : ''}
            ${(s.links || s.action) ? html`<div class="rb-actions">${(s.links || []).map(linkBtn)}${s.action ? actBtn(s.action) : ''}</div>` : ''}</div></li>`;
      })}</ol></section>`;
  }

  OperA.views.alertDetail = {
    title: ([id]) => (alerts.get(id) ? `${id} · ${alerts.get(id).title}` : 'Alert not found'),
    render([id]) {
      const a = alerts.get(id);
      if (!a) return html`${ui.pageHead({ title: 'Alert not found', lead: `There’s no alert ${id}. It may have been closed and archived.`, crumbs: [ { href: '#/alerts', label: 'Alerts' }, { label: id } ] })}<a class="btn" href="#/alerts">All alerts</a>`;
      const app = reg.app(a.camrId);
      const as = tel.assess(a);
      const esc = alerts.escalation(a, as);
      const n = alerts.nextStep(a);
      const others = alerts.open().filter((x) => x.camrId === a.camrId && x.id !== a.id);
      const gaps = as.evidence.filter((e) => e.gap);
      const role = store.state.role;
      const actionBtn = (act, label, primary) => {
        if (act === 'ack') return html`<button type="button" class="btn ${primary ? 'btn-primary' : ''}" data-action="ack" data-alert="${a.id}">${ui.icon('user')}${label || 'Acknowledge'}</button>`;
        if (act === 'escalate') return html`<button type="button" class="btn ${primary ? 'btn-primary' : ''}" data-action="escalate" data-alert="${a.id}" ${esc.due ? raw(`data-target="${esc.due.key}"`) : ''}>${ui.icon('bell')}${label || 'Escalate'}</button>`;
        if (act === 'link-incident') return html`<button type="button" class="btn ${primary ? 'btn-primary' : ''}" data-action="link-incident" data-alert="${a.id}">${ui.icon('link')}${label}</button>`;
        if (act === 'resolve') return html`<button type="button" class="btn ${primary ? 'btn-primary' : ''}" data-action="resolve" data-alert="${a.id}">${ui.icon('check')}${label || 'Resolve'}</button>`;
        return '';
      };
      const pending = a.approvals.filter((p) => p.state === 'pending');
      return html`
        ${ui.pageHead({ crumbs: [ { href: '#/alerts', label: 'Alerts' }, { label: a.id } ],
          eyebrow: html`${ui.sev(a.severity)} ${a.id} · ${ui.envTag(a.env)} · ${ui.alertStatus(a.status)}${a.assignee ? html` <span class="muted">· ${a.assignee}</span>` : ''}`,
          title: a.title, lead: html`${app.name} <span class="mono small">${app.camrId}</span> · <span class="mono">${a.service}/${a.component}</span> · started ${ui.timeAgo(a.startedAt)} (${fmt.clock(a.startedAt)})` })}

        <div class="next-step tone-${n.tone === 'warn' ? 'warn' : n.tone}" role="region" aria-label="Next step">
          <div class="next-step-label">Next step</div>
          <div class="next-step-text">${n.text}</div>
          ${n.action ? actionBtn(n.action, n.label, true) : ''}
        </div>
        ${a.status !== 'resolved' ? html`<div class="btn-row" style="margin:-6px 0 18px">
          ${a.status === 'new' && n.action !== 'ack' ? actionBtn('ack') : ''}
          ${n.action !== 'escalate' ? actionBtn('escalate', 'Escalate or page someone') : ''}
          ${n.action !== 'resolve' ? actionBtn('resolve') : ''}
          <button type="button" class="btn btn-ghost" data-action="open-assistant" data-prompt="summary">${ui.icon('sparkle')}Ask OperA to summarize</button>
        </div>` : ''}

        <div class="split">
          <div>
            <section class="card" aria-labelledby="h-what">
              <h2 class="card-title" id="h-what">${ui.icon('info')}What’s happening</h2>
              <p><strong>${a.summary}</strong></p>
              <p class="small"><strong>Impact:</strong> ${a.impact}</p>
              ${ui.lineChart(a)}
            </section>

            <section class="card" aria-labelledby="h-src">
              <h2 class="card-title" id="h-src">${ui.icon('activity')}Application or telemetry?</h2>
              <div class="verdict verdict-${as.verdict}">
                <div class="verdict-head">${ui.verdictChip(as.verdict)}<span class="verdict-title">${as.headline}</span></div>
                <p class="small">${as.guidance}</p>
                <p class="small muted">Confidence: ${as.confidence}. Based on the evidence below.</p>
              </div>
              <div class="signal-grid">${D.signals.map((s) => html`<div class="signal-cell"><div class="sig-name">${fmt.cap(s)}${s === a.signal ? html` <span class="muted small">(alert source)</span>` : ''}</div>${ui.freshChip(as.freshness[s])}<div class="sig-detail">${as.freshness[s].detail}</div></div>`)}</div>
              <h3 style="margin-top:16px">Evidence</h3>
              ${evidenceList(as.evidence)}
              ${gaps.length ? html`<p class="small" style="margin-top:12px">${role === 'app'
                ? html`<a href="#/onboard?app=${app.camrId}&service=${a.service}&component=${a.component}&env=${a.env}">Set up ${gaps.map((g) => g.gap).join(' and ')} for this component</a> so the next investigation has more to go on.`
                : html`<button type="button" class="link-btn" data-action="flag-gap" data-alert="${a.id}">Ask ${app.owningTeam} to set up ${gaps.map((g) => g.gap).join(' and ')}</button>`}</p>` : ''}
            </section>

            ${runbookCard(a, as)}

            ${a.approvals.length ? html`<section class="card" aria-labelledby="h-appr"><h2 class="card-title" id="h-appr">${ui.icon('shield')}Approvals</h2>
              <ul class="plain">${a.approvals.map((p) => html`<li style="padding:6px 0">
                ${p.state === 'pending' ? html`<span class="chip chip-info">${ui.icon('clock')}Waiting for ${p.approver}</span>` : p.state === 'approved' ? html`<span class="chip chip-success">${ui.icon('check')}Approved by ${p.approver}</span>` : html`<span class="chip chip-danger">${ui.icon('x')}Rejected by ${p.approver}</span>`}
                <strong>${p.title}</strong> <span class="muted small">· ${p.change} · requested ${fmt.rel(p.at)} by ${p.by}</span>
                ${p.reason ? html`<div class="small">“${p.reason}”</div>` : ''}
                ${p.state === 'pending' ? html`<div class="proto-inline">Prototype: simulate ${p.approver}’s decision <button type="button" class="btn btn-sm" data-action="approval-sim" data-alert="${a.id}" data-id="${p.id}" data-to="approved">Approve</button><button type="button" class="btn btn-sm" data-action="approval-sim" data-alert="${a.id}" data-id="${p.id}" data-to="rejected">Reject</button></div>` : ''}
              </li>`)}</ul></section>` : ''}

            <section class="card" aria-labelledby="h-activity">
              <h2 class="card-title" id="h-activity">${ui.icon('clock')}Activity</h2>
              <form data-form="alert-note" data-alert="${a.id}" class="field" novalidate>
                <label for="note-${a.id}">Add a note for the next responder</label>
                <textarea id="note-${a.id}" name="note" rows="2" placeholder="What you checked and what you found"></textarea>
                <p class="error-msg" data-error-for="note" hidden></p>
                <button type="submit" class="btn btn-sm" style="margin-top:8px">Add note</button>
              </form>
              ${a.timeline.length ? html`<ol class="timeline">${a.timeline.map((t) => html`<li><div><strong>${t.who}</strong> · ${t.text}</div><div class="tl-meta">${ui.timeAgo(t.at)}</div></li>`)}</ol>` : html`<p class="muted small">No activity yet.</p>`}
            </section>
          </div>

          <div class="stack">
            ${ui.ownership(app, { title: 'Responsible team' })}
            <section class="card" aria-labelledby="h-esc">
              <h2 class="card-title" id="h-esc">${ui.icon('bell')}Escalation path</h2>
              <p class="small muted">${as.verdict === 'telemetry' ? 'Routed to the Telemetry Platform team because this is a telemetry problem.' : `Tier ${app.tier} policy. Alert age: ${fmt.dur(esc.age)}.`}</p>
              ${a.holdPaging ? ui.callout('tel', 'Application paging is on hold', html`<p>${app.owningTeam} won’t be paged for this alert while ${a.linkedIncident} is open. It reopens automatically if the alert still fires 15 minutes after the incident is resolved.</p>`) : ''}
              ${ui.escalationLadder(esc, a.status === 'resolved' ? null : a)}
            </section>
            <section class="card" aria-labelledby="h-inv">
              <h2 class="card-title" id="h-inv">${ui.icon('search')}Investigate</h2>
              <p class="small muted">Already filtered to ${a.service}/${a.component} in ${a.env}, around the alert time.</p>
              <ul class="plain">${D.signals.map((s) => html`<li style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0">
                <button type="button" class="link-btn" data-action="explore" data-alert="${a.id}" data-signal="${s}">${fmt.cap(s)}</button>${ui.freshChip(as.freshness[s])}</li>`)}
                <li style="padding:4px 0"><button type="button" class="link-btn" data-action="explore" data-alert="${a.id}" data-signal="changes">Recent changes</button> <span class="muted small">(${a.changes.length || 'none'} in 24 h)</span></li>
                ${app.dashboards.map((d) => html`<li style="padding:4px 0"><button type="button" class="link-btn" data-action="open-external" data-what="${d}">${d}</button> ${ui.icon('external')}</li>`)}</ul>
            </section>
            ${as.incident || others.length ? html`<section class="card" aria-labelledby="h-rel"><h2 class="card-title" id="h-rel">${ui.icon('link')}Related</h2><ul class="plain">
              ${as.incident ? html`<li><a href="#/health">${as.incident.id}</a> · ${as.incident.title}</li>` : ''}
              ${others.map((o) => html`<li><a href="#/alerts/${o.id}">${o.id}</a> · ${o.title}</li>`)}</ul></section>` : ''}
          </div>
        </div>`;
    },
    mount(root) { ui.mountCharts(root); },
  };
  OperA.route(/^\/alerts\/(ALR-\d+)$/, OperA.views.alertDetail);

  /* ---------------- explorer (pre-scoped telemetry) ---------------- */
  const SAMPLE_LOGS = {
    'ALR-2041': [ ['WARN', 'pricing quote slow duration_ms=1412 region=us-east'], ['INFO', 'checkout completed session=8f2a duration_ms=2980'], ['WARN', 'pricing quote slow duration_ms=1388'], ['INFO', 'deploy marker version=v2.14.0'] ],
    'ALR-2042': [ ['INFO', 'reconcile batch=88213 complete records=1176 errors=0'], ['INFO', 'reconcile batch=88212 complete records=1192 errors=0'], ['INFO', 'reconcile batch=88211 complete records=1169 errors=0'] ],
    'ALR-2040': [ ['INFO', 'committed offset partition=3 offset=9921842'], ['INFO', 'committed offset partition=1 offset=9920577'], ['INFO', 'consumer heartbeat ok members=6'] ],
    'ALR-2043': [ ['ERROR', 'score request failed: ModelTimeoutException after 250 ms'], ['ERROR', 'score request failed: ModelTimeoutException after 250 ms'], ['WARN', 'falling back to rules-only scoring'] ],
    'ALR-2044': [ ['ERROR', 'GET /api/settlements 502 upstream=reports-service connection refused'], ['ERROR', 'GET /api/reports/monthly 502 upstream=reports-service connection refused'], ['WARN', 'circuit breaker half-open upstream=reports-service'] ],
    'ALR-2039': [ ['WARN', 'provider=mailer-a status=429 rate limited retry_in=30s'], ['WARN', 'provider=mailer-a status=429 rate limited retry_in=30s'], ['INFO', 'retry-worker queue_depth=14112'] ],
  };
  const SAMPLE_TRACES = {
    'ALR-2041': [ ['POST /checkout (checkout-api)', '1,910 ms', '100%'], ['GET /quote (checkout-pricing)', '1,420 ms', '74%'], ['SELECT fx_rates (pricing-db)', '1,190 ms', '62%'], ['authorize (fraud-scoring-api)', '140 ms', '7%'] ],
    'ALR-2043': [ ['POST /score (fraud-scoring-api)', '262 ms', '100%'], ['infer (fraud-model-runner)', '250 ms (timeout)', '95%'] ],
    'ALR-2044': [ ['GET /api/settlements (merchant-portal-web)', '35 ms', '100%'], ['GET /reports (reports-service)', 'connection refused', '—'] ],
  };
  OperA.actions.explore = (el) => {
    const a = alerts.get(el.dataset.alert); const sig = el.dataset.signal;
    const app = reg.app(a.camrId); const as = tel.assess(a);
    const f = as.freshness[sig];
    const from = fmt.clock(a.startedAt - 15 * 60000);
    let body;
    if (sig === 'changes') {
      body = html`${a.changes.length ? html`<ul class="plain">${a.changes.map((c) => html`<li>${ui.icon('commit')} <strong>${c.text}</strong> · ${fmt.rel(c.at)} · ${c.by}${c.correlated ? html` <span class="chip chip-warn">${ui.icon('alert')}Just before the alert</span>` : ''}</li>`)}</ul>` : html`<p>No deploys or config changes to ${app.name} in the last 24 hours.</p>`}`;
    } else if (f.state === 'not-onboarded') {
      body = ui.callout('warn', `${fmt.cap(sig)} aren’t set up for ${a.service}/${a.component} in ${a.env}`, html`<p>There’s nothing to search. Use the signals that are set up. After the incident, ${app.owningTeam} can onboard ${sig} in about 15 minutes.</p>`,
        store.state.role === 'app' ? html`<a class="btn btn-sm" href="#/onboard?app=${app.camrId}&service=${a.service}&component=${a.component}&env=${a.env}">Set up ${sig}</a>` : '');
    } else {
      const query = `camr.id:"${app.camrId}" AND service.name:"${a.service}" AND app.component:"${a.component}" AND deployment.environment:"${a.env}"${sig === 'logs' ? ' AND level:(WARN OR ERROR)' : ''}  | from ${from} to now`;
      const notice = f.state === 'delayed' ? ui.callout('warn', `Logs are delayed about ${f.incident.lagMinutes} minutes (${f.incident.id})`, html`<p>Events from the last ${f.incident.lagMinutes} minutes may be missing. They’ll backfill automatically.</p>`)
        : f.state === 'missing' ? ui.callout('tel', `${fmt.cap(sig)} are missing or partial (${f.incident.id})`, html`<p>${f.incident.impact}</p>`) : '';
      let results;
      if (sig === 'logs') { const lines = SAMPLE_LOGS[a.id] || [ ['INFO', 'no warnings or errors in this window'] ];
        results = html`<pre class="log-lines" tabindex="0" aria-label="Sample log lines">${lines.map(([lvl, msg], i) => html`<span class="lvl-${lvl.toLowerCase()}">${fmt.clock(Date.now() - (i + 1) * 47000)} ${lvl.padEnd(5)} ${a.service} ${msg}</span>\n`)}</pre>`; }
      else if (sig === 'traces') { const spans = SAMPLE_TRACES[a.id];
        results = spans ? html`<table class="table table-compact"><caption class="sr-only">Slowest span breakdown</caption><thead><tr><th scope="col">Span (slowest trace)</th><th scope="col" class="num">Duration</th><th scope="col" class="num">Share</th></tr></thead><tbody>${spans.map(([s, d, p]) => html`<tr><td class="mono small">${s}</td><td class="num">${d}</td><td class="num">${p}</td></tr>`)}</tbody></table>`
          : html`<p class="small">No slow or failed traces in this window.</p>`; }
      else results = html`${ui.lineChart(a, { height: 160 })}`;
      body = html`${notice}<p class="small"><strong>Scope:</strong> ${app.name} · <span class="mono">${a.service}/${a.component}</span> · ${a.env} · from ${from}</p>
        ${ui.codeBlock(query, 'Query (paste into your observability tool)')}
        <h3 style="margin:12px 0 6px">Sample results</h3>${results}`;
    }
    OperA.modal.open({ title: sig === 'changes' ? `Recent changes · ${app.name}` : `${fmt.cap(sig)} · ${a.service}/${a.component} · ${a.env}`, body, wide: true, cancelLabel: 'Close' });
    if (sig === 'metrics') ui.mountCharts(document.getElementById('modal'));
  };

  /* ---------------- actions ---------------- */
  const me = () => reg.persona().name;
  OperA.actions.ack = (el) => {
    const id = el.dataset.alert; const st = alerts.st(id);
    st.status = 'acknowledged'; st.assignee = me();
    alerts.log(id, 'Acknowledged and took ownership.');
    OperA.refresh(); OperA.toast(`${id} acknowledged. You’re the owner now.`);
  };
  OperA.changes['rb-step'] = (el) => {
    const id = el.dataset.alert; const idx = Number(el.dataset.idx); const st = alerts.st(id);
    const a = alerts.get(id);
    const rb = reg.runbook(a.runbook) || reg.runbook(tel.assess(a).verdict === 'telemetry' ? 'RB-900' : 'RB-000');
    st.stepsDone = el.checked ? Array.from(new Set([...(st.stepsDone || []), idx])) : (st.stepsDone || []).filter((i) => i !== idx);
    if (el.checked) alerts.log(id, `Completed procedure step ${idx + 1}: ${rb.steps[idx].title}.`);
    store.save(); OperA.refresh();
  };
  OperA.forms['alert-note'] = (form) => {
    const note = form.elements.note.value.trim();
    if (!OperA.modal.fieldError(form, 'note', note ? '' : 'Write a short note before adding it.')) return;
    alerts.log(form.dataset.alert, `Note: ${note}`);
    OperA.refresh(); OperA.toast('Note added.');
  };
  OperA.actions['request-runbook'] = (el) => {
    const a = alerts.get(el.dataset.alert); const app = reg.app(a.camrId);
    alerts.log(a.id, `Asked ${app.owningTeam} to add a handling procedure for “${a.metric.name}” alerts.`);
    OperA.refresh(); OperA.toast(`Request sent to ${app.owningTeam} (${app.appOwner}).`);
  };
  OperA.actions['flag-gap'] = (el) => {
    const a = alerts.get(el.dataset.alert); const app = reg.app(a.camrId);
    alerts.log(a.id, `Flagged a telemetry coverage gap to ${app.owningTeam}.`);
    OperA.refresh(); OperA.toast(`${app.owningTeam} will see this on their home page as a coverage gap, with a link to set it up.`);
  };

  /* Escalate / page — always a deliberate human action, with context attached. */
  function contextPacket(a) {
    const as = tel.assess(a); const app = reg.app(a.camrId);
    return [
      `${a.id} · ${a.severity.toUpperCase()} · ${a.title}`,
      `${app.name} (${app.camrId}) · ${a.service}/${a.component} · ${a.env}`,
      `Started ${fmt.rel(a.startedAt)}. ${a.summary}`,
      `Impact: ${a.impact}`,
      `Assessment: ${as.headline} (confidence ${as.confidence}).`,
      ...as.evidence.slice(0, 4).map((e) => `- ${e.text}`),
      `Procedure steps done: ${a.stepsDone.length ? a.stepsDone.map((i) => i + 1).join(', ') : 'none yet'}`,
      `Open in OperA: #/alerts/${a.id}`,
    ].join('\n');
  }
  OperA.contextPacket = contextPacket;
  OperA.actions.escalate = (el) => {
    const a = alerts.get(el.dataset.alert); const as = tel.assess(a); const esc = alerts.escalation(a, as);
    const choices = esc.steps.filter((s) => s.key !== 'noc' && s.state !== 'done');
    const pre = el.dataset.target || (esc.due && esc.due.key) || (choices[0] && choices[0].key);
    if (!choices.length) { OperA.toast('Everyone on the escalation path has already been paged or has acknowledged.', 'info'); return; }
    OperA.modal.open({
      title: `Escalate ${a.id}`, form: 'escalate', submitLabel: 'Send page', wide: true, data: { alert: a.id },
      body: html`<fieldset class="field"><legend>Who should be paged?</legend><div class="choice-list">${choices.map((s, i) => html`<label class="choice"><input type="radio" name="target" value="${s.key}" id="esc-t-${i}" ${s.key === pre ? raw('checked') : ''} />
          <span class="choice-body"><span class="choice-title">${s.who}${s.state === 'due' ? html`<span class="chip chip-danger">${ui.icon('bell')}Due now</span>` : ''}${s.gap ? html`<span class="chip chip-warn">${ui.icon('alert')}Business hours only</span>` : ''}</span><span class="choice-desc">${s.role}</span></span></label>`)}</div>
          <p class="error-msg" data-error-for="target" hidden></p></fieldset>
        <div class="field"><label for="esc-reason">Why are you escalating?</label><p class="hint" id="esc-reason-hint">One or two sentences. This goes at the top of the page.</p>
          <textarea id="esc-reason" name="reason" rows="2" aria-describedby="esc-reason-hint"></textarea><p class="error-msg" data-error-for="reason" hidden></p></div>
        <p class="field-label">Context sent with the page</p><p class="hint">Attached automatically, so the responder doesn’t have to ask you for it.</p>
        <pre class="packet" tabindex="0" aria-label="Context sent with the page">${contextPacket(a)}</pre>`,
    });
  };
  OperA.forms.escalate = (form) => {
    const target = form.querySelector('input[name="target"]:checked');
    const reason = form.elements.reason.value.trim();
    const ok1 = OperA.modal.fieldError(form, 'target', target ? '' : 'Choose who to page.');
    const ok2 = OperA.modal.fieldError(form, 'reason', reason.length >= 10 ? '' : 'Add a short reason (at least 10 characters) so the responder knows why.');
    if (!ok1 || !ok2) return;
    const a = alerts.get(form.dataset.alert); const t = alerts.resolveTarget(reg.app(a.camrId), target.value, tel.assess(a));
    const st = alerts.st(a.id);
    st.escalations.push({ target: target.value, at: Date.now(), by: me(), reason });
    if (!st.status || st.status === 'new') { st.status = 'investigating'; st.assignee = st.assignee || me(); }
    alerts.log(a.id, `Paged ${t.who} (${t.role}) with context attached. Reason: ${reason}`);
    OperA.modal.close(); OperA.refresh();
    OperA.toast(`Paged ${t.who}. They’ll get the alert summary, the assessment and what you’ve already checked.`);
  };

  /* Link to telemetry incident */
  OperA.actions['link-incident'] = (el) => {
    const a = alerts.get(el.dataset.alert); const as = tel.assess(a); const app = reg.app(a.camrId);
    if (!as.incident) return;
    OperA.modal.open({
      title: `Link ${a.id} to ${as.incident.id}`, form: 'link-incident', submitLabel: `Link to ${as.incident.id}`, data: { alert: a.id },
      body: html`<p>${as.incident.title}. ${as.incident.impact}</p>
        <p class="small">Linking tells everyone this alert is explained by a telemetry problem, and assigns it to you.</p>
        <label class="radio-row"><input type="checkbox" name="hold" /><span><strong>Hold paging ${app.owningTeam} for this alert while ${as.incident.id} is open</strong><br /><span class="muted small">Recommended when other signals show the application is healthy. It reopens automatically if the alert still fires 15 minutes after the incident is resolved.</span></span></label>`,
    });
  };
  OperA.forms['link-incident'] = (form) => {
    const a = alerts.get(form.dataset.alert); const as = tel.assess(a); const app = reg.app(a.camrId);
    const st = alerts.st(a.id);
    st.linkedIncident = as.incident.id; st.holdPaging = form.elements.hold.checked;
    st.status = a.status === 'new' ? 'investigating' : a.status; st.assignee = st.assignee || me();
    alerts.log(a.id, `Linked to ${as.incident.id}.${st.holdPaging ? ` Paging for ${app.owningTeam} is on hold until the incident is resolved.` : ''}`);
    OperA.modal.close(); OperA.refresh();
    OperA.toast(`Linked to ${as.incident.id}.${st.holdPaging ? ` ${app.owningTeam} won’t be paged for it.` : ''}`);
  };

  /* Remediation — two-person rule: request approval, never execute directly. */
  OperA.actions.remediate = (el) => {
    const a = alerts.get(el.dataset.alert); const r = D.remediations[a.id]; const app = reg.app(a.camrId);
    if (!r) { OperA.toast('No pre-approved remediation exists for this alert. Escalate to the owning team.', 'warn'); return; }
    let approver = r.approver;
    if (approver === me()) approver = app.onCall ? app.onCall.secondary : app.appOwner;
    OperA.modal.open({
      title: 'Request approval', form: 'remediate', submitLabel: 'Request approval', wide: true, data: { alert: a.id, approver },
      body: html`${ui.callout('info', `Nothing changes until ${approver} approves`, html`<p>Production changes need a second person. OperA sends this to the approver with the alert context, and the pipeline runs it only after approval.</p>`)}
        <div class="approval-box"><dl class="kv">
          <dt>Action</dt><dd><strong>${r.title}</strong></dd><dt>Target</dt><dd>${r.target}</dd><dt>Blast radius</dt><dd>${r.blastRadius}</dd>
          <dt>Rollback plan</dt><dd>${r.rollbackPlan}</dd><dt>Approver</dt><dd>${approver} · ${approver === r.approver ? r.approverRole : 'alternate approver (you can’t approve your own request)'}</dd></dl></div>
        <div class="field"><label for="rem-chg">Change record</label><p class="hint" id="rem-chg-hint">Format: CHG- followed by 6 digits, for example CHG-204118. Emergency change records are fine.</p>
          <input type="text" id="rem-chg" name="change" autocomplete="off" aria-describedby="rem-chg-hint" /><p class="error-msg" data-error-for="change" hidden></p></div>
        <div class="field"><label for="rem-why">Why now?</label><textarea id="rem-why" name="why" rows="2"></textarea><p class="error-msg" data-error-for="why" hidden></p></div>
        <label class="radio-row"><input type="checkbox" name="confirm" id="rem-confirm" /><span>I’ve read the blast radius and rollback plan.</span></label><p class="error-msg" data-error-for="confirm" hidden></p>`,
    });
  };
  OperA.forms.remediate = (form) => {
    const change = form.elements.change.value.trim().toUpperCase();
    const why = form.elements.why.value.trim();
    const okC = OperA.modal.fieldError(form, 'confirm', form.elements.confirm.checked ? '' : 'Confirm you’ve read the blast radius and rollback plan.');
    const okW = OperA.modal.fieldError(form, 'why', why.length >= 10 ? '' : 'Explain why in a sentence, so the approver can decide quickly.');
    const okR = OperA.modal.fieldError(form, 'change', /^CHG-\d{6}$/.test(change) ? '' : (change ? `“${change}” isn’t a change record number. It should look like CHG-204118.` : 'Enter the change record number.'));
    if (!okR || !okW || !okC) return;
    const a = alerts.get(form.dataset.alert); const r = D.remediations[a.id];
    const st = alerts.st(a.id);
    const id = `APR-${Math.floor(1000 + Math.random() * 8999)}`;
    st.approvals.push({ id, title: r.title, approver: form.dataset.approver, state: 'pending', at: Date.now(), by: me(), change, why });
    if (!st.status || st.status === 'new') { st.status = 'investigating'; st.assignee = st.assignee || me(); }
    alerts.log(a.id, `Requested approval from ${form.dataset.approver}: ${r.title} (${change}). Reason: ${why}`);
    OperA.modal.close(); OperA.refresh();
    OperA.toast(`Approval requested from ${form.dataset.approver}. Nothing runs until they approve.`);
  };
  OperA.actions['approval-sim'] = (el) => {
    const st = alerts.st(el.dataset.alert); const p = st.approvals.find((x) => x.id === el.dataset.id);
    p.state = el.dataset.to;
    if (p.state === 'rejected') p.reason = 'Hold off. The pricing team is deploying a fix in the next 10 minutes.';
    alerts.log(el.dataset.alert, p.state === 'approved' ? `Approved: ${p.title}. The pipeline is running it under ${p.change}.` : `Rejected: ${p.title}. “${p.reason}”`, p.approver);
    store.save(); OperA.refresh(); OperA.toast('Prototype: approver decision recorded.', 'info');
  };

  /* Resolve */
  OperA.actions.resolve = (el) => {
    const a = alerts.get(el.dataset.alert);
    const opts = [ ['Application', 'The application caused it'], ['Telemetry pipeline', 'Missing or wrong telemetry data'], ['Infrastructure', 'Platform, network or a dependency'], ['False alarm', 'The threshold needs tuning'] ];
    OperA.modal.open({
      title: `Resolve ${a.id}`, form: 'resolve', submitLabel: 'Resolve alert', data: { alert: a.id },
      body: html`<fieldset class="field"><legend>What caused it?</legend>${opts.map(([v, d], i) => html`<label class="radio-row"><input type="radio" name="cause" value="${v}" id="res-${i}" /><span><strong>${v}</strong><br /><span class="muted small">${d}</span></span></label>`)}
        <p class="error-msg" data-error-for="cause" hidden></p></fieldset>
        <div class="field"><label for="res-note">What fixed it?</label><p class="hint">Helps the next responder and the procedure owner.</p><textarea id="res-note" name="note" rows="3"></textarea><p class="error-msg" data-error-for="note" hidden></p></div>`,
    });
  };
  OperA.forms.resolve = (form) => {
    const cause = form.querySelector('input[name="cause"]:checked');
    const note = form.elements.note.value.trim();
    const ok1 = OperA.modal.fieldError(form, 'cause', cause ? '' : 'Choose what caused it.');
    const ok2 = OperA.modal.fieldError(form, 'note', note.length >= 5 ? '' : 'Add a short note about what fixed it.');
    if (!ok1 || !ok2) return;
    const st = alerts.st(form.dataset.alert);
    st.status = 'resolved'; st.resolution = `${cause.value}: ${note}`; st.assignee = st.assignee || me();
    alerts.log(form.dataset.alert, `Resolved. Cause: ${cause.value}. ${note}`);
    OperA.modal.close(); OperA.refresh(); OperA.toast(`${form.dataset.alert} resolved.`);
  };
})();
