/* OperA — about this prototype, with one-click scenario launchers for design reviews */
(function () {
  'use strict';
  const OperA = window.OperA;
  const { html, store, ui } = OperA;

  const SCENARIOS = [
    { id: 'A-App', workflow: 'Telemetry onboarding', role: 'app', start: '#/onboard', who: 'Jordan Kim · application developer, new to observability',
      task: 'Onboard metrics, logs and traces for rewards-api in qa without asking anyone for help. Expect the logs check to fail first.' },
    { id: 'A-Ops', workflow: 'Telemetry onboarding', role: 'ops', start: '#/alerts', who: 'Sam Ortiz · DevOps engineer on shift',
      task: 'Handle ALR-2044 (Merchant Portal 5xx). Ownership and procedure data are incomplete. Find who to contact and fix the gaps for next time.' },
    { id: 'B-App', workflow: 'Alert investigation', role: 'app', start: '#/home', who: 'Jordan Kim · first on-call shift',
      task: 'You’re primary on-call for Rewards Engine and ALR-2045 just fired. Work out what’s wrong and what you’re allowed to do about it.' },
    { id: 'B-Ops', workflow: 'Alert investigation', role: 'ops', start: '#/alerts', who: 'Sam Ortiz · DevOps engineer on shift',
      task: 'Handle ALR-2041 (Checkout latency). Decide whether a rollback is warranted and get it approved, without running anything yourself.' },
    { id: 'C-App', workflow: 'Application or telemetry?', role: 'app', start: '#/home', who: 'Jordan Kim · application developer',
      task: 'Your qa logs aren’t showing up in search yet. Find out whether you broke something.' },
    { id: 'C-Ops', workflow: 'Application or telemetry?', role: 'ops', start: '#/alerts', who: 'Sam Ortiz · DevOps engineer on shift',
      task: 'ALR-2042 says Ledger Sync has “no data”. Decide whether to page Core Ledger.' },
    { id: 'D-App', workflow: 'Ask, paste or jump', role: 'app', start: '#/home', who: 'Jordan Kim · application developer',
      task: 'You edited your settings by hand. Before deploying, find out whether they’re right. Try the example “Settings sent to the wrong environment” in Fix-it, or paste your own into the box.' },
    { id: 'D-Ops', workflow: 'Ask, paste or jump', role: 'ops', start: '#/home', who: 'Sam Ortiz · DevOps engineer on shift',
      task: 'Someone messages you “ALR-2041?”. Get to that alert, find who owns the application and write a handoff note, using the box at the top.' },
  ];

  OperA.views.about = {
    title: () => 'About this prototype',
    render() {
      return html`
        ${ui.pageHead({ eyebrow: 'OperA prototype', title: 'About this prototype', lead: 'OperA is an application-centred, self-service observability platform. North Star: less chasing, more solving.' })}
        ${ui.callout('warn', 'Everything here is fictional', html`<p>Applications, people, alerts and telemetry are made up, and no real systems are connected. The assistant is scripted. Fix-it is real: it runs fixed rules in your browser against the fictional registry.</p>`)}
        <div class="grid grid-2">
          <section class="card" aria-labelledby="h-who"><h2 class="card-title" id="h-who">${ui.icon('users')}One interface for everyone</h2>
            <p>There is one OperA, with no beginner or expert mode. <strong>Ask, paste or pick</strong>: type a question, paste a log line or settings, or choose a goal card. Help sits beside each choice for anyone who wants it, and the fast paths (the box at the top, keyboard shortcuts, “as code”) are always there.</p>
            <p><strong>Application teams</strong> onboard telemetry themselves and check their setup before deploying. <strong>DevOps and operations</strong> see who owns an alert, whether the data can be trusted, and what to do next. Risky actions still need a second person.</p>
            <p class="small muted">“View as” in the top bar switches between the two jobs. The sun or moon button changes colours only.</p></section>
          <section class="card" aria-labelledby="h-how"><h2 class="card-title" id="h-how">${ui.icon('info')}Reviewing states</h2>
            <p>Open <strong>Prototype controls</strong> (in the dark strip at the very top of the page) to force validation outcomes (realistic, all pass, blocked, misconfigured, no data yet) and list states (normal, empty, unavailable). Purple dashed boxes on pages simulate other people’s decisions, such as an approver approving.</p>
            <p class="small muted">The design notes and usability scenarios are in the repository under <span class="mono">opera/docs/</span>.</p></section>
        </div>
        <section class="section" aria-labelledby="h-sc"><h2 class="section-title" id="h-sc">Usability scenarios</h2>
          <p class="small muted">Start a scenario to reset the prototype, switch to the right person, and open the starting screen. These scripts were walked through with simulated personas. They are not results from testing with real users.</p>
          <ul class="action-list">${SCENARIOS.map((s) => html`<li class="action-item"><div class="action-main">
            <div class="action-tags"><span class="chip chip-neutral">${s.id}</span><span class="chip chip-info">${s.workflow}</span></div>
            <div class="action-title">${s.who}</div><div class="action-why">${s.task}</div></div>
            <button type="button" class="btn" data-action="start-scenario" data-role="${s.role}" data-start="${s.start}">Start ${s.id}</button></li>`)}</ul>
        </section>`;
    },
  };
  OperA.actions['start-scenario'] = (el) => {
    store.reset({ keepPrefs: true });
    store.state.role = el.dataset.role; store.save();
    OperA.toast('Prototype reset for this scenario.', 'info');
    OperA.go(el.dataset.start);
  };
  OperA.route(/^\/about$/, OperA.views.about);
})();
