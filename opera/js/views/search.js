/* OperA — global search: applications, CAMR IDs, services, alerts, requests, procedures */
(function () {
  'use strict';
  const OperA = window.OperA;
  const { html, reg, alerts, requests, ui, fmt } = OperA;
  const D = OperA.data;

  function find(q) {
    const s = q.trim().toLowerCase();
    if (!s) return null;
    const apps = reg.searchApps(q, { includeRetired: true });
    const services = [];
    D.applications.forEach((a) => a.services.forEach((sv) => { if (sv.name.includes(s)) services.push({ a, sv }); }));
    const al = alerts.all().filter((a) => a.id.toLowerCase().includes(s) || a.title.toLowerCase().includes(s));
    const rq = requests.all().filter((r) => r.id.toLowerCase().includes(s));
    const rb = D.runbooks.filter((r) => r.id.toLowerCase().includes(s) || r.title.toLowerCase().includes(s));
    return { apps, services, al, rq, rb, total: apps.length + services.length + al.length + rq.length + rb.length };
  }
  /** Jump straight to an exact ID match; otherwise show results. */
  OperA.forms['global-search'] = (form) => {
    const q = form.elements.q.value.trim();
    if (!q) return;
    const up = q.toUpperCase();
    if (/^CAMR-\d{6}$/.test(up) && reg.app(up)) return OperA.go(`#/apps/${up}`);
    if (/^ALR-\d+$/.test(up) && alerts.get(up)) return OperA.go(`#/alerts/${up}`);
    if (/^REQ-\d+$/.test(up) && requests.get(up)) return OperA.go(`#/requests/${up}`);
    if (/^RB-\d+$/.test(up) && reg.runbook(up)) return OperA.go(`#/runbooks/${up}`);
    OperA.go(`#/search?q=${encodeURIComponent(q)}`);
  };

  OperA.views.search = {
    title: (_, q) => `Search: ${q.q || ''}`,
    render(_, q) {
      const query = q.q || '';
      const r = find(query);
      const parsed = reg.parseCamr(query);
      const group = (title, items, fn) => (items.length ? html`<section class="section" aria-label="${title}"><h2 class="section-title">${title} <span class="muted small">(${items.length})</span></h2><ul class="action-list">${items.map(fn)}</ul></section>` : '');
      const li = (href, title, sub, chip) => html`<li class="action-item"><div class="action-main"><div class="action-title"><a href="${href}">${title}</a> ${chip || ''}</div><div class="action-why">${sub}</div></div></li>`;
      return html`
        ${ui.pageHead({ title: `Results for “${query}”`, lead: r ? `${fmt.plural(r.total, 'result')}` : 'Type something to search.' })}
        ${r && !r.total ? html`${parsed.looksLike && parsed.suggestion ? ui.callout('info', `Did you mean ${parsed.suggestion}?`, html`<p>CAMR IDs look like CAMR-104233. <a href="#/search?q=${parsed.suggestion}">Search for ${parsed.suggestion}</a></p>`) : ''}
          ${ui.emptyState({ title: 'Nothing matched', body: 'Try an application name (Checkout API), a CAMR ID (CAMR-104233), a service (rewards-api), or an alert ID (ALR-2041).' })}` : ''}
        ${r ? group('Applications', r.apps, (a) => li(`#/apps/${a.camrId}`, a.name, `${a.camrId} · ${a.owningTeam} · Tier ${a.tier}`, a.status === 'retired' ? html`<span class="chip chip-neutral">${ui.icon('minus')}Retired</span>` : '')) : ''}
        ${r ? group('Services', r.services, ({ a, sv }) => li(`#/apps/${a.camrId}`, sv.name, `${a.name} · ${sv.description}`)) : ''}
        ${r ? group('Alerts', r.al, (a) => li(`#/alerts/${a.id}`, `${a.id} · ${a.title}`, `${reg.app(a.camrId).name} · ${a.env}`, ui.alertStatus(a.status))) : ''}
        ${r ? group('Onboarding requests', r.rq, (x) => li(`#/requests/${x.id}`, x.id, `${reg.app(x.camrId).name} · ${x.service} · ${x.env}`, ui.reqStatus(x.status))) : ''}
        ${r ? group('Handling procedures', r.rb, (x) => li(`#/runbooks/${x.id}`, x.title, `${x.id} · ${x.owner}`)) : ''}`;
    },
  };
  OperA.route(/^\/search$/, OperA.views.search);
})();
