/*
 * OperA scripted persona walkthroughs.
 *
 * Runs the usability scenarios from docs/usability-scenarios.md end to end in a real
 * browser, counts the interactions each one needs, and checks the outcome. Every
 * element is found by its accessible role and name, the way assistive technology
 * finds it, so a broken label fails the run.
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

async function run(browser, s) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE + '#/about');
  await page.evaluate((role) => {
    localStorage.clear();
    localStorage.setItem('opera.prototype.v1', JSON.stringify({ role, theme: 'light' }));
  }, s.role);
  await page.goto('about:blank');
  await page.goto(BASE + '#/home');
  let n = 0;
  const log = [];
  const t = {
    page,
    async click(locator, why) { n++; log.push(`click: ${why}`); await locator.click(); await page.waitForTimeout(120); },
    async fill(locator, value, why) { n++; log.push(`type: ${why}`); await locator.fill(value); await page.waitForTimeout(80); },
    async key(key, why) { n++; log.push(`key ${key}: ${why}`); await page.keyboard.press(key); await page.waitForTimeout(200); },
    async check(locator, why) { n++; log.push(`check: ${why}`); await locator.check(); await page.waitForTimeout(80); },
    async select(locator, value, why) { n++; log.push(`select: ${why}`); await locator.selectOption(value); await page.waitForTimeout(150); },
    async see(text) { await page.getByText(text).first().waitFor({ state: 'visible', timeout: 5000 }); },
    nav(label) { return page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: label }); },
    /** The big box on the home page. */
    box() { return page.getByRole('main').getByRole('combobox'); },
    async openAlert(title) {
      await this.click(this.nav(/^Alerts/), 'open alerts');
      await this.click(page.getByRole('link', { name: title }).first(), 'choose the alert in the list');
    },
  };
  let ok = true; let failure = '';
  try { await s.fn(t); } catch (e) { ok = false; failure = e.message.split('\n')[0]; }
  if (errors.length) { ok = false; failure = failure || `console errors: ${errors.join(' | ')}`; }
  await page.close();
  return { id: s.id, name: s.name, role: s.role, ok, interactions: n, failure, log };
}

const nextStep = (p) => p.getByRole('region', { name: 'Next step' });

