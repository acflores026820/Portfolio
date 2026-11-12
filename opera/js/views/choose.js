/* OperA — layout chooser: two layouts to select from, for each kind of user */
(function () {
  'use strict';
  const OperA = window.OperA;
  const { html, raw, store, ui } = OperA;

  /* Decorative wireframe thumbnails (hidden from assistive technology; the text beside them says the same). */
  const L = { bg: '#f5f6f8', card: '#ffffff', line: '#d5dae1', ink: '#9aa3af', accent: '#1f4fd1', warn: '#e7a23a', bad: '#d03b3b', ok: '#2f9e55' };
  const K = { bg: '#0e1014', card: '#171a21', line: '#2d333e', ink: '#5d6878', accent: '#4f7cff', warn: '#d99a00', bad: '#d03b3b', ok: '#3fb56a' };
  const r = (x, y, w, h, fill, rx = 3) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;
  const frame = (c, inner) => `<svg viewBox="0 0 320 170" aria-hidden="true" focusable="false">${r(0, 0, 320, 170, c.bg, 0)}${inner}</svg>`;
  const sidebar = (c) => r(0, 0, 320, 16, c.card, 0) + r(8, 5, 34, 6, c.accent) + r(0, 16, 56, 154, c.card, 0) + [26, 40, 54, 68, 82].map((y, i) => r(8, y, 40, 7, i === 0 ? c.accent : c.line)).join('');
  const topnav = (c) => r(0, 0, 320, 16, c.card, 0) + r(8, 5, 34, 6, c.accent) + r(0, 17, 320, 12, c.card, 0) + [8, 52, 96, 140, 184].map((x, i) => r(x, 20, 36, 6, i === 0 ? c.accent : c.line)).join('');
  const PREVIEW = {
    'app-guided': frame(L, sidebar(L) + r(68, 26, 110, 9, L.ink) + r(262, 24, 48, 12, L.accent)
      + [44, 70, 96].map((y, i) => r(68, y, 242, 22, L.card) + r(74, y + 5, 28, 5, [L.bad, L.bad, L.warn][i]) + r(74, y + 13, 130, 4, L.line) + r(266, y + 6, 38, 10, L.line)).join('')
      + r(68, 128, 117, 34, L.card) + r(193, 128, 117, 34, L.card) + r(74, 148, 60, 5, L.ok) + r(199, 148, 30, 5, L.ok)),
    'app-console': frame(K, topnav(K) + r(8, 36, 304, 10, K.card) + r(12, 39, 24, 4, K.bad) + r(8, 48, 304, 10, K.card) + r(12, 51, 24, 4, K.warn)
      + r(8, 64, 196, 60, K.card) + [0, 1, 2].map((row) => r(14, 72 + row * 16, 50, 6, K.line) + [0, 1, 2].map((col) => [0, 1, 2].map((s) => r(78 + col * 42 + s * 11, 71 + row * 16, 9, 8, (row + col + s) % 3 === 0 ? K.ok : (row + col) % 2 ? K.ink : K.warn, 2)).join('')).join('')).join('')
      + r(212, 64, 100, 60, K.card) + r(218, 72, 60, 5, K.warn) + r(218, 82, 84, 4, K.line)
      + [0, 1, 2, 3].map((i) => r(8 + i * 77, 130, 73, 34, K.card) + r(13 + i * 77, 135, 30, 4, K.ink) + r(13 + i * 77, 144, 63, 14, [K.bad, K.line, K.line, K.ok][i], 2)).join('')),
    'ops-guided': frame(L, sidebar(L) + r(68, 26, 90, 9, L.ink)
      + [0, 1, 2, 3].map((i) => r(68 + i * 62, 42, 56, 26, L.card) + r(74 + i * 62, 48, 26, 4, L.line) + r(74 + i * 62, 56, 14, 7, L.ink)).join('')
      + r(68, 76, 242, 86, L.card) + [0, 1, 2, 3, 4].map((i) => r(74, 84 + i * 15, 22, 7, [L.bad, L.warn, L.warn, L.warn, L.line][i]) + r(102, 85 + i * 15, 96, 5, L.ink) + r(208, 85 + i * 15, 34, 5, L.line) + r(250, 85 + i * 15, 52, 5, L.line)).join('')),
    'ops-console': frame(K, topnav(K) + r(8, 36, 88, 128, K.card)
      + [0, 1, 2, 3, 4].map((i) => r(8, 42 + i * 24, 88, 22, i === 0 ? '#1a2440' : K.card, 0) + r(8, 42 + i * 24, 2, 22, i === 0 ? K.accent : K.card, 0) + r(14, 46 + i * 24, 18, 5, [K.bad, K.warn, K.warn, K.warn, K.ink][i]) + r(14, 55 + i * 24, 70, 4, K.line)).join('')
      + r(102, 36, 132, 12, K.card) + r(106, 40, 80, 4, K.ink) + r(102, 52, 132, 18, K.card) + r(106, 57, 60, 4, K.line) + r(196, 56, 32, 10, K.accent)
      + r(102, 74, 132, 46, K.card) + `<polyline points="108,108 126,106 144,107 160,104 174,88 190,84 206,86 226,82" fill="none" stroke="${K.accent}" stroke-width="2"/>` + r(108, 92, 118, 1, K.bad, 0)
      + r(102, 124, 132, 40, K.card) + [0, 1, 2].map((i) => r(108, 131 + i * 10, 6, 6, K.line, 1) + r(118, 132 + i * 10, 90, 4, K.line)).join('')
      + r(240, 36, 72, 52, K.card) + r(246, 42, 40, 4, K.ink) + [0, 1, 2].map((i) => r(246, 52 + i * 10, 56, 4, K.line)).join('')
      + r(240, 92, 72, 72, K.card) + r(246, 98, 40, 4, K.ink) + [0, 1, 2, 3].map((i) => r(246, 108 + i * 13, 8, 8, i === 1 ? K.bad : K.line, 4) + r(258, 110 + i * 13, 44, 4, K.line)).join('')),
  };

  /* Interaction counts come from tests/walkthroughs.js, which runs every scenario in both layouts. */
  const INFO = {
    app: {
      title: 'Application teams', sub: 'Onboarding telemetry and looking after your own applications',
      task: 'Onboard a service',
      guided: { summary: 'Step by step, with explanations along the way.',
        best: 'People new to observability, or anyone who onboards a service now and then.',
        home: 'A prioritised list: your next actions, then what you’re waiting on.',
        work: 'Onboarding in four steps, with one decision per screen.',
        cost: 'More screens. Slower if you set up many components in a row.', count: '11 interactions' },
      console: { summary: 'Everything on one screen, built for repeat work.',
        best: 'People who know the terms already and manage several components.',
        home: 'A coverage board (every component and environment) and a request pipeline.',
        work: 'Onboarding on one page, with a live readiness panel.',
        cost: 'Denser. Explanations stay folded away until you open them.', count: '8 interactions' },
    },
    ops: {
      title: 'DevOps and operations', sub: 'Triage, escalation and handling procedures',
      task: 'Handle a “no data” alert',
      guided: { summary: 'One alert at a time, with room for the reasoning.',
        best: 'Occasional responders, application on-call, handovers and training.',
        home: 'Triage numbers and a “needs attention” table.',
        work: 'A queue, then a full page for each alert.',
        cost: 'You lose sight of the queue while you’re inside an alert.', count: '5 interactions' },
      console: { summary: 'Queue, alert and ownership side by side.',
        best: 'On-shift responders working through several alerts.',
        home: 'The triage console itself. The most urgent alert is already open.',
        work: 'Three panes, with J and K to move between alerts.',
        cost: 'Needs a wide screen. A lot to take in for a newcomer.', count: '3 interactions' },
    },
  };
  const NAME = { guided: 'Guided', console: 'Console' };

  function card(role, design) {
    const i = INFO[role][design];
    const selected = store.state.chosen && store.state.design[role] === design;
    return html`<article class="card choose-card ${selected ? 'is-selected' : ''}" aria-labelledby="h-${role}-${design}">
      <div class="choose-preview">${raw(PREVIEW[`${role}-${design}`])}</div>
      <div class="card-head"><h3 id="h-${role}-${design}">${NAME[design]}</h3>${selected ? html`<span class="chip chip-success">${ui.icon('check')}Selected</span>` : ''}</div>
      <p>${i.summary}</p>
      <dl class="kv">
        <dt>Best for</dt><dd>${i.best}</dd>
        <dt>Home</dt><dd>${i.home}</dd>
        <dt>Main work</dt><dd>${i.work}</dd>
        <dt>Trade-off</dt><dd>${i.cost}</dd>
        <dt>Scripted run</dt><dd>${INFO[role].task}: ${i.count}</dd>
      </dl>
      <button type="button" class="btn ${selected ? '' : 'btn-primary'}" data-action="set-design" data-role="${role}" data-design="${design}" data-go="#/home">Use ${NAME[design]} for ${role === 'app' ? 'application teams' : 'DevOps'}</button>
    </article>`;
  }

  OperA.views.choose = {
    title: () => 'Choose your layout',
    render() {
      return html`
        ${ui.pageHead({ eyebrow: 'Two layouts, one OperA', title: 'Choose your layout',
          lead: 'OperA comes in two layouts. Pick one for each kind of work. You can change your mind at any time with “Layout” in the top bar.' })}
        ${ui.callout('info', 'Only the presentation changes', html`<p>Both layouts use the same data, checks, handling procedures and approvals. Nothing is easier to get wrong in one than in the other, and production changes need a second person in both.</p>`)}
        ${['app', 'ops'].map((role) => html`<section class="section" aria-labelledby="h-choose-${role}">
          <h2 class="section-title" id="h-choose-${role}">${INFO[role].title} <span class="muted small">· ${INFO[role].sub}</span></h2>
          <div class="grid grid-2">${card(role, 'guided')}${card(role, 'console')}</div>
        </section>`)}
        <p class="small muted" style="margin-top:16px">Interaction counts are from scripted walkthroughs of this prototype (see <span class="mono">opera/docs/usability-scenarios.md</span>). They are not results from testing with real users.
          Not sure? Start with Guided for application teams and Console for DevOps. That’s what the design review suggests trying first.</p>`;
    },
  };
  OperA.route(/^\/choose$/, OperA.views.choose);
})();
