/* OperA — handling procedures (runbooks) */
(function () {
  'use strict';
  const OperA = window.OperA;
  const { html, fmt, reg, alerts, ui } = OperA;
  const D = OperA.data;

  const reviewed = (rb) => html`${fmt.date(new Date(rb.lastReviewed).getTime())}${reg.runbookStale(rb) ? html` <span class="chip chip-warn">${ui.icon('alert')}Review overdue</span>` : ''}`;
  const appliesTo = (rb) => (rb.camrIds.length ? rb.camrIds.map((id) => reg.app(id)).filter(Boolean).map((a) => a.name).join(', ') : 'Any application');

  OperA.views.runbooks = {
    title: () => 'Handling procedures',
    render() {
      const missing = D.applications.filter((a) => a.status === 'active' && !a.runbooks.length);
      return html`
        ${ui.pageHead({ title: 'Handling procedures', lead: 'Step-by-step procedures for alerts, owned by the teams that know the applications. Alerts link straight to the right one.' })}
        ${missing.length ? ui.callout('warn', `${fmt.plural(missing.length, 'application has', 'applications have')} no procedure`, html`<p>${missing.map((a) => a.name).join(', ')}. Alerts on ${missing.length === 1 ? 'it' : 'them'} fall back to generic triage, which is slower.</p>`) : ''}
        <div class="table-wrap"><table class="table"><caption class="sr-only">Handling procedures</caption>
          <thead><tr><th scope="col">Procedure</th><th scope="col">Applies to</th><th scope="col">Owner</th><th scope="col">Last reviewed</th><th scope="col" class="num">Steps</th></tr></thead>
          <tbody>${D.runbooks.map((rb) => html`<tr><td><a class="row-title" href="#/runbooks/${rb.id}">${rb.title}</a><div class="row-sub">${rb.id} · ${rb.summary}</div></td>
            <td>${appliesTo(rb)}</td><td>${rb.owner}</td><td class="nowrap">${reviewed(rb)}</td><td class="num">${rb.steps.length}</td></tr>`)}</tbody></table></div>`;
    },
  };
  OperA.route(/^\/runbooks$/, OperA.views.runbooks);

  OperA.views.runbookDetail = {
    title: ([id]) => (reg.runbook(id) ? reg.runbook(id).title : 'Procedure not found'),
    render([id]) {
      const rb = reg.runbook(id);
      if (!rb) return html`${ui.pageHead({ title: 'Procedure not found', crumbs: [ { href: '#/runbooks', label: 'Handling procedures' }, { label: id } ] })}<a class="btn" href="#/runbooks">All procedures</a>`;
      const used = alerts.open().filter((a) => a.runbook === rb.id);
      return html`
        ${ui.pageHead({ crumbs: [ { href: '#/runbooks', label: 'Handling procedures' }, { label: rb.id } ], eyebrow: `${rb.id} · Owner ${rb.owner}`, title: rb.title, lead: rb.summary })}
        ${reg.runbookStale(rb) ? ui.callout('warn', 'This procedure is overdue for review', html`<p>Last reviewed by ${rb.reviewedBy} on ${fmt.date(new Date(rb.lastReviewed).getTime())}. Procedures should be reviewed every 6 months. Steps may be out of date.</p>`) : ''}
        <div class="split"><div>
          <section class="card" aria-labelledby="h-steps"><h2 class="card-title" id="h-steps">${ui.icon('list')}Steps</h2>
            <ol class="numbered">${rb.steps.map((s) => html`<li><h3>${s.title}</h3><p class="small">${s.body}</p>${s.decision ? html`<p class="rb-decision small"><strong>Decision:</strong> ${s.decision}</p>` : ''}
              ${s.action && s.action.type === 'remediation' ? html`<p class="small"><span class="chip chip-info">${ui.icon('shield')}Needs approval</span> A second person must approve this action, with a change record.</p>` : ''}</li>`)}</ol>
          </section></div>
          <div class="stack"><section class="card" aria-labelledby="h-meta"><h2 class="card-title" id="h-meta">${ui.icon('info')}Details</h2>
            <dl class="kv"><dt>Applies to</dt><dd>${appliesTo(rb)}</dd><dt>Owner</dt><dd>${rb.owner}</dd><dt>Last reviewed</dt><dd>${reviewed(rb)}</dd><dt>Reviewed by</dt><dd>${rb.reviewedBy}</dd></dl></section>
            <section class="card" aria-labelledby="h-used"><h2 class="card-title" id="h-used">${ui.icon('bell')}Open alerts using this</h2>
              ${used.length ? html`<ul class="plain">${used.map((a) => html`<li><a href="#/alerts/${a.id}">${a.id} · ${a.title}</a></li>`)}</ul>` : html`<p class="muted small">None right now.</p>`}</section></div></div>`;
    },
  };
  OperA.route(/^\/runbooks\/(RB-\d+)$/, OperA.views.runbookDetail);
})();
