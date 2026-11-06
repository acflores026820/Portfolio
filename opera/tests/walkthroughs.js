/*
 * OperA scripted persona walkthroughs.
 *
 * Runs the six usability scenarios from docs/usability-scenarios.md end to end in a
 * real browser, counts the interactions each one needs, and checks the outcome.
 * Every element is found by its accessible role and name, the way assistive
 * technology finds it, so a broken label fails the run.
 *
 * These are SCRIPTED walkthroughs of the designed "happy path plus recovery". They
 * verify the prototype works and measure step counts. They are not user research.
 *
 * Usage:  python3 -m http.server 8765   (from the repository root)
 *         node opera/tests/walkthroughs.js [baseUrl]
 * Needs:  the `playwright` package with Chromium.
 */
const { chromium } = require('playwright');

const BASE = process.argv[2] || process.env.OPERA_URL || 'http://127.0.0.1:8765/opera/index.html';

async function scenario(browser, name, persona, fn) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(BASE + '#/home');
  await page.evaluate((role) => { localStorage.clear(); localStorage.setItem('opera.prototype.v1', JSON.stringify({ role })); }, persona);
  await page.reload();
  let n = 0;
  const log = [];
  const t = {
    page,
    async click(locator, why) { n++; log.push(`click: ${why}`); await locator.click(); await page.waitForTimeout(120); },
    async fill(locator, value, why) { n++; log.push(`type: ${why}`); await locator.fill(value); },
    async check(locator, why) { n++; log.push(`check: ${why}`); await locator.check(); await page.waitForTimeout(80); },
    async select(locator, value, why) { n++; log.push(`select: ${why}`); await locator.selectOption(value); await page.waitForTimeout(120); },
    async see(text) { await page.getByText(text).first().waitFor({ state: 'visible', timeout: 5000 }); },
  };
  let ok = true; let failure = '';
  try { await fn(t); } catch (e) { ok = false; failure = e.message.split('\n')[0]; }
  if (errors.length) { ok = false; failure = failure || `console errors: ${errors.join(' | ')}`; }
  await page.close();
  return { name, persona, ok, interactions: n, failure, log };
}

const nav = (page, name) => page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name });

