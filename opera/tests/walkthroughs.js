/*
 * OperA scripted persona walkthroughs.
 *
 * Runs the six usability scenarios from docs/usability-scenarios.md end to end in a
 * real browser, in BOTH layouts (Guided and Console), counts the interactions each
 * one needs, and checks the outcome. Every element is found by its accessible role
 * and name, the way assistive technology finds it, so a broken label fails the run.
 *
 * These are SCRIPTED walkthroughs of the designed "happy path plus recovery". They
 * verify the prototype works and measure step counts. They are not user research.
 *
 * Usage:  python3 -m http.server 8765   (from the repository root)
 *         node opera/tests/walkthroughs.js [baseUrl]      (VERBOSE=1 lists every step)
 * Needs:  the `playwright` package with Chromium.
 */
const { chromium } = require('playwright');

const BASE = process.argv[2] || process.env.OPERA_URL || 'http://127.0.0.1:8765/opera/index.html';
const DESIGNS = ['guided', 'console'];

async function run(browser, id, name, role, design, fn) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE + '#/about');
  await page.evaluate(([r, d]) => {
    localStorage.clear();
    localStorage.setItem('opera.prototype.v1', JSON.stringify({ role: r, chosen: true, design: { app: d, ops: d } }));
  }, [role, design]);
  await page.goto('about:blank');
  await page.goto(BASE + '#/home');
  let n = 0;
  const log = [];
  const t = {
    page, design, console: design === 'console',
    async click(locator, why) { n++; log.push(`click: ${why}`); await locator.click(); await page.waitForTimeout(120); },
    async fill(locator, value, why) { n++; log.push(`type: ${why}`); await locator.fill(value); },
    async check(locator, why) { n++; log.push(`check: ${why}`); await locator.check(); await page.waitForTimeout(80); },
    async select(locator, value, why) { n++; log.push(`select: ${why}`); await locator.selectOption(value); await page.waitForTimeout(150); },
    async see(text) { await page.getByText(text).first().waitFor({ state: 'visible', timeout: 5000 }); },
    nav(label) { return page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: label }); },
    /** Open an alert: from the queue in Guided, from the always-visible list in Console. */
    async openAlert(title) {
      if (design === 'guided') await this.click(this.nav(/^Alerts/), 'open alert queue');
      await this.click(page.getByRole('link', { name: title }).first(), 'open alert');
    },
  };
  let ok = true; let failure = '';
  try { await fn(t); } catch (e) { ok = false; failure = e.message.split('\n')[0]; }
  if (errors.length) { ok = false; failure = failure || `console errors: ${errors.join(' | ')}`; }
  await page.close();
  return { id, name, role, design, ok, interactions: n, failure, log };
}

const nextStep = (p) => p.getByRole('region', { name: 'Next step' });

