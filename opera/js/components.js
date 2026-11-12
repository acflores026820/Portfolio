/*
 * OperA prototype — shared UI components.
 * Status is never conveyed by colour alone: every chip pairs an icon with text.
 * Icon paths adapted from Feather Icons (MIT License, https://feathericons.com).
 */
(function () {
  'use strict';
  const OperA = window.OperA;
  const { html, raw, fmt, reg, tel, alerts, requests, store } = OperA;
  const D = OperA.data;

  const ICONS = {
    check: '<polyline points="20 6 9 17 4 12"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    octagon: '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    plus: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    arrow: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
    commit: '<circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    chevron: '<polyline points="9 18 15 12 9 6"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  };
  function icon(name, cls = '') {
    return raw(`<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`);
  }

  /* ---------- chips & badges (icon + text, never colour alone) ---------- */
  const SEV = {
    critical: { icon: 'octagon', label: 'Critical' }, high: { icon: 'alert', label: 'High' },
    medium: { icon: 'alert', label: 'Medium' }, low: { icon: 'info', label: 'Low' },
  };
  const sev = (s) => html`<span class="sev sev-${s}">${icon(SEV[s].icon)}<span>${SEV[s].label}</span></span>`;

  const STATE = {
    pass: { icon: 'check', label: 'Passed', tone: 'success' },
    fail: { icon: 'x', label: 'Needs your action', tone: 'danger' },
    waiting: { icon: 'clock', label: 'Waiting for data', tone: 'info' },
    warn: { icon: 'alert', label: 'Warning', tone: 'warn' },
    skipped: { icon: 'minus', label: 'Not checked yet', tone: 'neutral' },
  };
  const checkChip = (s) => html`<span class="chip chip-${STATE[s].tone}">${icon(STATE[s].icon)}${STATE[s].label}</span>`;

  const COVERAGE = {
    active: { icon: 'check', label: 'Active', tone: 'success' }, partial: { icon: 'alert', label: 'Partial', tone: 'warn' },
    onboarding: { icon: 'clock', label: 'Onboarding', tone: 'info' }, none: { icon: 'minus', label: 'Not set up', tone: 'neutral' },
  };
  const covChip = (s) => html`<span class="chip chip-${COVERAGE[s].tone}">${icon(COVERAGE[s].icon)}${COVERAGE[s].label}</span>`;

  const FRESH = {
    fresh: { icon: 'check', tone: 'success' }, delayed: { icon: 'clock', tone: 'warn' }, missing: { icon: 'x', tone: 'danger' },
    partial: { icon: 'alert', tone: 'warn' }, 'not-onboarded': { icon: 'minus', tone: 'neutral' },
  };
  const freshChip = (f) => html`<span class="chip chip-${FRESH[f.state].tone}">${icon(FRESH[f.state].icon)}${f.label}</span>`;

  const ALERT_STATUS = {
    new: { label: 'New, not acknowledged', short: 'New', tone: 'danger', icon: 'bell' },
    acknowledged: { label: 'Acknowledged', short: 'Acknowledged', tone: 'info', icon: 'user' },
    investigating: { label: 'Investigating', short: 'Investigating', tone: 'info', icon: 'search' },
    resolved: { label: 'Resolved', short: 'Resolved', tone: 'success', icon: 'check' },
  };
  const alertStatus = (s) => html`<span class="chip chip-${ALERT_STATUS[s].tone}">${icon(ALERT_STATUS[s].icon)}${ALERT_STATUS[s].short}</span>`;

  const VERDICT = {
    application: { icon: 'layers', label: 'App issue', tone: 'app' },
    telemetry: { icon: 'activity', label: 'Telemetry issue', tone: 'tel' },
    inconclusive: { icon: 'help', label: 'Unclear: check data', tone: 'warn' },
  };
  const verdictChip = (v) => html`<span class="chip chip-${VERDICT[v].tone}">${icon(VERDICT[v].icon)}${VERDICT[v].label}</span>`;

  const REQ_STATUS = {
    'action-needed': { label: 'Needs your action', tone: 'danger', icon: 'x' },
    'awaiting-approval': { label: 'Awaiting approval', tone: 'info', icon: 'shield' },
    rejected: { label: 'Not approved', tone: 'danger', icon: 'x' },
    provisioning: { label: 'Setting up', tone: 'info', icon: 'clock' },
    receiving: { label: 'Checking data flow', tone: 'info', icon: 'clock' },
    complete: { label: 'Complete', tone: 'success', icon: 'check' },
  };
  const reqStatus = (s) => html`<span class="chip chip-${REQ_STATUS[s].tone}">${icon(REQ_STATUS[s].icon)}${REQ_STATUS[s].label}</span>`;

  const envTag = (env) => html`<span class="env env-${env}">${env}</span>`;
  const timeAgo = (ts) => html`<time datetime="${fmt.iso(ts)}" title="${new Date(ts).toLocaleString()}">${fmt.rel(ts)}</time>`;

  /* ---------- layout pieces ---------- */
  function pageHead({ title, eyebrow, lead, actions, crumbs }) {
    return html`
      ${crumbs ? html`<nav class="crumbs" aria-label="Breadcrumb"><ol>${crumbs.map((c, i) => i < crumbs.length - 1
        ? html`<li><a href="${c.href}">${c.label}</a></li>` : html`<li aria-current="page">${c.label}</li>`)}</ol></nav>` : ''}
      <div class="page-head">
        <div>
          ${eyebrow ? html`<p class="eyebrow">${eyebrow}</p>` : ''}
          <h1>${title}</h1>
          ${lead ? html`<p class="lead">${lead}</p>` : ''}
        </div>
        ${actions ? html`<div class="page-actions">${actions}</div>` : ''}
      </div>`;
  }
  const CALLOUT_ICON = { info: 'info', success: 'check', warn: 'alert', danger: 'octagon', tel: 'activity' };
  function callout(tone, title, body, actions) {
    return html`<div class="callout callout-${tone}">
      ${icon(CALLOUT_ICON[tone] || 'info', 'callout-icon')}
      <div class="callout-content">
        ${title ? html`<p class="callout-title">${title}</p>` : ''}
        ${body ? html`<div class="callout-body">${body}</div>` : ''}
        ${actions ? html`<div class="callout-actions">${actions}</div>` : ''}
      </div></div>`;
  }
  function emptyState({ title, body, action }) {
    return html`<div class="empty">${icon('check', 'empty-icon')}<p class="empty-title">${title}</p>${body ? html`<p>${body}</p>` : ''}${action || ''}</div>`;
  }
  function errorState({ title, body, cached }) {
    return callout('danger', title, html`<p>${body}</p>${cached ? html`<p class="muted">${cached}</p>` : ''}`,
      html`<button type="button" class="btn" data-action="retry-load">${icon('refresh')}Try again</button>`);
  }
  function notFound(path) {
    return html`${pageHead({ title: 'We couldn’t find that page', lead: `There’s nothing at “${path}”. It may have moved, or the link may be mistyped.` })}
      <p><a class="btn btn-primary" href="#/home">Go to home</a></p>`;
  }

  /* ---------- help toggle (accessible disclosure, plain-language glossary) ---------- */
  let helpSeq = 0;
  function help(key, label) {
    const g = D.glossary[key];
    const id = `help-${key}-${++helpSeq}`;
    const term = /^[A-Z]{2}/.test(g.term) ? g.term : g.term.toLowerCase();
    const plural = /s$/.test(term);
    const q = plural ? `What are ${term}?` : `What’s ${/^[aeiou]/i.test(term) ? 'an' : 'a'} ${term}?`;
    return html`<span class="help"><button type="button" class="help-btn" aria-expanded="false" aria-controls="${id}" data-action="toggle-help">${icon('help')}<span>${label || q}</span></button>
      <span class="help-panel" id="${id}" hidden>${g.text}</span></span>`;
  }
  OperA.actions['toggle-help'] = (btn) => {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    panel.hidden = open;
  };

  /* ---------- code block with copy ---------- */
  let codeSeq = 0;
  function codeBlock(code, label) {
    const id = `code-${++codeSeq}`;
    return html`<div class="code"><div class="code-head"><span>${label || 'Code'}</span>
      <button type="button" class="btn btn-sm" data-action="copy" data-copy-target="${id}">${icon('copy')}<span>Copy</span></button></div>
      <pre id="${id}" tabindex="0" aria-label="${label || 'Code'}"><code>${code}</code></pre></div>`;
  }
  OperA.actions.copy = (btn) => {
    const pre = document.getElementById(btn.dataset.copyTarget);
    const text = pre ? pre.textContent : '';
    const done = () => { btn.querySelector('span').textContent = 'Copied'; OperA.announce('Copied to clipboard'); setTimeout(() => { if (btn.isConnected) btn.querySelector('span').textContent = 'Copy'; }, 2000); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  };
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    ta.remove(); done();
  }

  /* ---------- stepper (wizard steps & request stages) ---------- */
  function stepper(labels, current, { failedAt = -1, label = 'Progress' } = {}) {
    return html`<ol class="stepper" aria-label="${label}">${labels.map((l, i) => {
      const st = i === failedAt ? 'failed' : i < current ? 'done' : i === current ? 'current' : 'todo';
      const sr = { done: 'completed', current: 'current step', todo: 'not started', failed: 'needs attention' }[st];
      return html`<li class="step step-${st}" ${i === current ? raw('aria-current="step"') : ''}>
        <span class="step-dot">${st === 'done' ? icon('check') : st === 'failed' ? icon('x') : i + 1}</span>
        <span class="step-label">${l}<span class="sr-only"> (${sr})</span></span></li>`;
    })}</ol>`;
  }

  /* ---------- ownership card ---------- */
  function ownership(app, { title = 'Who owns this' } = {}) {
    const staleDays = Math.round((Date.now() - app.registryVerified) / 86400000);
    const stale = staleDays > 180;
    return html`<section class="card" aria-labelledby="own-${app.camrId}">
      <h2 class="card-title" id="own-${app.camrId}">${icon('users')}${title}</h2>
      <dl class="kv">
        <dt>Application</dt><dd><a href="#/apps/${app.camrId}">${app.name}</a> <span class="mono">${app.camrId}</span> · Tier ${app.tier}</dd>
        <dt>Owning team</dt><dd>${app.owningTeam}</dd>
        <dt>App owner</dt><dd>${app.appOwner}</dd>
        ${app.onCall
          ? html`<dt>Primary on-call</dt><dd>${app.onCall.primary}</dd><dt>Secondary on-call</dt><dd>${app.onCall.secondary}</dd>`
          : html`<dt>On-call</dt><dd><span class="chip chip-warn">${icon('alert')}Not registered</span></dd>`}
        <dt>Support group</dt><dd class="mono">${app.supportGroup}</dd>
        <dt>Team chat</dt><dd class="mono">${app.chat}</dd>
      </dl>
      ${!app.onCall ? callout('warn', 'No on-call schedule is registered for this application',
        html`<p>Outside business hours there is nobody to page. Contact <span class="mono">${app.supportGroup}</span> during business hours, or the incident commander if customers are affected. Flag the gap so the owning team can fix it.</p>`) : ''}
      ${stale ? callout('warn', `Ownership last verified ${fmt.dur(staleDays * 1440)} ago`, html`<p>These details may be out of date. Confirm with the team before relying on them.</p>`) : html`<p class="muted small">Registry details verified ${timeAgo(app.registryVerified)}.</p>`}
      <button type="button" class="btn btn-sm btn-ghost" data-action="report-registry" data-camr="${app.camrId}">${icon('flag')}Report wrong or missing details</button>
    </section>`;
  }
  OperA.actions['report-registry'] = (btn) => {
    const app = reg.app(btn.dataset.camr);
    OperA.modal.open({
      title: 'Report wrong or missing ownership details',
      form: 'report-registry', submitLabel: 'Send to registry owner', data: { camr: app.camrId },
      body: html`<p>This goes to <strong>${app.appOwner}</strong> (app owner for ${app.name}), who can correct the registry. You don’t need to find the right person yourself.</p>
        <div class="field"><label for="rr-what">What’s wrong?</label>
          <select id="rr-what" name="what"><option>No on-call schedule</option><option>Wrong on-call person</option><option>Wrong owning team</option><option>Wrong support group</option><option>Something else</option></select></div>
        <div class="field"><label for="rr-note">Details <span class="optional">(optional)</span></label><textarea id="rr-note" name="note" rows="3"></textarea></div>`,
    });
  };
  OperA.forms['report-registry'] = (form) => {
    const app = reg.app(form.dataset.camr);
    OperA.modal.close();
    OperA.toast(`Sent to ${app.appOwner}. You’ll be notified when the registry is updated.`);
  };

  /* ---------- escalation ladder ---------- */
  function escalationLadder(esc, alert) {
    return html`<ol class="ladder">${esc.steps.map((s, i) => {
      const timing = s.after === 0 ? 'From the start' : `After ${s.after} min`;
      let status;
      if (s.state === 'engaged') status = html`<span class="chip chip-tel">${icon('activity')}Already on it</span>`;
      else if (s.state === 'done') status = s.key === 'noc' ? html`<span class="chip chip-neutral">${icon('check')}Triage owner</span>`
        : s.ackedBy ? html`<span class="chip chip-success">${icon('check')}Acknowledged</span>`
        : s.sent ? html`<span class="chip chip-success">${icon('check')}Paged ${fmt.rel(s.sent.at)}</span>`
        : html`<span class="chip chip-success">${icon('check')}Done</span>`;
      else if (s.state === 'due') status = html`<span class="chip chip-danger">${icon('bell')}Due now</span>`;
      else if (s.state === 'overdue-later') status = html`<span class="chip chip-warn">${icon('clock')}Next after that</span>`;
      else if (s.state === 'skipped') status = html`<span class="chip chip-neutral">${icon('minus')}Not needed</span>`;
      else status = html`<span class="chip chip-neutral">${icon('clock')}In ${s.inMin} min</span>`;
      return html`<li class="ladder-step ladder-${s.state}">
        <div class="ladder-head"><span class="ladder-num">${i + 1}</span><strong>${s.who}</strong>${status}</div>
        <div class="ladder-meta">${s.role}<br /><span class="muted">${timing} · ${s.contact || ''}</span>${s.state === 'engaged' && alert ? html`<br />Working on the telemetry incident already. No need to page.` : ''}</div>
        ${s.state === 'due' && alert ? html`<button type="button" class="btn btn-sm btn-primary" data-action="escalate" data-alert="${alert.id}" data-target="${s.key}">${icon('bell')}${s.key === 'telemetry' ? 'Page Telemetry Platform' : `Page ${s.who}`}</button>` : ''}
      </li>`;
    })}</ol>`;
  }

  /* ---------- line chart (single series: no legend; title names it) ---------- */
  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((x) => n <= x);
    return step * p;
  }
  function tickLabel(t, unit) {
    let n;
    if (t >= 10000) n = `${Math.round(t / 1000)}K`;
    else if (t % 1) n = String(Math.round(t * 10) / 10);
    else n = fmt.num(t);
    return unit === '%' ? `${n}%` : n;
  }
  function fmtVal(v, unit, decimals) {
    if (v == null) return 'no data';
    const n = decimals ? Number(v).toFixed(decimals) : fmt.num(Math.round(v));
    return unit === '%' ? `${n}%` : unit ? `${n} ${unit}` : n;
  }
  function chartSummary(alert) {
    const m = alert.metric;
    const vals = m.series;
    const firstVals = vals.slice(0, 15).filter((v) => v != null);
    const start = firstVals.length ? firstVals.reduce((a, b) => a + b, 0) / firstVals.length : null;
    let lastIdx = vals.length - 1; while (lastIdx >= 0 && vals[lastIdx] == null) lastIdx--;
    const last = lastIdx >= 0 ? vals[lastIdx] : null;
    const missing = vals.filter((v) => v == null).length;
    const trailingGap = vals.length - 1 - lastIdx;
    const d = (m.unit === '%' || m.unit === 'min') ? 1 : 0;
    let s = `${m.name} over the last 60 minutes. `;
    if (trailingGap >= 5 && trailingGap === missing) s += `Normal at about ${fmtVal(start, m.unit, d)} until ${trailingGap} minutes ago, then no data at all.`;
    else {
      s += `About ${fmtVal(start, m.unit, d)} an hour ago; latest value ${fmtVal(last, m.unit, d)}.`;
      if (missing > 5) s += ` ${missing} of 60 data points are missing.`;
    }
    if (m.threshold != null) s += ` Alert threshold: ${fmtVal(m.threshold, m.unit, d)}.`;
    return s;
  }
  function lineChart(alert, { height = 190 } = {}) {
    const m = alert.metric;
    const W = 640, H = height, L = 56, R = 64, T = 14, B = 28;
    const vals = m.series;
    const d = (m.unit === '%' || m.unit === 'min') ? 1 : 0;
    const max = niceMax(Math.max(m.threshold || 0, ...vals.filter((v) => v != null)) * 1.12);
    const x = (i) => L + (i / (vals.length - 1)) * (W - L - R);
    const y = (v) => T + (1 - v / max) * (H - T - B);
    const ticks = [0, max / 2, max];
    // segments split at gaps
    const segs = []; let cur = [];
    vals.forEach((v, i) => { if (v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([x(i), y(v)]); });
    if (cur.length) segs.push(cur);
    const linePath = segs.map((sg) => 'M' + sg.map((p) => p.map((n) => n.toFixed(1)).join(',')).join('L')).join(' ');
    const areaPath = segs.filter((sg) => sg.length > 1).map((sg) => `M${sg[0][0].toFixed(1)},${y(0).toFixed(1)}L` + sg.map((p) => p.map((n) => n.toFixed(1)).join(',')).join('L') + `L${sg[sg.length - 1][0].toFixed(1)},${y(0).toFixed(1)}Z`).join(' ');
    // trailing gap shading
    let lastIdx = vals.length - 1; while (lastIdx >= 0 && vals[lastIdx] == null) lastIdx--;
    const trailingGap = vals.length - 1 - lastIdx;
    const startIdx = Math.max(0, vals.length - 1 - fmt.minsSince(alert.startedAt));
    const endPt = lastIdx >= 0 ? [x(lastIdx), y(vals[lastIdx])] : null;
    const id = `chart-${alert.id}`;
    const tableRows = [];
    for (let i = 0; i < vals.length; i += 5) tableRows.push([i, vals[i]]);
    if ((vals.length - 1) % 5) tableRows.push([vals.length - 1, vals[vals.length - 1]]);

    const svg = `
      <svg viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false" class="chart-svg">
        ${ticks.map((t) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/>
          <text class="tick" x="${L - 8}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end">${OperA.esc(tickLabel(t, m.unit))}</text>`).join('')}
        ${trailingGap >= 3 ? `<rect class="gap" x="${x(lastIdx + 1).toFixed(1)}" y="${T}" width="${(x(vals.length - 1) - x(lastIdx + 1)).toFixed(1)}" height="${H - T - B}"/>
          <text class="gap-label" x="${((x(lastIdx + 1) + x(vals.length - 1)) / 2).toFixed(1)}" y="${(T + 18).toFixed(1)}" text-anchor="middle">No data</text>` : ''}
        <line class="marker" x1="${x(startIdx).toFixed(1)}" x2="${x(startIdx).toFixed(1)}" y1="${T}" y2="${H - B}"/>
        <text class="marker-label" x="${(x(startIdx) + 4).toFixed(1)}" y="${(H - B - 6).toFixed(1)}">Alert started</text>
        ${m.threshold != null ? `<line class="threshold" x1="${L}" x2="${W - R}" y1="${y(m.threshold).toFixed(1)}" y2="${y(m.threshold).toFixed(1)}"/>
          <text class="threshold-label" x="${L + 6}" y="${(y(m.threshold) - 6).toFixed(1)}">Threshold ${OperA.esc(fmtVal(m.threshold, m.unit === 'messages' ? '' : m.unit, d))}</text>` : ''}
        <path class="area" d="${areaPath}"/>
        <path class="line" d="${linePath}"/>
        ${endPt && trailingGap < 3 ? `<circle class="end-dot" cx="${endPt[0].toFixed(1)}" cy="${endPt[1].toFixed(1)}" r="4"/>
          <text class="end-label" x="${(endPt[0] + 8).toFixed(1)}" y="${(endPt[1] + 4).toFixed(1)}">${OperA.esc(fmtVal(vals[lastIdx], m.unit === 'messages' ? '' : m.unit, d))}</text>` : ''}
        ${['−60 min', '−45', '−30', '−15', 'now'].map((lbl, i) => `<text class="tick" x="${(L + (i / 4) * (W - L - R)).toFixed(1)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}">${lbl}</text>`).join('')}
        <line class="crosshair" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/>
      </svg>`;
    const data = JSON.stringify({ vals, unit: m.unit, d, L, R, W, name: m.name });
    return html`<figure class="chart" id="${id}">
      <figcaption><strong>${m.name}</strong> <span class="muted">· last 60 minutes${m.unit && m.unit !== '' ? html` · ${m.unit === '/min' ? 'per minute' : m.unit}` : ''}</span></figcaption>
      <p class="chart-summary">${chartSummary(alert)}</p>
      <div class="chart-plot" tabindex="0" role="group" aria-label="${m.name} chart. Use the left and right arrow keys to read values minute by minute." data-chart="${data}">
        ${raw(svg)}
        <div class="chart-tip" hidden><strong class="tip-val"></strong><span class="tip-time"></span></div>
      </div>
      <details class="chart-table"><summary>Show data as a table</summary>
        <table class="table table-compact"><caption class="sr-only">${m.name}, every 5 minutes</caption>
          <thead><tr><th scope="col">Time</th><th scope="col" class="num">${m.name}</th></tr></thead>
          <tbody>${tableRows.map(([i, v]) => html`<tr><td>${i === vals.length - 1 ? 'Now' : `${vals.length - 1 - i} min ago`}</td><td class="num">${fmtVal(v, m.unit, d)}</td></tr>`)}</tbody>
        </table></details>
    </figure>`;
  }
  function mountCharts(root) {
    root.querySelectorAll('.chart-plot').forEach((plot) => {
      const cfg = JSON.parse(plot.dataset.chart);
      const svg = plot.querySelector('svg');
      const cross = svg.querySelector('.crosshair');
      const tip = plot.querySelector('.chart-tip');
      let idx = cfg.vals.length - 1;
      const show = (i) => {
        idx = Math.max(0, Math.min(cfg.vals.length - 1, i));
        const xs = cfg.L + (idx / (cfg.vals.length - 1)) * (cfg.W - cfg.L - cfg.R);
        cross.setAttribute('x1', xs); cross.setAttribute('x2', xs); cross.setAttribute('visibility', 'visible');
        tip.hidden = false;
        tip.querySelector('.tip-val').textContent = fmtVal(cfg.vals[idx], cfg.unit === 'messages' ? 'messages' : cfg.unit, cfg.d);
        const minsAgo = cfg.vals.length - 1 - idx;
        tip.querySelector('.tip-time').textContent = minsAgo === 0 ? 'now' : `${minsAgo} min ago`;
        const pct = (xs / cfg.W) * 100;
        tip.style.left = `${pct}%`;
        tip.classList.toggle('tip-left', pct > 70);
      };
      const hide = () => { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; };
      plot.addEventListener('pointermove', (e) => {
        const r = svg.getBoundingClientRect();
        const xs = ((e.clientX - r.left) / r.width) * cfg.W;
        show(Math.round(((xs - cfg.L) / (cfg.W - cfg.L - cfg.R)) * (cfg.vals.length - 1)));
      });
      plot.addEventListener('pointerleave', () => { if (document.activeElement !== plot) hide(); });
      plot.addEventListener('focus', () => show(idx));
      plot.addEventListener('blur', hide);
      plot.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { show(idx - 1); e.preventDefault(); }
        else if (e.key === 'ArrowRight') { show(idx + 1); e.preventDefault(); }
        else if (e.key === 'Home') { show(0); e.preventDefault(); }
        else if (e.key === 'End') { show(cfg.vals.length - 1); e.preventDefault(); }
      });
    });
  }

  /* ---------- telemetry incident banner ---------- */
  function incidentBanner({ app } = {}) {
    const list = app ? tel.incidentsFor(app) : D.telemetry.incidents;
    if (!list.length) return '';
    if (app) {
      return callout('tel', `Telemetry platform issue affecting ${app.name}`,
        html`${list.map((i) => html`<p><strong>${i.id}</strong> · ${i.title}. ${i.impact}</p>`)}<p>This is a platform problem, not something your team needs to fix.</p>`,
        html`<a class="btn btn-sm" href="#/health">See telemetry health</a>`);
    }
    return callout('tel', `${fmt.plural(list.length, 'telemetry platform incident')} in progress`,
      html`<ul class="plain">${list.map((i) => html`<li><strong>${i.id}</strong> · ${i.title} <span class="muted">(${i.status.toLowerCase()}, started ${fmt.rel(i.startedAt)})</span></li>`)}</ul>
        <p>Alerts on affected applications may reflect missing data rather than real problems. OperA marks them for you.</p>`,
      html`<a class="btn btn-sm" href="#/health">See impact and guidance</a>`);
  }

  /* ---------- navigation ---------- */
  function navItems() {
    const role = store.state.role;
    const openNew = alerts.open().filter((a) => a.status === 'new');
    const myCamr = D.personas.app.apps;
    const alertCount = role === 'app' ? alerts.open().filter((a) => myCamr.includes(a.camrId)).length : openNew.length;
    const myReqs = requests.all().filter((r) => requests.next(r).owner === 'you' && (r.requester === D.personas.app.name || myCamr.includes(r.camrId)));
    const items = {
      home: { href: '#/home', icon: 'home', label: 'Home', match: /^\/home/ },
      apps: { href: '#/apps', icon: 'grid', label: role === 'app' ? 'My applications' : 'Applications', match: /^\/apps/ },
      onboard: { href: '#/onboard', icon: 'plus', label: 'Onboard telemetry', match: /^\/onboard/ },
      requests: { href: '#/requests', icon: 'list', label: 'Onboarding requests', match: /^\/requests/,
        badge: role === 'app' && myReqs.length ? { n: myReqs.length, sr: 'need your action', tone: 'danger' } : null },
      alerts: { href: '#/alerts', icon: 'bell', label: 'Alerts', match: /^\/alerts/,
        badge: alertCount ? { n: alertCount, sr: role === 'app' ? 'open on your applications' : 'new, not acknowledged', tone: role === 'app' ? 'neutral' : 'danger' } : null },
      health: { href: '#/health', icon: 'activity', label: 'Telemetry health', match: /^\/health/,
        badge: D.telemetry.incidents.length ? { n: D.telemetry.incidents.length, sr: 'active incidents', tone: 'tel' } : null },
      runbooks: { href: '#/runbooks', icon: 'book', label: 'Handling procedures', match: /^\/runbooks/ },
    };
    let order = role === 'app'
      ? ['home', 'apps', 'onboard', 'requests', 'alerts', 'health', 'runbooks']
      : ['home', 'alerts', 'health', 'apps', 'runbooks', 'requests', 'onboard'];
    if (OperA.design() === 'console') {
      if (role === 'ops') {
        // In the Console layout the triage console is the home page, so one item covers both.
        items.home = Object.assign({}, items.alerts, { href: '#/home', icon: 'bell', label: 'Triage', match: /^\/(home|alerts)/ });
        order = ['home', 'health', 'apps', 'runbooks', 'requests', 'onboard'];
      } else {
        items.home.label = 'Workspace';
        order = ['home', 'onboard', 'requests', 'alerts', 'health', 'apps', 'runbooks'];
      }
      // The Console's navigation runs across the top, so it uses shorter labels.
      Object.assign(items.onboard, { label: 'Onboard' });
      Object.assign(items.requests, { label: 'Requests' });
      Object.assign(items.runbooks, { label: 'Procedures' });
      Object.assign(items.apps, { label: 'Applications' });
    }
    return order.map((k) => items[k]);
  }
  function renderNav() {
    const path = OperA.current.path;
    const nav = document.getElementById('sidenav');
    nav.innerHTML = String(html`<ul>${navItems().map((it) => html`<li><a href="${it.href}" ${it.match.test(path) ? raw('aria-current="page"') : ''}>
      ${icon(it.icon)}<span class="nav-label">${it.label}</span>
      ${it.badge ? html`<span class="nav-badge nav-badge-${it.badge.tone}">${it.badge.n}<span class="sr-only"> ${it.badge.sr}</span></span>` : ''}</a></li>`)}</ul>
      <p class="nav-foot"><span class="nav-foot-note">OperA prototype · fictional data</span>
        <a href="#/choose">Choose layout</a><span aria-hidden="true"> · </span><a href="#/about">About and scenarios</a></p>`);
    const p = reg.persona();
    document.getElementById('user-chip').innerHTML = String(html`<span class="avatar" aria-hidden="true">${p.initials}</span><span class="user-meta"><strong>${p.name}</strong><span>${p.title}</span></span>`);
    document.querySelectorAll('[data-action="set-role"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.role === store.state.role)));
    document.querySelectorAll('.design-switch [data-action="set-design"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.design === OperA.design())));
  }
  const LAYOUT_NAME = { guided: 'Guided', console: 'Console' };
  OperA.actions['set-design'] = (btn) => {
    const role = btn.dataset.role || store.state.role;
    store.state.role = role;
    store.state.design[role] = btn.dataset.design;
    store.state.chosen = true; store.save();
    OperA.toast(`${LAYOUT_NAME[btn.dataset.design]} layout is on for ${role === 'app' ? 'application teams' : 'DevOps'}. Switch any time from the top bar.`, 'info');
    if (btn.dataset.go) OperA.go(btn.dataset.go); else OperA.render();
  };
  OperA.actions['toggle-nav'] = (btn) => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    document.body.classList.toggle('nav-open', !open);
  };
  document.addEventListener('click', (e) => {
    if (document.body.classList.contains('nav-open') && e.target.closest('#sidenav a')) {
      document.body.classList.remove('nav-open');
      document.querySelector('.nav-toggle').setAttribute('aria-expanded', 'false');
    }
  });
  OperA.actions['set-role'] = (btn) => {
    store.state.role = btn.dataset.role; store.save();
    OperA.toast(`${btn.dataset.role === 'app' ? 'Now viewing as Jordan Kim (application team)' : 'Now viewing as Sam Ortiz (DevOps / operations)'}, ${LAYOUT_NAME[OperA.design()]} layout.`, 'info');
    OperA.render();
  };

  /* ---------- prototype controls (clearly separated from the product) ---------- */
  function renderProto() {
    const p = store.state.proto;
    const panel = document.getElementById('proto-panel');
    const opt = (name, value, label, hint) => html`<label class="radio-row"><input type="radio" name="${name}" value="${value}" data-change="proto" ${p[name] === value ? raw('checked') : ''} /><span><strong>${label}</strong>${hint ? html`<br /><span class="muted small">${hint}</span>` : ''}</span></label>`;
    panel.innerHTML = String(html`
      <div class="proto-head"><h2>Prototype controls</h2><button type="button" class="icon-btn" data-action="toggle-proto"><span class="sr-only">Close prototype controls</span>${icon('x')}</button></div>
      <p class="muted small">For design review only. These are not part of the product. Use them to see each state of a screen.</p>
      <fieldset><legend>Onboarding validation outcome</legend>
        ${opt('validation', 'realistic', 'Realistic (default)', 'Logs fail on the first check, traces wait for data, and both pass when checked again.')}
        ${opt('validation', 'all-pass', 'Everything passes')}
        ${opt('validation', 'blocked', 'Collector unreachable', 'A blocking failure that keeps failing, to show the “Get help” path.')}
        ${opt('validation', 'misconfigured', 'Missing camr.id attribute', 'A blocking failure that passes once fixed.')}
        ${opt('validation', 'no-data', 'No data yet', 'Incomplete data: nothing has arrived.')}
      </fieldset>
      <fieldset><legend>Data source for lists</legend>
        ${opt('dataSource', 'normal', 'Normal')}
        ${opt('dataSource', 'empty', 'Empty', 'Shows empty states.')}
        ${opt('dataSource', 'error', 'Unavailable', 'Shows load-failure states.')}
      </fieldset>
      <button type="button" class="btn btn-danger-ghost" data-action="reset-proto">${icon('refresh')}Reset all prototype data</button>`);
  }
  OperA.actions['toggle-proto'] = () => {
    const panel = document.getElementById('proto-panel');
    const btn = document.querySelector('.proto-btn');
    const open = !panel.hidden;
    if (!open) renderProto();
    panel.hidden = open;
    btn.setAttribute('aria-expanded', String(!open));
    if (!open) panel.querySelector('h2').setAttribute('tabindex', '-1'), panel.querySelector('h2').focus();
    else btn.focus();
  };
  OperA.changes.proto = (el) => {
    store.state.proto[el.name] = el.value; store.save();
    OperA.announce('Prototype setting changed.');
    OperA.render({ keepFocus: true });
    el = document.querySelector(`#proto-panel input[name="${el.name}"][value="${el.value}"]`); if (el) el.focus();
  };
  OperA.actions['reset-proto'] = () => {
    OperA.confirm({ title: 'Reset all prototype data?', label: 'Reset everything',
      body: html`<p>Drafts, requests you created and alert actions will be cleared, and both layouts go back to Guided. This can’t be undone.</p>` },
    () => { store.reset(); renderProto(); OperA.toast('Prototype data reset.', 'info'); OperA.go('#/home'); });
  };
  OperA.actions['retry-load'] = () => { store.state.proto.dataSource = 'normal'; store.save(); renderProto(); OperA.refresh(); OperA.toast('Loaded.', 'info'); };

  OperA.ui = {
    icon, sev, checkChip, covChip, freshChip, alertStatus, verdictChip, reqStatus, envTag, timeAgo,
    pageHead, callout, emptyState, errorState, notFound, help, codeBlock, stepper, ownership, escalationLadder,
    lineChart, mountCharts, incidentBanner, renderNav,
  };
})();
