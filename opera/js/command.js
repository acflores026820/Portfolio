/*
 * OperA — command bar: ask, paste or jump.
 *
 * One box for everyone. A first-timer sees plain suggestions before typing;
 * someone who knows the product types an ID or a few words and presses Enter.
 * Recognition is rule-based: IDs, pasted logs or settings, a few intents
 * ("onboard …", "who owns …"), then search, then the assistant.
 *
 * Accessibility: WAI-ARIA combobox with a listbox popup (aria-activedescendant).
 */
(function () {
  'use strict';
  const OperA = window.OperA;
  const { html, reg, alerts, requests, lint, store, ui } = OperA;
  const D = OperA.data;

  /* ---------- understanding the text ---------- */
  const words = (t) => t.toLowerCase().replace(/[^a-z0-9-]+/g, ' ').trim();
  /** The application and (if named) service a phrase is about. */
  function findTarget(text) {
    const t = words(text);
    const camr = (text.toUpperCase().match(/CAMR-?\d{6}/) || [])[0];
    if (camr) { const app = reg.app(camr.replace(/^CAMR-?/, 'CAMR-')); if (app) return { app, service: null }; }
    for (const app of reg.activeApps()) for (const s of app.services) if (t.includes(s.name)) return { app, service: s.name };
    let best = null;
    reg.activeApps().forEach((app) => {
      const name = app.name.toLowerCase();
      const first = name.split(' ')[0];
      const score = t.includes(name) ? 2 : (first.length > 3 && new RegExp(`\\b${first}\\b`).test(t) ? 1 : 0);
      if (score && (!best || score > best.score)) best = { app, score };
    });
    return best ? { app: best.app, service: null } : null;
  }
  const findEnv = (text) => { const m = words(text).match(/\b(dev|qa|prod|production)\b/); return m ? (m[1] === 'production' ? 'prod' : m[1]) : null; };

  const go = (hash) => () => OperA.go(hash);
  const opt = (group, icon, title, sub, run) => ({ group, icon, title, sub, run });

  const STARTERS = {
    app: [
      ['plus', 'Set up telemetry for a service', 'Onboarding, with every value filled in', '#/onboard'],
      ['check', 'Check a log line or my settings', 'Fix-it tells you what to change before you deploy', '#/fix'],
      ['activity', 'Is it me or the platform?', 'Find out whether missing data is your problem', '#/health'],
      ['layers', 'Review my coverage', 'See what’s missing and fix it in one click', '#/coverage'],
    ],
    ops: [
      ['bell', 'Work the alert queue', 'Most urgent first, with the next step for each', '#/alerts'],
      ['activity', 'Check telemetry health', 'See whether an alert is the app or the pipeline', '#/health'],
      ['layers', 'Review coverage gaps', 'Applications that would be hard to investigate', '#/coverage?scope=all'],
      ['book', 'Find a handling procedure', 'Step-by-step procedures by application', '#/runbooks'],
    ],
  };
  const PAGES = [
    [/onboard|set ?up|instrument/, 'plus', 'Onboard telemetry', '#/onboard'],
    [/fix|check|lint|valid|config|setting|log line/, 'check', 'Check my setup (Fix-it)', '#/fix'],
    [/coverage|gap|readiness|missing signal/, 'layers', 'Coverage review', '#/coverage'],
    [/health|platform|pipeline|collector|incident/, 'activity', 'Telemetry health', '#/health'],
    [/alert|queue|triage|page/, 'bell', 'Alerts', '#/alerts'],
    [/request|status|progress|approval/, 'list', 'Onboarding requests', '#/requests'],
    [/procedure|runbook|playbook/, 'book', 'Handling procedures', '#/runbooks'],
    [/application|apps|registry|camr/, 'grid', 'Applications', '#/apps'],
  ];

  function suggest(text) {
    const t = String(text || '').trim();
    const role = store.state.role;
    if (!t) {
      return [
        ...STARTERS[role].map(([icon, title, sub, href]) => opt('Try', icon, title, sub, go(href))),
        opt('Try', 'sparkle', 'Ask a question', 'For example: “why are my logs missing?”', () => OperA.assistant.open()),
      ];
    }
    const out = [];
    const low = t.toLowerCase();
    const up = t.toUpperCase();

    /* 1. IDs */
    const idm = up.match(/\b(ALR|REQ|RB|TEL)-?(\d{2,5})\b/);
    if (idm) {
      const id = `${idm[1]}-${idm[2]}`;
      if (idm[1] === 'ALR' && alerts.get(id)) out.push(opt('Best match', 'bell', `Open alert ${id}`, alerts.get(id).title, go(`#/alerts/${id}`)));
      if (idm[1] === 'REQ' && requests.get(id)) out.push(opt('Best match', 'list', `Open request ${id}`, `${reg.app(requests.get(id).camrId).name} · ${requests.get(id).service} · ${requests.get(id).env}`, go(`#/requests/${id}`)));
      if (idm[1] === 'RB' && reg.runbook(id)) out.push(opt('Best match', 'book', `Open procedure ${id}`, reg.runbook(id).title, go(`#/runbooks/${id}`)));
      const inc = D.telemetry.incidents.find((i) => i.id === id);
      if (inc) out.push(opt('Best match', 'activity', `Open telemetry incident ${id}`, inc.title, go('#/health')));
    }
    const camr = reg.parseCamr(t);
    const camrId = camr.valid ? camr.id : camr.suggestion;
    if (camrId && reg.app(camrId)) out.push(opt('Best match', 'grid', `Open ${reg.app(camrId).name}`, camr.valid ? camrId : `Did you mean ${camrId}? CAMR IDs have a dash after “CAMR”.`, go(`#/apps/${camrId}`)));

    /* 2. Something pasted: a log line or settings */
    const kind = lint.detect(t);
    if (kind !== 'unknown') out.push(opt('Best match', 'check', kind === 'log' ? 'Check this log line with Fix-it' : 'Check these settings with Fix-it', 'Finds what’s wrong and shows the fix', () => OperA.fixit.open(t)));

    /* 3. Intents */
    const target = findTarget(t);
    const env = findEnv(t);
    if (/\b(onboard|set ?up|setup|instrument|monitor)\b|add (metrics|logs|traces|telemetry)/.test(low)) {
      const q = target ? `?${new URLSearchParams(Object.assign({ app: target.app.camrId }, target.service ? { service: target.service } : {}, env ? { env } : {}))}` : '';
      out.push(opt('Best match', 'plus', target ? `Onboard telemetry for ${target.service || target.app.name}${env ? ` in ${env}` : ''}` : 'Onboard telemetry', target ? 'Opens onboarding with this filled in' : 'Choose your application on the next screen', go(`#/onboard${q}`)));
    }
    if (target && /\b(who|owner|owns|on-?call|contact|team)\b/.test(low)) {
      out.push(opt('Best match', 'users', `See who owns ${target.app.name}`, target.app.onCall ? `${target.app.owningTeam} · on-call ${target.app.onCall.primary}` : `${target.app.owningTeam} · no on-call registered`, go(`#/apps/${target.app.camrId}`)));
    }
    if (/missing|not showing|aren.?t showing|delayed|flowing|arriving|my fault|me or|platform|no data|broke/.test(low)) {
      const q = target ? `?${new URLSearchParams(Object.assign({ app: target.app.camrId }, env ? { env } : {}))}` : '';
      out.push(opt('Best match', 'activity', `Check whether it’s you or the platform${target ? `: ${target.app.name}` : ''}`, 'One verdict, with the evidence', go(`#/health${q}`)));
    }

    /* 4. Go to: matching things */
    const seen = new Set(out.map((o) => o.title));
    const push = (o) => { if (!seen.has(o.title) && out.filter((x) => x.group === 'Go to').length < 6) { seen.add(o.title); out.push(o); } };
    if (!camrId) reg.searchApps(t).slice(0, 3).forEach((a) => push(opt('Go to', 'grid', `Open ${a.name}`, `${a.camrId} · ${a.owningTeam}`, go(`#/apps/${a.camrId}`))));
    alerts.all().filter((a) => a.title.toLowerCase().includes(low)).slice(0, 3).forEach((a) => push(opt('Go to', 'bell', `Open alert ${a.id}`, a.title, go(`#/alerts/${a.id}`))));
    D.runbooks.filter((r) => r.title.toLowerCase().includes(low)).slice(0, 2).forEach((r) => push(opt('Go to', 'book', `Open procedure ${r.id}`, r.title, go(`#/runbooks/${r.id}`))));
    PAGES.filter(([re]) => re.test(low)).slice(0, 3).forEach(([, icon, title, href]) => push(opt('Go to', icon, title, 'Open this screen', go(href))));

    /* 5. Ask, then search */
    if (/\s/.test(t) || /\?$/.test(t)) out.push(opt('Ask', 'sparkle', `Ask OperA: “${t.length > 60 ? `${t.slice(0, 57)}…` : t}”`, 'A read-only answer with its sources', () => OperA.assistant.ask(t)));
    out.push(opt('Search', 'search', `Search everything for “${t.length > 40 ? `${t.slice(0, 37)}…` : t}”`, 'Applications, services, alerts, requests and procedures', go(`#/search?q=${encodeURIComponent(t)}`)));
    return out;
  }

  /* ---------- the combobox ---------- */
  function attach(box) {
    if (box.dataset.cmdReady) return;
    box.dataset.cmdReady = '1';
    const input = box.querySelector('input');
    const pop = box.querySelector('.cmd-pop');
    const list = pop.querySelector('[role="listbox"]');
    let options = [];
    let active = -1;

    const render = () => {
      options = suggest(input.value);
      active = input.value.trim() ? 0 : -1;
      const groups = [];
      options.forEach((o, i) => { let g = groups.find((x) => x.name === o.group); if (!g) groups.push(g = { name: o.group, items: [] }); g.items.push([o, i]); });
      list.innerHTML = String(html`${groups.map((g, gi) => html`<div role="group" aria-labelledby="${list.id}-g${gi}">
        <div class="cmd-group" id="${list.id}-g${gi}">${g.name}</div>
        ${g.items.map(([o, i]) => html`<div role="option" class="cmd-option" id="${list.id}-o${i}" data-index="${i}" aria-selected="${i === active}">
          ${ui.icon(o.icon)}<span class="cmd-option-text"><span class="cmd-option-title">${o.title}</span><span class="cmd-option-sub">${o.sub}</span></span></div>`)}
      </div>`)}`);
      sync();
    };
    const sync = () => {
      list.querySelectorAll('[role="option"]').forEach((el) => el.setAttribute('aria-selected', String(Number(el.dataset.index) === active)));
      if (active >= 0) { input.setAttribute('aria-activedescendant', `${list.id}-o${active}`); const el = document.getElementById(`${list.id}-o${active}`); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); }
      else input.removeAttribute('aria-activedescendant');
    };
    const open = () => { render(); pop.hidden = false; input.setAttribute('aria-expanded', 'true'); };
    const close = () => { pop.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
    const run = (i) => {
      const o = options[i];
      if (!o) return;
      input.value = ''; close(); input.blur();
      o.run();
    };

    input.addEventListener('focus', open);
    input.addEventListener('input', open);
    input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) close(); }, 120));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (pop.hidden) { open(); return; }
        const n = options.length;
        active = e.key === 'ArrowDown' ? (active + 1) % n : (active - 1 + n) % n;
        sync();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (pop.hidden) open();
        run(active >= 0 ? active : (input.value.trim() ? 0 : -1));
      } else if (e.key === 'Escape') {
        if (!pop.hidden) { e.preventDefault(); e.stopPropagation(); close(); } else if (input.value) { input.value = ''; }
      }
    });
    // Settings and stack traces span several lines, which a one-line box can't hold: send them straight to Fix-it.
    input.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (/\n/.test(text.trim()) && lint.detect(text) !== 'unknown') {
        e.preventDefault(); input.value = ''; close(); input.blur();
        OperA.announce('Recognised what you pasted. Opening Fix-it.');
        OperA.fixit.open(text);
      }
    });
    list.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus in the box while clicking an option
    list.addEventListener('click', (e) => { const el = e.target.closest('[role="option"]'); if (el) run(Number(el.dataset.index)); });
  }
  function mount(root = document) { root.querySelectorAll('[data-cmd]').forEach(attach); }

  /** Markup for a command box. The top bar has one; the home screen has a large one. */
  function box(id, { hero = false, placeholder = 'Ask, paste or jump…' } = {}) {
    return html`<div class="cmd ${hero ? 'cmd-hero' : ''}" data-cmd>
      <label for="${id}" class="${hero ? 'cmd-label' : 'sr-only'}">Ask a question, paste a log line or settings, or type a name or ID</label>
      ${ui.icon('search', 'cmd-icon')}
      <input id="${id}" type="text" role="combobox" aria-expanded="false" aria-controls="${id}-list" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="${placeholder}" />
      <div class="cmd-pop" hidden><div id="${id}-list" role="listbox" aria-label="Suggestions"></div></div>
    </div>`;
  }

  /* Ctrl+K (or ⌘K) from anywhere. It has a modifier, so it can't clash with typing. */
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const dlg = document.getElementById('modal'); if (dlg.open) return;
      const input = document.getElementById('cmd-hero') || document.getElementById('cmd-input');
      input.focus(); input.select();
    }
  });
  /** Example chips: do the thing, so a first-timer sees a result in one click. */
  OperA.actions['cmd-example'] = (el) => { const first = suggest(el.dataset.text)[0]; if (first) first.run(); };

  OperA.cmd = { suggest, mount, box, findTarget };
  mount();
})();
