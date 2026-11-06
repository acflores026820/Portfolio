/* OperA — application catalog and application detail (the centre of the product) */
(function () {
  'use strict';
  const OperA = window.OperA;
  const { html, raw, fmt, reg, tel, alerts, requests, store, ui } = OperA;
  const D = OperA.data;

  /* ---------------- catalog ---------------- */
  OperA.views.apps = {
    title: () => (store.state.role === 'app' ? 'My applications' : 'Applications'),
    render(_, q) {
      const role = store.state.role;
      const scope = q.scope || (role === 'app' ? 'mine' : 'all');
      const retired = q.retired === '1';
      const ds = store.state.proto.dataSource;
      let list = D.applications.filter((a) => retired || a.status === 'active');
      if (scope === 'mine') list = list.filter((a) => D.personas.app.apps.includes(a.camrId) || (retired && a.owningTeam === D.personas.app.team));
      const qs = (patch) => '#/apps?' + new URLSearchParams(Object.assign({ scope, retired: retired ? '1' : '0' }, patch)).toString();

      let body;
      if (ds === 'error') body = ui.errorState({ title: 'We couldn’t load the application registry', body: 'The registry didn’t respond. This is usually temporary. Your applications and telemetry are not affected.', cached: 'Showing nothing rather than out-of-date ownership. Last successful load: 6 minutes ago.' });
      else if (ds === 'empty' || !list.length) body = ui.emptyState({ title: scope === 'mine' ? 'You’re not listed on any applications yet' : 'No applications in the registry',
        body: scope === 'mine' ? 'OperA shows applications where the registry lists you as a member or on-call. If that’s wrong, ask your app owner to add you in the registry.' : '',
        action: scope === 'mine' ? html`<a class="btn" href="${qs({ scope: 'all' })}">Show all applications</a>` : '' });
      else body = html`<div class="table-wrap"><table class="table" id="apps-table">
        <caption class="sr-only">Applications</caption>
        <thead><tr><th scope="col">Application</th><th scope="col">CAMR ID</th><th scope="col">Tier</th><th scope="col">Owning team</th><th scope="col">Production telemetry</th><th scope="col">Open alerts</th></tr></thead>
        <tbody>${list.map((a) => {
          const c = OperA.covSummary(a, 'prod');
          const open = alerts.open().filter((x) => x.camrId === a.camrId).length;
          const search = [a.name, a.camrId, a.owningTeam, a.appOwner, ...a.services.map((s) => s.name)].join(' ').toLowerCase();
          return html`<tr data-search="${search}">
            <td><a class="row-title" href="#/apps/${a.camrId}">${a.name}</a>${a.status === 'retired' ? html` <span class="chip chip-neutral">${ui.icon('minus')}Retired</span>` : ''}<div class="row-sub">${a.description}</div></td>
            <td class="mono nowrap">${a.camrId}</td><td>${a.tier}</td><td>${a.owningTeam}</td>
            <td style="min-width:150px"><div class="small">${c.total ? `${c.active} of ${c.total} active` : '—'}</div>${c.total ? OperA.covBar(c, `${a.name} production coverage`) : ''}</td>
            <td>${open ? html`<span class="chip chip-danger">${ui.icon('bell')}${open}</span>` : html`<span class="chip chip-success">${ui.icon('check')}None</span>`}</td></tr>`;
        })}
        <tr id="apps-noresults" hidden><td colspan="6"><strong>No applications match your search.</strong> Try a name, CAMR ID (for example CAMR-104233), team or service name.</td></tr>
        </tbody></table></div>`;

      return html`
        ${ui.pageHead({ title: role === 'app' && scope === 'mine' ? 'My applications' : 'Applications',
          lead: 'Every application from the registry, with who owns it, what telemetry it has, and what’s alerting.' })}
        <div class="toolbar">
          <div class="field"><label for="apps-q">Filter</label><input id="apps-q" type="search" data-input="apps-filter" placeholder="Name, CAMR ID, team or service" style="width:300px" /></div>
          <div class="seg" role="group" aria-label="Which applications">
            <button type="button" data-action="nav" data-href="${qs({ scope: 'mine' })}" aria-pressed="${scope === 'mine'}">Mine</button>
            <button type="button" data-action="nav" data-href="${qs({ scope: 'all' })}" aria-pressed="${scope === 'all'}">All</button>
          </div>
          <label class="radio-row"><input type="checkbox" data-change="apps-retired" ${retired ? raw('checked') : ''} /> Show retired</label>
          <span class="muted small" id="apps-count" aria-live="polite">${fmt.plural(list.length, 'application')}</span>
        </div>
        ${body}`;
    },
  };
  OperA.inputs['apps-filter'] = (el) => {
    const q = el.value.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    let n = 0;
    document.querySelectorAll('#apps-table tbody tr[data-search]').forEach((tr) => {
      const hit = !q || tr.dataset.search.includes(q) || (digits.length >= 3 && tr.dataset.search.includes(digits));
      tr.hidden = !hit; if (hit) n++;
    });
    const nr = document.getElementById('apps-noresults'); if (nr) nr.hidden = n > 0;
    const c = document.getElementById('apps-count'); if (c) c.textContent = fmt.plural(n, 'application');
  };
  OperA.changes['apps-retired'] = (el) => {
    const q = OperA.current.query;
    location.hash = '#/apps?' + new URLSearchParams(Object.assign({}, q, { retired: el.checked ? '1' : '0' })).toString();
  };
  OperA.actions.nav = (el) => { location.hash = el.dataset.href; };
  OperA.route(/^\/apps$/, OperA.views.apps);

  /* ---------------- application detail ---------------- */
  function coverageTable(app, env) {
    const rows = [];
    app.services.forEach((s) => s.components.forEach((c) => { if (s.envs.includes(env)) rows.push({ s, c }); }));
    if (!rows.length) return html`<p class="muted">No services are registered in ${env}.</p>`;
    const sum = OperA.covSummary(app, env);
    return html`
      <p class="small"><strong>${sum.active} of ${sum.total}</strong> signals active in ${env}.${sum.none ? ` ${sum.none} not set up.` : ''}${sum.partial ? ` ${sum.partial} arriving without required attributes.` : ''}</p>
      <div class="table-wrap" style="box-shadow:none"><table class="table">
        <caption class="sr-only">Telemetry coverage in ${env}</caption>
        <thead><tr><th scope="col">Service / component</th><th scope="col">Metrics</th><th scope="col">Logs</th><th scope="col">Traces</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead>
        <tbody>${rows.map(({ s, c }) => {
          const cv = reg.coverage(app, s.name, c.name, env);
          const f = tel.freshness(app, s.name, c.name, env);
          const missing = D.signals.filter((x) => cv[x] === 'none');
          const cell = (sig) => html`<td><div class="cell-stack">${ui.covChip(cv[sig])}${['delayed', 'missing'].includes(f[sig].state) ? ui.freshChip(f[sig]) : ''}</div></td>`;
          return html`<tr><th scope="row" style="font-weight:600;text-align:left"><span class="mono">${s.name}</span> / <span class="mono">${c.name}</span><div class="row-sub" style="font-weight:400">${c.description}</div></th>
            ${cell('metrics')}${cell('logs')}${cell('traces')}
            <td>${missing.length && app.status === 'active' ? html`<a class="btn btn-sm" href="#/onboard?app=${app.camrId}&service=${s.name}&component=${c.name}&env=${env}">Set up ${missing.join(', ')}</a>`
              : cv.metrics === 'partial' || cv.logs === 'partial' || cv.traces === 'partial' ? html`<a class="btn btn-sm btn-ghost" href="#/onboard?app=${app.camrId}&service=${s.name}&component=${c.name}&env=${env}">Fix attributes</a>` : ''}</td></tr>`;
        })}</tbody></table></div>`;
  }

  OperA.views.appDetail = {
    title: ([id]) => (reg.app(id) ? reg.app(id).name : 'Application not found'),
    render([id], q) {
      const app = reg.app(id);
      if (!app) {
        return html`${ui.pageHead({ title: 'Application not found', lead: `There’s no application with CAMR ID ${id} in the registry.`, crumbs: [ { href: '#/apps', label: 'Applications' }, { label: id } ] })}
          ${ui.callout('info', 'What you can do', html`<ul><li>Check the ID for typos. CAMR IDs look like CAMR-104233.</li><li>Search by application name instead.</li><li>New applications appear here after they’re registered.</li></ul>`)}
          <a class="btn" href="#/apps">Browse applications</a>`;
      }
      const env = D.envs.includes(q.env) ? q.env : 'prod';
      const envs = D.envs.filter((e) => app.services.some((s) => s.envs.includes(e)));
      const active = envs.includes(env) ? env : envs[envs.length - 1];
      const open = alerts.sort(alerts.open().filter((a) => a.camrId === app.camrId));
      const reqs = requests.all().filter((r) => r.camrId === app.camrId);
      const rbs = app.runbooks.map(reg.runbook).filter(Boolean);
      const region = tel.region(app.region);
      return html`
        ${ui.pageHead({
          crumbs: [ { href: '#/apps', label: 'Applications' }, { label: app.name } ],
          eyebrow: html`<span class="mono">${app.camrId}</span> · Tier ${app.tier} · ${app.owningTeam}`,
          title: app.name, lead: app.description,
          actions: app.status === 'active' ? html`<a class="btn btn-primary" href="#/onboard?app=${app.camrId}">${ui.icon('plus')}Onboard telemetry</a>` : '' })}
        ${app.status === 'retired' ? ui.callout('warn', 'This application is retired', html`<p>Retired applications can’t be onboarded and don’t alert. If it’s still running, ask ${app.appOwner} to reactivate it in the registry.</p>`) : ''}
        ${ui.incidentBanner({ app })}
        <div class="split">
          <div>
            <section class="card" aria-labelledby="h-cov">
              <h2 class="card-title" id="h-cov">${ui.icon('layers')}Telemetry coverage</h2>
              <div class="tabs" role="tablist" aria-label="Environment">${envs.map((e) => html`<button type="button" role="tab" id="tab-env-${e}" aria-controls="panel-env-${e}" aria-selected="${e === active}" tabindex="${e === active ? 0 : -1}" data-action="tab">${e}</button>`)}</div>
              ${envs.map((e) => html`<div role="tabpanel" id="panel-env-${e}" aria-labelledby="tab-env-${e}" class="tab-panel" ${e === active ? '' : raw('hidden')}>${coverageTable(app, e)}</div>`)}
            </section>

            <section class="card" aria-labelledby="h-alerts">
              <h2 class="card-title" id="h-alerts">${ui.icon('bell')}Open alerts</h2>
              ${open.length ? html`<ul class="plain">${open.map((a) => html`<li style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 0">${ui.sev(a.severity)} <a href="#/alerts/${a.id}">${a.title}</a> ${ui.envTag(a.env)} ${ui.verdictChip(tel.assess(a).verdict)} <span class="muted small">${fmt.rel(a.startedAt)}</span></li>`)}</ul>`
                : html`<p class="muted">No open alerts.</p>`}
            </section>

            <section class="card" aria-labelledby="h-reqs">
              <h2 class="card-title" id="h-reqs">${ui.icon('list')}Onboarding requests</h2>
              ${reqs.length ? html`<ul class="plain">${reqs.map((r) => html`<li style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 0"><a href="#/requests/${r.id}">${r.id}</a> <span class="mono small">${r.service}/${r.component}</span> ${ui.envTag(r.env)} ${ui.reqStatus(r.status)} <span class="small muted">${requests.next(r).text}</span></li>`)}</ul>`
                : html`<p class="muted">No onboarding requests for this application.</p>`}
            </section>
          </div>
          <div class="stack">
            ${ui.ownership(app)}
            <section class="card" aria-labelledby="h-rb">
              <h2 class="card-title" id="h-rb">${ui.icon('book')}Handling procedures</h2>
              ${rbs.length ? html`<ul class="plain">${rbs.map((rb) => html`<li><a href="#/runbooks/${rb.id}">${rb.title}</a>${reg.runbookStale(rb) ? html` <span class="chip chip-warn">${ui.icon('alert')}Review overdue</span>` : ''}</li>`)}</ul>`
                : ui.callout('warn', 'No handling procedures', html`<p>Responders will use generic triage for this application’s alerts, which is slower. Ask ${app.owningTeam} to add a procedure for their most common alerts.</p>`)}
            </section>
            <section class="card" aria-labelledby="h-route">
              <h2 class="card-title" id="h-route">${ui.icon('activity')}Telemetry routing</h2>
              <dl class="kv"><dt>Region</dt><dd>${region.name}</dd><dt>Collector pool</dt><dd class="mono">${app.pool}</dd><dt>Platform</dt><dd>${app.platform === 'kubernetes' ? 'Kubernetes' : 'Virtual machines'}</dd></dl>
              <ul class="plain small">${D.signals.map((s) => { const r = region.signals[s]; return html`<li>${fmt.cap(s)}: ${r.status === 'healthy' ? html`<span class="chip chip-success">${ui.icon('check')}Healthy</span>` : html`<span class="chip chip-warn">${ui.icon('alert')}${fmt.cap(r.status)}</span>`} <span class="muted">lag ${r.lag}</span></li>`; })}</ul>
            </section>
            ${app.dashboards.length ? html`<section class="card" aria-labelledby="h-dash"><h2 class="card-title" id="h-dash">${ui.icon('grid')}Dashboards</h2>
              <ul class="plain">${app.dashboards.map((d) => html`<li><button type="button" class="link-btn" data-action="open-external" data-what="${d}">${d}</button></li>`)}</ul></section>` : ''}
          </div>
        </div>`;
    },
  };
  OperA.actions['open-external'] = (el) => OperA.toast(`“${el.dataset.what}” would open in your dashboard tool. External tools aren’t connected in this prototype.`, 'info');
  OperA.route(/^\/apps\/([A-Z]+-\d+)$/, OperA.views.appDetail);
})();
