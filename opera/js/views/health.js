/* OperA — telemetry platform health ("is it us or them?") */
(function () {
  'use strict';
  const OperA = window.OperA;
  const { html, raw, fmt, reg, tel, alerts, store, ui } = OperA;
  const D = OperA.data;

  const regionChip = (s) => s.status === 'healthy' ? html`<span class="chip chip-success">${ui.icon('check')}Healthy</span>`
    : s.status === 'delayed' ? html`<span class="chip chip-warn">${ui.icon('clock')}Delayed</span>` : html`<span class="chip chip-danger">${ui.icon('x')}Degraded</span>`;

  function appCheck(camrId, env) {
    const app = reg.app(camrId);
    if (!app) return '';
    const rows = [];
    app.services.forEach((s) => s.components.forEach((c) => { if (s.envs.includes(env)) rows.push({ s, c, f: tel.freshness(app, s.name, c.name, env) }); }));
    const affected = tel.incidentsFor(app);
    return html`${affected.length ? ui.callout('tel', `${app.name} is affected by ${affected.map((i) => i.id).join(' and ')}`, html`<p>${affected.map((i) => i.impact).join(' ')}</p><p>Missing or delayed data for this application is a platform problem. ${app.owningTeam} doesn’t need to change anything.</p>`)
        : ui.callout('success', `No platform problems affect ${app.name}`, html`<p>If data looks wrong, the cause is probably in the application or its configuration. Check the application’s onboarding requests and validation results.</p>`)}
      ${rows.length ? html`<div class="table-wrap" style="box-shadow:none"><table class="table"><caption class="sr-only">Data freshness for ${app.name} in ${env}</caption>
        <thead><tr><th scope="col">Service / component</th><th scope="col">Metrics</th><th scope="col">Logs</th><th scope="col">Traces</th></tr></thead>
        <tbody>${rows.map(({ s, c, f }) => html`<tr><th scope="row" class="mono" style="text-align:left;font-weight:600">${s.name}/${c.name}</th>${D.signals.map((sig) => html`<td>${ui.freshChip(f[sig])}</td>`)}</tr>`)}</tbody></table></div>` : html`<p class="muted">No components registered in ${env}.</p>`}`;
  }

  OperA.views.health = {
    title: () => 'Telemetry health',
    render() {
      const incidents = D.telemetry.incidents;
      const defaultApp = store.state.role === 'app' ? D.personas.app.apps[0] : 'CAMR-100871';
      return html`
        ${ui.pageHead({ title: 'Telemetry health', lead: 'Is it the application or the telemetry pipeline? Check here before paging an application team, or before debugging your own configuration.' })}
        ${incidents.length ? '' : ui.callout('success', 'All telemetry pipelines are healthy', html`<p>Metrics, logs and traces are arriving normally in every region.</p>`)}
        ${incidents.map((i) => {
          const apps = D.applications.filter((a) => a.status === 'active' && tel.incidentsFor(a).some((x) => x.id === i.id));
          const linked = alerts.open().filter((a) => apps.some((p) => p.camrId === a.camrId));
          return html`<section class="card" aria-labelledby="h-${i.id}" style="border-left:4px solid var(--tel)">
            <div class="card-head"><h2 class="card-title" id="h-${i.id}" style="margin:0">${ui.icon('activity')}${i.id} · ${i.title}</h2>
              <span class="btn-row">${ui.sev(i.severity)}<span class="chip chip-tel">${ui.icon('clock')}${i.status}</span></span></div>
            <p class="small muted">Started ${ui.timeAgo(i.startedAt)} · Owner: ${i.owner} (${i.ownerPerson}) · Next update ${fmt.rel(i.nextUpdateAt)}</p>
            <p><strong>Impact:</strong> ${i.impact}</p>
            <div class="grid grid-2" style="margin-top:12px">
              <div class="callout callout-info" style="margin:0">${ui.icon('bell', 'callout-icon')}<div class="callout-content"><p class="callout-title">If you’re responding to alerts</p><div class="callout-body">${i.responderGuidance}</div></div></div>
              <div class="callout callout-success" style="margin:0">${ui.icon('users', 'callout-icon')}<div class="callout-content"><p class="callout-title">If you’re on an application team</p><div class="callout-body">Nothing to fix on your side. Don’t change your configuration because of this. Your data ${i.effect === 'delayed' ? 'will backfill automatically.' : 'will resume when the collectors recover.'}</div></div></div>
            </div>
            <h3 style="margin-top:14px">Affected applications</h3>
            <p class="small">${apps.map((a, k) => html`${k ? ', ' : ''}<a href="#/apps/${a.camrId}">${a.name}</a>`)}${i.estimatedAffected > apps.length ? html` and about ${i.estimatedAffected - apps.length} others not shown in this prototype` : ''}.</p>
            ${linked.length ? html`<h3 style="margin-top:10px">Open alerts on affected applications</h3><ul class="plain small">${linked.map((a) => html`<li>${ui.verdictChip(tel.assess(a).verdict)} <a href="#/alerts/${a.id}">${a.id} · ${a.title}</a></li>`)}</ul>` : ''}
            <details style="margin-top:12px"><summary class="link-btn">Updates (${i.updates.length})</summary><ol class="timeline" style="margin-top:8px">${i.updates.slice().reverse().map((u) => html`<li><div>${u.text}</div><div class="tl-meta">${ui.timeAgo(u.at)}</div></li>`)}</ol></details>
          </section>`;
        })}
        <section class="section" aria-labelledby="h-regions">
          <h2 class="section-title" id="h-regions">Pipelines by region</h2>
          <div class="table-wrap"><table class="table"><caption class="sr-only">Telemetry pipeline status by region and signal</caption>
            <thead><tr><th scope="col">Region</th><th scope="col">Metrics</th><th scope="col">Logs</th><th scope="col">Traces</th><th scope="col">Collector pools</th></tr></thead>
            <tbody>${D.telemetry.regions.map((r) => html`<tr><th scope="row" style="text-align:left">${r.name}</th>
              ${D.signals.map((s) => html`<td><div class="cell-stack">${regionChip(r.signals[s])}<span class="row-sub">Lag ${r.signals[s].lag} · dropped ${r.signals[s].drop}</span></div></td>`)}
              <td>${r.pools.map((p) => html`<div class="small"><span class="mono">${p.id}</span> ${p.status === 'healthy' ? html`<span class="chip chip-success">${ui.icon('check')}Healthy</span>` : html`<span class="chip chip-danger">${ui.icon('x')}Degraded</span><div class="row-sub">${p.note}</div>`}</div>`)}</td></tr>`)}</tbody></table></div>
        </section>
        <section class="section card" aria-labelledby="h-check">
          <h2 class="card-title" id="h-check">${ui.icon('search')}Check one application</h2>
          <div class="toolbar">
            <div class="field"><label for="hc-app">Application</label><select id="hc-app" data-change="health-app">${D.applications.filter((a) => a.status === 'active').map((a) => html`<option value="${a.camrId}" ${a.camrId === defaultApp ? raw('selected') : ''}>${a.name} (${a.camrId})</option>`)}</select></div>
            <div class="field"><label for="hc-env">Environment</label><select id="hc-env" data-change="health-app">${D.envs.map((e) => html`<option value="${e}" ${e === 'prod' ? raw('selected') : ''}>${e}</option>`)}</select></div>
          </div>
          <div id="health-app" aria-live="polite">${appCheck(defaultApp, 'prod')}</div>
        </section>`;
    },
  };
  OperA.changes['health-app'] = () => {
    document.getElementById('health-app').innerHTML = String(appCheck(document.getElementById('hc-app').value, document.getElementById('hc-env').value));
    OperA.markScrollable();
  };
  OperA.route(/^\/health$/, OperA.views.health);
})();
