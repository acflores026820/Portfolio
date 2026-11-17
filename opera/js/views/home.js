/*
 * OperA — home. One screen for everyone: ask, paste or pick.
 * The big box takes a question, a pasted log line or settings, or a name or ID.
 * The goal cards say the same things in plain words for anyone who'd rather click.
 */
(function () {
  'use strict';
  const OperA = window.OperA;
  const { html, fmt, reg, tel, alerts, requests, store, ui } = OperA;
  const D = OperA.data;

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

  /** What needs the application developer, most urgent first. */
  function appActions() {
    const me = D.personas.app;
    const myCamr = me.apps;
    const actions = [];
    alerts.open().filter((a) => myCamr.includes(a.camrId)).forEach((a) => {
      const app = reg.app(a.camrId);
      const onCall = app.onCall && (app.onCall.primary === me.name ? 'primary' : app.onCall.secondary === me.name ? 'secondary' : null);
      actions.push({ rank: 0, tags: html`${ui.sev(a.severity)} <span class="chip chip-neutral">${ui.icon('bell')}Alert</span>`,
        title: a.title, why: onCall ? `You’re ${onCall} on-call for ${app.name}. ${a.summary}` : a.summary, href: `#/alerts/${a.id}`, cta: 'Open alert' });
    });
    requests.all().filter((r) => myCamr.includes(r.camrId) && requests.next(r).owner === 'you').forEach((r) => {
      const app = reg.app(r.camrId);
      actions.push({ rank: 1, tags: html`${ui.reqStatus(r.status)} <span class="chip chip-neutral">${ui.icon('list')}${r.id}</span>`,
        title: `${app.name} · ${r.service} (${r.env}): ${requests.next(r).text}`,
        why: 'Your onboarding request can’t continue until this is fixed. The fix is on the request.', href: `#/requests/${r.id}`, cta: 'See how to fix' });
    });
    if (store.state.draft && store.state.draft.camrId) {
      const app = reg.app(store.state.draft.camrId);
      actions.push({ rank: 2, tags: html`<span class="chip chip-info">${ui.icon('clock')}Draft</span>`,
        title: `Finish onboarding ${app ? app.name : 'your application'}${store.state.draft.service ? ` · ${store.state.draft.service}` : ''}`,
        why: 'Your answers are saved. Pick up where you left off.', href: '#/onboard', cta: 'Continue' });
    }
    reg.myApps().forEach((app) => {
      const r = OperA.readiness(app);
      const gaps = r.items.filter((i) => !i.ok && !i.pending);
      if (gaps.length) actions.push({ rank: 3, tags: html`<span class="chip chip-warn">${ui.icon('alert')}Coverage</span>`,
        title: `${app.name} is ${r.score} of ${r.total} ready for an incident`,
        why: `Not ready: ${gaps.map((g) => g.label.toLowerCase()).join(', ')}. Responders can only investigate what’s onboarded.`, href: '#/coverage', cta: 'Review coverage' });
    });
    return actions.sort((a, b) => a.rank - b.rank);
  }

  const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
  const GOALS = {
    app: [
      { icon: 'plus', title: 'Set up telemetry', text: 'Get metrics, logs and traces flowing for a service. Every value is filled in for you.', href: '#/onboard', cta: 'Start onboarding' },
      { icon: 'check', title: 'Check my setup', text: 'Paste a log line or your settings. Fix-it tells you what to change before you deploy.', href: '#/fix', cta: 'Open Fix-it' },
      { icon: 'activity', title: 'Is it me or the platform?', text: 'Data missing or late? Get one verdict, with the evidence, before you change anything.', href: '#/health', cta: 'Check now' },
      { icon: 'layers', title: 'Review my coverage', text: 'See how ready each application is for an incident, and fix gaps in one click.', href: '#/coverage', cta: 'Review coverage' },
    ],
    ops: [
      { icon: 'bell', title: 'Work the alert queue', text: 'Most urgent first. Each alert says who owns it, whether the data can be trusted, and what to do next.', href: '#/alerts', cta: 'Open alerts' },
      { icon: 'activity', title: 'App or telemetry?', text: 'Check the pipeline before paging an application team for missing or odd data.', href: '#/health', cta: 'Check telemetry' },
      { icon: 'users', title: 'Find an owner', text: 'Type an application, service or CAMR ID in the box above to see who owns it and who’s on call.', focus: true, cta: 'Find an owner' },
      { icon: 'layers', title: 'Review coverage gaps', text: 'See which applications would be hard to investigate, and ask their teams to close the gaps.', href: '#/coverage?scope=all', cta: 'Review coverage' },
    ],
  };
  const EXAMPLES = {
    app: [ 'Onboard rewards-api in qa', 'Why are my logs missing?', 'ALR-2045', '2026-11-06 09:14:02 INFO Accrual batch 8812 complete' ],
    ops: [ 'ALR-2041', 'Who owns Merchant Portal?', 'Is Ledger Sync data missing?', 'CAMR-104233' ],
  };
  const exampleLabel = (t) => (/^\d{4}-\d{2}-\d{2}/.test(t) ? 'Paste a log line' : t);

  function hero(role) {
    const p = D.personas[role];
    return html`<section class="hero" aria-labelledby="h-hero">
      <p class="eyebrow">${role === 'app' ? `Application team · ${p.team}` : 'DevOps / Operations · on shift'}</p>
      <h1 id="h-hero">${greet()}, ${p.name.split(' ')[0]}. What do you need to do?</h1>
      ${OperA.cmd.box('cmd-hero', { hero: true, placeholder: role === 'app' ? 'Try “onboard rewards-api in qa”, or paste a log line' : 'Try “ALR-2041”, or “who owns Merchant Portal?”' })}
      <p class="hero-examples"><span class="muted small">Examples:</span>
        ${EXAMPLES[role].map((t) => html`<button type="button" class="quick-pick" data-action="cmd-example" data-text="${t}">${exampleLabel(t)}</button>`)}</p>
      <p class="small muted kbd-hint">Press <kbd>Ctrl</kbd> <kbd>K</kbd> on any screen to come back to this box.</p>
    </section>`;
  }
  function goals(role) {
    return html`<section class="section" aria-labelledby="h-goals">
      <h2 class="section-title" id="h-goals">Or pick what you want to do</h2>
      <div class="grid grid-4">${GOALS[role].map((g, i) => html`<article class="card goal-card" aria-labelledby="h-goal-${i}">
        <h3 id="h-goal-${i}">${ui.icon(g.icon)}${g.title}</h3>
        <p class="small">${g.text}</p>
        ${g.focus ? html`<button type="button" class="btn btn-sm" data-action="cmd-focus" data-text="who owns ">${g.cta}</button>`
          : html`<a class="btn btn-sm" href="${g.href}">${g.cta}${ui.icon('arrow')}</a>`}
      </article>`)}</div>
    </section>`;
  }
  OperA.actions['cmd-focus'] = (el) => {
    const input = document.getElementById('cmd-hero') || document.getElementById('cmd-input');
    input.value = el.dataset.text || ''; input.focus();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  function appHome() {
    const me = D.personas.app;
    const myApps = reg.myApps();
    const actions = appActions();
    const waiting = requests.all().filter((r) => me.apps.includes(r.camrId) && ['approver', 'platform'].includes(requests.next(r).owner));
    const affected = myApps.find((a) => tel.incidentsFor(a).length);
    return html`
      ${hero('app')}
      ${affected ? ui.incidentStrip(affected) : ''}
      ${goals('app')}
      <section class="section" aria-labelledby="h-next">
        <h2 class="section-title" id="h-next">Needs you <span class="muted">(${actions.length})</span></h2>
        ${actions.length ? html`<ul class="action-list">${actions.map((x) => html`<li class="action-item">
            <div class="action-main"><div class="action-tags">${x.tags}</div><div class="action-title">${x.title}</div><div class="action-why">${x.why}</div></div>
            <a class="btn" href="${x.href}">${x.cta}${ui.icon('arrow')}</a></li>`)}</ul>`
          : ui.emptyState({ title: 'Nothing needs you right now', body: 'Your applications are healthy and your requests are moving.' })}
      </section>
      <section class="section" aria-labelledby="h-wait">
        <h2 class="section-title" id="h-wait">Waiting on someone else</h2>
        ${waiting.length ? html`<div class="table-wrap"><table class="table">
          <caption class="sr-only">Requests waiting on someone else</caption>
          <thead><tr><th scope="col">Request</th><th scope="col">Status</th><th scope="col">Who’s on it</th><th scope="col">What’s happening</th></tr></thead>
          <tbody>${waiting.map((r) => { const n = requests.next(r); const app = reg.app(r.camrId); return html`<tr>
            <td><a class="row-title" href="#/requests/${r.id}">${r.id}</a><div class="row-sub">${app.name} · ${r.service} · ${r.env}</div></td>
            <td>${ui.reqStatus(r.status)}</td><td>${n.owner === 'approver' ? r.approver : requests.ownerLabel[n.owner]}</td><td class="small">${n.text}</td></tr>`; })}</tbody>
          </table></div>` : html`<p class="muted">Nothing is waiting on others.</p>`}
      </section>
      <section class="section" aria-labelledby="h-apps">
        <h2 class="section-title" id="h-apps">Your applications</h2>
        <div class="grid grid-2">${myApps.map((app) => {
          const r = OperA.readiness(app);
          const open = alerts.open().filter((a) => a.camrId === app.camrId);
          return html`<article class="card app-card">
            <div class="card-head"><h3><a href="#/apps/${app.camrId}">${app.name}</a></h3><span class="mono small">${app.camrId}</span></div>
            <p class="small muted">${app.description}</p>
            <div class="ready-score"><strong>${r.score} of ${r.total} ready</strong> <span class="muted small">for an incident (${r.env})</span>${OperA.readinessMeter(r, app.name)}</div>
            <div class="btn-row">${open.length ? html`<a class="chip chip-danger" href="#/alerts?app=${app.camrId}&scope=all">${ui.icon('bell')}${fmt.plural(open.length, 'open alert')}</a>` : html`<span class="chip chip-success">${ui.icon('check')}No open alerts</span>`}
              <a class="btn btn-sm btn-ghost" href="#/coverage">What’s missing?${ui.icon('arrow')}</a></div>
          </article>`; })}</div>
      </section>
      <details class="section card primer"><summary><strong>New to observability?</strong> Three terms in three sentences</summary>
        <div class="grid grid-3" style="margin-top:12px">
          <div><h3>Metrics</h3><p class="small">${D.glossary.metrics.text}</p></div>
          <div><h3>Logs</h3><p class="small">${D.glossary.logs.text}</p></div>
          <div><h3>Traces</h3><p class="small">${D.glossary.traces.text}</p></div>
        </div>
        <p class="small" style="margin-top:10px">Onboarding takes about 15 minutes per component. OperA fills in your settings from the application registry and checks them for you. You don’t need to know how the collectors work.</p>
      </details>`;
  }

  function opsHome() {
    const open = alerts.sort(alerts.open());
    const assessed = open.map((a) => { const as = tel.assess(a); return { a, as, esc: alerts.escalation(a, as) }; });
    const newCount = open.filter((a) => a.status === 'new').length;
    const telCount = assessed.filter((x) => x.as.verdict !== 'application').length;
    const dueCount = assessed.filter((x) => x.esc.due).length;
    const gapCount = assessed.filter((x) => !reg.app(x.a.camrId).onCall || !x.a.runbook).length;
    const pending = alerts.all().flatMap((a) => a.approvals.filter((p) => p.state === 'pending').map((p) => ({ a, p })));
    const resolved = alerts.all().filter((a) => a.status === 'resolved');
    return html`
      ${hero('ops')}
      ${ui.incidentStrip()}
      ${goals('ops')}
      <section class="section" aria-labelledby="h-now">
        <h2 class="section-title" id="h-now">Right now</h2>
        <div class="grid grid-4">
          <a class="stat" href="#/alerts?status=new"><div class="stat-label">${ui.icon('bell')}New alerts</div><div class="stat-value">${newCount}</div><div class="stat-sub">Not acknowledged yet</div></a>
          <a class="stat" href="#/alerts?kind=not-app"><div class="stat-label">${ui.icon('activity')}Telemetry-related</div><div class="stat-value">${telCount}</div><div class="stat-sub">Check the data before paging</div></a>
          <a class="stat" href="#/alerts"><div class="stat-label">${ui.icon('clock')}Escalations due</div><div class="stat-value">${dueCount}</div><div class="stat-sub">Per escalation policy</div></a>
          <a class="stat" href="#/alerts?gap=1"><div class="stat-label">${ui.icon('flag')}Ownership or procedure gaps</div><div class="stat-value">${gapCount}</div><div class="stat-sub">No on-call or no procedure</div></a>
        </div>
      </section>
      <section class="section" aria-labelledby="h-attn">
        <div class="card-head"><h2 class="section-title" id="h-attn" style="margin:0">Needs attention</h2><a href="#/alerts">Open the alert queue</a></div>
        ${open.length ? html`<div class="table-wrap"><table class="table">
          <caption class="sr-only">Alerts that need attention, most urgent first</caption>
          <thead><tr><th scope="col">Severity</th><th scope="col">Alert</th><th scope="col">App or telemetry?</th><th scope="col">Status</th><th scope="col">Next step</th></tr></thead>
          <tbody>${assessed.slice(0, 6).map(({ a, as }) => { const app = reg.app(a.camrId); return html`<tr>
            <td>${ui.sev(a.severity)}</td>
            <td><a class="row-title" href="#/alerts/${a.id}">${a.title}</a><div class="row-sub">${app.name} · ${a.env} · started ${ui.timeAgo(a.startedAt)}</div></td>
            <td>${ui.verdictChip(as.verdict)}</td><td>${ui.alertStatus(a.status)}</td><td class="small">${alerts.nextStep(a).text}</td></tr>`; })}</tbody></table></div>`
          : ui.emptyState({ title: 'No open alerts', body: 'All quiet.' })}
      </section>
      ${pending.length ? html`<section class="section" aria-labelledby="h-appr"><h2 class="section-title" id="h-appr">Waiting for approval</h2>
        <ul class="action-list">${pending.map(({ a, p }) => html`<li class="action-item"><div class="action-main"><div class="action-tags"><span class="chip chip-info">${ui.icon('shield')}Awaiting approval</span></div>
          <div class="action-title">${p.title}</div><div class="action-why">Requested ${fmt.rel(p.at)} for ${a.id}. Approver: ${p.approver}. Nothing runs until they approve.</div></div>
          <a class="btn" href="#/alerts/${a.id}">Open alert</a></li>`)}</ul></section>` : ''}
      <section class="section" aria-labelledby="h-res"><h2 class="section-title" id="h-res">Recently resolved</h2>
        ${resolved.length ? html`<ul class="plain">${resolved.map((a) => html`<li><a href="#/alerts/${a.id}?status=all">${a.id} · ${a.title}</a> <span class="muted small">· ${a.resolution || ''}</span></li>`)}</ul>` : html`<p class="muted">Nothing resolved in the last 24 hours.</p>`}
      </section>`;
  }

  OperA.views.home = {
    title: () => 'Home',
    render: () => (store.state.role === 'app' ? appHome() : opsHome()),
    mount(root) { OperA.cmd.mount(root); return false; },
  };
  OperA.route(/^\/home$/, OperA.views.home);
})();
