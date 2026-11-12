/*
 * OperA — Console layout.
 *
 * The second of the two selectable layouts. Same data, rules and safeguards as
 * the Guided layout (it reuses the alert parts, the validation engine and the
 * onboarding handlers), presented for people who want everything on one screen:
 *   - DevOps:            three-pane triage console (queue · alert · ownership)
 *   - Application teams: workspace board (coverage grid + request pipeline)
 *                        and single-page onboarding with a readiness panel
 */
(function () {
  'use strict';
  const OperA = window.OperA;
  const { html, raw, fmt, reg, tel, alerts, requests, validation, store, ui } = OperA;
  const D = OperA.data;

  /* One-line platform status, so a pipeline incident is visible without leaving the screen. */
  function incidentStrip(app) {
    const list = app ? tel.incidentsFor(app) : D.telemetry.incidents;
    if (!list.length) return '';
    return html`<p class="strip strip-tel">${ui.icon('activity')}<strong>${fmt.plural(list.length, 'telemetry incident')}:</strong>
      ${list.map((i, k) => html`${k ? ' · ' : ''}${i.id} ${i.title}`)}.
      ${app ? 'A platform problem, not yours to fix.' : 'Affected alerts are marked.'} <a href="#/health">Telemetry health</a></p>`;
  }

  /* =====================================================================
   * DevOps: triage console
   * ===================================================================== */
  function triageData() {
    const role = store.state.role;
    const t = store.state.triage;
    const scope = t.scope || (role === 'app' ? 'mine' : 'all');
    let list = alerts.all();
    if (t.status === 'open') list = list.filter((a) => a.status !== 'resolved');
    if (t.status === 'new') list = list.filter((a) => a.status === 'new');
    if (scope === 'mine') list = list.filter((a) => D.personas.app.apps.includes(a.camrId));
    return { list: alerts.sort(list), scope, status: t.status };
  }
  const seg = (label, key, value, options) => html`<div class="seg seg-sm" role="group" aria-label="${label}">${options.map(([v, l]) =>
    html`<button type="button" data-action="triage-filter" data-key="${key}" data-value="${v}" aria-pressed="${v === value}">${l}</button>`)}</div>`;

  function alertRow(a, selectedId) {
    const app = reg.app(a.camrId);
    const as = tel.assess(a);
    return html`<li><a class="alert-row" href="#/alerts/${a.id}" ${a.id === selectedId ? raw('aria-current="true"') : ''}>
      <span class="alert-row-top">${ui.sev(a.severity)}${ui.alertStatus(a.status)}<span class="alert-row-age">${a.status === 'resolved' ? 'resolved' : fmt.dur(fmt.minsSince(a.startedAt))}</span></span>
      <span class="alert-row-title">${a.title}</span>
      <span class="alert-row-meta">${a.id} · ${app.name} · ${a.env} · ${app.owningTeam}</span>
      <span class="alert-row-tags">${ui.verdictChip(as.verdict)}${!app.onCall ? html`<span class="chip chip-warn">${ui.icon('alert')}No on-call</span>` : ''}${!a.runbook ? html`<span class="chip chip-warn">${ui.icon('alert')}No procedure</span>` : ''}</span>
    </a></li>`;
  }

  OperA.views.triage = {
    title: ([id]) => (id && alerts.get(id) ? `${id} · ${alerts.get(id).title}` : 'Triage'),
    render([id]) {
      const { parts, model } = OperA.alertParts;
      const ds = store.state.proto.dataSource;
      const { list, scope, status } = triageData();
      const shown = ds === 'normal' ? list : [];
      // On narrow screens there's room for one pane: the list, or the alert you opened.
      const narrow = NARROW.matches;
      const showList = !narrow || !id;
      const showDetail = !narrow || !!id;
      const selectedId = id || (showDetail && shown[0] && shown[0].id) || null;
      const m = selectedId ? model(selectedId) : null;
      const role = store.state.role;
      const listTitle = html`${role === 'app' && scope === 'mine' ? 'Alerts on my applications' : 'Alerts'} <span class="muted">(${shown.length})</span>`;

      let listBody;
      if (ds === 'error') listBody = ui.errorState({ title: 'We couldn’t load alerts', body: 'The alerting service didn’t respond. Paging still works. On-call engineers are notified directly.', cached: 'If this continues, use #prod-ops and check Telemetry health.' });
      else if (!shown.length) listBody = ui.emptyState({ title: 'No alerts here', body: status === 'open' && scope === 'all' ? 'Nothing is alerting right now.' : 'Nothing matches these filters.' });
      else listBody = html`<ul class="alert-list">${shown.map((a) => alertRow(a, selectedId))}</ul>`;

      const detail = m ? html`
          ${narrow ? html`<p class="back-link"><a href="#/alerts">${ui.icon('arrow', 'flip')}All alerts</a></p>` : ''}
          <p class="eyebrow">${parts.eyebrow(m)}</p>
          <h1>${m.a.title}</h1>
          <p class="lead">${parts.lead(m)}</p>
          ${parts.nextStep(m)}
          ${parts.quickActions(m)}
          ${parts.main(m)}`
        : html`<h1>Triage</h1>${id ? html`<p class="lead">There’s no alert ${id}. It may have been closed and archived.</p>` : html`<p class="lead">Choose an alert from the list to work on it here.</p>`}`;

      return html`<div class="triage ${id ? 'is-explicit' : ''}" id="triage">
        ${incidentStrip()}
        <div class="triage-panes ${showList && !showDetail ? 'list-only' : ''} ${showDetail && !showList ? 'detail-only' : ''}" id="triage-panes">
          ${showList ? html`<section class="pane pane-list" aria-labelledby="h-triage-list" data-scroll-key="triage-list" data-scroll-keep="route">
            <div class="pane-head">
              ${showDetail ? html`<h2 id="h-triage-list">${listTitle}</h2>` : html`<h1 id="h-triage-list">${listTitle}</h1>`}
              <div class="pane-filters">
                ${seg('Status', 'status', status, [ ['open', 'Open'], ['new', 'New'], ['all', 'All'] ])}
                ${seg('Applications', 'scope', scope, [ ['mine', 'Mine'], ['all', 'All'] ])}
              </div>
            </div>
            ${listBody}
            <div class="pane-foot">
              <label class="radio-row"><input type="checkbox" id="triage-shortcuts" data-change="triage-shortcuts" ${store.state.shortcuts ? raw('checked') : ''} /><span>Single-key shortcuts</span></label>
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

  /* Panes scroll on their own, so the page itself must fit the window exactly. */
  const NARROW = window.matchMedia('(max-width: 1099px)');
  NARROW.addEventListener('change', () => { if (document.getElementById('triage')) OperA.refresh(); });
  function sizePanes() {
    const el = document.getElementById('triage-panes');
    if (!el) return;
    if (NARROW.matches) { el.style.height = ''; return; }
    const top = el.getBoundingClientRect().top + window.scrollY;
    el.style.height = `${Math.max(420, window.innerHeight - top - 12)}px`;
  }
  window.addEventListener('resize', sizePanes);

  OperA.actions['triage-filter'] = (btn) => {
    store.state.triage[btn.dataset.key] = btn.dataset.value; store.save();
    const sel = `[data-action="triage-filter"][data-key="${btn.dataset.key}"][data-value="${btn.dataset.value}"]`;
    // Filters change the list, so go back to the list view rather than keep a now-hidden selection.
    if (/^\/alerts\//.test(OperA.current.path)) { history.replaceState(null, '', '#/alerts'); }
    OperA.render({ keepFocus: true });
    const again = document.querySelector(sel); if (again) again.focus();
    OperA.announce(`${fmt.plural(document.querySelectorAll('.alert-row').length, 'alert')} shown.`);
  };
  OperA.changes['triage-shortcuts'] = (el) => {
    store.state.shortcuts = el.checked; store.save();
    OperA.announce(`Single-key shortcuts ${el.checked ? 'on' : 'off'}.`);
  };
  const SHORTCUTS = [ ['J', 'Next alert'], ['K', 'Previous alert'], ['A', 'Acknowledge the selected alert'], ['E', 'Escalate or page someone'], ['/', 'Search'], ['?', 'Show this list'] ];
  OperA.actions['triage-help'] = () => {
    OperA.modal.open({ title: 'Keyboard shortcuts', cancelLabel: 'Close',
      body: html`<p>Shortcuts work in the triage console when you’re not typing in a field. Turn them off with the “Single-key shortcuts” checkbox under the alert list.</p>
        <table class="table table-compact"><caption class="sr-only">Keyboard shortcuts</caption><thead><tr><th scope="col">Key</th><th scope="col">What it does</th></tr></thead>
        <tbody>${SHORTCUTS.map(([k, d]) => html`<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`)}</tbody></table>
        <p class="small muted">Nothing risky has a shortcut. Approvals, resolving and linking incidents always go through their dialogs.</p>` });
  };
  document.addEventListener('keydown', (e) => {
    if (OperA.design() !== 'console' || !store.state.shortcuts) return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], [role="tab"], .chart-plot')) return;
    if (document.getElementById('modal').open) return;
    const key = e.key.toLowerCase();
    if (key === '/') { e.preventDefault(); const s = document.getElementById('global-search-input'); if (s) s.focus(); return; }
    const triage = document.getElementById('triage');
    if (!triage) return;
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

  /* =====================================================================
   * Application teams: workspace board
   * ===================================================================== */
  const SIG_ICON = { active: 'check', partial: 'alert', onboarding: 'clock', none: 'minus' };
  const SIG_WORD = { active: 'active', partial: 'arriving without required attributes', onboarding: 'onboarding', none: 'not set up' };
  function covCell(app, s, c, env) {
    if (!s.envs.includes(env)) return html`<span class="muted" aria-hidden="true">—</span><span class="sr-only">Not deployed in ${env}</span>`;
    const cv = reg.coverage(app, s.name, c.name, env);
    const pills = html`<span class="sigs" aria-hidden="true">${D.signals.map((sig) => html`<span class="sig sig-${cv[sig]}">${sig[0].toUpperCase()}${ui.icon(SIG_ICON[cv[sig]])}</span>`)}</span>`;
    const words = D.signals.map((sig) => `${sig} ${SIG_WORD[cv[sig]]}`).join(', ');
    const gaps = D.signals.filter((sig) => cv[sig] === 'none' || cv[sig] === 'partial');
    if (!gaps.length || app.status !== 'active') return html`<span class="cov-cell">${pills}<span class="sr-only">${words}</span></span>`;
    return html`<a class="cov-cell cov-cell-link" href="#/onboard?app=${app.camrId}&service=${s.name}&component=${c.name}&env=${env}">${pills}<span class="sr-only">${s.name}/${c.name} in ${env}: ${words}. Set up ${gaps.join(' and ')}.</span></a>`;
  }
  function board(app) {
    const envs = D.envs.filter((e) => app.services.some((s) => s.envs.includes(e)));
    const prod = OperA.covSummary(app, 'prod');
    return html`<section class="card board" aria-labelledby="h-board-${app.camrId}">
      <div class="card-head"><h3 id="h-board-${app.camrId}"><a href="#/apps/${app.camrId}">${app.name}</a> <span class="mono small muted">${app.camrId}</span></h3>
        <span class="small muted">${prod.total ? `${prod.active} of ${prod.total} prod signals active` : 'No prod environment'}</span></div>
      <div class="table-wrap" style="box-shadow:none"><table class="table table-compact board-table">
        <caption class="sr-only">Telemetry coverage for ${app.name}, by component and environment. Choose a cell with gaps to set it up.</caption>
        <thead><tr><th scope="col">Component</th>${envs.map((e) => html`<th scope="col">${e}</th>`)}</tr></thead>
        <tbody>${app.services.map((s) => s.components.map((c) => html`<tr><th scope="row" class="mono">${s.name}/${c.name}</th>${envs.map((e) => html`<td>${covCell(app, s, c, e)}</td>`)}</tr>`))}</tbody>
      </table></div></section>`;
  }
  const PIPE = [
    { key: 'you', title: 'Needs you', test: (r) => requests.next(r).owner === 'you' },
    { key: 'approval', title: 'Waiting for approval', test: (r) => r.status === 'awaiting-approval' },
    { key: 'setup', title: 'Setting up', test: (r) => r.status === 'provisioning' || r.status === 'receiving' },
    { key: 'done', title: 'Done', test: (r) => r.status === 'complete' },
  ];

  OperA.views.workspace = {
    render() {
      const me = D.personas.app;
      const myApps = reg.myApps();
      const actions = OperA.appActions();
      const mine = requests.all().filter((r) => me.apps.includes(r.camrId));
      const myAlerts = alerts.sort(alerts.open().filter((a) => me.apps.includes(a.camrId)));
      const affected = myApps.find((a) => tel.incidentsFor(a).length);
      return html`
        ${ui.pageHead({ eyebrow: `Application team · ${me.team}`, title: 'Workspace',
          lead: 'Everything for your applications on one screen: what needs you, what’s covered, and where each request is.',
          actions: html`<a class="btn btn-primary" href="#/onboard">${ui.icon('plus')}Onboard telemetry</a>` })}
        ${affected ? incidentStrip(affected) : ''}
        <section class="section" aria-labelledby="h-needs">
          <h2 class="section-title" id="h-needs">Needs you <span class="muted">(${actions.length})</span></h2>
          ${actions.length ? html`<ul class="strip-list">${actions.map((x) => html`<li><span class="strip-tags">${x.tags}</span><span class="strip-title">${x.title}</span><a class="btn btn-sm" href="${x.href}">${x.cta}</a></li>`)}</ul>`
            : html`<p class="muted">Nothing needs you right now.</p>`}
        </section>
        <div class="ws-grid">
          <section class="section" aria-labelledby="h-cov-board">
            <h2 class="section-title" id="h-cov-board">Coverage board</h2>
            <p class="small muted board-legend"><span><strong>M</strong> metrics · <strong>L</strong> logs · <strong>T</strong> traces</span>
              <span class="sig sig-active">${ui.icon('check')}Active</span><span class="sig sig-partial">${ui.icon('alert')}Partial</span><span class="sig sig-onboarding">${ui.icon('clock')}Onboarding</span><span class="sig sig-none">${ui.icon('minus')}Not set up</span>
              <span>Choose a cell with gaps to set it up.</span></p>
            ${myApps.map(board)}
          </section>
          <div>
            <section class="section" aria-labelledby="h-my-alerts">
              <h2 class="section-title" id="h-my-alerts">Open alerts <span class="muted">(${myAlerts.length})</span></h2>
              ${myAlerts.length ? html`<ul class="strip-list">${myAlerts.map((a) => html`<li><span class="strip-tags">${ui.sev(a.severity)}${ui.verdictChip(tel.assess(a).verdict)}</span>
                <span class="strip-title">${a.title}<span class="row-sub">${a.id} · ${a.env} · ${fmt.rel(a.startedAt)}</span></span><a class="btn btn-sm" href="#/alerts/${a.id}">Open alert</a></li>`)}</ul>`
                : html`<p class="muted">No open alerts on your applications.</p>`}
            </section>
          </div>
        </div>
        <section class="section" aria-labelledby="h-pipe">
          <h2 class="section-title" id="h-pipe">Onboarding requests</h2>
          <div class="pipeline">${PIPE.map((col) => {
            const items = mine.filter(col.test);
            return html`<div class="pipe-col pipe-${col.key}"><h3>${col.title} <span class="muted">(${items.length})</span></h3>
              ${items.length ? html`<ul>${items.map((r) => { const app = reg.app(r.camrId); return html`<li><a class="pipe-card" href="#/requests/${r.id}">
                <span class="pipe-id">${r.id} ${ui.envTag(r.env)}</span>
                <span class="pipe-what">${app.name} · <span class="mono">${r.service}/${r.component}</span></span>
                <span class="pipe-next">${col.key === 'approval' ? `With ${r.approver}, ${fmt.dur(fmt.minsSince(r.createdAt))}` : col.key === 'done' ? r.signals.join(', ') : requests.next(r).text}</span>
              </a></li>`; })}</ul>` : html`<p class="muted small">None</p>`}</div>`;
          })}</div>
        </section>`;
    },
  };

  /* =====================================================================
   * Application teams: single-page onboarding
   * ===================================================================== */
  const FIELD = { app: 'ob-app-q', service: 'ob-svc', component: 'ob-cmp', env: 'ob-env', signals: 'ob-sig-metrics', checks: 'ob-run' };

  OperA.views.onboardConsole = {
    render(d, errors) {
      const ob = OperA.onboard;
      const app = d.camrId ? reg.app(d.camrId) : null;
      const me = D.personas[store.state.role];
      const svc = app && d.service ? reg.service(app, d.service) : null;
      const located = !!(app && app.status === 'active' && svc && d.component && d.env);
      const cv = located ? reg.coverage(app, d.service, d.component, d.env) : null;
      const member = app ? reg.isMember(app, me.name) : true;
      const needsApproval = app && (d.env === 'prod' || !member);
      const sum = d.checks ? validation.summary(d.checks) : null;
      const errList = Object.entries(errors).filter(([, v]) => v);
      const opt = (v, label, sel, disabled) => html`<option value="${v}" ${sel ? raw('selected') : ''} ${disabled ? raw('disabled') : ''}>${label}</option>`;

      /* 1 · identify */
      let identify;
      if (!app) {
        identify = html`
          ${store.state.role === 'app' ? html`<p class="field-label">Your applications</p><div class="quick-picks">${reg.myApps().map((a) => html`<button type="button" class="quick-pick" data-action="ob-pick-quick" data-camr="${a.camrId}">${a.name} · ${a.camrId}</button>`)}</div>` : ''}
          <div class="field"><label for="ob-app-q">Application name or CAMR ID</label>
            <p class="hint" id="ob-app-hint">For example “Rewards Engine” or “CAMR-108840”. ${ui.help('camr')}</p>
            <input id="ob-app-q" type="search" autocomplete="off" aria-describedby="ob-app-hint${errors.app ? ' ob-app-err' : ''}" ${errors.app ? raw('aria-invalid="true"') : ''} data-input="ob-app-search" value="${d.query || ''}" />
            ${errors.app ? html`<p class="error-msg" id="ob-app-err">${errors.app}</p>` : ''}</div>
          <div id="ob-app-results">${ob.appResults(d.query || '')}</div>`;
      } else {
        const envLabel = (e) => {
          const c = reg.coverage(app, svc.name, d.component, e);
          const active = D.signals.filter((s) => c[s] === 'active');
          return `${e} · ${active.length === 3 ? 'fully set up' : active.length ? `${active.join(', ')} active` : 'nothing set up'}${e === 'prod' ? ' · needs approval' : ''}`;
        };
        identify = html`
          <div class="selected-app" id="ob-selected" tabindex="-1">
            <div><div class="choice-title">${ui.icon('check')}${app.name} <span class="mono small">${app.camrId}</span></div>
              <div class="choice-meta">${app.owningTeam} · App owner ${app.appOwner} · Tier ${app.tier}</div></div>
            <button type="button" class="btn btn-sm" data-action="ob-change-app">Change application</button>
          </div>
          ${app.status === 'retired' ? ui.callout('danger', 'This application is retired', html`<p>Telemetry can’t be onboarded for retired applications. If it’s still running, ask ${app.appOwner} to reactivate it in the registry, then come back.</p>`) : html`
          ${!member ? ui.callout('warn', `You’re not listed on ${app.owningTeam}`, html`<p>You can continue, but ${app.appOwner} (app owner) will need to approve this request, even for dev and qa.</p>`) : ''}
          <div class="obc-selects">
            <div class="field"><label for="ob-svc">Service</label>
              <select id="ob-svc" data-change="ob-set" data-key="service" ${errors.service ? raw('aria-invalid="true" aria-describedby="ob-svc-err"') : ''}>${opt('', 'Choose a service…', !d.service)}${app.services.map((s) => opt(s.name, `${s.name} · ${s.description}`, d.service === s.name))}</select>
              ${errors.service ? html`<p class="error-msg" id="ob-svc-err">${errors.service}</p>` : ''}</div>
            <div class="field"><label for="ob-cmp">Component</label>
              <select id="ob-cmp" data-change="ob-set" data-key="component" ${svc ? '' : raw('disabled')} ${errors.component ? raw('aria-invalid="true" aria-describedby="ob-cmp-err"') : ''}>${svc ? html`${svc.components.length > 1 ? opt('', 'Choose a component…', !d.component) : ''}${svc.components.map((c) => opt(c.name, `${c.name} · ${c.description}`, d.component === c.name))}` : opt('', 'Choose a service first', true)}</select>
              ${errors.component ? html`<p class="error-msg" id="ob-cmp-err">${errors.component}</p>` : ''}</div>
            <div class="field"><label for="ob-env">Environment</label>
              <select id="ob-env" data-change="ob-set" data-key="env" ${svc && d.component ? '' : raw('disabled')} ${errors.env ? raw('aria-invalid="true" aria-describedby="ob-env-err"') : ''}>${svc && d.component ? html`${opt('', 'Choose an environment…', !d.env)}${svc.envs.map((e) => {
                const c = reg.coverage(app, svc.name, d.component, e);
                return opt(e, envLabel(e), d.env === e, D.signals.every((s) => c[s] === 'active'));
              })}` : opt('', 'Choose a component first', true)}</select>
              ${errors.env ? html`<p class="error-msg" id="ob-env-err">${errors.env}</p>` : ''}</div>
          </div>
          <p class="small muted">Service not listed? Services come from the registry. Ask ${app.appOwner} to add it to ${app.camrId}. ${ui.help('service')} ${ui.help('component')} ${ui.help('environment')}</p>`}`;
      }

      /* 2 · signals */
      const signals = located ? html`<fieldset class="field" style="margin:0"><legend class="sr-only">Signals to collect</legend>
          <div class="obc-signals">${D.signals.map((s) => {
            const already = cv[s] === 'active' || cv[s] === 'onboarding';
            return html`<label class="choice"><input type="checkbox" id="ob-sig-${s}" value="${s}" data-change="ob-signal" ${already || d.signals.includes(s) ? raw('checked') : ''} ${already ? raw('disabled') : ''} />
              <span class="choice-body"><span class="choice-title">${fmt.cap(s)}${already ? html`<span class="chip chip-success">${ui.icon('check')}${cv[s] === 'active' ? 'Active' : 'Onboarding'}</span>` : ob.recommended(app).includes(s) ? html`<span class="chip chip-info">Recommended</span>` : ''}</span>
                <span class="choice-desc">${ob.PREREQ[s].need}</span></span></label>`;
          })}</div>
          ${errors.signals ? html`<p class="error-msg" id="ob-sig-err">${errors.signals}</p>` : ''}
          <details class="small" style="margin-top:8px"><summary class="link-btn">What each signal is, and how to check the prerequisites</summary>
            <ul style="margin-top:6px">${D.signals.map((s) => html`<li><strong>${fmt.cap(s)}:</strong> ${D.glossary[s].text} <em>To check:</em> ${ob.PREREQ[s].check}</li>`)}</ul></details>
        </fieldset>` : html`<p class="muted">Choose a service, component and environment first. Recommended signals are then selected for you.</p>`;

      /* readiness */
      const item = (ok, label, detail, tone) => html`<li class="ready-${ok ? 'ok' : tone || 'todo'}">${ui.icon(ok ? 'check' : tone === 'bad' ? 'x' : tone === 'wait' ? 'clock' : 'minus')}<span><strong>${label}</strong><br /><span class="small">${detail}</span></span></li>`;
      const checksItem = !sum ? item(false, 'Checks', 'Not run yet')
        : sum.blocked ? item(false, 'Checks', 'Blocked. Fix the failing check before you submit.', 'bad')
        : sum.fail ? item(false, 'Checks', `${sum.pass} passed, ${sum.fail} need${sum.fail === 1 ? 's' : ''} your action. You can still submit.`, 'bad')
        : sum.waiting ? item(false, 'Checks', `${sum.pass} passed, ${sum.waiting} waiting for data. You can still submit.`, 'wait')
        : item(true, 'Checks', `All ${sum.total} passed`);

      return html`
        ${ui.pageHead({ title: 'Onboard telemetry', lead: 'One page. Values come from the application registry, and the readiness panel shows what’s left. Your progress saves automatically.' })}
        ${errList.length ? html`<div class="error-summary" role="alert" tabindex="-1" id="ob-errors"><h2>There’s a problem</h2><ul>${errList.map(([k, v]) => html`<li><a href="#" data-action="focus-field" data-field="${FIELD[k]}">${v}</a></li>`)}</ul></div>` : ''}
        <div class="obc">
          <div class="obc-form">
            <section class="card" aria-labelledby="h-obc-1"><h2 class="card-title" id="h-obc-1"><span class="obc-num">1</span>What are you onboarding?</h2>${identify}</section>
            ${app && app.status === 'retired' ? '' : html`
            <section class="card" aria-labelledby="h-obc-2"><h2 class="card-title" id="h-obc-2"><span class="obc-num">2</span>Signals</h2>${signals}</section>
            <section class="card" aria-labelledby="h-obc-3"><h2 class="card-title" id="h-obc-3"><span class="obc-num">3</span>Configuration</h2>
              ${located && d.signals.length ? html`${ob.configBlock(d)}<p class="small" style="margin-top:8px">Add it, then deploy to ${d.env} the way you normally do. OperA doesn’t change your pipeline or your code.</p>`
                : html`<p class="muted">Your configuration appears here once you’ve chosen what to onboard.</p>`}</section>
            <section class="card" aria-labelledby="h-obc-4"><h2 class="card-title" id="h-obc-4"><span class="obc-num">4</span>Check that data arrives</h2>
              <p class="small">Takes about 10 seconds. Run it as many times as you like.</p>${ob.checksBlock(d, errors)}</section>`}
          </div>
          <section class="card obc-side" aria-labelledby="h-obc-ready">
            <h2 class="card-title" id="h-obc-ready">${ui.icon('list')}Readiness</h2>
            <ul class="ready-list">
              ${item(!!app && app.status === 'active', 'Application', app ? `${app.name} · ${app.camrId}` : 'Not chosen')}
              ${item(!!(svc && d.component), 'Service and component', svc && d.component ? `${d.service}/${d.component}` : 'Not chosen')}
              ${item(!!d.env && located, 'Environment', d.env || 'Not chosen')}
              ${item(located && d.signals.length > 0, 'Signals', located && d.signals.length ? d.signals.map(fmt.cap).join(', ') : 'None selected')}
              ${checksItem}
            </ul>
            ${located ? html`<p class="small ready-approval">${needsApproval
              ? html`${ui.icon('shield')} <strong>Needs approval from ${app.appOwner}</strong> (${d.env === 'prod' ? 'production requests always do' : 'you’re not on the owning team'}). Usually within 1 business day.`
              : html`${ui.icon('check')} <strong>Approved automatically.</strong> ${d.env} requests from the owning team don’t need approval.`}
              Set-up then takes about 15 minutes and needs nothing from you.</p>` : ''}
            ${app && app.status === 'retired' ? '' : html`<button type="button" class="btn btn-primary obc-submit" data-action="ob-submit" id="ob-next">Submit request</button>`}
            <p class="draft-note">${d.savedAt ? html`${ui.icon('check')}Draft saved ${fmt.rel(d.savedAt)}` : ''}</p>
            <div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" data-action="ob-later">Save and finish later</button><button type="button" class="link-btn small" data-action="ob-reset">Start over</button></div>
          </section>
        </div>`;
    },
  };
})();