const SCENARIOS = [
  /* A · Onboarding, application team: first-time onboarding with realistic failures */
  { id: 'A-App', name: 'Onboard rewards-api to qa without help', role: 'app', fn: async (t) => {
    const p = t.page;
    await t.click(t.nav('Onboard'), 'open onboarding');
    await t.click(p.getByRole('button', { name: /Rewards Engine · CAMR-108840/ }), 'pick my application');
    await t.click(p.getByRole('radio', { name: /rewards-api/ }), 'choose service (component auto-selected)');
    await t.click(p.getByRole('radio', { name: /^qa\b/ }), 'choose qa (recommended signals pre-selected)');
    await t.see('Approved automatically.');
    await t.click(p.getByRole('button', { name: 'Run checks' }), 'run the checks');
    await t.see('Received 1,204 log lines, but none are valid JSON');
    await t.click(p.getByRole('button', { name: /fixed it, check again/ }), 'recheck logs after fixing');
    await t.see('All of them are valid JSON');
    await t.click(p.getByRole('button', { name: 'Check again' }), 'recheck traces after sending requests');
    await t.see('Received 37 traces');
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
    await t.click(p.getByRole('button', { name: 'Draft a procedure from this alert' }), 'draft a procedure from what was done');
    await t.see('Nothing is published from here');
    await t.click(p.getByRole('button', { name: 'Send draft to Merchant Experience' }), 'send the draft to the owning team');
    await t.see('Draft sent to');
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
    // The alerts screen opens on the most urgent alert, which is this one.
    await t.click(t.nav(/^Alerts/), 'open alerts');
    await t.see('Likely a telemetry problem, not the application');
    await t.click(nextStep(p).getByRole('button', { name: 'Link to TEL-552' }), 'link to incident');
    await t.check(p.getByRole('checkbox', { name: /Hold paging Core Ledger/ }), 'hold app-team paging');
    await t.click(p.getByRole('dialog').getByRole('button', { name: 'Link to TEL-552' }), 'confirm');
    await t.see('Application paging is on hold');
  } },

  /* C · App or telemetry?, application team: "my logs aren't in search" */
  { id: 'C-App', name: 'Are my missing logs my fault?', role: 'app', fn: async (t) => {
    const p = t.page;
    await t.see('TEL-553'); // the home screen flags the platform incident
    await t.click(p.getByRole('link', { name: 'Check now' }), 'choose “Is it me or the platform?”');
    await t.select(p.getByLabel('Environment'), 'qa', 'choose qa');
    await t.see('Rewards Engine is affected by TEL-553');
    await t.see('It’s the platform.');
    await t.see('doesn’t need to change anything');
  } },

  /* D · Ask, paste or jump, application team: check a log line and settings before deploying */
  { id: 'D-App', name: 'Paste a log line, then check hand-edited settings', role: 'app', fn: async (t) => {
    const p = t.page;
    await t.fill(t.box(), '2026-11-17 10:02:11 ERROR payment failed order=1182', 'paste a log line into the box');
    await t.see('Check this log line with Fix-it');
    await t.key('Enter', 'accept the best match');
    await p.getByRole('heading', { name: 'Result' }).waitFor({ state: 'visible', timeout: 5000 });
    await t.see('This line is plain text, not JSON');
    await t.click(p.getByRole('button', { name: 'Settings sent to the wrong environment' }), 'try settings with a mistake');
    await t.see('1 thing to fix before you deploy');
    await t.see('The settings say qa, but the address is the prod collector');
    await t.see('OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.qa.eu-central.opera.example:4317');
    await t.click(p.getByRole('button', { name: 'Settings that are right' }), 'try settings that are right');
    await t.see('These settings are right');
  } },

  /* D · Ask, paste or jump, DevOps: jump by ID, find the owner, hand over */
  { id: 'D-Ops', name: 'Jump to ALR-2041, write a handoff note, find an owner', role: 'ops', fn: async (t) => {
    const p = t.page;
    await t.fill(t.box(), 'alr2041', 'type an alert ID, without the dash');
    await t.see('Open alert ALR-2041');
    await t.key('Enter', 'accept the best match');
    await t.see('Checkout API p99 latency above 1.5 s');
    await t.see('Priya Raman'); // the primary on-call is beside the alert
    await t.click(p.getByRole('button', { name: 'Write handoff note' }), 'write a handoff note');
    const note = await p.getByRole('dialog').getByRole('textbox', { name: 'Note', exact: true }).inputValue();
    for (const must of ['ALR-2041', 'Checkout Platform', 'Priya Raman', 'Likely an application problem']) {
      if (!note.includes(must)) throw new Error(`handoff note is missing “${must}”`);
    }
    await t.click(p.getByRole('button', { name: 'Save to the alert’s activity' }), 'save the note');
    await t.see('Handoff note saved');
    await t.key('Control+k', 'jump back to the box');
    await t.fill(p.getByRole('banner').getByRole('combobox'), 'who owns merchant portal', 'ask who owns an application');
    await t.see('See who owns Merchant Portal');
    await t.key('Enter', 'accept the best match');
    await p.getByRole('heading', { name: 'Merchant Portal', level: 1 }).waitFor({ state: 'visible', timeout: 5000 });
    await t.see('No on-call schedule is registered for this application');
  } },

  /* Error recovery: submitting with nothing chosen shows a focused, linked error summary */
  { id: 'Recovery', name: 'Onboarding errors and bad identifiers', role: 'app', fn: async (t) => {
    const p = t.page;
    await t.click(t.nav('Onboard'), 'open onboarding');
    await t.click(p.getByRole('button', { name: 'Submit request' }), 'submit with nothing chosen');
    await t.see('There’s a problem');
    const focused = await p.evaluate(() => document.activeElement && document.activeElement.id);
    if (focused !== 'ob-errors') throw new Error(`error summary not focused (focused: ${focused})`);
    const search = p.getByLabel('Search by application name or CAMR ID');
    await t.fill(search, 'camr108840', 'type malformed CAMR ID');
    await t.see('Showing results for');
    await t.fill(search, 'CAMR-123456', 'type unknown CAMR ID');
    await t.see('No application found for “CAMR-123456”');
    await t.fill(search, 'CAMR-099120', 'type a retired application');
    await t.click(p.getByRole('radio', { name: /Legacy Points Ledger/ }), 'pick retired application');
    await t.see('This application is retired');
  } },

  /* Keyboard: single-key shortcuts move through the alerts, and can be switched off */
  { id: 'Shortcuts', name: 'J/K/A shortcuts, and turning them off', role: 'ops', fn: async (t) => {
    const p = t.page;
    await t.click(t.nav(/^Alerts/), 'open alerts');
    const current = () => p.locator('.alert-row[aria-current="true"] .alert-row-title').textContent();
    if (!/Ledger Sync reconciliation/.test(await current())) throw new Error('most urgent alert not preselected');
    await t.key('j', 'next alert');
    if (!/Checkout API p99/.test(await current())) throw new Error('J did not move to the next alert');
    await t.key('k', 'previous alert');
    if (!/Ledger Sync reconciliation/.test(await current())) throw new Error('K did not move back');
    await t.key('j', 'next alert');
    await t.key('a', 'acknowledge');
    await t.see('Acknowledged and took ownership.');
    // Acknowledged alerts sort below unacknowledged ones; the selection must follow the alert.
    if (!/Checkout API p99/.test(await current())) throw new Error('selection lost after acknowledging');
    await t.click(p.getByRole('checkbox', { name: 'Keyboard shortcuts' }), 'turn shortcuts off');
    await p.locator('main h1').focus();
    const before = await current();
    await p.keyboard.press('j'); await p.waitForTimeout(200);
    if ((await current()) !== before) throw new Error('J still worked with shortcuts off');
  } },
];

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const s of SCENARIOS) results.push(await run(browser, s));
  await browser.close();

  console.log('\nOperA scripted walkthroughs\n');
  const pad = (v, n) => String(v).padEnd(n);
  console.log(`${pad('Scenario', 11)}${pad('Role', 6)}${pad('Result', 8)}${pad('Steps', 7)}What`);
  for (const r of results) console.log(`${pad(r.id, 11)}${pad(r.role, 6)}${pad(r.ok ? 'PASS' : 'FAIL', 8)}${pad(r.interactions, 7)}${r.name}`);
  results.filter((r) => !r.ok).forEach((r) => console.log(`\nFAILED ${r.id}: ${r.failure}`));
  if (process.env.VERBOSE) results.forEach((r) => { console.log(`\n${r.id}`); r.log.forEach((l, i) => console.log(`  ${i + 1}. ${l}`)); });
  process.exit(results.every((r) => r.ok) ? 0 : 1);
})();
