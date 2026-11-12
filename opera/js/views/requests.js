/* OperA — onboarding request tracker */
(function () {
  'use strict';
  const OperA = window.OperA;
  const { html, raw, fmt, reg, requests, validation, store, ui } = OperA;
  const D = OperA.data;

  const OWNER_CHIP = {
    you: (t) => html`<span class="chip chip-danger">${ui.icon('user')}${t || 'You'}</span>`,
    approver: (t) => html`<span class="chip chip-info">${ui.icon('shield')}${t || 'Approver'}</span>`,
    platform: () => html`<span class="chip chip-neutral">${ui.icon('activity')}Platform (automatic)</span>`,
    none: () => html`<span class="chip chip-success">${ui.icon('check')}Done</span>`,
  };
  const ownerChip = (r, n) => OWNER_CHIP[n.owner](n.owner === 'approver' ? r.approver : n.owner === 'you' && r.requester !== D.personas[store.state.role].name ? r.requester : null);

  OperA.views.requests = {
    title: () => 'Onboarding requests',
    render(_, q) {
      const role = store.state.role;
      const me = D.personas.app;
      const filter = q.filter || (role === 'app' ? 'mine' : 'all');
      const ds = store.state.proto.dataSource;
      let list = requests.all();
      if (filter === 'mine') list = list.filter((r) => r.requester === me.name || me.apps.includes(r.camrId));
      if (filter === 'action') list = list.filter((r) => requests.next(r).owner === 'you' && (r.requester === me.name || me.apps.includes(r.camrId)));
      const tab = (k, label) => html`<button type="button" data-action="nav" data-href="#/requests?filter=${k}" aria-pressed="${filter === k}">${label}</button>`;
      let body;
      if (ds === 'error') body = ui.errorState({ title: 'We couldn’t load onboarding requests', body: 'The onboarding service didn’t respond. Your requests are safe and still being processed.', cached: 'Try again in a minute. If it keeps failing, check Telemetry health.' });
      else if (ds === 'empty' || !list.length) body = ui.emptyState({ title: filter === 'action' ? 'Nothing needs your action' : 'No onboarding requests yet',
        body: filter === 'action' ? 'All your requests are either moving or done.' : 'When you onboard telemetry, your request shows up here with its progress and next step.',
        action: html`<a class="btn btn-primary" href="#/onboard">Onboard telemetry</a>` });
      else body = html`<div class="table-wrap"><table class="table">
        <caption class="sr-only">Onboarding requests</caption>
        <thead><tr><th scope="col">Request</th><th scope="col">What</th><th scope="col">Progress</th><th scope="col">Next step</th></tr></thead>
        <tbody>${list.map((r) => {
          const app = reg.app(r.camrId); const n = requests.next(r);
          const failedAt = r.status === 'action-needed' ? 1 : r.status === 'rejected' ? 2 : -1;
          return html`<tr>
            <td><a class="row-title" href="#/requests/${r.id}">${r.id}</a><div class="row-sub">${r.requester} · ${fmt.rel(r.createdAt)}</div></td>
            <td><div class="row-title">${app.name}</div><div class="row-sub"><span class="mono">${r.service}/${r.component}</span> · ${ui.envTag(r.env)} · ${r.signals.join(', ')}</div></td>
            <td style="min-width:260px">${ui.reqStatus(r.status)}<div class="stepper-compact">${ui.stepper(requests.STAGES, requests.stageIndex(r), { failedAt, label: `${r.id} progress` })}</div></td>
            <td style="min-width:220px"><div class="cell-stack">${ownerChip(r, n)}<span class="small">${n.text}</span></div></td></tr>`;
        })}</tbody></table></div>`;
      return html`
        ${ui.pageHead({ title: 'Onboarding requests', lead: 'Every request from submission to data flowing. Each one shows who has to act next, so nobody has to chase.',
          actions: html`<a class="btn btn-primary" href="#/onboard">${ui.icon('plus')}Onboard telemetry</a>` })}
        <div class="toolbar"><div class="seg" role="group" aria-label="Filter requests">${tab('mine', 'Mine')}${tab('action', 'Needs my action')}${tab('all', 'All')}</div>
          <span class="muted small">${fmt.plural(list.length, 'request')}</span></div>
        ${body}`;
    },
  };
  OperA.route(/^\/requests$/, OperA.views.requests);

  OperA.views.requestDetail = {
    title: ([id]) => `Request ${id}`,
    render([id], q) {
      const r = requests.get(id);
      if (!r) return html`${ui.pageHead({ title: 'Request not found', lead: `We couldn’t find ${id}. It may have been created in a different browser, or the prototype data was reset.`, crumbs: [ { href: '#/requests', label: 'Onboarding requests' }, { label: id } ] })}<a class="btn" href="#/requests">All requests</a>`;
      const app = reg.app(r.camrId);
      const n = requests.next(r);
      const failedAt = r.status === 'action-needed' ? 1 : r.status === 'rejected' ? 2 : -1;
      const firstFail = r.checks.find((c) => c.state === 'fail');
      const tone = { you: 'danger', approver: 'info', platform: 'info', none: 'success' }[n.owner];
      let actions = '';
      if (r.status === 'action-needed' && firstFail) actions = html`<a class="btn btn-primary" href="#check-${firstFail.id}" data-action="jump" data-target="check-${firstFail.id}">See how to fix it</a>`;
      else if (r.status === 'awaiting-approval') actions = n.reminded ? html`<span class="chip chip-success">${ui.icon('check')}Reminder sent ${fmt.rel(r.reminderAt)}</span>`
        : html`<button type="button" class="btn" data-action="req-remind" data-id="${r.id}" ${n.canRemind ? '' : raw('aria-disabled="true" title="You can send a reminder once the request has waited more than a day"')}>${ui.icon('bell')}Send reminder to ${r.approver}</button>`;
      else if (r.status === 'rejected') actions = html`<button type="button" class="btn btn-primary" data-action="req-resubmit" data-id="${r.id}">Update and resubmit</button>`;
      else if (r.status === 'complete') actions = html`<button type="button" class="btn" data-action="open-external" data-what="${app.name} · ${r.service}">${ui.icon('external')}Open dashboard</button>`;
      const proto = r.status === 'awaiting-approval' ? html`<div class="proto-inline">Prototype: simulate the approver’s decision <button type="button" class="btn btn-sm" data-action="req-sim" data-id="${r.id}" data-to="approve">Approve</button><button type="button" class="btn btn-sm" data-action="req-sim" data-id="${r.id}" data-to="reject">Reject</button></div>`
        : r.status === 'provisioning' ? html`<div class="proto-inline">Prototype: <button type="button" class="btn btn-sm" data-action="req-sim" data-id="${r.id}" data-to="complete">Simulate setup finishing</button></div>` : '';

      return html`
        ${ui.pageHead({ crumbs: [ { href: '#/requests', label: 'Onboarding requests' }, { label: r.id } ],
          eyebrow: html`${r.id} · submitted ${ui.timeAgo(r.createdAt)} by ${r.requester}`,
          title: html`${app.name} · <span class="mono">${r.service}/${r.component}</span>`,
          lead: html`${ui.envTag(r.env)} · ${r.signals.map(fmt.cap).join(', ')}` })}
        ${q.new ? ui.callout('success', `Request ${r.id} submitted`, html`<p>${n.owner === 'you' ? 'One thing still needs you. See the next step below.' : n.owner === 'approver' ? `We’ve asked ${r.approver} to approve it.` : 'It’s being set up automatically. You don’t need to do anything else.'} We’ll notify you when it changes.</p>`) : ''}
        <div class="next-step tone-${tone}" role="region" aria-label="Next step">
          <div><div class="next-step-label">Next step · ${n.owner === 'approver' ? r.approver : requests.ownerLabel[n.owner]}</div></div>
          <div class="next-step-text">${n.text}</div>
          ${actions}
        </div>
        ${proto}
        <section class="card" aria-labelledby="h-prog" style="margin-top:16px">
          <h2 class="card-title" id="h-prog">${ui.icon('list')}Progress</h2>
          ${ui.stepper(requests.STAGES, requests.stageIndex(r), { failedAt, label: 'Request progress' })}
        </section>
        <div class="split" style="margin-top:16px">
          <div>
            <section class="card" aria-labelledby="h-checks">
              <div class="card-head"><h2 class="card-title" id="h-checks">${ui.icon('check')}Validation checks</h2>
                ${r.status !== 'complete' ? html`<button type="button" class="btn btn-sm" data-action="req-recheck-all" data-id="${r.id}" id="req-run">${ui.icon('refresh')}Run all checks again</button>` : ''}</div>
              <div id="req-results">${OperA.resultsBlock(r.checks, 'req')}</div>
            </section>
            <section class="card" aria-labelledby="h-act">
              <h2 class="card-title" id="h-act">${ui.icon('clock')}Activity</h2>
              <ol class="timeline">${r.history.slice().reverse().map((h) => html`<li><div>${h.text}</div><div class="tl-meta">${ui.timeAgo(h.at)}</div></li>`)}</ol>
            </section>
          </div>
          <div class="stack">
            <section class="card" aria-labelledby="h-ppl">
              <h2 class="card-title" id="h-ppl">${ui.icon('users')}People involved</h2>
              <dl class="kv"><dt>Requested by</dt><dd>${r.requester}</dd>
                ${r.needsApproval || r.env === 'prod' ? html`<dt>Approver</dt><dd>${r.approver || app.appOwner} (app owner)</dd>` : html`<dt>Approval</dt><dd>Automatic (${r.env})</dd>`}
                <dt>Platform help</dt><dd>${D.telemetry.telemetryOnCall.team} <span class="mono small">${D.telemetry.telemetryOnCall.chat}</span></dd></dl>
              <p class="small muted">If you ask for help, OperA attaches this request’s diagnostics automatically.</p>
            </section>
            ${ui.ownership(app, { title: 'Application' })}
          </div>
        </div>`;
    },
  };
  OperA.route(/^\/requests\/(REQ-\d+)$/, OperA.views.requestDetail);

  OperA.actions.jump = (el) => { const t = document.getElementById(el.dataset.target); if (t) { t.setAttribute('tabindex', '-1'); t.scrollIntoView({ block: 'start' }); t.focus({ preventScroll: true }); } };

  function afterChecks(r, attempts, historyText) {
    const app = reg.app(r.camrId);
    const checks = validation.run({ app, service: r.service, component: r.component, env: r.env, signals: r.signals }, r.scenario, attempts);
    const s = validation.summary(checks);
    const patch = { attempts };
    let msg = historyText;
    if (r.status === 'action-needed' && !s.fail) {
      patch.status = r.needsApproval || r.env === 'prod' ? 'awaiting-approval' : 'provisioning';
      msg += patch.status === 'provisioning' ? ' All checks passed. Approved automatically and setting up.' : ` All checks passed. Waiting for approval from ${r.approver || app.appOwner}.`;
      if (patch.status === 'awaiting-approval' && !r.approver) patch.approver = app.appOwner;
    }
    requests.override(r.id, patch, msg);
    return { checks, s, moved: !!patch.status };
  }
  OperA.actions['req-recheck'] = (el) => {
    const r = requests.get(OperA.current.params[0]); const id = el.dataset.check;
    const attempts = Object.assign({}, r.attempts, { [id]: (r.attempts[id] || 0) + 1 });
    el.disabled = true; el.lastChild.textContent = 'Checking…';
    setTimeout(() => {
      const res = afterChecks(r, attempts, `${validation.label[id]} checked again by ${D.personas[store.state.role].name}.`);
      OperA.refresh();
      const c = res.checks.find((x) => x.id === id);
      OperA.announce(`${c.label}: ${c.state === 'pass' ? 'passed' : 'still not passing'}. ${res.moved ? 'Your request moved to the next stage.' : ''}`);
      if (res.moved) OperA.toast('Fixed. Your request moved to the next stage.');
      const li = document.getElementById(`check-${id}`); if (li) { li.setAttribute('tabindex', '-1'); li.focus(); }
    }, 700);
  };
  OperA.actions['req-recheck-all'] = (el) => {
    const r = requests.get(el.dataset.id);
    const attempts = Object.assign({}, r.attempts);
    r.checks.forEach((c) => { if (c.state !== 'pass') attempts[c.id] = (attempts[c.id] || 0) + 1; });
    el.disabled = true;
    setTimeout(() => {
      const res = afterChecks(r, attempts, `All checks run again by ${D.personas[store.state.role].name}.`);
      OperA.refresh();
      OperA.announce(`Checks finished. ${res.s.pass} passed${res.s.fail ? `, ${res.s.fail} need your action` : ''}.`);
      if (res.moved) OperA.toast('Fixed. Your request moved to the next stage.');
    }, 700);
  };
  OperA.actions['req-help'] = (el) => {
    const r = requests.get(OperA.current.params[0]);
    const c = r.checks.find((x) => x.id === el.dataset.check);
    OperA.helpModal({ app: reg.app(r.camrId), service: r.service, component: r.component, env: r.env, signals: r.signals, attempts: r.attempts }, c);
  };
  OperA.actions['req-remind'] = (el) => {
    if (el.getAttribute('aria-disabled') === 'true') return;
    const r = requests.get(el.dataset.id);
    requests.override(r.id, { reminderAt: Date.now() }, `Reminder sent to ${r.approver} by ${D.personas[store.state.role].name}.`);
    OperA.toast(`Reminder sent to ${r.approver}. You can send another in 24 hours.`); OperA.refresh();
  };
  OperA.actions['req-sim'] = (el) => {
    const r = requests.get(el.dataset.id); const to = el.dataset.to;
    if (to === 'approve') requests.override(r.id, { status: 'provisioning' }, `Approved by ${r.approver}. Setting up storage, retention and dashboard (automated).`);
    if (to === 'reject') requests.override(r.id, { status: 'rejected', rejectReason: 'Please set this up in qa first so we can confirm the sampling rate before production.' }, `Not approved by ${r.approver}: “Please set this up in qa first so we can confirm the sampling rate before production.”`);
    if (to === 'complete') requests.override(r.id, { status: 'complete' }, 'Set up finished. Data is flowing steadily. Onboarding complete.');
    OperA.refresh(); OperA.toast('Prototype: request updated.', 'info');
  };
  OperA.actions['req-resubmit'] = (el) => {
    const r = requests.get(el.dataset.id);
    store.state.draft = { step: 0, camrId: r.camrId, service: r.service, component: r.component, env: r.env === 'prod' ? 'qa' : r.env, signals: r.signals.slice(),
      method: 'kubernetes', checks: null, attempts: {}, scenario: null, query: '', startedAt: Date.now(), savedAt: Date.now() };
    store.save();
    OperA.toast('We copied your request into a new draft. The approver asked for qa first, so qa is selected.', 'info');
    OperA.go('#/onboard');
  };
})();