(async () => {
  const browser = await chromium.launch();
  const results = [];

  /* A · Onboarding — application team: first-time onboarding with realistic failures */
  results.push(await scenario(browser, 'A-App · Onboard rewards-api to qa without help', 'app', async (t) => {
    const p = t.page;
    await t.click(nav(p, 'Onboard telemetry'), 'open onboarding');
    await t.click(p.getByRole('button', { name: /Rewards Engine · CAMR-108840/ }), 'pick my application');
    await t.click(p.getByRole('radio', { name: /rewards-api/ }), 'choose service (component auto-selected)');
    await t.click(p.getByRole('radio', { name: /^qa\b/ }), 'choose qa');
    await t.click(p.getByRole('button', { name: 'Continue' }), 'continue to signals');
    await t.see('We’ve selected what we recommend');
    await t.click(p.getByRole('button', { name: 'Continue' }), 'accept recommended signals');
    await t.click(p.getByRole('button', { name: 'Run checks' }), 'run validation');
    await t.see('Received 1,204 log lines, but none are valid JSON');
    await t.click(p.getByRole('button', { name: /fixed it, check again/ }), 'recheck logs after fixing');
    await t.see('All of them are valid JSON');
    await t.click(p.getByRole('button', { name: 'Check again' }), 'recheck traces after sending requests');
    await t.see('Received 37 traces');
    await t.click(p.getByRole('button', { name: 'Continue' }), 'continue to review');
    await t.click(p.getByRole('button', { name: 'Submit request' }), 'submit');
    await t.see('submitted');
    await t.see('Nothing for you to do');
  }));

  /* A · Onboarding — DevOps: alert where ownership and onboarding data are incomplete */
  results.push(await scenario(browser, 'A-Ops · ALR-2044 with no on-call, no procedure, partial traces', 'ops', async (t) => {
    const p = t.page;
    await t.click(nav(p, /^Alerts/), 'open alert queue');
    await t.click(p.getByRole('link', { name: 'Merchant Portal HTTP 5xx rate at 6%' }), 'open alert');
    await t.see('No on-call schedule is registered for this application');
    await t.see('No procedure is linked to this alert');
    await t.click(p.getByRole('region', { name: 'Next step' }).getByRole('button', { name: 'Acknowledge' }), 'acknowledge');
    await t.click(p.getByRole('button', { name: 'Escalate or page someone' }), 'open escalation');
    await t.click(p.getByRole('radio', { name: /SG-MERCHANT-EXP/ }), 'choose support group');
    await t.fill(p.getByLabel('Why are you escalating?'), '5xx at 6% on settlements pages; upstream reports-service refusing connections.', 'reason');
    await t.click(p.getByRole('button', { name: 'Send page' }), 'send page');
    await t.see('Paged SG-MERCHANT-EXP');
    await t.click(p.getByRole('button', { name: 'Report wrong or missing details' }), 'report registry gap');
    await t.click(p.getByRole('button', { name: 'Send to registry owner' }), 'send report');
    await t.click(p.getByRole('button', { name: 'Ask Merchant Experience for a procedure' }), 'request a procedure');
    await t.see('Asked Merchant Experience to add a handling procedure');
  }));

  /* B · Alert response — DevOps: deploy-correlated latency, approval-gated rollback */
  results.push(await scenario(browser, 'B-Ops · ALR-2041 rollback request and page on-call', 'ops', async (t) => {
    const p = t.page;
    await t.click(nav(p, /^Alerts/), 'open alert queue');
    await t.click(p.getByRole('link', { name: 'Checkout API p99 latency above 1.5 s' }), 'open alert');
    await t.see('Likely an application problem');
    await t.click(p.getByRole('region', { name: 'Next step' }).getByRole('button', { name: 'Acknowledge' }), 'acknowledge');
    await t.click(p.getByRole('button', { name: 'Recent changes' }).first(), 'check recent changes');
    await t.see('Just before the alert');
    await t.click(p.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }), 'close');
    await t.click(p.getByRole('button', { name: 'Request rollback' }), 'request rollback');
    await t.fill(p.getByLabel('Change record'), '204118', 'change record (wrong format)');
    await t.fill(p.getByLabel('Why now?'), 'Latency rose 8 minutes after v2.14.0; traces point at pricing calls.', 'reason');
    await t.check(p.getByLabel('I’ve read the blast radius and rollback plan.'), 'confirm blast radius');
    await t.click(p.getByRole('button', { name: 'Request approval' }), 'submit');
    await t.see('isn’t a change record number');
    await t.fill(p.getByLabel('Change record'), 'CHG-204118', 'fix change record');
    await t.click(p.getByRole('button', { name: 'Request approval' }), 'resubmit');
    await t.see('Waiting for Priya Raman');
    await t.click(p.getByRole('button', { name: 'Page Priya Raman' }).first(), 'page primary on-call');
    await t.fill(p.getByLabel('Why are you escalating?'), 'p99 1.9 s for 18 min; rollback approval requested from you.', 'reason');
    await t.click(p.getByRole('button', { name: 'Send page' }), 'send page');
    await t.see('Paged Priya Raman');
  }));

  /* B · Alert response — application team: first on-call shift, uses the assistant */
  results.push(await scenario(browser, 'B-App · ALR-2045 as primary on-call (first time)', 'app', async (t) => {
    const p = t.page;
    await t.click(p.getByRole('link', { name: /Open alert/ }).first(), 'open alert from next actions');
    await t.click(p.getByRole('button', { name: 'Ask OperA to summarize' }), 'ask assistant');
    await t.see('Suggested actions');
    await t.click(p.getByRole('region', { name: 'Next step' }).getByRole('button', { name: 'Acknowledge' }), 'acknowledge');
    await t.check(p.getByRole('checkbox', { name: /Check the accrual lag trend/ }), 'step 1 done');
    await t.check(p.getByRole('checkbox', { name: /Check the scheduler job/ }), 'step 2 done');
    await t.click(p.getByRole('main').getByRole('button', { name: 'Request restart' }), 'request restart');
    await t.see('Nothing changes until Alex Morgan approves');
    await t.fill(p.getByLabel('Change record'), 'CHG-204119', 'change record');
    await t.fill(p.getByLabel('Why now?'), 'Scheduler run stuck for 24 minutes; accrual lag still growing.', 'reason');
    await t.check(p.getByLabel('I’ve read the blast radius and rollback plan.'), 'confirm');
    await t.click(p.getByRole('button', { name: 'Request approval' }), 'submit');
    await t.see('Waiting for Alex Morgan');
  }));

  /* C · App or telemetry? — DevOps: "no data" caused by the pipeline */
  results.push(await scenario(browser, 'C-Ops · ALR-2042 no-data caused by TEL-552', 'ops', async (t) => {
    const p = t.page;
    await t.click(nav(p, /^Alerts/), 'open alert queue');
    await t.click(p.getByRole('link', { name: 'Ledger Sync reconciliation throughput: no data' }), 'open alert');
    await t.see('Likely a telemetry problem, not the application');
    await t.click(p.getByRole('region', { name: 'Next step' }).getByRole('button', { name: 'Link to TEL-552' }), 'link to incident');
    await t.check(p.getByRole('checkbox', { name: /Hold paging Core Ledger/ }), 'hold app-team paging');
    await t.click(p.getByRole('dialog').getByRole('button', { name: 'Link to TEL-552' }), 'confirm');
    await t.see('Application paging is on hold');
  }));

  /* C · App or telemetry? — application team: "my logs aren't in search" */
  results.push(await scenario(browser, 'C-App · Are my missing logs my fault?', 'app', async (t) => {
    const p = t.page;
    await t.click(nav(p, /^Telemetry health/), 'open telemetry health');
    await t.select(p.getByLabel('Environment'), 'qa', 'choose qa');
    await t.see('Rewards Engine is affected by TEL-553');
    await t.see('doesn’t need to change anything');
  }));

  /* Error recovery: continuing with nothing chosen shows a focused, linked error summary */
  results.push(await scenario(browser, 'Recovery · Wizard error summary', 'app', async (t) => {
    const p = t.page;
    await t.click(nav(p, 'Onboard telemetry'), 'open onboarding');
    await t.click(p.getByRole('button', { name: 'Continue' }), 'continue with nothing chosen');
    await t.see('There’s a problem');
    const focused = await p.evaluate(() => document.activeElement && document.activeElement.id);
    if (focused !== 'ob-errors') throw new Error(`error summary not focused (focused: ${focused})`);
    await t.fill(p.getByLabel('Search by application name or CAMR ID'), 'camr108840', 'type malformed CAMR ID');
    await t.see('Showing results for');
    await t.fill(p.getByLabel('Search by application name or CAMR ID'), 'CAMR-123456', 'type unknown CAMR ID');
    await t.see('No application found for “CAMR-123456”');
    await t.fill(p.getByLabel('Search by application name or CAMR ID'), 'CAMR-099120', 'type a retired application');
    await t.click(p.getByRole('radio', { name: /Legacy Points Ledger/ }), 'pick retired application');
    await t.see('This application is retired');
  }));

  await browser.close();
  console.log('\nOperA scripted walkthroughs\n');
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.persona}, ${r.interactions} interactions)${r.ok ? '' : `\n      ${r.failure}`}`);
  if (process.env.VERBOSE) results.forEach((r) => { console.log(`\n${r.name}`); r.log.forEach((l, i) => console.log(`  ${i + 1}. ${l}`)); });
  process.exit(results.every((r) => r.ok) ? 0 : 1);
})();
