/* OperA — alert queue and alert detail */
(function () {
  'use strict';
  const OperA = window.OperA;
  const { html, raw, fmt, reg, tel, alerts, store, ui } = OperA;
  const D = OperA.data;

  /* ---------------- queue (always visible beside the selected alert) ----------------
   * Filters live in the address (#/alerts?status=new&app=CAMR-…), so a filtered
   * queue can be bookmarked or shared, and they survive moving between alerts.
   * ------------------------------------------------------------------ */
  function filters(q) {
    const role = store.state.role;
    return {
      status: ['open', 'new', 'all'].includes(q.status) ? q.status : 'open',
      scope: q.scope === 'mine' || q.scope === 'all' ? q.scope : (role === 'app' ? 'mine' : 'all'),
      app: q.app && reg.app(q.app) ? q.app : '',
      kind: q.kind === 'not-app' ? 'not-app' : '',
      gap: q.gap === '1',
    };
  }
  /** Query string for a set of filters, leaving out the defaults. */
  function qs(f, patch) {
    const n = Object.assign({}, f, patch);
    const role = store.state.role;
    const out = {};
    if (n.status !== 'open') out.status = n.status;
    if (n.scope !== (role === 'app' ? 'mine' : 'all')) out.scope = n.scope;
    if (n.app) out.app = n.app;
    if (n.kind) out.kind = n.kind;
    if (n.gap) out.gap = '1';
    const str = new URLSearchParams(out).toString();
    return str ? `?${str}` : '';
  }
  function queue(f) {
    let list = alerts.all();
    if (f.status === 'open') list = list.filter((a) => a.status !== 'resolved');
    if (f.status === 'new') list = list.filter((a) => a.status === 'new');
    if (f.scope === 'mine') list = list.filter((a) => D.personas.app.apps.includes(a.camrId));
    if (f.app) list = list.filter((a) => a.camrId === f.app);
    if (f.kind) list = list.filter((a) => tel.assess(a).verdict !== 'application');
    if (f.gap) list = list.filter((a) => !reg.app(a.camrId).onCall || !a.runbook);
    return alerts.sort(list);
  }
  const seg = (label, f, key, options) => html`<div class="seg seg-sm" role="group" aria-label="${label}">${options.map(([v, l]) =>
    html`<button type="button" data-action="queue-filter" data-href="#/alerts${qs(f, { [key]: v })}" aria-pressed="${v === f[key]}">${l}</button>`)}</div>`;
  function alertRow(a, selectedId, query) {
    const app = reg.app(a.camrId);
    const as = tel.assess(a);
    return html`<li><a class="alert-row" href="#/alerts/${a.id}${query}" ${a.id === selectedId ? raw('aria-current="true"') : ''}>
      <span class="alert-row-top">${ui.sev(a.severity)}${ui.alertStatus(a.status)}<span class="alert-row-age">${a.status === 'resolved' ? 'resolved' : fmt.dur(fmt.minsSince(a.startedAt))}</span></span>
      <span class="alert-row-title">${a.title}</span>
      <span class="alert-row-meta">${a.id} · ${app.name} · ${a.env} · ${app.owningTeam}</span>
      <span class="alert-row-tags">${ui.verdictChip(as.verdict)}${!app.onCall ? html`<span class="chip chip-warn">${ui.icon('alert')}No on-call</span>` : ''}${!a.runbook ? html`<span class="chip chip-warn">${ui.icon('alert')}No procedure</span>` : ''}</span>
    </a></li>`;
  }

  /* ---------------- detail ----------------
   * The alert page is built from parts so both layouts (Guided page, Console
   * triage panes) show exactly the same content and follow the same rules.
   * ------------------------------------------------------------------ */
  const EV_ICON = { good: 'check', bad: 'x', warn: 'alert', info: 'info' };
  const evidenceList = (items) => html`<ul class="evidence">${items.map((e) => html`<li class="ev-${e.type}"><span class="ev-icon">${ui.icon(EV_ICON[e.type])}<span class="sr-only">${{ good: 'Healthy:', bad: 'Problem:', warn: 'Caution:', info: 'Note:' }[e.type]}</span></span><span>${e.text}${e.href ? html` <a href="${e.href}">Details</a>` : ''}</span></li>`)}</ul>`;

  /** Everything the parts need about one alert, computed once. */
  function model(id) {
    const a = alerts.get(id);
    if (!a) return null;
    const app = reg.app(a.camrId);
    const as = tel.assess(a);
    const esc = alerts.escalation(a, as);
    return { a, app, as, esc, n: alerts.nextStep(a) };
  }

  function actionBtn(m, act, label, primary) {
    const { a, esc } = m;
    const cls = `btn ${primary ? 'btn-primary' : ''}`;
    if (act === 'ack') return html`<button type="button" class="${cls}" data-action="ack" data-alert="${a.id}">${ui.icon('user')}${label || 'Acknowledge'}</button>`;
    if (act === 'escalate') return html`<button type="button" class="${cls}" data-action="escalate" data-alert="${a.id}" ${esc.due ? raw(`data-target="${esc.due.key}"`) : ''}>${ui.icon('bell')}${label || 'Escalate'}</button>`;
    if (act === 'link-incident') return html`<button type="button" class="${cls}" data-action="link-incident" data-alert="${a.id}">${ui.icon('link')}${label}</button>`;
    if (act === 'resolve') return html`<button type="button" class="${cls}" data-action="resolve" data-alert="${a.id}">${ui.icon('check')}${label || 'Resolve'}</button>`;
    return '';
  }

  /** Recent changes shown where the procedure asks for them, so nobody has to open a dialog to see one line. */
  function changesInline(a) {
    if (!a.changes.length) return html`<p class="rb-found">${ui.icon('check')} Checked for you: no deploys or config changes in the last 24 hours.</p>`;
    return html`<ul class="rb-found plain">${a.changes.map((c) => {
      const before = Math.round((a.startedAt - c.at) / 60000);
      return html`<li>${ui.icon('commit')} <strong>${c.text}</strong>, ${fmt.rel(c.at)} (${before} minutes before the alert). ${c.by}.${c.correlated ? html` <span class="chip chip-warn">${ui.icon('alert')}Just before the alert</span>` : ''}</li>`;
    })}</ul>`;
  }

  function runbookCard(m) {
    const { a, as, app } = m;
    let rb = reg.runbook(a.runbook);
    const fallback = !rb;
    if (!rb) rb = reg.runbook(as.verdict === 'telemetry' ? 'RB-900' : 'RB-000');
    const stale = reg.runbookStale(rb);
    const nextIdx = rb.steps.findIndex((_, i) => !a.stepsDone.includes(i));
    const linkBtn = (kind) => {
      const label = { metrics: 'Open metrics', logs: 'Open logs', traces: 'Open traces', health: 'Telemetry health' }[kind];
      if (kind === 'changes') return '';
      if (kind === 'health') return html`<a class="btn btn-sm" href="#/health">${ui.icon('activity')}${label}</a>`;
      return html`<button type="button" class="btn btn-sm" data-action="explore" data-alert="${a.id}" data-signal="${kind}">${ui.icon('search')}${label}</button>`;
    };
    const actBtn = (act) => {
      if (act.type === 'remediation') return a.approvals.some((p) => p.state === 'pending') ? html`<span class="chip chip-info">${ui.icon('shield')}Approval requested</span>`
        : html`<button type="button" class="btn btn-sm btn-primary" data-action="remediate" data-alert="${a.id}">${ui.icon('shield')}${act.label}</button>`;
      if (act.type === 'escalate') return html`<button type="button" class="btn btn-sm" data-action="escalate" data-alert="${a.id}">${ui.icon('bell')}${act.label}</button>`;
      if (act.type === 'link-incident') return as.incident ? html`<button type="button" class="btn btn-sm" data-action="link-incident" data-alert="${a.id}" ${a.linkedIncident ? raw('disabled') : ''}>${ui.icon('link')}${a.linkedIncident ? `Linked to ${a.linkedIncident}` : `Link to ${as.incident.id}`}</button>` : '';
      return '';
    };
    return html`<section class="card" aria-labelledby="h-rb">
      <div class="card-head"><h2 class="card-title" id="h-rb">${ui.icon('book')}Handling procedure</h2><span class="small muted">${a.stepsDone.length} of ${rb.steps.length} steps done</span></div>
      ${fallback ? ui.callout('warn', 'No procedure is linked to this alert', html`<p>Using <strong>${rb.title}</strong> instead. Generic steps are slower, so ask ${app.owningTeam} to add a procedure once this is handled.</p>`,
        html`<button type="button" class="btn btn-sm" data-action="draft-runbook" data-alert="${a.id}">${ui.icon('book')}Draft a procedure from this alert</button>`) : ''}
      <p><a href="#/runbooks/${rb.id}"><strong>${rb.title}</strong></a> <span class="muted small">· Owner ${rb.owner} · Reviewed ${fmt.date(new Date(rb.lastReviewed).getTime())}</span></p>
      ${stale ? ui.callout('warn', 'This procedure is overdue for review', html`<p>It was last reviewed more than 6 months ago, so some steps may be out of date. Follow it, but confirm anything risky with ${rb.owner}.</p>`) : ''}
      <p class="small">${rb.summary}</p>
      <ol class="rb-steps">${rb.steps.map((s, i) => {
        const done = a.stepsDone.includes(i);
        const links = (s.links || []);
        const buttons = links.map(linkBtn).filter(Boolean);
        return html`<li class="rb-step ${done ? 'is-done' : ''} ${i === nextIdx && a.status !== 'resolved' ? 'is-next' : ''}">
          <input type="checkbox" class="rb-check" id="rb-${a.id}-${i}" data-change="rb-step" data-alert="${a.id}" data-idx="${i}" ${done ? raw('checked') : ''} aria-describedby="rb-${a.id}-${i}-body" />
          <div><label for="rb-${a.id}-${i}" class="rb-title"><span class="rb-num">${i + 1}.</span>${s.title}</label>${i === nextIdx && a.status !== 'resolved' ? html`<span class="next-tag">Next</span>` : ''}
            <p class="rb-body" id="rb-${a.id}-${i}-body">${s.body}</p>
            ${links.includes('changes') ? changesInline(a) : ''}
            ${s.decision ? html`<p class="rb-decision"><strong>Decision:</strong> ${s.decision}</p>` : ''}
            ${(buttons.length || s.action) ? html`<div class="rb-actions">${buttons}${s.action ? actBtn(s.action) : ''}</div>` : ''}</div></li>`;
      })}</ol></section>`;
  }

  const parts = {
    eyebrow: ({ a }) => html`${ui.sev(a.severity)} ${a.id} · ${ui.envTag(a.env)} · ${ui.alertStatus(a.status)}${a.assignee ? html` <span class="muted">· ${a.assignee}</span>` : ''}`,
    lead: ({ a, app }) => html`${app.name} <span class="mono small">${app.camrId}</span> · <span class="mono">${a.service}/${a.component}</span> · started ${ui.timeAgo(a.startedAt)} (${fmt.clock(a.startedAt)})`,
    nextStep: (m) => html`<div class="next-step tone-${m.n.tone}" role="region" aria-label="Next step">
        <div class="next-step-label">Next step</div>
        <div class="next-step-text">${m.n.text}</div>
        ${m.n.action ? actionBtn(m, m.n.action, m.n.label, true) : ''}
      </div>`,
    quickActions: (m) => (m.a.status !== 'resolved' ? html`<div class="btn-row quick-actions">
        ${m.a.status === 'new' && m.n.action !== 'ack' ? actionBtn(m, 'ack') : ''}
        ${m.n.action !== 'escalate' ? actionBtn(m, 'escalate', 'Escalate or page someone') : ''}
        ${m.n.action !== 'resolve' ? actionBtn(m, 'resolve') : ''}
        <button type="button" class="btn" data-action="handoff" data-alert="${m.a.id}">${ui.icon('copy')}Write handoff note</button>
        <button type="button" class="btn btn-ghost" data-action="open-assistant" data-prompt="summary">${ui.icon('sparkle')}Ask OperA to summarize</button>
      </div>` : ''),
    whats: ({ a }) => html`<section class="card" aria-labelledby="h-what">
        <h2 class="card-title" id="h-what">${ui.icon('info')}What’s happening</h2>
        <p><strong>${a.summary}</strong></p>
        <p class="small"><strong>Impact:</strong> ${a.impact}</p>
        ${ui.lineChart(a)}
      </section>`,
    assessment: ({ a, as, app }) => {
      const gaps = as.evidence.filter((e) => e.gap);
      return html`<section class="card" aria-labelledby="h-src">
        <h2 class="card-title" id="h-src">${ui.icon('activity')}Application or telemetry?</h2>
        <div class="verdict verdict-${as.verdict}">
          <div class="verdict-head">${ui.verdictChip(as.verdict)}<span class="verdict-title">${as.headline}</span></div>
          <p class="small">${as.guidance}</p>
          <p class="small muted">Confidence: ${as.confidence}. Based on the evidence below.</p>
        </div>
        <div class="signal-grid">${D.signals.map((s) => html`<div class="signal-cell"><div class="sig-name">${fmt.cap(s)}${s === a.signal ? html` <span class="muted small">(alert source)</span>` : ''}</div>${ui.freshChip(as.freshness[s])}<div class="sig-detail">${as.freshness[s].detail}</div></div>`)}</div>
        <h3 style="margin-top:16px">Evidence</h3>
        ${evidenceList(as.evidence)}
        ${gaps.length ? html`<p class="small" style="margin-top:12px">${store.state.role === 'app'
          ? html`<a href="#/onboard?app=${app.camrId}&service=${a.service}&component=${a.component}&env=${a.env}">Set up ${gaps.map((g) => g.gap).join(' and ')} for this component</a> so the next investigation has more to go on.`
          : html`<button type="button" class="link-btn" data-action="flag-gap" data-alert="${a.id}">Ask ${app.owningTeam} to set up ${gaps.map((g) => g.gap).join(' and ')}</button>`}</p>` : ''}
      </section>`;
    },
    runbook: runbookCard,
    approvals: ({ a }) => (a.approvals.length ? html`<section class="card" aria-labelledby="h-appr"><h2 class="card-title" id="h-appr">${ui.icon('shield')}Approvals</h2>
        <ul class="plain">${a.approvals.map((p) => html`<li style="padding:6px 0">
          ${p.state === 'pending' ? html`<span class="chip chip-info">${ui.icon('clock')}Waiting for ${p.approver}</span>` : p.state === 'approved' ? html`<span class="chip chip-success">${ui.icon('check')}Approved by ${p.approver}</span>` : html`<span class="chip chip-danger">${ui.icon('x')}Rejected by ${p.approver}</span>`}
          <strong>${p.title}</strong> <span class="muted small">· ${p.change} · requested ${fmt.rel(p.at)} by ${p.by}${p.paged ? ' · sent with the page' : ''}</span>
          ${p.reason ? html`<div class="small">“${p.reason}”</div>` : ''}
          ${p.state === 'pending' ? html`<div class="proto-inline">Prototype: simulate ${p.approver}’s decision <button type="button" class="btn btn-sm" data-action="approval-sim" data-alert="${a.id}" data-id="${p.id}" data-to="approved">Approve</button><button type="button" class="btn btn-sm" data-action="approval-sim" data-alert="${a.id}" data-id="${p.id}" data-to="rejected">Reject</button></div>` : ''}
        </li>`)}</ul></section>` : ''),
    activity: ({ a }) => html`<section class="card" aria-labelledby="h-activity">
        <h2 class="card-title" id="h-activity">${ui.icon('clock')}Activity</h2>
        <form data-form="alert-note" data-alert="${a.id}" class="field" novalidate>
          <label for="note-${a.id}">Add a note for the next responder</label>
          <textarea id="note-${a.id}" name="note" rows="2" placeholder="What you checked and what you found"></textarea>
          <p class="error-msg" data-error-for="note" hidden></p>
          <button type="submit" class="btn btn-sm" style="margin-top:8px">Add note</button>
        </form>
        ${a.timeline.length ? html`<ol class="timeline">${a.timeline.map((t) => html`<li><div><strong>${t.who}</strong> · ${t.text}</div><div class="tl-meta">${ui.timeAgo(t.at)}</div></li>`)}</ol>` : html`<p class="muted small">No activity yet.</p>`}
      </section>`,
    ownership: ({ app }) => ui.ownership(app, { title: 'Responsible team' }),
    escalation: ({ a, as, esc, app }) => {
      const icStep = esc.steps.find((s) => s.key === 'ic');
      return html`<section class="card" aria-labelledby="h-esc">
        <h2 class="card-title" id="h-esc">${ui.icon('bell')}Escalation path</h2>
        <p class="small muted">${as.verdict === 'telemetry' ? 'Routed to the Telemetry Platform team because this is a telemetry problem.' : html`Tier ${app.tier} policy. Alert age: ${fmt.dur(esc.age)}. ${ui.help('tier', `What does Tier ${app.tier} mean?`)}`}</p>
        ${a.holdPaging ? ui.callout('tel', 'Application paging is on hold', html`<p>${app.owningTeam} won’t be paged for this alert while ${a.linkedIncident} is open. It reopens automatically if the alert still fires 15 minutes after the incident is resolved.</p>`) : ''}
        ${ui.escalationLadder(esc, a.status === 'resolved' ? null : a)}
        ${icStep && icStep.state !== 'done' && a.status !== 'resolved' && as.verdict !== 'telemetry' ? html`<p class="small ic-rule"><strong>Customers affected right now?</strong> Don’t wait for the timers.
          <button type="button" class="link-btn" data-action="escalate" data-alert="${a.id}" data-target="ic">Page the incident commander now</button></p>` : ''}
      </section>`;
    },
    investigate: ({ a, as, app }) => html`<section class="card" aria-labelledby="h-inv">
        <h2 class="card-title" id="h-inv">${ui.icon('search')}Investigate</h2>
        <p class="small muted">Already filtered to ${a.service}/${a.component} in ${a.env}, around the alert time.</p>
        <ul class="plain">${D.signals.map((s) => html`<li style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0">
          <button type="button" class="link-btn" data-action="explore" data-alert="${a.id}" data-signal="${s}">${fmt.cap(s)}</button>${ui.freshChip(as.freshness[s])}</li>`)}
          <li style="padding:4px 0"><button type="button" class="link-btn" data-action="explore" data-alert="${a.id}" data-signal="changes">Recent changes</button> <span class="muted small">(${a.changes.length || 'none'} in 24 h)</span></li>
          ${app.dashboards.map((d) => html`<li style="padding:4px 0"><button type="button" class="link-btn" data-action="open-external" data-what="${d}">${d}</button> ${ui.icon('external')}</li>`)}</ul>
      </section>`,
    related: ({ a, as }) => {
      const others = alerts.open().filter((x) => x.camrId === a.camrId && x.id !== a.id);
      return as.incident || others.length ? html`<section class="card" aria-labelledby="h-rel"><h2 class="card-title" id="h-rel">${ui.icon('link')}Related</h2><ul class="plain">
        ${as.incident ? html`<li><a href="#/health">${as.incident.id}</a> · ${as.incident.title}</li>` : ''}
        ${others.map((o) => html`<li><a href="#/alerts/${o.id}">${o.id}</a> · ${o.title}</li>`)}</ul></section>` : '';
    },
    /** Main column and side column, in reading order. Both layouts use these. */
    main: (m) => html`${parts.whats(m)}${parts.assessment(m)}${parts.runbook(m)}${parts.approvals(m)}${parts.activity(m)}`,
    side: (m) => html`${parts.ownership(m)}${parts.escalation(m)}${parts.investigate(m)}${parts.related(m)}`,
  };

  /* On narrow screens there is room for one pane: the queue, or the alert you opened. */
  const NARROW = window.matchMedia('(max-width: 1099px)');
  NARROW.addEventListener('change', () => { if (document.getElementById('triage')) OperA.refresh(); });

  OperA.views.alerts = {
    title: ([id]) => (id && alerts.get(id) ? `${id} · ${alerts.get(id).title}` : 'Alerts'),
    render([id], q) {
      const f = filters(q);
      const query = qs(f);
      const ds = store.state.proto.dataSource;
      const shown = ds === 'normal' ? queue(f) : [];
      const narrow = NARROW.matches;
      const showList = !narrow || !id;
      const showDetail = !narrow || !!id;
      const selectedId = id || (showDetail && shown[0] && shown[0].id) || null;
      const m = selectedId ? model(selectedId) : null;
      const mine = store.state.role === 'app' && f.scope === 'mine';
      const listTitle = html`${mine ? 'Alerts on my applications' : 'Alerts'} <span class="muted">(${shown.length})</span>`;
      const extra = [
        f.app ? [`Only ${reg.app(f.app).name}`, { app: '' }] : null,
        f.kind ? ['Only telemetry-related or unclear', { kind: '' }] : null,
        f.gap ? ['Only ownership or procedure gaps', { gap: false }] : null,
      ].filter(Boolean);

      let listBody;
      if (ds === 'error') listBody = ui.errorState({ title: 'We couldn’t load alerts', body: 'The alerting service didn’t respond. Paging still works. On-call engineers are notified directly.', cached: 'If this continues, use #prod-ops and check Telemetry health.' });
      else if (!shown.length) listBody = ui.emptyState({ title: 'No alerts here', body: f.status === 'open' && f.scope === 'all' && !extra.length ? 'Nothing is alerting right now.' : 'Nothing matches these filters.',
        action: query ? html`<a class="btn btn-sm" href="#/alerts">Clear filters</a>` : '' });
      else listBody = html`<ul class="alert-list">${shown.map((a) => alertRow(a, selectedId, query))}</ul>`;

      const detail = m ? html`
          ${narrow ? html`<p class="back-link"><a href="#/alerts${query}">${ui.icon('arrow', 'flip')}All alerts</a></p>` : ''}
          <p class="eyebrow">${parts.eyebrow(m)}</p>
          <h1>${m.a.title}</h1>
          <p class="lead">${parts.lead(m)}</p>
          ${parts.nextStep(m)}
          ${parts.quickActions(m)}
          ${parts.main(m)}`
        : html`<h1>Alerts</h1>${id ? html`<p class="lead">There’s no alert ${id}. It may have been closed and archived.</p>` : html`<p class="lead">Nothing to show. Choose an alert from the list to work on it here.</p>`}`;

      return html`<div class="triage" id="triage">
        ${ui.incidentStrip()}
        <div class="triage-panes ${showList && !showDetail ? 'list-only' : ''} ${showDetail && !showList ? 'detail-only' : ''}" id="triage-panes">
          ${showList ? html`<section class="pane pane-list" aria-labelledby="h-triage-list" data-scroll-key="triage-list" data-scroll-keep="route">
            <div class="pane-head">
              ${showDetail ? html`<h2 id="h-triage-list">${listTitle}</h2>` : html`<h1 id="h-triage-list">${listTitle}</h1>`}
              <div class="pane-filters">
                ${seg('Status', f, 'status', [ ['open', 'Open'], ['new', 'New'], ['all', 'All'] ])}
                ${seg('Applications', f, 'scope', [ ['mine', 'Mine'], ['all', 'All'] ])}
              </div>
              ${extra.length ? html`<ul class="filter-chips">${extra.map(([label, patch]) => html`<li><a class="chip chip-info" href="#/alerts${qs(f, patch)}">${label}<span class="sr-only">. Remove this filter</span>${ui.icon('x')}</a></li>`)}</ul>` : ''}
            </div>
            ${listBody}
            <div class="pane-foot">
              <label class="radio-row"><input type="checkbox" id="triage-shortcuts" data-change="triage-shortcuts" ${store.state.shortcuts ? raw('checked') : ''} /><span>Keyboard shortcuts</span></label>
              <button type="button" class="link-btn small" data-action="triage-help" id="triage-help">What are the shortcuts?</button>
            </div>
          </section>` : ''}
          ${showDetail ? html`<div class="triage-main" data-scroll-key="triage-main">
            <section class="pane pane-detail" aria-label="${m ? 'Selected alert' : 'No alert selected'}" data-scroll-key="triage-detail">${detail}</section>
            ${m ? html`<section class="pane pane-context" aria-label="Ownership, escalation and investigation" data-scroll-key="triage-context">${parts.side(m)}</section>` : ''}
          </div>` : ''}
        </div>
      </div>`;
    },
    mount(root) {
      ui.mountCharts(root);
      sizePanes();
      const cur = root.querySelector('.alert-row[aria-current="true"]');
      if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
      return false;
    },
  };
  OperA.route(/^\/alerts$/, OperA.views.alerts);
  OperA.route(/^\/alerts\/(ALR-\d+)$/, OperA.views.alerts);

  /* The queue and the alert scroll on their own, so the page itself must fit the window. */
  function sizePanes() {
    const el = document.getElementById('triage-panes');
    if (!el) return;
    if (NARROW.matches) { el.style.height = ''; return; }
    const top = el.getBoundingClientRect().top + window.scrollY;
    el.style.height = `${Math.max(420, window.innerHeight - top - 12)}px`;
  }
  window.addEventListener('resize', sizePanes);

  OperA.actions['queue-filter'] = (btn) => {
    const href = btn.dataset.href;
    history.replaceState(null, '', href);
    OperA.render({ keepFocus: true });
    const again = document.querySelector(`[data-action="queue-filter"][data-href="${CSS.escape(href)}"]`); if (again) again.focus();
    OperA.announce(`${fmt.plural(document.querySelectorAll('.alert-row').length, 'alert')} shown.`);
  };
  OperA.changes['triage-shortcuts'] = (el) => {
    store.state.shortcuts = el.checked; store.save();
    OperA.announce(`Keyboard shortcuts ${el.checked ? 'on' : 'off'}.`);
  };
  const SHORTCUTS = [ ['J', 'Next alert'], ['K', 'Previous alert'], ['A', 'Acknowledge the selected alert'], ['E', 'Escalate or page someone'], ['Ctrl K', 'Ask, paste or jump (works on every screen)'], ['?', 'Show this list'] ];
  OperA.actions['triage-help'] = () => {
    OperA.modal.open({ title: 'Keyboard shortcuts', cancelLabel: 'Close',
      body: html`<p>Single-key shortcuts work on the alerts screen when you’re not typing in a field. Turn them off with the “Keyboard shortcuts” checkbox under the alert list.</p>
        <table class="table table-compact"><caption class="sr-only">Keyboard shortcuts</caption><thead><tr><th scope="col">Key</th><th scope="col">What it does</th></tr></thead>
        <tbody>${SHORTCUTS.map(([k, d]) => html`<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`)}</tbody></table>
        <p class="small muted">Nothing risky has a shortcut. Approvals, resolving and linking incidents always go through their dialogs.</p>` });
  };
  document.addEventListener('keydown', (e) => {
    if (!store.state.shortcuts) return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], [role="tab"], .chart-plot')) return;
    if (document.getElementById('modal').open) return;
    const triage = document.getElementById('triage');
    if (!triage) return;
    const key = e.key.toLowerCase();
    if (key === 'j' || key === 'k') {
      const rows = Array.from(triage.querySelectorAll('.alert-row'));
      const cur = rows.findIndex((r) => r.getAttribute('aria-current') === 'true');
      const next = rows[cur + (key === 'j' ? 1 : -1)];
      e.preventDefault();
      if (next) location.hash = next.getAttribute('href');
      else OperA.announce(key === 'j' ? 'Last alert in the list.' : 'First alert in the list.');
    } else if (key === 'a' || key === 'e') {
      const btn = triage.querySelector(`.pane-detail [data-action="${key === 'a' ? 'ack' : 'escalate'}"]`);
      e.preventDefault();
      if (btn) btn.click();
      else OperA.announce(key === 'a' ? 'This alert is already acknowledged.' : 'Nothing to escalate on this alert.');
    } else if (e.key === '?') { e.preventDefault(); OperA.actions['triage-help'](); }
  });

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
  /* Handoff note: everything the next person needs, written from the alert's state. */
  function handoffNote(a) {
    const app = reg.app(a.camrId); const as = tel.assess(a); const esc = alerts.escalation(a, as);
    const rb = reg.runbook(a.runbook) || reg.runbook(as.verdict === 'telemetry' ? 'RB-900' : 'RB-000');
    const done = a.stepsDone.slice().sort().map((i) => `- Procedure step ${i + 1}: ${rb.steps[i].title}`);
    const paged = a.escalations.map((e) => `- Paged ${alerts.resolveTarget(app, e.target, as).who} ${fmt.rel(e.at)}`);
    const approvals = a.approvals.map((p) => `- ${p.title}: ${p.state === 'pending' ? `waiting for ${p.approver}` : `${p.state} by ${p.approver}`} (${p.change})`);
    const notes = a.timeline.filter((t) => /^Note: /.test(t.text)).slice(0, 3).map((t) => `- ${t.who}: ${t.text.replace(/^Note: /, '')}`);
    const upcoming = esc.steps.find((s) => s.state === 'due' || s.state === 'upcoming');
    return [
      `HANDOFF · ${a.id} · ${a.severity.toUpperCase()} · ${a.title}`,
      `${app.name} (${app.camrId}) · ${a.service}/${a.component} · ${a.env} · started ${fmt.rel(a.startedAt)}`,
      `Status: ${ui.ALERT_STATUS[a.status].label}${a.assignee ? `, owned by ${a.assignee}` : ''}`,
      '',
      'WHAT WE KNOW',
      `- ${a.summary} ${a.impact}`,
      `- ${as.headline} (confidence: ${as.confidence}).`,
      ...as.evidence.filter((e) => e.type === 'bad' || e.type === 'warn').slice(0, 3).map((e) => `- ${e.text}`),
      '',
      'DONE SO FAR',
      ...(done.length || paged.length || approvals.length || notes.length ? [...done, ...paged, ...approvals, ...notes] : ['- Nothing yet.']),
      '',
      'NEXT',
      `- ${alerts.nextStep(a).text}`,
      ...(upcoming ? [`- Escalation: ${upcoming.who} (${upcoming.role}) ${upcoming.state === 'due' ? 'is due now' : `in ${upcoming.inMin} min`}.`] : []),
      `- Procedure: ${rb.title} (${rb.id})`,
    ].join('\n');
  }
  OperA.actions.handoff = (el) => {
    const a = alerts.get(el.dataset.alert);
    OperA.modal.open({ title: `Handoff note for ${a.id}`, form: 'handoff', submitLabel: 'Save to the alert’s activity', wide: true, data: { alert: a.id },
      body: html`<p>Written from the alert’s current state. Edit it if you need to, then copy it into your handover or save it here for the next responder.</p>
        <div class="field"><label for="handoff-text">Note</label><textarea id="handoff-text" name="note" rows="16" class="mono">${handoffNote(a)}</textarea></div>
        <button type="button" class="btn btn-sm" data-action="copy" data-copy-target="handoff-text">${ui.icon('copy')}<span>Copy</span></button>` });
  };
  OperA.forms.handoff = (form) => {
    alerts.log(form.dataset.alert, `Handoff note:\n${form.elements.note.value.trim()}`);
    OperA.modal.close(); OperA.refresh(); OperA.toast('Handoff note saved to the alert’s activity.');
  };

  /* Procedure draft: the responder who just handled it writes the first version; the owning team reviews and publishes. */
  function runbookDraft(a) {
    const app = reg.app(a.camrId); const as = tel.assess(a); const esc = alerts.escalation(a, as);
    const d = (a.metric.unit === '%' || a.metric.unit === 'min') ? 1 : 0;
    const threshold = a.metric.threshold != null ? `${Number(a.metric.threshold).toFixed(d)}${a.metric.unit === '%' ? '%' : a.metric.unit ? ` ${a.metric.unit}` : ''}` : null;
    const found = [ ...as.evidence.filter((e) => e.type === 'bad').map((e) => e.text), ...a.timeline.filter((t) => /^Note: /.test(t.text)).map((t) => t.text.replace(/^Note: /, '')) ];
    const path = esc.steps.filter((s) => s.key !== 'noc').map((s) => `${s.after === 0 ? 'From the start' : `After ${s.after} min`}: ${s.who} (${s.role})`);
    return [
      `TITLE: ${app.name} — ${a.metric.name.toLowerCase()}`,
      `APPLIES TO: ${app.name} (${app.camrId}) · ${a.service}/${a.component}`,
      `USE WHEN: ${a.metric.name}${threshold ? ` crosses ${threshold}` : ' stops reporting'}. ${a.impact}`,
      '',
      'STEPS',
      `1. Confirm the impact. Open ${app.dashboards[0] || 'the application dashboard'} and check ${a.metric.name.toLowerCase()}. Confirm another signal shows the problem too.`,
      '2. Check telemetry health first. If metrics, logs or traces for this application are delayed or missing, link the alert to the telemetry incident instead of paging.',
      '3. Check recent changes. Deploys and config changes in the last 60 minutes are the most common cause.',
      `4. ${found.length ? `Look for what was found last time (${a.id}): ${found.join(' ')}` : 'Read recent error logs and group them by message.'}`,
      `5. Escalate to ${app.owningTeam} if it is not improving.`,
      '',
      'ESCALATION',
      ...path.map((p) => `- ${p}`),
      ...(!app.onCall ? ['- NOTE: no on-call schedule is registered. Add one before publishing this procedure.'] : []),
      '',
      'ACTIONS THAT NEED APPROVAL',
      '- None proposed. Add any rollback, restart or scale-up here, with who approves it.',
      '',
      `Drafted from ${a.id} by ${me()}. Review before publishing.`,
    ].join('\n');
  }
  OperA.actions['draft-runbook'] = (el) => {
    const a = alerts.get(el.dataset.alert); const app = reg.app(a.camrId);
    OperA.modal.open({ title: `Draft a procedure for ${app.name}`, form: 'draft-runbook', submitLabel: `Send draft to ${app.owningTeam}`, wide: true, data: { alert: a.id },
      body: html`<p>You’ve just worked this alert, so you’re the best person to write the first version. ${app.owningTeam} owns the procedure: they review, correct and publish it. Nothing is published from here.</p>
        <div class="field"><label for="rb-draft">Draft</label><textarea id="rb-draft" name="draft" rows="18" class="mono">${runbookDraft(a)}</textarea>
          <p class="error-msg" data-error-for="draft" hidden></p></div>` });
  };
  OperA.forms['draft-runbook'] = (form) => {
    if (!OperA.modal.fieldError(form, 'draft', form.elements.draft.value.trim().length >= 40 ? '' : 'The draft is empty. Keep the generated text or write your own.')) return;
    const a = alerts.get(form.dataset.alert); const app = reg.app(a.camrId);
    alerts.log(a.id, `Sent a draft handling procedure for “${a.metric.name}” alerts to ${app.owningTeam} for review.`);
    OperA.modal.close(); OperA.refresh();
    OperA.toast(`Draft sent to ${app.appOwner} (${app.owningTeam}) to review and publish.`);
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
  OperA.actions.escalate = (el) => {
    const a = alerts.get(el.dataset.alert); const as = tel.assess(a); const esc = alerts.escalation(a, as);
    const choices = esc.steps.filter((s) => s.key !== 'noc' && s.state !== 'done');
    const pre = el.dataset.target || (esc.due && esc.due.key) || (choices[0] && choices[0].key);
    if (!choices.length) { OperA.toast('Everyone on the escalation path has already been paged or has acknowledged.', 'info'); return; }
    OperA.modal.open({
      title: `Escalate ${a.id}`, form: 'escalate', submitLabel: 'Send page', wide: true, data: { alert: a.id },
      body: html`<fieldset class="field"><legend>Who should be paged?</legend><div class="choice-list">${choices.map((s, i) => html`<label class="choice"><input type="radio" name="target" value="${s.key}" id="esc-t-${i}" ${s.key === pre ? raw('checked') : ''} />
          <span class="choice-body"><span class="choice-title">${s.who}${s.state === 'due' ? html`<span class="chip chip-danger">${ui.icon('bell')}Due now</span>` : ''}${s.gap ? html`<span class="chip chip-warn">${ui.icon('alert')}Business hours only</span>` : ''}</span><span class="choice-desc">${s.role}${s.key === 'ic' ? ' · Choose this now if customers are affected, whatever the timer says.' : ''}</span></span></label>`)}</div>
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
    // If the approver is also next on the escalation path, send one notification instead of two.
    const esc = alerts.escalation(a);
    const pageStep = esc.steps.find((x) => x.who === approver && x.key !== 'noc' && x.state !== 'done' && x.state !== 'engaged');
    OperA.modal.open({
      title: 'Request approval', form: 'remediate', submitLabel: 'Request approval', wide: true, data: { alert: a.id, approver, page: pageStep ? pageStep.key : '' },
      body: html`${ui.callout('info', `Nothing changes until ${approver} approves`, html`<p>Production changes need a second person. OperA sends this to the approver with the alert context, and the pipeline runs it only after approval.</p>`)}
        <div class="approval-box"><dl class="kv">
          <dt>Action</dt><dd><strong>${r.title}</strong></dd><dt>Target</dt><dd>${r.target}</dd><dt>Blast radius</dt><dd>${r.blastRadius}</dd>
          <dt>Rollback plan</dt><dd>${r.rollbackPlan}</dd><dt>Approver</dt><dd>${approver} · ${approver === r.approver ? r.approverRole : 'alternate approver (you can’t approve your own request)'}</dd></dl></div>
        ${pageStep ? html`<label class="radio-row combined-page"><input type="checkbox" name="page" id="rem-page" checked /><span><strong>Also page ${approver} now, in the same notification</strong><br /><span class="muted small">${approver} is ${pageStep.state === 'due' ? 'due to be paged on the escalation path' : 'next on the escalation path'}. One message carries both the page and this approval request, so they aren’t notified twice.</span></span></label>` : ''}
        <div class="field"><label for="rem-chg">Change record</label><p class="hint" id="rem-chg-hint">Format: CHG- followed by 6 digits, for example CHG-204118. Emergency change records are fine. ${ui.help('changeRecord', 'What’s a change record, and how do I get one?')}</p>
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
    const paged = !!(form.dataset.page && form.elements.page && form.elements.page.checked);
    st.approvals.push({ id, title: r.title, approver: form.dataset.approver, state: 'pending', at: Date.now(), by: me(), change, why, paged });
    if (paged) st.escalations.push({ target: form.dataset.page, at: Date.now(), by: me(), reason: why, combined: true });
    if (!st.status || st.status === 'new') { st.status = 'investigating'; st.assignee = st.assignee || me(); }
    alerts.log(a.id, `${paged ? `Paged ${form.dataset.approver} and requested approval in one notification` : `Requested approval from ${form.dataset.approver}`}: ${r.title} (${change}). Reason: ${why}`);
    OperA.modal.close(); OperA.refresh();
    OperA.toast(`${paged ? `${form.dataset.approver} was paged with the approval request` : `Approval requested from ${form.dataset.approver}`}. Nothing runs until they approve.`);
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
