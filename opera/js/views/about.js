/* OperA — about this prototype, with one-click scenario launchers for design reviews */
(function () {
  'use strict';
  const OperA = window.OperA;
  const { html, store, ui } = OperA;

  const SCENARIOS = [
    { id: 'A-App', workflow: 'Telemetry onboarding', role: 'app', start: '#/onboard', who: 'Jordan Kim · application developer, new to observability',
      task: 'Onboard metrics, logs and traces for rewards-api in qa without asking anyone for help. Expect the logs check to fail first.' },
    { id: 'A-Ops', workflow: 'Telemetry onboarding', role: 'ops', start: '#/alerts', console: '#/home', who: 'Sam Ortiz · DevOps engineer on shift',
      task: 'Handle ALR-2044 (Merchant Portal 5xx). Ownership and procedure data are incomplete. Find who to contact and fix the gaps for next time.' },
    { id: 'B-Ops', workflow: 'Alert investigation', role: 'ops', start: '#/alerts', console: '#/home', who: 'Sam Ortiz · DevOps engineer on shift',
      task: 'Handle ALR-2041 (Checkout latency). Decide whether a rollback is warranted and get it approved, without running anything yourself.' },
    { id: 'B-App', workflow: 'Alert investigation', role: 'app', start: '#/home', who: 'Jordan Kim · first on-call shift',
      task: 'You’re primary on-call for Rewards Engine and ALR-2045 just fired. Work out what’s wrong and what you’re allowed to do about it.' },
    { id: 'C-Ops', workflow: 'Application or telemetry?', role: 'ops', start: '#/alerts', console: '#/home', who: 'Sam Ortiz · DevOps engineer on shift',
      task: 'ALR-2042 says Ledger Sync has “no data”. Decide whether to page Core Ledger.' },
    { id: 'C-App', workflow: 'Application or telemetry?', role: 'app', start: '#/home', who: 'Jordan Kim · application developer',
      task: 'Your qa logs aren’t showing up in search yet. Find out whether you broke something.' },
  ];

  OperA.views.about = {
    title: () => 'About this prototype',
    render() {
      return html`
        ${ui.pageHead({ eyebrow: 'OperA prototype', title: 'About this prototype', lead: 'OperA is an application-centred, self-service observability platform. North Star: less chasing, more solving.' })}
        ${ui.callout('warn', 'Everything here is fictional', html`<p>Applications, people, alerts and telemetry are made up, and no real systems are connected. The assistant is scripted. It shows the intended behaviour and safeguards, not a live model.</p>`)}
        <div class="grid grid-2">
          <section class="card" aria-labelledby="h-who"><h2 class="card-title" id="h-who">${ui.icon('users')}Who it’s for</h2>
            <p><strong>Application teams</strong> onboard metrics, logs and traces themselves, understand what failed and how to fix it, and always see their next action.</p>
            <p><strong>DevOps and operations</strong> see who owns an alert, whether it’s the application or the telemetry, the procedure to follow, and when to escalate. Risky actions still need human approval.</p>
            <p class="small muted">Use “View as” in the top bar to switch between the two perspectives.</p></section>
          <section class="card" aria-labelledby="h-how"><h2 class="card-title" id="h-how">${ui.icon('info')}Reviewing states</h2>
            <p><strong>Two layouts.</strong> Guided is step by step; Console puts everything on one screen. <a href="#/choose">Compare them and choose</a>, or switch with “Layout” in the top bar. Each role remembers its own layout.</p>
            <p>Open <strong>Prototype controls</strong> (bottom left) to force validation outcomes (realistic, all pass, blocked, misconfigured, no data yet) and list states (normal, empty, unavailable). Purple dashed boxes on pages simulate other people’s decisions, such as an approver approving.</p>
            <p class="small muted">The full design review and usability scenarios are in the repository under <span class="mono">opera/docs/</span>.</p></section>
        </div>
        <section class="section" aria-labelledby="h-sc"><h2 class="section-title" id="h-sc">Usability scenarios</h2>
          <p class="small muted">Start a scenario to reset the prototype, switch to the right person, and open the starting screen. These scripts were walked through with simulated personas. They are not results from testing with real users.</p>
          <ul class="action-list">${SCENARIOS.map((s) => html`<li class="action-item"><div class="action-main">
            <div class="action-tags"><span class="chip chip-neutral">${s.id}</span><span class="chip chip-info">${s.workflow}</span></div>
            <div class="action-title">${s.who}</div><div class="action-why">${s.task}</div></div>
            <div class="btn-row"><button type="button" class="btn" data-action="start-scenario" data-role="${s.role}" data-design="guided" data-start="${s.start}">Start ${s.id} in Guided</button>
              <button type="button" class="btn" data-action="start-scenario" data-role="${s.role}" data-design="console" data-start="${s.console || s.start}">Start ${s.id} in Console</button></div></li>`)}</ul>
        </section>`;
    },
  };
  OperA.actions['start-scenario'] = (el) => {
    store.reset({ keepPrefs: true });
    store.state.role = el.dataset.role; store.state.design[el.dataset.role] = el.dataset.design; store.state.chosen = true; store.save();
    OperA.toast(`Prototype reset for this scenario, ${el.dataset.design === 'console' ? 'Console' : 'Guided'} layout.`, 'info');
    OperA.go(el.dataset.start);
  };
  OperA.route(/^\/about$/, OperA.views.about);
})();
