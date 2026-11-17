/*
 * OperA — self-service helpers.
 *   Fix-it:          paste a log line or settings, get what's wrong and the fix
 *   Coverage review: a readiness score per application and one-click fixes
 */
(function () {
  'use strict';
  const OperA = window.OperA;
  const { html, fmt, reg, lint, store, ui } = OperA;
  const D = OperA.data;

  /* =====================================================================
   * Readiness: six things that decide how well an application can be
   * investigated during an incident. Used here, on home and on application pages.
   * ===================================================================== */
  function readiness(app) {
    const env = ['prod', 'qa', 'dev'].find((e) => app.services.some((s) => s.envs.includes(e)));
    const comps = [];
    app.services.forEach((s) => s.components.forEach((c) => { if (s.envs.includes(env)) comps.push({ s, c, cv: reg.coverage(app, s.name, c.name, env) }); }));
    const link = (x) => `#/onboard?app=${app.camrId}&service=${x.s.name}&component=${x.c.name}&env=${env}`;
    const names = (xs) => xs.map((x) => `${x.s.name}/${x.c.name}`).join(', ');
    const signal = (sig) => {
      const missing = comps.filter((x) => x.cv[sig] === 'none');
      const coming = comps.filter((x) => x.cv[sig] === 'onboarding');
      const ok = !missing.length && !coming.length;
      return { id: sig, label: `${fmt.cap(sig)} in ${env}`, ok,
        detail: ok ? 'Active for every component.' : missing.length ? `Not set up for ${names(missing)}.${coming.length ? ` In progress for ${names(coming)}.` : ''}` : `In progress for ${names(coming)}.`,
        action: missing.length ? { href: link(missing[0]), label: `Set up ${sig}` } : null, pending: !missing.length && coming.length > 0 };
    };
    const partial = comps.filter((x) => D.signals.some((s) => x.cv[s] === 'partial'));
    const rb = app.runbooks.map(reg.runbook).filter(Boolean);
    const stale = rb.filter(reg.runbookStale);
    const items = [
      signal('metrics'), signal('logs'), signal('traces'),
      { id: 'linked', label: 'Data linked to the application', ok: !partial.length,
        detail: partial.length ? `Some data from ${names(partial)} arrives without required attributes, so it may not link to ${app.name}.` : 'Every signal carries the required attributes.',
        action: partial.length ? { href: '#/fix', label: 'Check settings with Fix-it' } : null },
      { id: 'oncall', label: 'On-call registered', ok: !!app.onCall,
        detail: app.onCall ? `${app.onCall.primary} (primary), ${app.onCall.secondary} (secondary).` : 'Nobody can be paged for this application outside business hours.',
        action: app.onCall ? null : { report: app.camrId, label: 'Report to the app owner' } },
      { id: 'runbook', label: 'Current handling procedure', ok: rb.length > 0 && !stale.length,
        detail: !rb.length ? 'No procedure. Responders fall back to generic triage, which is slower.' : stale.length ? `${stale[0].title} is overdue for review.` : `${rb.length === 1 ? rb[0].title : `${rb.length} procedures`}, reviewed in the last 6 months.`,
        action: !rb.length ? { href: '#/runbooks', label: 'See procedures' } : stale.length ? { href: `#/runbooks/${stale[0].id}`, label: 'Open procedure' } : null },
    ];
    return { env, items, score: items.filter((i) => i.ok).length, total: items.length };
  }
  function readinessMeter(r, name) {
    return html`<div class="ready-meter" role="img" aria-label="${name} readiness: ${r.score} of ${r.total}">${r.items.map((i) => html`<span class="${i.ok ? 'on' : i.pending ? 'pending' : ''}"></span>`)}</div>`;
  }
  OperA.readiness = readiness;
  OperA.readinessMeter = readinessMeter;

  /* =====================================================================
   * Coverage review
   * ===================================================================== */
  const SIG_ICON = { active: 'check', partial: 'alert', onboarding: 'clock', none: 'minus' };
  const SIG_WORD = { active: 'active', partial: 'arriving without required attributes', onboarding: 'onboarding', none: 'not set up' };
  function covCell(app, s, c, env) {
    if (!s.envs.includes(env)) return html`<span class="muted" aria-hidden="true">—</span><span class="sr-only">Not deployed in ${env}</span>`;
    const cv = reg.coverage(app, s.name, c.name, env);
    const pills = html`<span class="sigs" aria-hidden="true">${D.signals.map((sig) => html`<span class="sig sig-${cv[sig]}">${sig[0].toUpperCase()}${ui.icon(SIG_ICON[cv[sig]])}</span>`)}</span>`;
    const said = D.signals.map((sig) => `${sig} ${SIG_WORD[cv[sig]]}`).join(', ');
    const gaps = D.signals.filter((sig) => cv[sig] === 'none' || cv[sig] === 'partial');
    if (!gaps.length || app.status !== 'active') return html`<span class="cov-cell">${pills}<span class="sr-only">${said}</span></span>`;
    return html`<a class="cov-cell cov-cell-link" href="#/onboard?app=${app.camrId}&service=${s.name}&component=${c.name}&env=${env}">${pills}<span class="sr-only">${s.name}/${c.name} in ${env}: ${said}. Set up ${gaps.join(' and ')}.</span></a>`;
  }
  function board(app) {
    const envs = D.envs.filter((e) => app.services.some((s) => s.envs.includes(e)));
    return html`<div class="table-wrap" style="box-shadow:none"><table class="table table-compact board-table">
      <caption class="sr-only">Telemetry coverage for ${app.name}, by component and environment. Choose a cell with gaps to set it up.</caption>
      <thead><tr><th scope="col">Component</th>${envs.map((e) => html`<th scope="col">${e}</th>`)}</tr></thead>
      <tbody>${app.services.map((s) => s.components.map((c) => html`<tr><th scope="row" class="mono">${s.name}/${c.name}</th>${envs.map((e) => html`<td>${covCell(app, s, c, e)}</td>`)}</tr>`))}</tbody>
    </table></div>`;
  }

  OperA.views.coverage = {
    title: () => 'Coverage review',
    render(_, q) {
      const role = store.state.role;
      const scope = q.scope === 'all' || q.scope === 'mine' ? q.scope : (role === 'app' ? 'mine' : 'all');
      let apps = reg.activeApps();
      if (scope === 'mine') apps = apps.filter((a) => D.personas.app.apps.includes(a.camrId));
      const rows = apps.map((app) => ({ app, r: readiness(app) })).sort((a, b) => a.app.tier - b.app.tier || a.r.score - b.r.score);
      const ready = rows.filter((x) => x.r.score === x.r.total).length;
      return html`
        ${ui.pageHead({ title: 'Coverage review', lead: 'How ready each application is for an incident, and what to fix first. Responders can only investigate what’s onboarded.' })}
        <div class="toolbar">
          <div class="seg" role="group" aria-label="Which applications">
            <button type="button" data-action="nav" data-href="#/coverage?scope=mine" aria-pressed="${scope === 'mine'}">Mine</button>
            <button type="button" data-action="nav" data-href="#/coverage?scope=all" aria-pressed="${scope === 'all'}">All</button>
          </div>
          <span class="muted small">${ready} of ${rows.length} ${rows.length === 1 ? 'application is' : 'applications are'} fully ready. Most critical first.</span>
        </div>
        <p class="small muted board-legend"><span><strong>M</strong> metrics · <strong>L</strong> logs · <strong>T</strong> traces</span>
          <span class="sig sig-active">${ui.icon('check')}Active</span><span class="sig sig-partial">${ui.icon('alert')}Partial</span><span class="sig sig-onboarding">${ui.icon('clock')}Onboarding</span><span class="sig sig-none">${ui.icon('minus')}Not set up</span>
          <span>Choose a cell with gaps to set it up.</span></p>
        ${rows.length ? rows.map(({ app, r }) => html`<section class="card coverage-card" aria-labelledby="h-cov-${app.camrId}">
          <div class="card-head">
            <h2 class="card-title" id="h-cov-${app.camrId}" style="margin:0"><a href="#/apps/${app.camrId}">${app.name}</a> <span class="mono small muted">${app.camrId}</span> <span class="chip chip-neutral">Tier ${app.tier}</span></h2>
            <div class="ready-score"><strong>${r.score} of ${r.total} ready</strong>${readinessMeter(r, app.name)}</div>
          </div>
          <div class="coverage-grid">
            <ul class="ready-list">${r.items.map((i) => html`<li class="ready-${i.ok ? 'ok' : i.pending ? 'wait' : 'bad'}">${ui.icon(i.ok ? 'check' : i.pending ? 'clock' : 'x')}
              <span><strong>${i.label}</strong><span class="sr-only"> ${i.ok ? '(ready)' : i.pending ? '(in progress)' : '(not ready)'}</span><br /><span class="small">${i.detail}</span>
                ${i.action ? html`<br />${i.action.report ? html`<button type="button" class="link-btn small" data-action="report-registry" data-camr="${i.action.report}">${i.action.label}</button>` : html`<a class="small" href="${i.action.href}">${i.action.label}</a>`}` : ''}</span></li>`)}</ul>
            <div>${board(app)}</div>
          </div>
        </section>`) : ui.emptyState({ title: 'No applications to review', body: 'OperA shows applications where the registry lists you as a member or on-call.', action: html`<a class="btn" href="#/coverage?scope=all">Show all applications</a>` })}`;
    },
  };
  OperA.route(/^\/coverage$/, OperA.views.coverage);

  /* =====================================================================
   * Fix-it
   * ===================================================================== */
  const rewards = () => ({ app: reg.app('CAMR-108840'), service: 'rewards-api', component: 'api', env: 'qa', signals: ['metrics', 'logs', 'traces'] });
  const EXAMPLES = [
    ['A plain-text log line', () => '2026-11-06 09:14:02 INFO Accrual batch 8812 complete'],
    ['A log line with no level', () => '{"timestamp":"2026-11-06T09:14:02Z","message":"Accrual batch 8812 complete","batch":8812}'],
    ['Settings missing the CAMR ID', () => lint.generate(rewards()).env.replace('camr.id=CAMR-108840,', '')],
    ['Settings sent to the wrong environment', () => lint.generate(rewards()).env.replace('otlp.qa.', 'otlp.prod.')],
    ['Settings that are right', () => lint.generate(rewards()).k8s],
  ];
  const STATE = {
    pass: { chip: 'success', icon: 'check', label: 'Passed' },
    fail: { chip: 'danger', icon: 'x', label: 'Fix this' },
    warn: { chip: 'warn', icon: 'alert', label: 'Worth changing' },
    info: { chip: 'neutral', icon: 'info', label: 'Tip' },
  };
  const STYLE = { env: 'environment variables', k8s: 'Kubernetes settings', vm: 'an agent command', cli: 'an OperA command', manifest: 'an opera.yaml file' };

  function results(text) {
    if (!text.trim()) return '';
    const r = lint.run(text);
    if (r.kind === 'unknown') {
      return html`<h2 class="section-title" id="fix-results-title" tabindex="-1">Result</h2>
        ${ui.callout('info', 'OperA didn’t recognise this as a log line or settings', html`<p>Fix-it checks two things: <strong>log lines</strong> (one or more lines your service printed) and <strong>OpenTelemetry settings</strong> (environment variables, Kubernetes YAML, an agent command or an opera.yaml file).</p><p>If you have a question instead, type it in the box at the top of the page.</p>`)}`;
    }
    const n = (s) => r.findings.filter((f) => f.state === s).length;
    const c = r.context;
    const what = r.kind === 'log' ? fmt.plural(r.lines, 'log line')
      : html`${STYLE[r.style]}${c ? html` for <strong>${c.service || 'an unknown service'}</strong> in ${c.app.name}${c.env ? html` (${c.env})` : ''}` : ''}`;
    let next;
    if (r.ok && r.kind === 'log') next = ui.callout('success', 'This log format works', html`<p>OperA can search these logs by field. If you’re onboarding logs, the “Logs received” check will pass.</p>`);
    else if (r.ok && r.complete) {
      const cv = reg.coverage(c.app, c.service, c.component, c.env);
      const todo = c.signals.filter((s) => cv[s] === 'none' || cv[s] === 'partial');
      next = ui.callout('success', 'These settings are right', todo.length
        ? html`<p>Deploy them, then finish onboarding. OperA will check that data arrives.</p>` : html`<p>${c.service}/${c.component} is already set up in ${c.env} for ${c.signals.join(', ')}.</p>`,
        todo.length ? html`<a class="btn btn-primary" href="#/onboard?app=${c.app.camrId}&service=${c.service}&component=${c.component}&env=${c.env}">Continue onboarding ${c.service} in ${c.env}</a>` : '');
    } else if (r.ok) next = ui.callout('success', 'Nothing wrong in what you pasted', html`<p>OperA couldn’t see every setting, so it couldn’t confirm the whole set-up.</p>`);
    else next = ui.callout('danger', `${fmt.plural(n('fail'), 'thing')} to fix before you deploy`, html`<p>${r.corrected ? 'Each one is explained below, and the corrected settings are at the end.' : 'Each one is explained below with its fix.'} Nothing has been changed for you.</p>`);

    return html`<h2 class="section-title" id="fix-results-title" tabindex="-1">Result</h2>
      <p class="small">OperA read this as ${what}.</p>
      <div class="val-summary" role="status">
        ${n('pass') ? html`<span class="chip chip-success">${ui.icon('check')}${n('pass')} passed</span>` : ''}
        ${n('fail') ? html`<span class="chip chip-danger">${ui.icon('x')}${n('fail')} to fix</span>` : ''}
        ${n('warn') ? html`<span class="chip chip-warn">${ui.icon('alert')}${n('warn')} worth changing</span>` : ''}
      </div>
      ${next}
      <ol class="checks" aria-label="What OperA checked">${r.findings.map((f) => html`<li class="check check-${f.state === 'fail' ? 'fail' : f.state}">
        <div class="check-head"><span class="check-name">${ui.icon(STATE[f.state].icon)}${f.title}</span><span class="chip chip-${STATE[f.state].chip}">${ui.icon(STATE[f.state].icon)}${STATE[f.state].label}</span></div>
        <p class="check-detail">${f.detail}</p>
        ${f.fix && f.state !== 'pass' ? html`<div class="check-block"><div><p class="check-sub">${f.state === 'fail' ? 'How to fix it' : 'What to do'}</p><p class="small">${f.fix.text}</p>${f.fix.code ? ui.codeBlock(f.fix.code, 'Fix') : ''}${f.fix.more ? html`<p class="small muted">${f.fix.more}</p>` : ''}</div></div>` : ''}
      </li>`)}</ol>
      ${r.corrected ? html`<h3 style="margin:18px 0 6px">Corrected settings</h3><p class="small">The same settings with every problem above fixed. Check them, then replace yours.</p>${ui.codeBlock(r.corrected, 'Corrected')}` : ''}`;
  }

  OperA.views.fix = {
    title: () => 'Check my setup',
    render() {
      const text = store.state.fixit || '';
      return html`
        ${ui.pageHead({ eyebrow: 'Fix-it', title: 'Check my setup',
          lead: 'Paste a log line or your OpenTelemetry settings. OperA checks them against the application registry and tells you exactly what to change, before you deploy.' })}
        <div class="fix-grid">
          <form class="card" data-form="fixit" novalidate>
            <div class="field" style="margin-bottom:10px"><label for="fix-text">Paste a log line or settings</label>
              <p class="hint" id="fix-hint">Environment variables, Kubernetes YAML, an agent command, an opera.yaml file, or lines your service printed. Nothing you paste leaves your browser.</p>
              <textarea id="fix-text" name="text" rows="9" class="mono" spellcheck="false" aria-describedby="fix-hint">${text}</textarea>
              <p class="error-msg" data-error-for="text" hidden></p></div>
            <div class="btn-row"><button type="submit" class="btn btn-primary">${ui.icon('check')}Check it</button>
              <button type="button" class="btn btn-ghost" data-action="fix-clear">Clear</button></div>
          </form>
          <section class="card" aria-labelledby="h-fix-ex">
            <h2 class="card-title" id="h-fix-ex">${ui.icon('sparkle')}Try an example</h2>
            <p class="small muted">See what Fix-it catches. Each one fills the box and checks it.</p>
            <ul class="plain fix-examples">${EXAMPLES.map(([label], i) => html`<li><button type="button" class="btn btn-sm" data-action="fix-example" data-index="${i}">${label}</button></li>`)}</ul>
          </section>
        </div>
        <div id="fix-results" class="section">${results(text)}</div>`;
    },
  };
  OperA.route(/^\/fix$/, OperA.views.fix);

  function check(text, { focus = true } = {}) {
    store.state.fixit = text; store.save();
    const box = document.getElementById('fix-results');
    if (!box) return;
    box.innerHTML = String(results(text));
    OperA.markScrollable();
    const title = document.getElementById('fix-results-title');
    if (focus && title) { title.focus(); title.scrollIntoView({ block: 'start', behavior: 'auto' }); }
    const r = lint.run(text);
    const fails = r.findings.filter((f) => f.state === 'fail').length;
    OperA.announce(r.kind === 'unknown' ? 'Not recognised as a log line or settings.' : fails ? `${fmt.plural(fails, 'thing')} to fix.` : 'Everything checked passed.');
  }
  OperA.forms.fixit = (form) => {
    const text = form.elements.text.value;
    if (!OperA.modal.fieldError(form, 'text', text.trim() ? '' : 'Paste a log line or your settings first, or try an example.')) return;
    check(text);
  };
  OperA.actions['fix-example'] = (el) => {
    const text = EXAMPLES[Number(el.dataset.index)][1]();
    document.getElementById('fix-text').value = text;
    check(text);
  };
  OperA.actions['fix-clear'] = () => {
    store.state.fixit = ''; store.save();
    const t = document.getElementById('fix-text'); t.value = ''; t.focus();
    document.getElementById('fix-results').innerHTML = '';
  };
  /** Open Fix-it on some text from anywhere (the command bar uses this for pasted logs and settings). */
  OperA.fixit = {
    open(text) {
      store.state.fixit = text; store.save();
      if (OperA.current.path === '/fix' && location.hash === '#/fix') OperA.render(); else OperA.go('#/fix');
    },
  };
})();
