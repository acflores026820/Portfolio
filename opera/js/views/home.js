/* OperA — role-aware home */
(function () {
  'use strict';
  const OperA = window.OperA;
  const { html, fmt, reg, tel, alerts, requests, store, ui } = OperA;
  const D = OperA.data;

  const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

  /** Coverage across all components of an app in one environment. */
  function covSummary(app, env) {
    const counts = { active: 0, partial: 0, onboarding: 0, none: 0 };
    app.services.forEach((s) => s.components.forEach((c) => {
      if (!s.envs.includes(env)) return;
      const cv = reg.coverage(app, s.name, c.name, env);
      D.signals.forEach((sig) => { counts[cv[sig]] += 1; });
    }));
    counts.total = counts.active + counts.partial + counts.onboarding + counts.none;
    return counts;
  }
  function covBar(c, label) {
    const pct = (n) => (c.total ? (n / c.total) * 100 : 0);
    return html`<div>
      <div class="cov-bar" role="img" aria-label="${label}: ${c.active} of ${c.total} signals active, ${c.partial} partial, ${c.onboarding} onboarding, ${c.none} not set up">
        ${c.active ? html`<span class="seg-active" style="width:${pct(c.active)}%"></span>` : ''}
        ${c.partial ? html`<span class="seg-partial" style="width:${pct(c.partial)}%"></span>` : ''}
        ${c.onboarding ? html`<span class="seg-onboarding" style="width:${pct(c.onboarding)}%"></span>` : ''}
      </div></div>`;
  }
  OperA.covSummary = covSummary; OperA.covBar = covBar;

  /** What needs the application developer, most urgent first. Shared by both layouts. */
  function appActions() {
    const me = D.personas.app;
    const myApps = reg.myApps();
    const myCamr = me.apps;
    const actions = [];

    // 1. Alerts where I'm on-call
    alerts.open().filter((a) => myCamr.includes(a.camrId)).forEach((a) => {
      const app = reg.app(a.camrId);
      const onCall = app.onCall && (app.onCall.primary === me.name ? 'primary' : app.onCall.secondary === me.name ? 'secondary' : null);
      actions.push({
        rank: 0, tags: html`${ui.sev(a.severity)} <span class="chip chip-neutral">${ui.icon('bell')}Alert</span>`,
        title: `${a.title}`,
        why: onCall ? `You’re ${onCall} on-call for ${app.name}. ${a.summary}` : a.summary,
        href: `#/alerts/${a.id}`, cta: 'Open alert',
      });
    });
    // 2. Requests that need me
    requests.all().filter((r) => myCamr.includes(r.camrId) && requests.next(r).owner === 'you').forEach((r) => {
      const app = reg.app(r.camrId);
      actions.push({
        rank: 1, tags: html`${ui.reqStatus(r.status)} <span class="chip chip-neutral">${ui.icon('list')}${r.id}</span>`,
        title: `${app.name} · ${r.service} (${r.env}): ${requests.next(r).text}`,
        why: 'Your onboarding request can’t continue until this is fixed. The fix guide is on the request.',
        href: `#/requests/${r.id}`, cta: 'See how to fix',
      });
    });
    // 3. Draft
    if (store.state.draft && store.state.draft.camrId) {
      const app = reg.app(store.state.draft.camrId);
      actions.push({ rank: 2, tags: html`<span class="chip chip-info">${ui.icon('clock')}Draft</span>`,
        title: `Finish onboarding ${app ? app.name : 'your application'}${store.state.draft.service ? ` · ${store.state.draft.service}` : ''}`,
        why: 'Your answers are saved. Pick up where you left off.', href: '#/onboard', cta: 'Continue' });
    }
    // 4. Production coverage gaps
    myApps.forEach((app) => {
      const gaps = [];
      app.services.forEach((s) => s.components.forEach((c) => {
        if (!s.envs.includes('prod')) return;
        const cv = reg.coverage(app, s.name, c.name, 'prod');
        const missing = D.signals.filter((sig) => cv[sig] === 'none');
        if (missing.length) gaps.push(`${s.name}/${c.name}: ${missing.join(', ')}`);
      }));
      if (gaps.length) actions.push({ rank: 3, tags: html`<span class="chip chip-warn">${ui.icon('alert')}Coverage gap</span>`,
        title: `${app.name}: ${fmt.plural(gaps.length, 'component')} missing signals in prod`,
        why: `${gaps.join(' · ')}. During incidents, responders can only see what’s onboarded.`,
        href: `#/apps/${app.camrId}?env=prod`, cta: 'Review coverage' });
    });
    return actions.sort((a, b) => a.rank - b.rank);
  }
  OperA.appActions = appActions;

  function appHome() {
    const me = D.personas.app;
    const myApps = reg.myApps();
    const myCamr = me.apps;
    const actions = appActions();
    const waiting = requests.all().filter((r) => myCamr.includes(r.camrId) && ['approver', 'platform'].includes(requests.next(r).owner));
    const affected = myApps.some((a) => tel.incidentsFor(a).length);

    return html`
      ${ui.pageHead({ eyebrow: 'Application team · Loyalty Engineering', title: `${greet()}, ${me.name.split(' ')[0]}`,
        lead: 'Here’s what needs you. Everything else is either handled or waiting on someone else, and you can see who.',
        actions: html`<a class="btn btn-primary" href="#/onboard">${ui.icon('plus')}Onboard telemetry</a>` })}
      ${affected ? myApps.filter((a) => tel.incidentsFor(a).length).slice(0, 1).map((a) => ui.incidentBanner({ app: a })) : ''}

      <section class="section" aria-labelledby="h-next">
        <h2 class="section-title" id="h-next">Your next actions</h2>
        ${actions.length ? html`<ul class="action-list">${actions.map((x) => html`<li class="action-item">
            <div class="action-main"><div class="action-tags">${x.tags}</div><div class="action-title">${x.title}</div><div class="action-why">${x.why}</div></div>
            <a class="btn" href="${x.href}">${x.cta}${ui.icon('arrow')}</a></li>`)}</ul>`
          : ui.emptyState({ title: 'Nothing needs you right now', body: 'Your applications are healthy and your requests are moving.' })}
      </section>

      <section class="section" aria-labelledby="h-wait">
        <h2 class="section-title" id="h-wait">Waiting on someone else</h2>
        ${waiting.length ? html`<div class="table-wrap"><table class="table">
          <thead><tr><th scope="col">Request</th><th scope="col">Status</th><th scope="col">Who’s on it</th><th scope="col">What’s happening</th></tr></thead>
          <tbody>${waiting.map((r) => { const n = requests.next(r); const app = reg.app(r.camrId); return html`<tr>
            <td><a class="row-title" href="#/requests/${r.id}">${r.id}</a><div class="row-sub">${app.name} · ${r.service} · ${r.env}</div></td>
            <td>${ui.reqStatus(r.status)}</td><td>${n.owner === 'approver' ? r.approver : requests.ownerLabel[n.owner]}</td><td class="small">${n.text}</td></tr>`; })}</tbody>
          </table></div>` : html`<p class="muted">Nothing is waiting on others.</p>`}
      </section>

      <section class="section" aria-labelledby="h-apps">
        <h2 class="section-title" id="h-apps">Your applications</h2>
        <div class="grid grid-2">${myApps.map((app) => {
          const c = covSummary(app, 'prod');
          const open = alerts.open().filter((a) => a.camrId === app.camrId);
          return html`<article class="card app-card">
            <div class="card-head"><h3><a href="#/apps/${app.camrId}">${app.name}</a></h3><span class="mono small">${app.camrId}</span></div>
            <p class="small muted">${app.description}</p>
            <div><div class="small"><strong>Production telemetry:</strong> ${c.total ? `${c.active} of ${c.total} signals active` : 'No production environment registered'}</div>
              ${c.total ? covBar(c, `${app.name} production coverage`) : ''}</div>
            <div class="btn-row">${open.length ? html`<a class="chip chip-danger" href="#/alerts?app=${app.camrId}">${ui.icon('bell')}${fmt.plural(open.length, 'open alert')}</a>` : html`<span class="chip chip-success">${ui.icon('check')}No open alerts</span>`}
              <a class="btn btn-sm btn-ghost" href="#/apps/${app.camrId}">View application${ui.icon('arrow')}</a></div>
          </article>`; })}</div>
        <div class="cov-legend" style="margin-top:10px" aria-hidden="true"><span class="lg-active">Active</span><span class="lg-partial">Partial</span><span class="lg-onboarding">Onboarding</span><span class="lg-none">Not set up</span></div>
      </section>

      <section class="section card" aria-labelledby="h-primer">
        <h2 class="card-title" id="h-primer">${OperA.ui.icon('book')}New to observability? Start here</h2>
        <div class="grid grid-3">
          <div><h3>Metrics</h3><p class="small">${D.glossary.metrics.text}</p></div>
          <div><h3>Logs</h3><p class="small">${D.glossary.logs.text}</p></div>
          <div><h3>Traces</h3><p class="small">${D.glossary.traces.text}</p></div>
        </div>
        <p class="small" style="margin-top:12px">Onboarding takes about 15 minutes per component. OperA fills in your configuration from the application registry and checks it for you. You don’t need to know how the collectors work.</p>
        <a class="btn btn-primary" href="#/onboard">Start onboarding</a>
      </section>`;
  }

  function opsHome() {
    const me = D.personas.ops;
    const open = alerts.sort(alerts.open());
    const assessed = open.map((a) => ({ a, as: tel.assess(a), esc: null }));
    assessed.forEach((x) => { x.esc = alerts.escalation(x.a, x.as); });
    const newCount = open.filter((a) => a.status === 'new').length;
    const telCount = assessed.filter((x) => x.as.verdict !== 'application').length;
    const dueCount = assessed.filter((x) => x.esc.due && x.a.status !== 'resolved').length;
    const gapCount = assessed.filter((x) => !reg.app(x.a.camrId).onCall || !x.a.runbook).length;
    const pendingApprovals = alerts.all().flatMap((a) => a.approvals.filter((p) => p.state === 'pending').map((p) => ({ a, p })));
    const resolved = alerts.all().filter((a) => a.status === 'resolved');

    return html`
      ${ui.pageHead({ eyebrow: 'DevOps / Operations · on shift', title: `${greet()}, ${me.name.split(' ')[0]}`,
        lead: 'Start with what needs action. OperA marks alerts that come from telemetry problems so you don’t page application teams for them.',
        actions: html`<a class="btn btn-primary" href="#/alerts">${ui.icon('bell')}Open alert queue</a>` })}
      ${ui.incidentBanner()}
      <div class="grid grid-4">
        <a class="stat" href="#/alerts?status=new"><div class="stat-label">${ui.icon('bell')}New alerts</div><div class="stat-value">${newCount}</div><div class="stat-sub">Not acknowledged yet</div></a>
        <a class="stat" href="#/alerts?verdict=not-app"><div class="stat-label">${ui.icon('activity')}Telemetry-related</div><div class="stat-value">${telCount}</div><div class="stat-sub">Check the data before paging</div></a>
        <a class="stat" href="#/alerts"><div class="stat-label">${ui.icon('clock')}Escalations due</div><div class="stat-value">${dueCount}</div><div class="stat-sub">Per escalation policy</div></a>
        <a class="stat" href="#/alerts?gap=1"><div class="stat-label">${ui.icon('flag')}Ownership or procedure gaps</div><div class="stat-value">${gapCount}</div><div class="stat-sub">No on-call or no procedure</div></a>
      </div>

      <section class="section" aria-labelledby="h-attn">
        <div class="card-head"><h2 class="section-title" id="h-attn" style="margin:0">Needs attention</h2><a href="#/alerts">All alerts</a></div>
        ${open.length ? html`<div class="table-wrap"><table class="table">
          <thead><tr><th scope="col">Severity</th><th scope="col">Alert</th><th scope="col">App or telemetry?</th><th scope="col">Status</th><th scope="col">Next step</th></tr></thead>
          <tbody>${assessed.slice(0, 6).map(({ a, as }) => { const app = reg.app(a.camrId); const n = alerts.nextStep(a); return html`<tr>
            <td>${ui.sev(a.severity)}</td>
            <td><a class="row-title" href="#/alerts/${a.id}">${a.title}</a><div class="row-sub">${app.name} · ${a.env} · started ${ui.timeAgo(a.startedAt)}</div></td>
            <td>${ui.verdictChip(as.verdict)}</td><td>${ui.alertStatus(a.status)}</td><td class="small">${n.text}</td></tr>`; })}</tbody></table></div>`
          : ui.emptyState({ title: 'No open alerts', body: 'All quiet.' })}
      </section>

      ${pendingApprovals.length ? html`<section class="section" aria-labelledby="h-appr"><h2 class="section-title" id="h-appr">Waiting for approval</h2>
        <ul class="action-list">${pendingApprovals.map(({ a, p }) => html`<li class="action-item"><div class="action-main"><div class="action-tags"><span class="chip chip-info">${ui.icon('shield')}Awaiting approval</span></div>
          <div class="action-title">${p.title}</div><div class="action-why">Requested ${fmt.rel(p.at)} for ${a.id}. Approver: ${p.approver}. Nothing runs until they approve.</div></div>
          <a class="btn" href="#/alerts/${a.id}">Open alert</a></li>`)}</ul></section>` : ''}

      <section class="section" aria-labelledby="h-res"><h2 class="section-title" id="h-res">Recently resolved</h2>
        ${resolved.length ? html`<ul class="plain">${resolved.map((a) => html`<li><a href="#/alerts/${a.id}">${a.id} · ${a.title}</a> <span class="muted small">· ${a.resolution || ''}</span></li>`)}</ul>` : html`<p class="muted">Nothing resolved in the last 24 hours.</p>`}
      </section>`;
  }

  OperA.views.home = {
    title: () => 'Home',
    render(params, q) {
      if (OperA.design() === 'console') return store.state.role === 'app' ? OperA.views.workspace.render() : OperA.views.triage.render([], q);
      return store.state.role === 'app' ? appHome() : opsHome();
    },
    mount(root, params, q) {
      return OperA.design() === 'console' && store.state.role === 'ops' ? OperA.views.triage.mount(root, [], q) : false;
    },
  };
  OperA.route(/^\/home$/, OperA.views.home);
})();
