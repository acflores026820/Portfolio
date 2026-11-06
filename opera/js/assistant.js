/*
 * OperA Assistant — AI + MCP integration (simulated, deterministic).
 *
 * Design rules this prototype demonstrates:
 *  - The assistant only calls READ tools on the OperA MCP server. Every call is shown.
 *  - It never acts. Suggested actions open the same human confirmation / approval
 *    dialogs a person would use. Production changes keep the two-person rule.
 *  - Every answer cites the evidence it used, so it can be checked.
 *  - Content from logs or tickets is treated as data, never as instructions.
 */
(function () {
  'use strict';
  const OperA = window.OperA;
  const { html, fmt, reg, tel, alerts, requests, validation, store, ui } = OperA;
  const D = OperA.data;

  const log = []; // conversation for this page view
  let lastKey = '';

  function context() {
    const { path, params } = OperA.current;
    if (/^\/alerts\//.test(path)) { const a = alerts.get(params[0]); if (a) return { kind: 'alert', key: a.id, label: `${a.id} · ${reg.app(a.camrId).name} (${a.env})`, alert: a }; }
    if (/^\/requests\//.test(path)) { const r = requests.get(params[0]); if (r) return { kind: 'request', key: r.id, label: `${r.id} · ${reg.app(r.camrId).name} · ${r.service} (${r.env})`, request: r }; }
    if (/^\/apps\//.test(path)) { const app = reg.app(params[0]); if (app) return { kind: 'app', key: app.camrId, label: `${app.name} · ${app.camrId}`, app }; }
    if (/^\/onboard/.test(path)) { const d = store.state.draft; return { kind: 'onboard', key: 'onboard', label: d && d.camrId ? `Onboarding draft · ${reg.app(d.camrId).name}${d.service ? ` · ${d.service}` : ''}` : 'Onboarding', draft: d }; }
    if (/^\/health/.test(path)) return { kind: 'health', key: 'health', label: 'Telemetry health' };
    return { kind: 'general', key: 'general:' + store.state.role, label: store.state.role === 'app' ? 'Your applications' : 'Operations overview' };
  }
  const SUGGEST = {
    alert: [ ['summary', 'Summarize this alert'], ['source', 'Is this the app or the telemetry?'], ['owner', 'Who should I contact?'], ['next', 'What should I do next?'] ],
    request: [ ['validation', 'Why is this blocked?'], ['next', 'What’s my next step?'], ['camr', 'What’s a CAMR ID?'] ],
    onboard: [ ['validation', 'Why did a check fail?'], ['camr', 'How do I find my CAMR ID?'], ['next', 'What’s my next step?'] ],
    app: [ ['coverage', 'What telemetry is missing?'], ['owner', 'Who owns this?'], ['attention', 'Anything alerting?'] ],
    health: [ ['impact', 'Which alerts are affected?'], ['attention', 'What needs attention?'] ],
    general: [ ['attention', 'What needs my attention?'], ['camr', 'What’s a CAMR ID?'], ['telemetry-now', 'Any telemetry problems now?'] ],
  };
  const tool = (name, args) => ({ name, args });

  /* ---------- intents → grounded answers ---------- */
  function answer(intent, ctx) {
    const a = ctx.alert; const role = store.state.role;
    if (intent === 'summary' && a) {
      const app = reg.app(a.camrId); const as = tel.assess(a); const n = alerts.nextStep(a);
      return { text: html`<p><strong>${a.title}</strong>, ${app.name} in ${a.env}, started ${fmt.rel(a.startedAt)}.</p><p>${a.summary} ${a.impact}</p><p><strong>${as.headline}.</strong> ${as.guidance}</p><p><strong>Next:</strong> ${n.text}</p>`,
        sources: [ { label: `${a.metric.name} (last 60 min)`, href: `#/alerts/${a.id}` }, ...(as.incident ? [ { label: `${as.incident.id} · ${as.incident.title}`, href: '#/health' } ] : []), ...(a.changes.length ? [ { label: 'Deploy history', href: `#/alerts/${a.id}` } ] : []) ],
        tools: [ tool('alerts.get', { id: a.id }), tool('telemetry.get_freshness', { camr_id: a.camrId, env: a.env }), tool('telemetry.list_incidents', { region: app.region }), tool('changes.list_recent', { camr_id: a.camrId, since: '24h' }) ],
        proposals: proposalsFor(a, as) };
    }
    if (intent === 'source' && a) {
      const as = tel.assess(a);
      return { text: html`<p><strong>${as.headline}</strong> (confidence: ${as.confidence}).</p><p>${as.guidance}</p><ul>${as.evidence.slice(0, 4).map((e) => html`<li>${e.text}</li>`)}</ul>`,
        sources: [ { label: 'Signal freshness for this component', href: `#/alerts/${a.id}` }, { label: 'Telemetry health', href: '#/health' } ],
        tools: [ tool('telemetry.get_freshness', { camr_id: a.camrId, service: a.service, env: a.env }), tool('telemetry.list_incidents', {}) ],
        proposals: as.verdict === 'telemetry' && !a.linkedIncident ? [ { title: `Link ${a.id} to ${as.incident.id}`, approval: 'You confirm', action: 'link-incident', alert: a.id } ] : [] };
    }
    if (intent === 'owner' && (a || ctx.app)) {
      const app = a ? reg.app(a.camrId) : ctx.app;
      const esc = a ? alerts.escalation(a) : null;
      return { text: html`<p><strong>${app.name}</strong> is owned by <strong>${app.owningTeam}</strong>. App owner: ${app.appOwner}.</p>
          ${app.onCall ? html`<p>On-call now: ${app.onCall.primary} (primary), ${app.onCall.secondary} (secondary). Team chat ${app.chat}.</p>`
            : html`<p><strong>There’s no on-call schedule in the registry.</strong> Contact ${app.supportGroup} during business hours, or the incident commander if customers are affected. That’s a registry gap worth reporting.</p>`}
          ${esc && esc.due ? html`<p>Under the escalation policy, <strong>${esc.due.who}</strong> is due to be paged now.</p>` : ''}`,
        sources: [ { label: `Registry record ${app.camrId}`, href: `#/apps/${app.camrId}` } ],
        tools: [ tool('registry.get_ownership', { camr_id: app.camrId }), ...(a ? [ tool('alerts.get_escalation_policy', { tier: app.tier }) ] : []) ],
        proposals: a && esc && esc.due ? [ { title: `Page ${esc.due.who}`, approval: 'You confirm', action: 'escalate', alert: a.id } ] : [] };
    }
    if (intent === 'next' && a) {
      const n = alerts.nextStep(a); const as = tel.assess(a);
      return { text: html`<p>${n.text}</p>${as.verdict === 'application' && D.remediations[a.id] ? html`<p>The procedure includes a remediation, <strong>${D.remediations[a.id].title}</strong>. It needs approval from ${D.remediations[a.id].approver} and a change record.</p>` : ''}`,
        sources: [ { label: 'Handling procedure', href: `#/runbooks/${a.runbook || 'RB-000'}` } ], tools: [ tool('runbooks.get', { id: a.runbook || 'RB-000' }), tool('alerts.get', { id: a.id }) ], proposals: proposalsFor(a, as) };
    }
    if (intent === 'validation' || (intent === 'next' && (ctx.request || ctx.kind === 'onboard'))) {
      const checks = ctx.request ? ctx.request.checks : (ctx.draft && ctx.draft.checks);
      if (!checks) return { text: html`<p>You haven’t run the checks yet. On the <strong>Connect and check</strong> step, add the configuration, deploy, then choose <strong>Run checks</strong>. I’ll explain anything that fails.</p>`, sources: [], tools: [ tool('onboarding.get_draft', {}) ], proposals: [] };
      const bad = checks.filter((c) => c.state === 'fail' || c.state === 'waiting');
      if (!bad.length) return { text: html`<p>All checks passed. ${ctx.request ? html`Next: ${requests.next(ctx.request).text}` : 'Continue to review and submit.'}</p>`, sources: [], tools: [ tool('onboarding.get_validation', { id: ctx.key }) ], proposals: [] };
      return { text: html`${bad.map((c) => html`<p><strong>${c.label}: ${c.state === 'fail' ? 'failed' : 'waiting'}.</strong> ${c.detail}${c.cause ? html` ${c.cause}` : ''}</p>${c.fix ? html`<p><strong>Fix:</strong> ${c.fix.text}</p>` : ''}`)}<p>After you change it, choose “check again” on that item. If the same check keeps failing, “Get help” sends these diagnostics to the Telemetry Platform team.</p>`,
        sources: bad.map((c) => ({ label: `Validation result: ${c.label}`, href: ctx.request ? `#/requests/${ctx.request.id}` : '#/onboard' })),
        tools: [ tool('onboarding.get_validation', { id: ctx.key }), tool('telemetry.list_incidents', {}) ], proposals: [] };
    }
    if (intent === 'camr') {
      const mine = reg.myApps();
      return { text: html`<p>${D.glossary.camr.text}</p>${role === 'app' ? html`<p>Your applications: ${mine.map((x) => `${x.name} (${x.camrId})`).join(', ')}.</p>` : ''}`,
        sources: [ { label: 'Application registry', href: '#/apps' } ], tools: [ tool('registry.search_applications', { member: D.personas.app.name }) ], proposals: [] };
    }
    if (intent === 'coverage' && ctx.app) {
      const app = ctx.app; const gaps = [];
      app.services.forEach((s) => s.components.forEach((c) => s.envs.forEach((e) => { const cv = reg.coverage(app, s.name, c.name, e); const m = D.signals.filter((x) => cv[x] === 'none'); if (m.length) gaps.push(`${s.name}/${c.name} in ${e}: ${m.join(', ')}`); })));
      return { text: gaps.length ? html`<p>${fmt.plural(gaps.length, 'gap')} found:</p><ul>${gaps.map((g) => html`<li>${g}</li>`)}</ul><p>Production gaps matter most. During an incident, responders can only see what’s onboarded.</p>` : html`<p>Everything is covered. Every registered component has metrics, logs and traces.</p>`,
        sources: [ { label: 'Coverage table', href: `#/apps/${app.camrId}` } ], tools: [ tool('onboarding.get_coverage', { camr_id: app.camrId }) ], proposals: [] };
    }
    if (intent === 'impact' || intent === 'telemetry-now') {
      const inc = D.telemetry.incidents;
      const affected = alerts.open().filter((x) => tel.assess(x).verdict !== 'application');
      return { text: inc.length ? html`<p>${fmt.plural(inc.length, 'telemetry incident')} in progress: ${inc.map((i) => `${i.id} (${i.title.toLowerCase()})`).join('; ')}.</p>${affected.length ? html`<p>Alerts that may come from this: ${affected.map((x) => `${x.id} ${x.title}`).join('; ')}. Check them before paging the application teams.</p>` : ''}` : html`<p>No telemetry incidents right now.</p>`,
        sources: [ { label: 'Telemetry health', href: '#/health' } ], tools: [ tool('telemetry.list_incidents', {}), tool('alerts.list', { status: 'open' }) ], proposals: [] };
    }
    if (intent === 'attention') {
      if (role === 'app') {
        const mine = D.personas.app.apps;
        const al = alerts.open().filter((x) => mine.includes(x.camrId));
        const rq = requests.all().filter((r) => mine.includes(r.camrId) && requests.next(r).owner === 'you');
        return { text: html`<p>${al.length ? html`<strong>${fmt.plural(al.length, 'open alert')}</strong> on your applications: ${al.map((x) => `${x.id} ${x.title}`).join('; ')}.` : 'No open alerts on your applications.'}</p>
            <p>${rq.length ? html`<strong>${fmt.plural(rq.length, 'request')} need${rq.length === 1 ? 's' : ''} you</strong>: ${rq.map((r) => `${r.id} (${requests.next(r).text})`).join('; ')}` : 'None of your onboarding requests need you.'}</p>`,
          sources: [ { label: 'Home', href: '#/home' } ], tools: [ tool('alerts.list', { camr_ids: mine }), tool('onboarding.list_requests', { requester: D.personas.app.name }) ], proposals: [] };
      }
      const open = alerts.sort(alerts.open().filter((x) => x.status === 'new'));
      return { text: html`<p><strong>${fmt.plural(open.length, 'new alert')}</strong>, most urgent first:</p><ol>${open.slice(0, 5).map((x) => html`<li>${x.id} · ${x.title}: ${tel.assess(x).headline.toLowerCase()}.</li>`)}</ol>`,
        sources: [ { label: 'Alert queue', href: '#/alerts' } ], tools: [ tool('alerts.list', { status: 'new' }), tool('telemetry.list_incidents', {}) ], proposals: [] };
    }
    return null;
  }
  function proposalsFor(a, as) {
    const out = [];
    if (a.status === 'resolved') return out;
    if (as.verdict === 'telemetry' && !a.linkedIncident) out.push({ title: `Link ${a.id} to ${as.incident.id}`, approval: 'You confirm', action: 'link-incident', alert: a.id });
    if (as.verdict === 'application' && D.remediations[a.id] && !a.approvals.some((p) => p.state === 'pending')) out.push({ title: D.remediations[a.id].title, approval: `Needs approval from ${D.remediations[a.id].approver}`, action: 'remediate', alert: a.id });
    const esc = alerts.escalation(a, as);
    if (esc.due) out.push({ title: `Page ${esc.due.who}`, approval: 'You confirm', action: 'escalate', alert: a.id });
    return out;
  }
  function route(text, ctx) {
    const t = text.toLowerCase();
    const has = (re) => re.test(t);
    // Requests to act are declined: the assistant is read-only by design.
    if (has(/\b(restart|roll ?back|scale|delete|silence|suppress|mute|approve|deploy|run)\b/)) return 'act';
    if (has(/summar|what.*happen|explain (this|the) alert|tl;?dr/)) return 'summary';
    if (has(/camr/)) return 'camr';
    if (has(/telemetry|pipeline|collector|no data|missing data|app or|application or/)) return ctx.alert ? 'source' : 'telemetry-now';
    if (has(/who|owner|contact|on-?call|team|page/)) return 'owner';
    if (has(/fail|fix|blocked|error|why/)) return ctx.alert ? 'source' : 'validation';
    if (has(/coverage|gap|missing signal|onboard/)) return ctx.app ? 'coverage' : 'next';
    if (has(/next|what should|do now|step/)) return 'next';
    if (has(/attention|today|priorit|alerting/)) return 'attention';
    return null;
  }

  /* ---------- rendering ---------- */
  function renderMsg(m) {
    if (m.who === 'user') return html`<div class="as-msg as-user">${m.text}</div>`;
    if (m.typing) return html`<div class="as-msg as-bot" aria-label="Assistant is working"><span class="typing"><span></span><span></span><span></span></span></div>`;
    const r = m.res;
    return html`<div class="as-msg as-bot">${r.text}
      ${r.sources && r.sources.length ? html`<p class="as-label">Sources</p><ul class="as-sources">${r.sources.map((s) => html`<li>${ui.icon('link')} <a href="${s.href}">${s.label}</a></li>`)}</ul>` : ''}
      ${r.proposals && r.proposals.length ? html`<p class="as-label">Suggested actions</p>${r.proposals.map((p) => html`<div class="as-proposal"><div class="as-proposal-title">${p.title} <span class="chip chip-info">${ui.icon('shield')}${p.approval}</span></div>
        <button type="button" class="btn btn-sm" data-action="${p.action}" data-alert="${p.alert}">Review and confirm</button></div>`)}` : ''}
      ${r.tools && r.tools.length ? html`<details class="as-tools"><summary>${fmt.plural(r.tools.length, 'read-only tool call')} on the OperA MCP server</summary><ul>${r.tools.map((x) => html`<li><code>${x.name}(${Object.entries(x.args).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')})</code> <span class="chip chip-success">${ui.icon('check')}read</span></li>`)}</ul></details>` : ''}
    </div>`;
  }
  function render() {
    const el = document.getElementById('assistant');
    const ctx = context();
    const sugg = SUGGEST[ctx.kind] || SUGGEST.general;
    el.innerHTML = String(html`
      <div class="as-head"><h2 id="as-title">${ui.icon('sparkle')}OperA Assistant</h2>
        <button type="button" class="icon-btn" data-action="toggle-assistant"><span class="sr-only">Close assistant</span>${ui.icon('x')}</button></div>
      <div class="as-context">Looking at: <strong>${ctx.label}</strong></div>
      <div class="as-log" id="as-log" role="log" aria-live="polite" aria-labelledby="as-title">
        ${log.length ? log.map(renderMsg) : html`<div class="as-msg as-bot"><p>I can explain what you’re looking at, find owners and procedures, and check whether a problem is the application or the telemetry.</p>
          <p>I only read data. I can’t page anyone, change configuration or run fixes. When I suggest an action, you review it, and production changes still need a second approver.</p></div>`}
      </div>
      <div class="as-suggest" aria-label="Suggested questions">${sugg.map(([k, label]) => html`<button type="button" data-action="as-ask" data-intent="${k}">${label}</button>`)}</div>
      <form class="as-form" data-form="as-ask"><label for="as-input" class="sr-only">Ask a question</label><input id="as-input" name="q" type="text" autocomplete="off" placeholder="Ask about this page…" /><button type="submit" class="btn btn-primary">Ask</button></form>
      <p class="as-foot">AI-generated from OperA data. Check the linked sources before acting.</p>`);
    // Show the start of the newest answer, not the end of it.
    const lg = document.getElementById('as-log');
    const msgs = lg.querySelectorAll('.as-msg');
    const lastUser = Array.from(lg.querySelectorAll('.as-user')).pop();
    if (lastUser) lg.scrollTop = lastUser.offsetTop - lg.offsetTop - 8; else if (msgs.length) lg.scrollTop = 0;
  }
  function ask(intent, label) {
    const ctx = context();
    log.push({ who: 'user', text: label });
    const typing = { who: 'bot', typing: true }; log.push(typing); render();
    setTimeout(() => {
      log.splice(log.indexOf(typing), 1);
      let res;
      if (intent === 'act') res = { text: html`<p>I can’t make changes. That’s deliberate, so a person always decides. ${ctx.alert ? 'If the handling procedure includes this action, use its button. It opens an approval request with the blast radius and rollback plan.' : 'Use the buttons on the page to take actions.'}</p>`, tools: [], sources: [], proposals: ctx.alert ? proposalsFor(ctx.alert, tel.assess(ctx.alert)) : [] };
      else res = (intent && answer(intent, ctx)) || { text: html`<p>I don’t have an answer for that in this prototype. Try one of the suggested questions. They cover what responders and application teams ask most often.</p>`, tools: [], sources: [], proposals: [] };
      log.push({ who: 'bot', res }); render();
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 50 : 600);
  }

  OperA.forms['as-ask'] = (form) => {
    const q = form.elements.q.value.trim(); if (!q) return;
    form.elements.q.value = '';
    ask(route(q, context()), q);
    setTimeout(() => { const i = document.getElementById('as-input'); if (i) i.focus(); }, 700);
  };
  OperA.actions['as-ask'] = (el) => ask(el.dataset.intent, el.textContent);
  function setOpen(open) {
    const el = document.getElementById('assistant');
    el.hidden = !open;
    document.body.classList.toggle('assistant-open', open);
    document.querySelector('.assistant-btn').setAttribute('aria-expanded', String(open));
    if (open) { render(); document.getElementById('as-input').focus(); }
  }
  OperA.actions['toggle-assistant'] = () => {
    const open = document.getElementById('assistant').hidden;
    setOpen(open);
    if (!open) document.querySelector('.assistant-btn').focus();
  };
  OperA.actions['open-assistant'] = (el) => {
    setOpen(true);
    const intent = el.dataset.prompt;
    if (intent) ask(intent, (SUGGEST[context().kind] || []).find(([k]) => k === intent)?.[1] || 'Summarize this');
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('assistant').hidden && document.getElementById('assistant').contains(document.activeElement) && !document.getElementById('modal').open) {
      setOpen(false); document.querySelector('.assistant-btn').focus();
    }
  });
  OperA.assistant = {
    onRoute() {
      const ctx = context();
      if (ctx.key !== lastKey) { log.length = 0; lastKey = ctx.key; }
      if (!document.getElementById('assistant').hidden) render();
    },
  };
})();