const SCENARIOS = [
  /* A · Onboarding, application team: first-time onboarding with realistic failures */
  { id: 'A-App', name: 'Onboard rewards-api to qa without help', role: 'app', fn: async (t) => {
    const p = t.page;
    if (t.console) {
      await t.click(t.nav('Onboard'), 'open onboarding');
      await t.click(p.getByRole('button', { name: /Rewards Engine · CAMR-108840/ }), 'pick my application');
      await t.select(p.getByLabel('Service', { exact: true }), 'rewards-api', 'choose service (component auto-selected)');
      await t.select(p.getByLabel('Environment', { exact: true }), 'qa', 'choose qa (recommended signals pre-selected)');
    } else {
      await t.click(t.nav('Onboard telemetry'), 'open onboarding');
      await t.click(p.getByRole('button', { name: /Rewards Engine · CAMR-108840/ }), 'pick my application');
      await t.click(p.getByRole('radio', { name: /rewards-api/ }), 'choose service (component auto-selected)');
      await t.click(p.getByRole('radio', { name: /^qa\b/ }), 'choose qa');
      await t.click(p.getByRole('button', { name: 'Continue' }), 'continue to signals');
      await t.see('We’ve selected what we recommend');
      await t.click(p.getByRole('button', { name: 'Continue' }), 'accept recommended signals');
    }
    await t.click(p.getByRole('button', { name: 'Run checks' }), 'run validation');
    await t.see('Received 1,204 log lines, but none are valid JSON');
    await t.click(p.getByRole('button', { name: /fixed it, check again/ }), 'recheck logs after fixing');
    await t.see('All of them are valid JSON');
    await t.click(p.getByRole('button', { name: 'Check again' }), 'recheck traces after sending requests');
    await t.see('Received 37 traces');
    if (!t.console) await t.click(p.getByRole('button', { name: 'Continue' }), 'continue to review');
    await t.click(p.getByRole('button', { name: 'Submit request' }), 'submit');
    await t.see('submitted');
    await t.see('Nothing for you to do');
  } },

  /* A · Onboarding, DevOps: alert where ownership and onboarding data are incomplete */
  { id: 'A-Ops', name: 'ALR-2044 with no on-call, no procedure, partial traces', role: 'ops', fn: async (t) => {
    const p = t.page;
    await t.openAlert(/Merchant Portal HTTP 5xx rate at 6%/);
    await t.see('No on-call schedule is registered for this application');
    await t.see('No procedure is linked to this alert');
    await t.click(nextStep(p).getByRole('button', { name: 'Acknowledge' }), 'acknowledge');
    await t.click(p.getByRole('button', { name: 'Escalate or page someone' }), 'open escalation');
    await t.click(p.getByRole('radio', { name: /SG-MERCHANT-EXP/ }), 'choose support group');
    await t.fill(p.getByLabel('Why are you escalating?'), '5xx at 6% on settlements pages; upstream reports-service refusing connections.', 'reason');
    await t.click(p.getByRole('button', { name: 'Send page' }), 'send page');
    await t.see('Paged SG-MERCHANT-EXP');
    await t.click(p.getByRole('button', { name: 'Report wrong or missing details' }), 'report registry gap');
    await t.click(p.getByRole('button', { name: 'Send to registry owner' }), 'send report');
    await t.click(p.getByRole('button', { name: 'Ask Merchant Experience for a procedure' }), 'request a procedure');
    await t.see('Asked Merchant Experience to add a handling procedure');
  } },

  /* B · Alert response, DevOps: deploy-correlated latency, approval-gated rollback */
  { id: 'B-Ops', name: 'ALR-2041 rollback request with on-call paged in the same notification', role: 'ops', fn: async (t) => {
    const p = t.page;
    await t.openAlert(/Checkout API p99 latency above 1.5 s/);
    await t.see('Likely an application problem');
    await t.click(nextStep(p).getByRole('button', { name: 'Acknowledge' }), 'acknowledge');
    await t.see('Just before the alert'); // the correlated deploy is shown inside the procedure step
    await t.click(p.getByRole('button', { name: 'Request rollback' }), 'request rollback');
    await t.see('Also page Priya Raman now, in the same notification');
    await t.fill(p.getByLabel('Change record'), '204118', 'change record (wrong format, on purpose)');
    await t.fill(p.getByLabel('Why now?'), 'Latency rose 8 minutes after v2.14.0; traces point at pricing calls.', 'reason');
    await t.check(p.getByLabel('I’ve read the blast radius and rollback plan.'), 'confirm blast radius');
    await t.click(p.getByRole('button', { name: 'Request approval' }), 'submit');
    await t.see('isn’t a change record number');
    await t.fill(p.getByLabel('Change record'), 'CHG-204118', 'fix change record');
    await t.click(p.getByRole('button', { name: 'Request approval' }), 'resubmit');
    await t.see('Waiting for Priya Raman');
    await t.see('Paged Priya Raman and requested approval in one notification');
  } },

  /* B · Alert response, application team: first on-call shift, uses the assistant */
  { id: 'B-App', name: 'ALR-2045 as primary on-call (first time)', role: 'app', fn: async (t) => {
    const p = t.page;
    await t.click(p.getByRole('link', { name: /Open alert/ }).first(), 'open alert from home');
    await t.click(p.getByRole('button', { name: 'Ask OperA to summarize' }), 'ask assistant');
    await t.see('Suggested actions');
    await t.click(nextStep(p).getByRole('button', { name: 'Acknowledge' }), 'acknowledge');
    await t.check(p.getByRole('checkbox', { name: /Check the accrual lag trend/ }), 'step 1 done');
    await t.check(p.getByRole('checkbox', { name: /Check the scheduler job/ }), 'step 2 done');
    await t.click(p.getByRole('main').getByRole('button', { name: 'Request restart' }), 'request restart');
    await t.see('Nothing changes until Alex Morgan approves');
    await t.fill(p.getByLabel('Change record'), 'CHG-204119', 'change record');
    await t.fill(p.getByLabel('Why now?'), 'Scheduler run stuck for 24 minutes; accrual lag still growing.', 'reason');
    await t.check(p.getByLabel('I’ve read the blast radius and rollback plan.'), 'confirm');
    await t.click(p.getByRole('button', { name: 'Request approval' }), 'submit');
    await t.see('Waiting for Alex Morgan');
  } },

  /* C · App or telemetry?, DevOps: "no data" caused by the pipeline */
  { id: 'C-Ops', name: 'ALR-2042 no-data caused by TEL-552', role: 'ops', fn: async (t) => {
    const p = t.page;
    // Console opens on the most urgent alert, which is this one, so there is nothing to navigate to.
    if (!t.console) await t.openAlert(/Ledger Sync reconciliation throughput: no data/);
    await t.see('Likely a telemetry problem, not the application');
    await t.click(nextStep(p).getByRole('button', { name: 'Link to TEL-552' }), 'link to incident');
    await t.check(p.getByRole('checkbox', { name: /Hold paging Core Ledger/ }), 'hold app-team paging');
    await t.click(p.getByRole('dialog').getByRole('button', { name: 'Link to TEL-552' }), 'confirm');
    await t.see('Application paging is on hold');
  } },

  /* C · App or telemetry?, application team: "my logs aren't in search" */
  { id: 'C-App', name: 'Are my missing logs my fault?', role: 'app', fn: async (t) => {
    const p = t.page;
    await t.see('TEL-553'); // both layouts flag the platform incident on the home screen
    await t.click(t.nav(/^Telemetry health/), 'open telemetry health');
    await t.select(p.getByLabel('Environment'), 'qa', 'choose qa');
    await t.see('Rewards Engine is affected by TEL-553');
    await t.see('doesn’t need to change anything');
  } },

  /* Error recovery: submitting with nothing chosen shows a focused, linked error summary */
  { id: 'Recovery', name: 'Onboarding errors and bad identifiers', role: 'app', fn: async (t) => {
    const p = t.page;
    await t.click(t.nav(t.console ? 'Onboard' : 'Onboard telemetry'), 'open onboarding');
    await t.click(p.getByRole('button', { name: t.console ? 'Submit request' : 'Continue' }), 'go on with nothing chosen');
    await t.see('There’s a problem');
    const focused = await p.evaluate(() => document.activeElement && document.activeElement.id);
    if (focused !== 'ob-errors') throw new Error(`error summary not focused (focused: ${focused})`);
    const search = p.getByLabel(t.console ? 'Application name or CAMR ID' : 'Search by application name or CAMR ID');
    await t.fill(search, 'camr108840', 'type malformed CAMR ID');
    await t.see('Showing results for');
    await t.fill(search, 'CAMR-123456', 'type unknown CAMR ID');
    await t.see('No application found for “CAMR-123456”');
    await t.fill(search, 'CAMR-099120', 'type a retired application');
    await t.click(p.getByRole('radio', { name: /Legacy Points Ledger/ }), 'pick retired application');
    await t.see('This application is retired');
  } },

  /* Console only: single-key shortcuts move through the queue, and can be switched off */
  { id: 'Shortcuts', name: 'J/K/A shortcuts, and turning them off', role: 'ops', only: 'console', fn: async (t) => {
    const p = t.page;
    const current = () => p.locator('.alert-row[aria-current="true"] .alert-row-title').textContent();
    if (!/Ledger Sync reconciliation/.test(await current())) throw new Error('most urgent alert not preselected');
    await p.keyboard.press('j'); await p.waitForTimeout(200);
    if (!/Checkout API p99/.test(await current())) throw new Error('J did not move to the next alert');
    await p.keyboard.press('k'); await p.waitForTimeout(200);
    if (!/Ledger Sync reconciliation/.test(await current())) throw new Error('K did not move back');
    await p.keyboard.press('j'); await p.waitForTimeout(200);
    await p.keyboard.press('a'); await p.waitForTimeout(200);
    await t.see('Acknowledged and took ownership.');
    // Acknowledged alerts sort below unacknowledged ones; the selection must follow the alert.
    if (!/Checkout API p99/.test(await current())) throw new Error('selection lost after acknowledging');
    await t.click(p.getByRole('checkbox', { name: 'Single-key shortcuts' }), 'turn shortcuts off');
    await p.locator('main h1').focus();
    const before = await current();
    await p.keyboard.press('j'); await p.waitForTimeout(200);
    if ((await current()) !== before) throw new Error('J still worked with shortcuts off');
  } },
];

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const s of SCENARIOS) for (const design of DESIGNS) {
    if (s.only && s.only !== design) continue;
    results.push(await run(browser, s.id, s.name, s.role, design, s.fn));
  }
  await browser.close();

  console.log('\nOperA scripted walkthroughs (interactions per layout)\n');
  const pad = (v, n) => String(v).padEnd(n);
  console.log(`${pad('Scenario', 10)}${pad('Role', 6)}${pad('Guided', 14)}${pad('Console', 14)}What`);
  for (const s of SCENARIOS) {
    const cell = (d) => { const r = results.find((x) => x.id === s.id && x.design === d); return r ? `${r.ok ? 'PASS' : 'FAIL'} ${r.interactions}` : '—'; };
    console.log(`${pad(s.id, 10)}${pad(s.role, 6)}${pad(cell('guided'), 14)}${pad(cell('console'), 14)}${s.name}`);
  }
  results.filter((r) => !r.ok).forEach((r) => console.log(`\nFAILED ${r.id} (${r.design}): ${r.failure}`));
  if (process.env.VERBOSE) results.forEach((r) => { console.log(`\n${r.id} · ${r.design}`); r.log.forEach((l, i) => console.log(`  ${i + 1}. ${l}`)); });
  process.exit(results.every((r) => r.ok) ? 0 : 1);
})();
