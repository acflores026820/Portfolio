/*
 * OperA — telemetry onboarding. One page for everyone:
 * numbered sections with help in place for a first-timer, values pre-filled
 * from the registry and a readiness checklist so an expert can finish fast.
 */
(function () {
  'use strict';
  const OperA = window.OperA;
  const { html, raw, fmt, reg, tel, validation, lint, store, ui } = OperA;
  const D = OperA.data;
  const PREREQ = {
    metrics: { need: 'Your service uses an OpenTelemetry SDK or exposes a Prometheus /metrics endpoint.',
      check: 'Look for an “opentelemetry” dependency in your build file (pom.xml, package.json or requirements.txt), or open /metrics on the running service.' },
    logs: { need: 'Your service writes logs to standard output as JSON, with timestamp, level and message.',
      check: 'Run the service locally and look at the console. JSON log lines start with “{”. Or paste a line into Fix-it.' },
    traces: { need: 'Your service uses an OpenTelemetry SDK, and calls between services pass trace headers.',
      check: 'OpenTelemetry auto-instrumentation agents usually handle this for you. Look for a “-javaagent:opentelemetry” flag or an @opentelemetry/auto-instrumentations package.' },
  };
  const FIELD = { app: 'ob-app-q', service: 'ob-svc-0', component: 'ob-cmp-0', env: 'ob-env-0', signals: 'ob-sig-metrics', checks: 'ob-run' };

  const draft = () => store.state.draft;
  function newDraft(prefill = {}) {
    store.state.draft = Object.assign({ camrId: null, service: null, component: null, env: null, signals: [], method: 'kubernetes',
      checks: null, attempts: {}, scenario: null, query: '', startedAt: Date.now() }, prefill);
    store.save();
    return store.state.draft;
  }
  function touch() { draft().savedAt = Date.now(); store.save(); }
  const ctx = (d) => ({ app: reg.app(d.camrId), service: d.service, component: d.component, env: d.env, signals: d.signals });
  const recommended = (app) => (app.tier <= 2 ? D.signals : ['metrics', 'logs']);
  /** Recommended signals that aren't set up yet, unless the person has already chosen their own. */
  function preselectSignals(d) {
    if (d.signalsTouched || !d.camrId || !d.service || !d.component || !d.env) return;
    const app = reg.app(d.camrId);
    const cv = reg.coverage(app, d.service, d.component, d.env);
    d.signals = recommended(app).filter((s) => cv[s] === 'none' || cv[s] === 'partial');
  }

  /* ---------- 1 · what are you onboarding? ---------- */
  function appResults(q) {
    const parsed = reg.parseCamr(q);
    const list = q.trim() ? reg.searchApps(q, { includeRetired: true }) : [];
    let msg = '';
    if (q.trim() && parsed.looksLike && !parsed.valid && parsed.suggestion && !list.length) {
      msg = html`<p class="error-msg" style="font-weight:500">CAMR IDs look like CAMR-104233: the letters CAMR, a dash, then 6 digits. Did you mean <button type="button" class="link-btn" data-action="ob-suggest" data-value="${parsed.suggestion}">${parsed.suggestion}</button>?</p>`;
    } else if (q.trim() && parsed.looksLike && !parsed.valid && parsed.suggestion && list.length) {
      msg = html`<p class="hint">Showing results for <strong>${parsed.suggestion}</strong>. CAMR IDs are written with a dash after “CAMR”.</p>`;
    } else if (q.trim() && !list.length) {
      msg = html`${ui.callout('info', `No application found for “${q.trim()}”`, html`<p>Check for a typo, or try the application name instead. If your application isn’t registered yet, your app owner needs to register it before telemetry can be onboarded. Registration is usually same-day.</p>`)}`;
    }
    return html`${msg}${list.length ? html`<fieldset style="margin:0"><legend class="sr-only">Matching applications</legend><div class="choice-list">${list.slice(0, 6).map((a) => html`
      <label class="choice"><input type="radio" name="ob-app" value="${a.camrId}" data-change="ob-pick-app" />
        <span class="choice-body"><span class="choice-title">${a.name} <span class="mono small">${a.camrId}</span>${a.status === 'retired' ? html`<span class="chip chip-neutral">${ui.icon('minus')}Retired</span>` : ''}</span>
          <span class="choice-meta">${a.owningTeam} · App owner ${a.appOwner} · ${fmt.plural(a.services.length, 'service')}</span></span></label>`)}</div></fieldset>` : ''}
      <p class="sr-only" aria-live="polite">${q.trim() ? (list.length ? `${fmt.plural(list.length, 'application')} found` : 'No applications found') : ''}</p>`;
  }

  function identify(d, errors, app, svc, member) {
    if (!app) {
      return html`
        ${store.state.role === 'app' ? html`<p class="field-label">Your applications</p><div class="quick-picks">${reg.myApps().map((a) => html`<button type="button" class="quick-pick" data-action="ob-pick-quick" data-camr="${a.camrId}">${a.name} · ${a.camrId}</button>`)}</div>` : ''}
        <div class="field">
          <label for="ob-app-q">Search by application name or CAMR ID</label>
          <p class="hint" id="ob-app-hint">For example “Rewards Engine” or “CAMR-108840”. ${ui.help('camr')}</p>
          <input id="ob-app-q" type="search" autocomplete="off" aria-describedby="ob-app-hint${errors.app ? ' ob-app-err' : ''}" ${errors.app ? raw('aria-invalid="true"') : ''} data-input="ob-app-search" value="${d.query || ''}" />
          ${errors.app ? html`<p class="error-msg" id="ob-app-err">${errors.app}</p>` : ''}
        </div>
        <div id="ob-app-results">${appResults(d.query || '')}</div>`;
    }
    const selected = html`<div class="selected-app" id="ob-selected" tabindex="-1">
        <div><div class="choice-title">${ui.icon('check')}${app.name} <span class="mono small">${app.camrId}</span></div>
          <div class="choice-meta">${app.owningTeam} · App owner ${app.appOwner} · Tier ${app.tier}</div></div>
        <button type="button" class="btn btn-sm" data-action="ob-change-app">Change application</button>
      </div>`;
    if (app.status === 'retired') {
      return html`${selected}${ui.callout('danger', 'This application is retired', html`<p>Telemetry can’t be onboarded for retired applications. If it’s still running, ask ${app.appOwner} to reactivate it in the registry, then come back.</p>`)}`;
    }
    return html`${selected}
      ${!member ? ui.callout('warn', `You’re not listed on ${app.owningTeam}`, html`<p>You can continue, but ${app.appOwner} (app owner) will need to approve this request, even for dev and qa. If you should be on this team, ask them to add you in the registry.</p>`) : ''}
      <fieldset class="field"><legend>Service</legend><p class="hint">${ui.help('service')}</p>
        <div class="choice-list choice-row">${app.services.map((s, i) => html`<label class="choice"><input type="radio" id="ob-svc-${i}" name="ob-svc" value="${s.name}" data-change="ob-set" data-key="service" ${d.service === s.name ? raw('checked') : ''} />
          <span class="choice-body"><span class="choice-title mono">${s.name}</span><span class="choice-desc">${s.description}</span></span></label>`)}</div>
        ${errors.service ? html`<p class="error-msg" id="ob-svc-err">${errors.service}</p>` : ''}
        <details class="small" style="margin-top:8px"><summary class="link-btn">My service isn’t listed</summary>
          <p style="margin-top:6px">Services come from the application registry so that alerts, owners and dashboards stay linked. Ask ${app.appOwner} to add the service to ${app.camrId}. It shows up here within a few minutes.</p></details>
      </fieldset>
      ${svc ? (svc.components.length === 1
        ? html`<div class="field"><p class="field-label">Component</p><p><span class="mono">${svc.components[0].name}</span> · ${svc.components[0].description} <span class="muted small">(the only component of ${svc.name}, so it’s selected for you)</span></p></div>`
        : html`<fieldset class="field"><legend>Component</legend><p class="hint">${ui.help('component')}</p>
          <div class="choice-list choice-row">${svc.components.map((c, i) => html`<label class="choice"><input type="radio" id="ob-cmp-${i}" name="ob-cmp" value="${c.name}" data-change="ob-set" data-key="component" ${d.component === c.name ? raw('checked') : ''} />
            <span class="choice-body"><span class="choice-title mono">${c.name}</span><span class="choice-desc">${c.description}</span></span></label>`)}</div>
          ${errors.component ? html`<p class="error-msg" id="ob-cmp-err">${errors.component}</p>` : ''}</fieldset>`) : ''}
      ${svc && d.component ? html`<fieldset class="field" style="margin-bottom:0"><legend>Environment</legend><p class="hint">${ui.help('environment')}</p>
        <div class="choice-list choice-row">${svc.envs.map((e, i) => {
          const cv = reg.coverage(app, svc.name, d.component, e);
          const active = D.signals.filter((s) => cv[s] === 'active');
          const onb = D.signals.filter((s) => cv[s] === 'onboarding');
          const full = active.length === 3;
          return html`<label class="choice"><input type="radio" id="ob-env-${i}" name="ob-env" value="${e}" data-change="ob-set" data-key="env" ${d.env === e ? raw('checked') : ''} ${full ? raw('disabled') : ''} />
            <span class="choice-body"><span class="choice-title">${ui.envTag(e)}${e === 'prod' ? html`<span class="chip chip-info">${ui.icon('shield')}Needs approval</span>` : ''}</span>
              <span class="choice-desc">${full ? 'Fully set up. Nothing to do here.' : active.length ? `Already active: ${active.join(', ')}.` : 'Nothing set up yet.'}${onb.length ? ` In progress: ${onb.join(', ')}.` : ''}</span></span></label>`;
        })}</div>
        ${errors.env ? html`<p class="error-msg" id="ob-env-err">${errors.env}</p>` : ''}</fieldset>` : ''}`;
  }

  /* ---------- 2 · what to collect ---------- */
  function signalsBlock(d, errors, app, cv) {
    return html`<fieldset class="field" style="margin:0"><legend class="sr-only">Signals to collect</legend>
      <p class="hint">We’ve ticked what we recommend for a Tier ${app.tier} application. Untick anything you don’t want. You can add more later.</p>
      <div class="choice-list choice-row">${D.signals.map((s) => {
        const already = cv[s] === 'active' || cv[s] === 'onboarding';
        return html`<label class="choice"><input type="checkbox" id="ob-sig-${s}" value="${s}" data-change="ob-signal" ${already || d.signals.includes(s) ? raw('checked') : ''} ${already ? raw('disabled') : ''} />
          <span class="choice-body"><span class="choice-title">${fmt.cap(s)}${already ? html`<span class="chip chip-success">${ui.icon('check')}${cv[s] === 'active' ? 'Already active' : 'In progress'}</span>` : recommended(app).includes(s) ? html`<span class="chip chip-info">Recommended</span>` : ''}</span>
            <span class="choice-desc">${D.glossary[s].text}</span>
            ${!already ? html`<span class="prereq" style="display:block"><span class="prereq-title" style="display:block">You’ll need</span>${PREREQ[s].need}
              <details style="margin-top:4px"><summary class="link-btn">How do I check?</summary><span style="display:block;margin-top:4px">${PREREQ[s].check}</span></details></span>` : ''}</span></label>`;
      })}</div>
      ${errors.signals ? html`<p class="error-msg" id="ob-sig-err">${errors.signals}</p>` : ''}
    </fieldset>`;
  }

  /* ---------- 3 · settings ---------- */
  function configBlock(d) {
    const c = ctx(d); const app = c.app;
    const g = lint.generate(c);
    const methods = [ ['kubernetes', 'Kubernetes', g.k8s, 'YAML'], ['env', 'Environment variables', g.env, 'Shell'], ['vm', 'Virtual machine agent', g.vm, 'Shell'] ];
    const rec = app.platform === 'kubernetes' ? 'kubernetes' : 'vm';
    if (!d.methodChosen && d.method !== rec) { d.method = rec; touch(); }
    return html`
      <p class="small">We filled in every value. Registry says ${app.name} runs on ${app.platform === 'kubernetes' ? 'Kubernetes' : 'virtual machines'}, so that tab is selected.</p>
      <div class="tabs" role="tablist" aria-label="Deployment type">${methods.map(([k, label]) => html`<button type="button" role="tab" id="tab-m-${k}" aria-controls="panel-m-${k}" aria-selected="${d.method === k}" tabindex="${d.method === k ? 0 : -1}" data-action="ob-method" data-method="${k}">${label}${k === rec ? ' (recommended)' : ''}</button>`)}</div>
      ${methods.map(([k, label, code, lang]) => html`<div role="tabpanel" id="panel-m-${k}" aria-labelledby="tab-m-${k}" class="tab-panel" ${d.method === k ? '' : raw('hidden')}>${ui.codeBlock(code, `${label} · ${lang}`)}</div>`)}
      <details class="small"><summary class="link-btn">What does this do?</summary>
        <ul style="margin-top:6px">
          <li><strong>OTEL_SERVICE_NAME</strong>: names your service in dashboards and alerts.</li>
          <li><strong>OTEL_RESOURCE_ATTRIBUTES</strong>: labels every piece of data with your CAMR ID, environment and component, so it’s linked to ${app.name} and its owners. ${ui.help('attributes', 'Why this matters')}</li>
          <li><strong>OTEL_EXPORTER_OTLP_ENDPOINT</strong>: where to send data. This is the ${d.env} collector for ${tel.region(app.region).name}. ${ui.help('collector', 'What’s a collector?')}</li>
          <li><strong>*_EXPORTER</strong>: turns each signal on or off to match what you chose.</li>
          ${d.signals.includes('traces') ? html`<li><strong>OTEL_TRACES_SAMPLER</strong> and <strong>_ARG</strong>: how many traces to keep. ${d.env === 'prod' ? '10% in prod keeps costs predictable, and errors are always kept.' : '100% outside prod, so you see every request while testing.'}</li>` : ''}
          ${d.signals.includes('logs') ? html`<li><strong>opera.example/collect-logs</strong>: tells the platform’s log agent to collect this pod’s output as JSON.</li>` : ''}
        </ul></details>
      <details class="small"><summary class="link-btn">Prefer to do this from code or a pipeline?</summary>
        <p style="margin-top:6px">Commit this file beside your service, or run the command. Either one makes the same request as this page, with the same checks and approvals.</p>
        ${ui.codeBlock(g.manifest, 'opera.yaml')}${ui.codeBlock(g.cli, 'Command line')}</details>
      <p class="small" style="margin-top:10px">Changed something by hand? <a href="#/fix">Check your settings with Fix-it</a> before you deploy.</p>`;
  }

  /* ---------- 4 · checks ---------- */
  function checkItem(c, where) {
    const showDetail = c.state === 'fail' || c.state === 'waiting';
    return html`<li class="check check-${c.state}" id="check-${c.id}">
      <div class="check-head"><span class="check-name">${ui.icon(c.state === 'pass' ? 'check' : c.state === 'fail' ? 'x' : c.state === 'waiting' ? 'clock' : 'minus')}${c.label}</span>${ui.checkChip(c.state)}</div>
      <p class="check-detail"><strong class="sr-only">What happened: </strong>${c.detail}</p>
      ${showDetail && (c.cause || c.fix) ? html`<div class="check-block">
        ${c.cause ? html`<div><p class="check-sub">Why</p><p class="small">${c.cause}</p></div>` : ''}
        ${c.fix ? html`<div><p class="check-sub">${c.state === 'waiting' ? 'What to do' : 'How to fix it'}</p><p class="small">${c.fix.text}</p>${c.fix.code ? ui.codeBlock(c.fix.code, 'Fix') : ''}${c.fix.more ? html`<p class="small muted">${c.fix.more}</p>` : ''}</div>` : ''}
      </div>` : ''}
      ${c.note ? html`<p class="check-note">${ui.icon('info')} ${c.note}</p>` : ''}
      ${showDetail ? html`<div class="check-actions">
        <button type="button" class="btn btn-sm btn-primary" data-action="${where}-recheck" data-check="${c.id}" id="recheck-${c.id}">${ui.icon('refresh')}${c.state === 'waiting' ? 'Check again' : 'I’ve fixed it, check again'}</button>
        ${c.state === 'fail' ? html`<button type="button" class="btn btn-sm" data-action="${where}-help" data-check="${c.id}">${ui.icon('help')}Get help</button>` : ''}
      </div>` : ''}
    </li>`;
  }
  function resultsBlock(checks, where) {
    const s = validation.summary(checks);
    return html`<div class="val-summary" role="status">
        ${s.pass ? html`<span class="chip chip-success">${ui.icon('check')}${s.pass} passed</span>` : ''}
        ${s.fail ? html`<span class="chip chip-danger">${ui.icon('x')}${s.fail} need${s.fail === 1 ? 's' : ''} your action</span>` : ''}
        ${s.waiting ? html`<span class="chip chip-info">${ui.icon('clock')}${s.waiting} waiting for data</span>` : ''}
        ${s.skipped ? html`<span class="chip chip-neutral">${ui.icon('minus')}${s.skipped} not checked yet</span>` : ''}
      </div>
      ${where === 'req'
        ? (s.blocked ? ui.callout('danger', 'Blocked: no data can reach OperA yet', html`<p>Fix the problem below. Everything else is checked once it’s fixed.</p>`)
          : s.fail ? ui.callout('warn', 'This request is waiting on your fix', html`<p>Once the failed check passes, the request moves on by itself. You don’t need to resubmit.</p>`)
          : s.waiting ? ui.callout('info', 'Waiting for data', html`<p>OperA keeps checking and updates this request when data arrives.</p>`)
          : '')
        : (s.blocked ? ui.callout('danger', 'Fix the blocking problem before you submit', html`<p>Without this, no data can reach OperA. Everything else is checked once it’s fixed.</p>`)
          : s.fail ? ui.callout('warn', 'You can submit now, or fix this first', html`<p>Your request will be marked “Needs your action” until the failed check passes. You can fix it at any time from the request page.</p>`)
          : s.waiting ? ui.callout('info', 'Almost there', html`<p>Some data hasn’t arrived yet. That’s normal right after a deploy. You can submit now. OperA keeps checking for 30 minutes and updates your request.</p>`)
          : ui.callout('success', 'Everything is working', html`<p>All checks passed. Submit your request.</p>`))}
      <ol class="checks" aria-label="Validation checks">${checks.map((c) => checkItem(c, where))}</ol>`;
  }
  OperA.resultsBlock = resultsBlock;

  /* ---------- the page ---------- */
  OperA.views.onboard = {
    title: () => 'Onboard telemetry',
    render(_, q) {
      let d = draft();
      // Links such as #/onboard?app=CAMR-108840&service=rewards-api&env=prod pre-fill the page.
      if (q.app) {
        if (d && d.camrId && d.camrId !== q.app && !q.fresh) {
          const cur = reg.app(d.camrId); const next = reg.app(q.app);
          return html`${ui.pageHead({ title: 'Onboard telemetry' })}
            ${ui.callout('info', 'You have an unfinished draft', html`<p>You started onboarding <strong>${cur ? cur.name : d.camrId}</strong>${d.service ? ` · ${d.service}` : ''}${d.env ? ` (${d.env})` : ''}. Starting a new one for ${next ? next.name : q.app} replaces it.</p>`,
              html`<a class="btn btn-primary" href="#/onboard">Continue my draft</a><a class="btn" href="#/onboard?${new URLSearchParams(Object.assign({}, q, { fresh: '1' }))}">Start new for ${next ? next.name : q.app}</a>`)}`;
        }
        const app = reg.app(q.app);
        const svc = app && q.service ? reg.service(app, q.service) : null;
        const cmp = svc && q.component && svc.components.some((c) => c.name === q.component) ? q.component : (svc && svc.components.length === 1 ? svc.components[0].name : null);
        const env = svc && q.env && svc.envs.includes(q.env) ? q.env : null;
        const prefill = { camrId: app ? app.camrId : null, query: app ? '' : q.app, service: svc ? svc.name : (app && app.services.length === 1 ? app.services[0].name : null), component: cmp, env };
        if (!d || d.camrId !== prefill.camrId || q.fresh) d = newDraft(prefill);
        else Object.assign(d, { service: prefill.service || d.service, component: prefill.component || d.component, env: prefill.env || d.env, checks: null });
        preselectSignals(d);
        touch();
        history.replaceState(null, '', '#/onboard');
      }
      if (!d) d = newDraft();
      const errors = OperA.views.onboard.errors || {};
      OperA.views.onboard.errors = null;
      const errList = Object.entries(errors).filter(([, v]) => v);

      const app = d.camrId ? reg.app(d.camrId) : null;
      const me = D.personas[store.state.role];
      const active = !!app && app.status === 'active';
      const svc = active && d.service ? reg.service(app, d.service) : null;
      const located = !!(svc && d.component && d.env);
      const cv = located ? reg.coverage(app, d.service, d.component, d.env) : null;
      const member = app ? reg.isMember(app, me.name) : true;
      const needsApproval = app && (d.env === 'prod' || !member);
      const sum = d.checks ? validation.summary(d.checks) : null;
      const item = (ok, label, detail, tone) => html`<li class="ready-${ok ? 'ok' : tone || 'todo'}">${ui.icon(ok ? 'check' : tone === 'bad' ? 'x' : tone === 'wait' ? 'clock' : 'minus')}<span><strong>${label}</strong><br /><span class="small">${detail}</span></span></li>`;
      const checksItem = !sum ? item(false, 'Checks', 'Not run yet')
        : sum.blocked ? item(false, 'Checks', 'Blocked. Fix the failing check before you submit.', 'bad')
        : sum.fail ? item(false, 'Checks', `${sum.pass} passed, ${sum.fail} need${sum.fail === 1 ? 's' : ''} your action. You can still submit.`, 'bad')
        : sum.waiting ? item(false, 'Checks', `${sum.pass} passed, ${sum.waiting} waiting for data. You can still submit.`, 'wait')
        : item(true, 'Checks', `All ${sum.total} passed`);
      const num = (n, title, id) => html`<h2 class="card-title" id="${id}"><span class="obc-num">${n}</span>${title}</h2>`;

      return html`
        ${ui.pageHead({ title: 'Onboard telemetry', lead: 'One page, about 15 minutes. Values come from the application registry, and the checklist shows what’s left. Your progress saves automatically.' })}
        ${errList.length ? html`<div class="error-summary" role="alert" tabindex="-1" id="ob-errors"><h2>There’s a problem</h2><ul>${errList.map(([k, v]) => html`<li><a href="#" data-action="focus-field" data-field="${FIELD[k]}">${v}</a></li>`)}</ul></div>` : ''}
        <div class="obc">
          <div class="obc-form">
            <section class="card" aria-labelledby="h-ob-1">${num(1, app ? `Which part of ${app.name}?` : 'Which application are you onboarding?', 'h-ob-1')}${identify(d, errors, app, svc, member)}</section>
            ${app && !active ? '' : html`
            <section class="card" aria-labelledby="h-ob-2">${num(2, 'What do you want to collect?', 'h-ob-2')}
              ${located ? signalsBlock(d, errors, app, cv) : html`<p class="muted">Choose a service, component and environment first. Recommended signals are then ticked for you.</p>`}</section>
            <section class="card" aria-labelledby="h-ob-3">${num(3, 'Add these settings and deploy', 'h-ob-3')}
              ${located && d.signals.length ? html`${configBlock(d)}<p class="small"><strong>Then deploy to ${d.env}</strong> the way you normally do. OperA doesn’t change your pipeline or your code.</p>`
                : html`<p class="muted">Your settings appear here once you’ve chosen what to onboard.</p>`}</section>
            <section class="card" aria-labelledby="h-ob-4">${num(4, 'Check that data arrives', 'h-ob-4')}
              <p class="small">Takes about 10 seconds. Run it as many times as you like.</p>
              <div id="ob-results" tabindex="-1">${d.checks ? resultsBlock(d.checks, 'ob') : ''}</div>
              <div class="btn-row" style="margin-top:12px">
                <button type="button" class="btn ${d.checks ? '' : 'btn-primary'}" data-action="ob-run-checks" id="ob-run">${ui.icon('refresh')}${d.checks ? 'Run all checks again' : 'Run checks'}</button>
                ${errors.checks ? html`<p class="error-msg" id="ob-checks-err" style="margin:0">${errors.checks}</p>` : ''}
              </div></section>`}
          </div>
          <section class="card obc-side" aria-labelledby="h-ob-ready">
            <h2 class="card-title" id="h-ob-ready">${ui.icon('list')}What’s left</h2>
            <ul class="ready-list">
              ${item(active, 'Application', app ? `${app.name} · ${app.camrId}` : 'Not chosen')}
              ${item(!!(svc && d.component), 'Service and component', svc && d.component ? `${d.service}/${d.component}` : 'Not chosen')}
              ${item(located, 'Environment', located ? d.env : 'Not chosen')}
              ${item(located && d.signals.length > 0, 'Signals', located && d.signals.length ? d.signals.map(fmt.cap).join(', ') : 'None selected')}
              ${checksItem}
            </ul>
            ${located ? html`<p class="small ready-approval">${needsApproval
              ? html`${ui.icon('shield')} <strong>Needs approval from ${app.appOwner}</strong> (${d.env === 'prod' ? 'production requests always do' : 'you’re not on the owning team'}). Usually within 1 business day.`
              : html`${ui.icon('check')} <strong>Approved automatically.</strong> ${d.env} requests from the owning team don’t need approval.`}
              Set-up then takes about 15 minutes and needs nothing from you.</p>` : ''}
            ${app && !active ? '' : html`<button type="button" class="btn btn-primary obc-submit" data-action="ob-submit" id="ob-submit">Submit request</button>`}
            <p class="draft-note">${d.savedAt ? html`${ui.icon('check')}Draft saved ${fmt.rel(d.savedAt)}` : ''}</p>
            <div class="btn-row"><button type="button" class="btn btn-ghost btn-sm" data-action="ob-later">Save and finish later</button><button type="button" class="link-btn small" data-action="ob-reset">Start over</button></div>
          </section>
        </div>`;
    },
    mount() {
      const errs = document.getElementById('ob-errors');
      if (errs) { errs.focus(); return true; }
      return false;
    },
  };
  OperA.route(/^\/onboard$/, OperA.views.onboard);

  /* ---------- interactions ---------- */
  OperA.inputs['ob-app-search'] = (el) => {
    draft().query = el.value; store.save();
    document.getElementById('ob-app-results').innerHTML = String(appResults(el.value));
  };
  OperA.actions['ob-suggest'] = (el) => {
    const input = document.getElementById('ob-app-q'); input.value = el.dataset.value;
    OperA.inputs['ob-app-search'](input); input.focus();
  };
  function pickApp(camrId) {
    const d = draft();
    Object.assign(d, { camrId, service: null, component: null, env: null, signals: [], signalsTouched: false, checks: null, attempts: {} });
    const app = reg.app(camrId);
    const only = app.services.length === 1 ? app.services[0] : null;
    if (only) { d.service = only.name; if (only.components.length === 1) d.component = only.components[0].name; }
    touch(); OperA.refresh();
    const sel = document.getElementById('ob-selected'); if (sel) sel.focus();
    OperA.announce(`Selected ${app.name}.${only ? ` Service ${only.name} selected automatically because it is the only one.` : ''}`);
  }
  OperA.changes['ob-pick-app'] = (el) => pickApp(el.value);
  OperA.actions['ob-pick-quick'] = (el) => pickApp(el.dataset.camr);
  OperA.actions['ob-change-app'] = () => {
    Object.assign(draft(), { camrId: null, service: null, component: null, env: null, signals: [], signalsTouched: false, checks: null });
    touch(); OperA.refresh(); const i = document.getElementById('ob-app-q'); if (i) i.focus();
  };
  OperA.changes['ob-set'] = (el) => {
    const d = draft(); const key = el.dataset.key;
    d[key] = el.value || null;
    if (key === 'service') {
      d.component = null; d.env = null;
      const svc = d.service && reg.service(reg.app(d.camrId), d.service);
      if (svc && svc.components.length === 1) d.component = svc.components[0].name;
    }
    if (key === 'component') d.env = null;
    if (key === 'env') preselectSignals(d);
    d.checks = null; touch(); OperA.refresh();
  };
  function syncSignalsFromPage(d) {
    if (!D.signals.some((s) => document.getElementById(`ob-sig-${s}`))) return;
    d.signals = D.signals.filter((s) => { const el = document.getElementById(`ob-sig-${s}`); return el && el.checked && !el.disabled; });
  }
  OperA.changes['ob-signal'] = (el) => {
    const d = draft();
    d.signals = D.signals.filter((s) => (s === el.value ? el.checked : d.signals.includes(s)));
    d.signalsTouched = true; d.checks = null; touch();
    OperA.refresh(); // the settings and the checklist update as you choose
  };
  OperA.actions['ob-method'] = (btn) => { OperA.ui.activateTab(btn); draft().method = btn.dataset.method; draft().methodChosen = true; touch(); };
  OperA.actions['focus-field'] = (el) => { const f = document.getElementById(el.dataset.field); if (f) f.focus(); };

  /** Problems in page order. `withChecks` adds the section-4 rule that applies only to submitting. */
  function problems(d, withChecks) {
    const e = {};
    const app = d.camrId && reg.app(d.camrId);
    if (!app) e.app = 'Choose your application. Search by name or CAMR ID.';
    else if (app.status === 'retired') e.app = 'This application is retired and can’t be onboarded.';
    else if (!d.service) e.service = 'Choose a service.';
    else if (!d.component) e.component = 'Choose a component.';
    else if (!d.env) e.env = 'Choose an environment.';
    else if (!d.signals.length) {
      const cv = reg.coverage(app, d.service, d.component, d.env);
      e.signals = D.signals.every((s) => cv[s] === 'active' || cv[s] === 'onboarding')
        ? 'Everything is already set up or in progress for this component. Choose another environment or component.'
        : 'Choose at least one signal to collect.';
    } else if (withChecks) {
      if (!d.checks) e.checks = 'Run the checks first so you know your setup works.';
      else if (validation.summary(d.checks).blocked) e.checks = 'Fix the blocking problem before you submit. Use “Get help” if you’re stuck.';
    }
    return e;
  }
  function stopIfProblems(d, withChecks) {
    syncSignalsFromPage(d);
    const e = problems(d, withChecks);
    if (!Object.keys(e).length) return false;
    OperA.views.onboard.errors = e; touch(); OperA.render();
    return true;
  }
  OperA.actions['ob-later'] = () => { touch(); OperA.toast('Draft saved. You’ll find it under “Needs you” on your home page.'); OperA.go('#/home'); };
  OperA.actions['ob-reset'] = () => {
    OperA.confirm({ title: 'Start over?', label: 'Delete draft and start over',
      body: html`<p>Your onboarding draft will be deleted. Requests you’ve already submitted are not affected.</p>` },
    () => { store.state.draft = null; store.save(); OperA.go('#/onboard'); });
  };

  /* Run checks with visible, announced progress. */
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function runChecks() {
    const d = draft();
    const scenario = store.state.proto.validation;
    const result = validation.run(ctx(d), scenario, d.attempts);
    const box = document.getElementById('ob-results');
    const btn = document.getElementById('ob-run'); if (btn) btn.disabled = true;
    let i = 0;
    const tick = () => {
      if (i >= result.length) {
        d.checks = result; d.scenario = scenario; touch(); OperA.refresh();
        const s = validation.summary(result);
        OperA.announce(`Checks finished. ${s.pass} passed${s.fail ? `, ${s.fail} need your action` : ''}${s.waiting ? `, ${s.waiting} waiting for data` : ''}.`);
        const r = document.getElementById('ob-results'); if (r) r.focus();
        return;
      }
      box.innerHTML = String(html`<p class="small" role="status">Checking ${i + 1} of ${result.length}: ${result[i].label}…</p><div class="progress-line"><div style="width:${((i + 1) / result.length) * 100}%"></div></div>`);
      i += 1; setTimeout(tick, reduced() ? 30 : 320);
    };
    tick();
  }
  OperA.actions['ob-run-checks'] = () => {
    const d = draft();
    if (stopIfProblems(d, false)) return; // nothing stops you pressing Run early, so say what's missing
    if (d.checks) d.checks.forEach((c) => { if (c.state !== 'pass') d.attempts[c.id] = (d.attempts[c.id] || 0) + 1; });
    runChecks();
  };
  OperA.actions['ob-recheck'] = (el) => {
    const d = draft(); const id = el.dataset.check;
    d.attempts[id] = (d.attempts[id] || 0) + 1;
    el.disabled = true; el.lastChild.textContent = 'Checking…';
    setTimeout(() => {
      d.checks = validation.run(ctx(d), store.state.proto.validation, d.attempts); touch(); OperA.refresh();
      const c = d.checks.find((x) => x.id === id);
      OperA.announce(`${c.label}: ${({ pass: 'passed', fail: 'still failing', waiting: 'still waiting for data', skipped: 'not checked yet' })[c.state]}. ${c.detail}`);
      const li = document.getElementById(`check-${id}`); if (li) { li.setAttribute('tabindex', '-1'); li.focus(); }
    }, reduced() ? 50 : 700);
  };
  function helpModal(context, check) {
    const app = context.app;
    const packet = [
      `Application:       ${app.name} (${app.camrId})`,
      `Service/component: ${context.service}/${context.component}`,
      `Environment:       ${context.env}`,
      `Signals:           ${context.signals.join(', ')}`,
      `Failed check:      ${check.label}`,
      `What happened:     ${check.detail}`,
      `Attempts so far:   ${(context.attempts && context.attempts[check.id] || 0) + 1}`,
      `Requested by:      ${D.personas[store.state.role].name}`,
    ].join('\n');
    OperA.modal.open({
      title: 'Get help from the Telemetry Platform team', form: 'ob-help', submitLabel: 'Send help request', wide: true,
      body: html`<p>We’ll send these diagnostics with your request, so nobody has to ask you for the details again.</p>
        <pre class="packet" tabindex="0" aria-label="Diagnostics that will be attached">${packet}</pre>
        <div class="field" style="margin-top:14px"><label for="help-note">Anything else we should know? <span class="optional">(optional)</span></label>
          <textarea id="help-note" name="note" rows="3" placeholder="For example: we don’t manage the network policy for this namespace."></textarea></div>`,
    });
  }
  OperA.actions['ob-help'] = (el) => {
    const d = draft(); const c = d.checks.find((x) => x.id === el.dataset.check);
    helpModal(Object.assign(ctx(d), { attempts: d.attempts }), c);
  };
  OperA.helpModal = helpModal;
  OperA.forms['ob-help'] = () => {
    OperA.modal.close();
    const id = `HLP-${Math.floor(4000 + Math.random() * 999)}`;
    OperA.toast(`Help request ${id} sent to Telemetry Platform with your diagnostics. Typical first reply: within 2 business hours in #telemetry-platform.`);
  };

  OperA.actions['ob-submit'] = () => {
    const d = draft();
    if (stopIfProblems(d, true)) return; // one page, so every problem is listed together
    const app = reg.app(d.camrId);
    const me = D.personas[store.state.role];
    const member = reg.isMember(app, me.name);
    const s = validation.summary(d.checks);
    let status;
    const id = store.nextId('REQ');
    const now = Date.now();
    const hist = [ { at: now, text: `Request submitted by ${me.name}.` } ];
    if (s.fail) { status = 'action-needed'; hist.push({ at: now, text: `Validation: ${d.checks.filter((x) => x.state === 'fail').map((x) => x.label).join(', ')} failed. Waiting for a fix.` }); }
    else if (d.env === 'prod' || !member) { status = 'awaiting-approval'; hist.push({ at: now, text: `All required checks passed. Waiting for approval from ${app.appOwner}.` }); }
    else { status = 'provisioning'; hist.push({ at: now, text: 'All required checks passed. Approved automatically.' }, { at: now, text: 'Setting up storage, retention and dashboard (automated).' }); }
    store.state.requests.push({ id, camrId: app.camrId, service: d.service, component: d.component, env: d.env, signals: d.signals.slice(),
      status, requester: me.name, createdAt: now, approver: app.appOwner, etaMinutes: 15, scenario: d.scenario, attempts: Object.assign({}, d.attempts),
      needsApproval: d.env === 'prod' || !member, history: hist, mine: true });
    store.state.draft = null; store.save();
    OperA.go(`#/requests/${id}?new=1`);
  };
})();
