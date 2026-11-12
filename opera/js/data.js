/*
 * OperA prototype — seed data.
 * Everything here is fictional. Times are generated relative to page load so
 * the prototype always reads as "live". Nothing in this file talks to a network.
 */
(function () {
  'use strict';
  const OperA = (window.OperA = window.OperA || {});

  const NOW = Date.now();
  const ago = (minutes) => NOW - minutes * 60000;
  const DAY = 60 * 24;

  /* ---------- deterministic series generator (stable charts between reloads) ---------- */
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /**
   * 60 one-minute points, index 59 = now.
   * rise: { at, to, over } ramps from base to `to` starting at index `at` over `over` points.
   * gapFrom: index from which data is missing (null). dropRate: fraction of points randomly missing.
   */
  function series({ base, noise, seed, rise, gapFrom, dropRate, decimals = 0 }) {
    const r = rng(seed);
    const out = [];
    for (let i = 0; i < 60; i++) {
      let level = base;
      if (rise && i >= rise.at) {
        const k = Math.min(1, (i - rise.at + 1) / (rise.over || 1));
        level = base + (rise.to - base) * k;
      }
      let v = level + (r() - 0.5) * 2 * noise * (level / base);
      v = Math.max(0, v);
      const f = Math.pow(10, decimals);
      v = Math.round(v * f) / f;
      if (gapFrom != null && i >= gapFrom) v = null;
      if (dropRate && r() < dropRate && i > 20) v = null;
      out.push(v);
    }
    return out;
  }

  /* ---------- coverage shorthand: a = active, p = partial, o = onboarding, n = not set up ---------- */
  const COV = { a: 'active', p: 'partial', o: 'onboarding', n: 'none' };
  function cov(code) {
    return { metrics: COV[code[0]], logs: COV[code[1]], traces: COV[code[2]] };
  }

  /* ---------- people ---------- */
  const personas = {
    app: {
      key: 'app', name: 'Jordan Kim', initials: 'JK', team: 'Loyalty Engineering',
      title: 'Application developer', apps: ['CAMR-108840', 'CAMR-110425'],
    },
    ops: {
      key: 'ops', name: 'Sam Ortiz', initials: 'SO', team: 'Production Operations',
      title: 'DevOps engineer · on shift',
    },
  };

  /* ---------- application registry (CAMR) ---------- */
  const applications = [
    {
      camrId: 'CAMR-104233', name: 'Checkout API', status: 'active', tier: 1,
      description: 'Handles checkout sessions and payment authorization requests for web and mobile.',
      owningTeam: 'Checkout Platform', appOwner: 'Dana Whitfield', supportGroup: 'SG-CHECKOUT-L2',
      chat: '#checkout-oncall',
      onCall: { primary: 'Priya Raman', secondary: 'Marcus Lee', schedule: 'checkout-platform-primary' },
      registryVerified: ago(21 * DAY), region: 'us-east', pool: 'use1-a', platform: 'kubernetes',
      members: ['Priya Raman', 'Marcus Lee', 'Dana Whitfield'],
      services: [
        { name: 'checkout-api', description: 'Public checkout HTTP API',
          components: [ { name: 'api', description: 'HTTP request handlers' }, { name: 'worker', description: 'Async payment status updates' } ],
          envs: ['dev', 'qa', 'prod'] },
        { name: 'checkout-pricing', description: 'Tax, fees and currency conversion',
          components: [ { name: 'api', description: 'Pricing HTTP API' } ], envs: ['dev', 'qa', 'prod'] },
      ],
      coverage: {
        'checkout-api/api': { dev: cov('aaa'), qa: cov('aaa'), prod: cov('aaa') },
        'checkout-api/worker': { dev: cov('aaa'), qa: cov('aaa'), prod: cov('aap') },
        'checkout-pricing/api': { dev: cov('aaa'), qa: cov('aaa'), prod: cov('aaa') },
      },
      runbooks: ['RB-101'],
      dashboards: ['Checkout · golden signals', 'Checkout · dependencies'],
    },
    {
      camrId: 'CAMR-100871', name: 'Ledger Sync', status: 'active', tier: 1,
      description: 'Streams settled transactions into the general ledger and reconciles balances.',
      owningTeam: 'Core Ledger', appOwner: 'Elena Vasquez', supportGroup: 'SG-LEDGER-L2', chat: '#ledger-oncall',
      onCall: { primary: 'Tom Becker', secondary: 'Aisha Noor', schedule: 'core-ledger-primary' },
      registryVerified: ago(9 * DAY), region: 'us-east', pool: 'use1-b', platform: 'kubernetes',
      members: ['Tom Becker', 'Aisha Noor', 'Elena Vasquez'],
      services: [
        { name: 'ledger-sync', description: 'Ledger streaming and reconciliation',
          components: [ { name: 'consumer', description: 'Reads settlement events from the queue' }, { name: 'reconciler', description: 'Batch reconciliation every 5 minutes' } ],
          envs: ['dev', 'qa', 'prod'] },
      ],
      coverage: {
        'ledger-sync/consumer': { dev: cov('aaa'), qa: cov('aaa'), prod: cov('aaa') },
        'ledger-sync/reconciler': { dev: cov('aaa'), qa: cov('aaa'), prod: cov('aaa') },
      },
      runbooks: ['RB-900'],
      dashboards: ['Ledger Sync · throughput & lag'],
    },
    {
      camrId: 'CAMR-102519', name: 'Fraud Scoring', status: 'active', tier: 1,
      description: 'Scores each authorization request for fraud risk in real time.',
      owningTeam: 'Risk Engineering', appOwner: 'Wei Zhang', supportGroup: 'SG-RISK-L2', chat: '#risk-oncall',
      onCall: { primary: 'Lena Fischer', secondary: 'Omar Haddad', schedule: 'risk-eng-primary' },
      registryVerified: ago(40 * DAY), region: 'eu-central', pool: 'euc1-a', platform: 'kubernetes',
      members: ['Lena Fischer', 'Omar Haddad', 'Wei Zhang'],
      services: [
        { name: 'fraud-scoring-api', description: 'Synchronous scoring API',
          components: [ { name: 'api', description: 'Scoring HTTP API' } ], envs: ['dev', 'qa', 'prod'] },
        { name: 'fraud-model-runner', description: 'Model inference workers',
          components: [ { name: 'worker', description: 'Inference worker pool' } ], envs: ['dev', 'qa', 'prod'] },
      ],
      coverage: {
        'fraud-scoring-api/api': { dev: cov('aaa'), qa: cov('aaa'), prod: cov('aaa') },
        'fraud-model-runner/worker': { dev: cov('aan'), qa: cov('aap'), prod: cov('aap') },
      },
      runbooks: ['RB-205'],
      dashboards: ['Fraud Scoring · latency & errors'],
    },
    {
      camrId: 'CAMR-108840', name: 'Rewards Engine', status: 'active', tier: 2,
      description: 'Calculates and posts loyalty points for every eligible purchase.',
      owningTeam: 'Loyalty Engineering', appOwner: 'Alex Morgan', supportGroup: 'SG-LOYALTY', chat: '#loyalty-eng',
      onCall: { primary: 'Jordan Kim', secondary: 'Riley Chen', schedule: 'loyalty-primary' },
      registryVerified: ago(5 * DAY), region: 'eu-central', pool: 'euc1-a', platform: 'kubernetes',
      members: ['Jordan Kim', 'Riley Chen', 'Alex Morgan'],
      services: [
        { name: 'rewards-api', description: 'Points balance and redemption API',
          components: [ { name: 'api', description: 'HTTP request handlers' } ], envs: ['dev', 'qa', 'prod'] },
        { name: 'rewards-worker', description: 'Points accrual processing',
          components: [ { name: 'worker', description: 'Processes purchase events into points' }, { name: 'scheduler', description: 'Runs the nightly and hourly accrual jobs' } ],
          envs: ['dev', 'qa', 'prod'] },
      ],
      coverage: {
        'rewards-api/api': { dev: cov('aaa'), qa: cov('nnn'), prod: cov('ann') },
        'rewards-worker/worker': { dev: cov('aaa'), qa: cov('non'), prod: cov('ann') },
        'rewards-worker/scheduler': { dev: cov('aan'), qa: cov('nnn'), prod: cov('ann') },
      },
      runbooks: ['RB-410'],
      dashboards: ['Rewards Engine · accrual pipeline'],
    },
    {
      camrId: 'CAMR-106102', name: 'Notification Hub', status: 'active', tier: 2,
      description: 'Sends email, SMS and push notifications on behalf of other applications.',
      owningTeam: 'Messaging', appOwner: 'Chris Patel', supportGroup: 'SG-MESSAGING', chat: '#messaging-oncall',
      onCall: { primary: 'Noah Williams', secondary: 'Grace Okafor', schedule: 'messaging-primary' },
      registryVerified: ago(14 * DAY), region: 'us-west', pool: 'usw2-a', platform: 'kubernetes',
      members: ['Noah Williams', 'Grace Okafor', 'Chris Patel'],
      services: [
        { name: 'notify-dispatcher', description: 'Delivery to email/SMS/push providers',
          components: [ { name: 'dispatcher', description: 'Sends messages to providers' }, { name: 'retry-worker', description: 'Retries failed deliveries' } ],
          envs: ['dev', 'qa', 'prod'] },
        { name: 'notify-templates', description: 'Template rendering API',
          components: [ { name: 'api', description: 'Template HTTP API' } ], envs: ['dev', 'qa', 'prod'] },
      ],
      coverage: {
        'notify-dispatcher/dispatcher': { dev: cov('aaa'), qa: cov('aaa'), prod: cov('aao') },
        'notify-dispatcher/retry-worker': { dev: cov('aan'), qa: cov('aan'), prod: cov('aan') },
        'notify-templates/api': { dev: cov('aaa'), qa: cov('aaa'), prod: cov('aaa') },
      },
      runbooks: ['RB-310'],
      dashboards: ['Notification Hub · delivery health'],
    },
    {
      camrId: 'CAMR-109377', name: 'Merchant Portal', status: 'active', tier: 3,
      description: 'Web portal where merchants view settlements, disputes and reports.',
      owningTeam: 'Merchant Experience', appOwner: 'Taylor Brooks', supportGroup: 'SG-MERCHANT-EXP', chat: '#merchant-exp',
      onCall: null, // ownership gap: no on-call schedule registered
      registryVerified: ago(212 * DAY), region: 'us-west', pool: 'usw2-a', platform: 'kubernetes',
      members: ['Taylor Brooks'],
      services: [
        { name: 'merchant-portal-web', description: 'Portal front end and backend-for-frontend',
          components: [ { name: 'web', description: 'Static front end' }, { name: 'bff', description: 'Backend-for-frontend API' } ],
          envs: ['dev', 'qa', 'prod'] },
      ],
      coverage: {
        'merchant-portal-web/web': { dev: cov('ann'), qa: cov('ann'), prod: cov('aan') },
        'merchant-portal-web/bff': { dev: cov('aan'), qa: cov('aan'), prod: cov('aap') },
      },
      runbooks: [],
      dashboards: ['Merchant Portal · availability'],
    },
    {
      camrId: 'CAMR-110425', name: 'Statement Generator', status: 'active', tier: 3,
      description: 'Builds monthly points statements as PDFs for members.',
      owningTeam: 'Loyalty Engineering', appOwner: 'Alex Morgan', supportGroup: 'SG-LOYALTY', chat: '#loyalty-eng',
      onCall: { primary: 'Riley Chen', secondary: 'Jordan Kim', schedule: 'loyalty-primary' },
      registryVerified: ago(2 * DAY), region: 'eu-central', pool: 'euc1-a', platform: 'kubernetes',
      members: ['Jordan Kim', 'Riley Chen', 'Alex Morgan'],
      services: [
        { name: 'statements-batch', description: 'Monthly statement batch job',
          components: [ { name: 'batch', description: 'Batch job that renders statements' } ], envs: ['dev', 'qa'] },
      ],
      coverage: {
        'statements-batch/batch': { dev: cov('nnn'), qa: cov('oon') },
      },
      runbooks: [],
      dashboards: [],
    },
    {
      camrId: 'CAMR-099120', name: 'Legacy Points Ledger', status: 'retired', tier: 3,
      description: 'Retired. Replaced by Rewards Engine.',
      owningTeam: 'Loyalty Engineering', appOwner: 'Alex Morgan', supportGroup: 'SG-LOYALTY', chat: '#loyalty-eng',
      onCall: null, registryVerified: ago(400 * DAY), region: 'us-east', pool: 'use1-a', platform: 'vm',
      members: ['Alex Morgan'],
      services: [ { name: 'points-ledger', description: 'Legacy ledger', components: [ { name: 'app', description: 'Monolith' } ], envs: ['prod'] } ],
      coverage: { 'points-ledger/app': { prod: cov('nnn') } },
      runbooks: [], dashboards: [],
    },
  ];

  /* ---------- telemetry platform ---------- */
  const telemetry = {
    regions: [
      {
        id: 'us-east', name: 'US East',
        pools: [ { id: 'use1-a', status: 'healthy' }, { id: 'use1-b', status: 'degraded', note: '2 of 3 collector nodes failing health checks' } ],
        signals: {
          metrics: { status: 'degraded', lag: '45 s', drop: '64% on pool use1-b' },
          logs: { status: 'healthy', lag: '28 s', drop: '0%' },
          traces: { status: 'healthy', lag: '19 s', drop: '0.1%' },
        },
      },
      {
        id: 'us-west', name: 'US West',
        pools: [ { id: 'usw2-a', status: 'healthy' } ],
        signals: {
          metrics: { status: 'healthy', lag: '22 s', drop: '0%' },
          logs: { status: 'healthy', lag: '31 s', drop: '0%' },
          traces: { status: 'healthy', lag: '17 s', drop: '0%' },
        },
      },
      {
        id: 'eu-central', name: 'EU Central',
        pools: [ { id: 'euc1-a', status: 'healthy' } ],
        signals: {
          metrics: { status: 'healthy', lag: '24 s', drop: '0%' },
          logs: { status: 'delayed', lag: '11 min', drop: '0% (backfilling)' },
          traces: { status: 'healthy', lag: '20 s', drop: '0%' },
        },
      },
    ],
    incidents: [
      {
        id: 'TEL-552', severity: 'high', status: 'Investigating',
        title: 'Metrics missing from collector pool use1-b',
        signal: 'metrics', scope: { pool: 'use1-b' }, effect: 'missing',
        startedAt: ago(38), nextUpdateAt: ago(-12),
        impact: 'Metrics from applications routed through pool use1-b (US East) are missing or partial. Logs and traces are not affected.',
        responderGuidance: 'If an alert on an affected application says "no data" or looks wrong, link it to TEL-552 instead of paging the application team. Use logs and traces to confirm the application itself is healthy.',
        owner: 'Telemetry Platform on-call', ownerPerson: 'Kai Rivera', estimatedAffected: 14,
        updates: [
          { at: ago(36), text: 'Investigating elevated failure rate on collector pool use1-b.' },
          { at: ago(21), text: 'Two of three collector nodes are failing health checks after an automated OS patch. Replacing nodes.' },
        ],
      },
      {
        id: 'TEL-553', severity: 'medium', status: 'Monitoring',
        title: 'Log ingestion delayed in EU Central',
        signal: 'logs', scope: { region: 'eu-central' }, effect: 'delayed', lagMinutes: 11,
        startedAt: ago(15), nextUpdateAt: ago(-20),
        impact: 'Logs from EU Central are reaching search about 11 minutes late. No data loss is expected; delayed logs will backfill automatically.',
        responderGuidance: 'Recent log events may be missing from search. Use metrics and traces for the last 15 minutes. Nothing for application teams to fix.',
        owner: 'Telemetry Platform on-call', ownerPerson: 'Kai Rivera', estimatedAffected: 9,
        updates: [
          { at: ago(14), text: 'Indexing backlog after a storage rebalance. Backlog is draining; expect normal latency within 30 minutes.' },
        ],
      },
    ],
    collectorEndpoint(env, region) { return `otlp.${env}.${region}.opera.example:4317`; },
    telemetryOnCall: { team: 'Telemetry Platform', person: 'Kai Rivera', chat: '#telemetry-platform' },
  };

  /* ---------- escalation policies by tier (minutes since alert start) ---------- */
  const escalationPolicies = {
    1: [ { after: 0, target: 'noc' }, { after: 15, target: 'primary' }, { after: 30, target: 'secondary' }, { after: 45, target: 'ic' } ],
    2: [ { after: 0, target: 'noc' }, { after: 30, target: 'primary' }, { after: 60, target: 'secondary' }, { after: 90, target: 'ic' } ],
    3: [ { after: 0, target: 'noc' }, { after: 60, target: 'support' }, { after: 120, target: 'ic' } ], // IC sooner if customers are affected
  };

  /* ---------- runbooks (handling procedures) ---------- */
  const runbooks = [
    {
      id: 'RB-101', title: 'Checkout API — high latency', camrIds: ['CAMR-104233'], owner: 'Checkout Platform',
      lastReviewed: '2026-09-12', reviewedBy: 'Dana Whitfield',
      summary: 'Use when checkout p99 latency crosses 1.5 s. Most incidents in the last year were caused by a deploy or a slow dependency.',
      steps: [
        { title: 'Confirm the impact', body: 'Open the golden-signals dashboard. Check whether the error rate is also elevated, not just latency.', links: ['metrics'],
          decision: 'If the error rate is above 2%, treat as SEV2 and go straight to step 5.' },
        { title: 'Check for recent changes', body: 'Look for deploys or config changes to checkout-api or checkout-pricing in the last 60 minutes.', links: ['changes'] },
        { title: 'Roll back a correlated deploy', body: 'If a deploy finished within 30 minutes before latency rose, request a rollback. Rollbacks need approval from the app on-call or app owner and a change record.',
          action: { type: 'remediation', label: 'Request rollback' } },
        { title: 'Find the slow dependency', body: 'Open slow traces and look for the span that takes most of the time.', links: ['traces'] },
        { title: 'Escalate if not mitigated', body: 'Page the Checkout Platform on-call if latency is not improving 15 minutes after the alert started.', action: { type: 'escalate', label: 'Page on-call' } },
      ],
    },
    {
      id: 'RB-205', title: 'Fraud Scoring — elevated error rate', camrIds: ['CAMR-102519'], owner: 'Risk Engineering',
      lastReviewed: '2025-12-01', reviewedBy: 'Wei Zhang',
      summary: 'Use when scoring errors exceed 2%. Errors cause authorizations to fall back to rules-only scoring.',
      steps: [
        { title: 'Check which error type is rising', body: 'Split the error-rate panel by error code. Timeouts usually point to the model runner; 5xx usually point to the API.', links: ['metrics'] },
        { title: 'Read recent error logs', body: 'Search error logs for the last 15 minutes and group by message.', links: ['logs'] },
        { title: 'Check model-runner latency', body: 'If model-runner p95 is above 300 ms, the worker pool may be saturated.', links: ['traces'] },
        { title: 'Escalate to Risk Engineering', body: 'Page the Risk Engineering on-call. Fallback scoring is safe for up to 60 minutes.', action: { type: 'escalate', label: 'Page on-call' } },
      ],
    },
    {
      id: 'RB-310', title: 'Notification Hub — retry queue backlog', camrIds: ['CAMR-106102'], owner: 'Messaging',
      lastReviewed: '2026-07-30', reviewedBy: 'Chris Patel',
      summary: 'Use when the retry queue is above 10,000 messages. Usually caused by a provider outage or rate limiting.',
      steps: [
        { title: 'Identify the failing provider', body: 'Break down delivery failures by provider.', links: ['metrics'] },
        { title: 'Check provider status', body: 'Check the provider status pages linked on the dashboard.', links: ['logs'] },
        { title: 'Scale the retry worker', body: 'If the backlog is growing and the provider is healthy, scale retry-worker. Needs approval from the Messaging on-call.', action: { type: 'remediation', label: 'Request scale-up' } },
        { title: 'Escalate if backlog exceeds 50,000', body: 'Page the Messaging on-call.', action: { type: 'escalate', label: 'Page on-call' } },
      ],
    },
    {
      id: 'RB-410', title: 'Rewards Engine — accrual job lag', camrIds: ['CAMR-108840'], owner: 'Loyalty Engineering',
      lastReviewed: '2026-08-20', reviewedBy: 'Alex Morgan',
      summary: 'Use when points accrual lags more than 15 minutes behind purchases. Members see points late; no points are lost.',
      steps: [
        { title: 'Check the accrual lag trend', body: 'Is lag still growing or flat? A flat lag usually recovers on its own.', links: ['metrics'] },
        { title: 'Check the scheduler job', body: 'Look at the scheduler’s last successful run. Logs for rewards-worker in prod are not onboarded yet, so use the job metrics panel.', links: ['metrics'] },
        { title: 'Restart a stuck scheduler', body: 'If the last run started more than 20 minutes ago and has not finished, request a scheduler restart. Needs approval from the app owner or secondary on-call.',
          action: { type: 'remediation', label: 'Request restart' } },
        { title: 'Escalate', body: 'If lag exceeds 60 minutes, page the secondary on-call and post in #loyalty-eng.', action: { type: 'escalate', label: 'Escalate' } },
      ],
    },
    {
      id: 'RB-900', title: 'Telemetry gap — “no data” or missing signals', camrIds: [], owner: 'Telemetry Platform',
      lastReviewed: '2026-10-02', reviewedBy: 'Kai Rivera', generic: true,
      summary: 'Use when an alert fires because data stopped arriving, or values look wrong. Decide whether the application or the telemetry pipeline is at fault before paging anyone.',
      steps: [
        { title: 'Check the telemetry platform status', body: 'Open Telemetry health. Is there an active incident for this application’s region, collector pool or signal?', links: ['health'] },
        { title: 'Cross-check with another signal', body: 'If metrics are missing, check logs or traces (and vice versa). Healthy activity in another signal means the application is probably fine.', links: ['logs', 'traces'] },
        { title: 'Link to the telemetry incident', body: 'If a telemetry incident explains the gap, link the alert to it. This keeps the application team from being paged for something they cannot fix.', action: { type: 'link-incident', label: 'Link to incident' } },
        { title: 'Route to Telemetry Platform', body: 'If there is no incident yet but data is missing for several applications, page the Telemetry Platform on-call.', action: { type: 'escalate', label: 'Page Telemetry Platform' } },
      ],
    },
    {
      id: 'RB-000', title: 'Generic triage (no application-specific procedure)', camrIds: [], owner: 'Production Operations',
      lastReviewed: '2026-10-15', reviewedBy: 'Production Operations', generic: true,
      summary: 'Use when an alert has no linked procedure. Gather facts, contact the owning team, and ask them to add a procedure afterwards.',
      steps: [
        { title: 'Confirm the alert is real', body: 'Check that telemetry is healthy and that more than one signal shows the problem.', links: ['health', 'metrics'] },
        { title: 'Check recent changes', body: 'Deploys and config changes in the last 60 minutes are the most common cause.', links: ['changes'] },
        { title: 'Contact the owning team', body: 'Use the ownership panel. If no on-call is registered, contact the support group during business hours or the incident commander for customer impact.', action: { type: 'escalate', label: 'Contact owner' } },
        { title: 'Request a procedure', body: 'After the alert is handled, ask the owning team to add a handling procedure for this alert.' },
      ],
    },
  ];

  /* ---------- remediation actions (always approval-gated) ---------- */
  const remediations = {
    'ALR-2041': {
      title: 'Roll back checkout-api in prod to v2.13.2',
      target: 'checkout-api · prod · US East', approver: 'Priya Raman', approverRole: 'Checkout Platform primary on-call',
      blastRadius: 'All checkout-api pods in prod (US East). Rolling restart takes about 4 minutes. No downtime expected.',
      rollbackPlan: 'Re-deploy v2.14.0 from the pipeline if the rollback makes things worse.',
    },
    'ALR-2039': {
      title: 'Scale notify-dispatcher retry-worker from 4 to 8 replicas',
      target: 'notify-dispatcher/retry-worker · prod · US West', approver: 'Noah Williams', approverRole: 'Messaging primary on-call',
      blastRadius: 'Doubles retry throughput. May increase provider rate-limit errors if the provider is unhealthy.',
      rollbackPlan: 'Scale back to 4 replicas.',
    },
    'ALR-2045': {
      title: 'Restart rewards-worker scheduler in prod',
      target: 'rewards-worker/scheduler · prod · EU Central', approver: 'Alex Morgan', approverRole: 'Rewards Engine app owner',
      blastRadius: 'The current accrual run is cancelled and restarts from its last checkpoint. No points are lost.',
      rollbackPlan: 'None needed. The scheduler resumes from checkpoint.',
    },
  };

  /* ---------- alerts ---------- */
  const alerts = [
    {
      id: 'ALR-2042', severity: 'critical', status: 'new', assignee: null,
      title: 'Ledger Sync reconciliation throughput: no data',
      summary: 'The reconciler has not reported its throughput metric for 30 minutes.',
      impact: 'Unknown from metrics alone. If reconciliation had actually stopped, ledger balances would drift.',
      camrId: 'CAMR-100871', service: 'ledger-sync', component: 'reconciler', env: 'prod',
      signal: 'metrics', kind: 'no-data', startedAt: ago(34),
      metric: { name: 'Reconciled records per minute', unit: '/min', threshold: null,
        series: series({ base: 1180, noise: 90, seed: 42, gapFrom: 26 }) },
      changes: [],
      findings: [ { type: 'good', text: 'Logs show reconcile batches completing normally. Last batch 40 seconds ago with 0 errors.' } ],
      runbook: 'RB-900',
    },
    {
      id: 'ALR-2041', severity: 'high', status: 'new', assignee: null,
      title: 'Checkout API p99 latency above 1.5 s',
      summary: 'The slowest 1% of checkout requests are taking about 1.9 s. Normal is around 0.4 s.',
      impact: 'About 3% of checkout requests are taking longer than 3 seconds. The error rate is normal (0.4%).',
      camrId: 'CAMR-104233', service: 'checkout-api', component: 'api', env: 'prod',
      signal: 'metrics', kind: 'threshold', startedAt: ago(18),
      metric: { name: 'p99 latency', unit: 'ms', threshold: 1500,
        series: series({ base: 420, noise: 40, seed: 7, rise: { at: 42, to: 1900, over: 5 } }) },
      changes: [ { at: ago(26), text: 'Deploy checkout-api v2.14.0 to prod', by: 'Pipeline · merged by Marcus Lee', correlated: true } ],
      findings: [ { type: 'bad', text: '71% of slow traces spend more than 1.2 s waiting on checkout-pricing.' } ],
      runbook: 'RB-101',
    },
    {
      id: 'ALR-2044', severity: 'high', status: 'new', assignee: null,
      title: 'Merchant Portal HTTP 5xx rate at 6%',
      summary: 'About 6 in every 100 portal API requests are failing with a server error.',
      impact: 'Merchants may see errors loading settlement reports. Merchant Portal is Tier 3 (business hours support).',
      camrId: 'CAMR-109377', service: 'merchant-portal-web', component: 'bff', env: 'prod',
      signal: 'metrics', kind: 'threshold', startedAt: ago(6),
      metric: { name: 'HTTP 5xx rate', unit: '%', threshold: 2,
        series: series({ base: 0.2, noise: 0.05, seed: 11, rise: { at: 54, to: 6.1, over: 3 }, decimals: 2 }) },
      changes: [],
      findings: [],
      runbook: null,
    },
    {
      id: 'ALR-2043', severity: 'high', status: 'investigating', assignee: 'Sam Ortiz',
      title: 'Fraud Scoring error rate at 2.8%',
      summary: 'Scoring errors rose from 0.3% to 2.8% in the last 9 minutes.',
      impact: 'Affected authorizations fall back to rules-only fraud scoring. Safe for up to 60 minutes.',
      camrId: 'CAMR-102519', service: 'fraud-scoring-api', component: 'api', env: 'prod',
      signal: 'metrics', kind: 'threshold', startedAt: ago(9),
      metric: { name: 'Scoring error rate', unit: '%', threshold: 2,
        series: series({ base: 0.3, noise: 0.06, seed: 23, rise: { at: 51, to: 2.8, over: 4 }, decimals: 2 }) },
      changes: [],
      findings: [ { type: 'info', text: 'Upstream fraud-model-runner latency is normal (p95 140 ms).' } ],
      runbook: 'RB-205',
    },
    {
      id: 'ALR-2040', severity: 'medium', status: 'new', assignee: null,
      title: 'Ledger Sync consumer lag above 50,000 messages',
      summary: 'The consumer appears to be falling behind the settlement queue.',
      impact: 'If real, ledger updates are delayed. Values are unreliable while metrics from pool use1-b are being dropped.',
      camrId: 'CAMR-100871', service: 'ledger-sync', component: 'consumer', env: 'prod',
      signal: 'metrics', kind: 'threshold', startedAt: ago(31),
      metric: { name: 'Consumer lag', unit: 'messages', threshold: 50000,
        series: series({ base: 12000, noise: 3000, seed: 5, rise: { at: 26, to: 58000, over: 6 }, dropRate: 0.55 }) },
      changes: [],
      findings: [ { type: 'good', text: 'Logs show the consumer committing offsets every few seconds.' } ],
      runbook: 'RB-900',
    },
    {
      id: 'ALR-2045', severity: 'medium', status: 'new', assignee: null,
      title: 'Rewards Engine points accrual lag above 15 min',
      summary: 'Points are being posted about 22 minutes after purchase. Normal is under 3 minutes.',
      impact: 'Members see new points late. No points are lost.',
      camrId: 'CAMR-108840', service: 'rewards-worker', component: 'scheduler', env: 'prod',
      signal: 'metrics', kind: 'threshold', startedAt: ago(12),
      metric: { name: 'Accrual lag', unit: 'min', threshold: 15,
        series: series({ base: 2, noise: 0.6, seed: 31, rise: { at: 44, to: 22, over: 12 }, decimals: 1 }) },
      changes: [],
      findings: [ { type: 'bad', text: 'The scheduler’s last accrual run started 24 minutes ago and has not finished. Runs normally take 3–4 minutes.' } ],
      runbook: 'RB-410',
    },
    {
      id: 'ALR-2039', severity: 'medium', status: 'acknowledged', assignee: 'Noah Williams',
      title: 'Notification Hub retry queue above 10,000',
      summary: 'Failed deliveries are piling up faster than the retry worker can process them.',
      impact: 'Some password-reset and receipt emails are delayed by up to 20 minutes.',
      camrId: 'CAMR-106102', service: 'notify-dispatcher', component: 'retry-worker', env: 'prod',
      signal: 'metrics', kind: 'threshold', startedAt: ago(52),
      metric: { name: 'Retry queue depth', unit: 'messages', threshold: 10000,
        series: series({ base: 2100, noise: 300, seed: 13, rise: { at: 8, to: 14200, over: 20 } }) },
      changes: [],
      findings: [ { type: 'bad', text: 'Email provider is returning rate-limit errors (HTTP 429) on 38% of attempts.' } ],
      runbook: 'RB-310',
      seedTimeline: [ { at: ago(44), who: 'Noah Williams', text: 'Acknowledged. Looking at the email provider’s rate limits.' } ],
    },
    {
      id: 'ALR-2031', severity: 'low', status: 'resolved', assignee: 'Priya Raman',
      title: 'Checkout API (qa) pod restarts above 3 per hour',
      summary: 'Pods restarted repeatedly in qa after a memory limit change.',
      impact: 'qa only. No customer impact.',
      camrId: 'CAMR-104233', service: 'checkout-api', component: 'worker', env: 'qa',
      signal: 'metrics', kind: 'threshold', startedAt: ago(240), resolvedAt: ago(170),
      metric: { name: 'Pod restarts per hour', unit: '', threshold: 3, series: series({ base: 0.5, noise: 0.3, seed: 3, decimals: 1 }) },
      changes: [], findings: [], runbook: 'RB-101', resolution: 'Application — memory limit reverted.',
    },
  ];

  /* ---------- onboarding requests (seed) ---------- */
  const requests = [
    {
      id: 'REQ-3105', camrId: 'CAMR-110425', service: 'statements-batch', component: 'batch', env: 'qa',
      signals: ['metrics', 'logs'], status: 'action-needed', requester: 'Jordan Kim', createdAt: ago(3 * DAY),
      scenario: 'realistic', attempts: {},
      history: [
        { at: ago(3 * DAY), text: 'Request submitted by Jordan Kim.' },
        { at: ago(3 * DAY - 6), text: 'Validation: metrics passed. Logs failed — log lines are plain text, not JSON.' },
      ],
    },
    {
      id: 'REQ-3101', camrId: 'CAMR-108840', service: 'rewards-worker', component: 'worker', env: 'qa',
      signals: ['logs'], status: 'provisioning', requester: 'Riley Chen', createdAt: ago(55), etaMinutes: 12,
      scenario: 'all-pass', attempts: {},
      history: [
        { at: ago(55), text: 'Request submitted by Riley Chen.' },
        { at: ago(48), text: 'All validation checks passed. qa requests are approved automatically.' },
        { at: ago(47), text: 'Provisioning log index and retention policy (automated).' },
      ],
    },
    {
      id: 'REQ-3088', camrId: 'CAMR-106102', service: 'notify-dispatcher', component: 'dispatcher', env: 'prod',
      signals: ['traces'], status: 'awaiting-approval', requester: 'Grace Okafor', createdAt: ago(2 * DAY + 90), approver: 'Chris Patel',
      scenario: 'all-pass', attempts: {},
      history: [
        { at: ago(2 * DAY + 90), text: 'Request submitted by Grace Okafor.' },
        { at: ago(2 * DAY + 80), text: 'All validation checks passed.' },
        { at: ago(2 * DAY + 79), text: 'Waiting for approval from the app owner, Chris Patel (production requests need owner approval).' },
      ],
    },
    {
      id: 'REQ-3092', camrId: 'CAMR-108840', service: 'rewards-api', component: 'api', env: 'dev',
      signals: ['metrics', 'logs', 'traces'], status: 'complete', requester: 'Jordan Kim', createdAt: ago(12 * DAY),
      scenario: 'all-pass', attempts: {},
      history: [
        { at: ago(12 * DAY), text: 'Request submitted by Jordan Kim.' },
        { at: ago(12 * DAY - 9), text: 'All validation checks passed. Approved automatically (dev).' },
        { at: ago(12 * DAY - 25), text: 'Provisioned. Dashboard “Rewards Engine · rewards-api” created.' },
        { at: ago(12 * DAY - 40), text: 'Data flowing for metrics, logs and traces. Onboarding complete.' },
      ],
    },
  ];

  /* ---------- glossary (plain language, used in help toggles) ---------- */
  const glossary = {
    camr: { term: 'CAMR ID', text: 'The ID your application has in the company application registry (CAMR). It looks like CAMR-104233. OperA uses it to connect telemetry to the right application, owners and on-call team. Find it on your application’s registry page, or search by application name here.' },
    service: { term: 'Service', text: 'Something you build and deploy on its own, such as rewards-api. One application can have several services. Services come from the registry.' },
    component: { term: 'Component', text: 'A part of a service that runs separately, such as an API and a background worker. Set up each component you want to observe.' },
    environment: { term: 'Environment', text: 'Where the service runs: dev, qa or prod. Each environment is onboarded separately, so you can try qa before prod.' },
    metrics: { term: 'Metrics', text: 'Numbers measured over time: request rate, errors, latency, CPU. They power dashboards and most alerts.' },
    logs: { term: 'Logs', text: 'Timestamped records of what happened, such as an error with its message. Used to find out why something happened.' },
    traces: { term: 'Traces', text: 'The path one request takes through your services, step by step. Used to find which step is slow or failing.' },
    collector: { term: 'Collector', text: 'The platform service that receives your telemetry and sends it to storage. You send data to it; the platform team runs it.' },
    tier: { term: 'Tier', text: 'How critical an application is, from the registry. Tier 1 is customer-facing and escalates fastest: the app on-call is paged after 15 minutes. Tier 2 pages after 30 minutes. Tier 3 is supported in business hours. The timers on this card come from the tier.' },
    changeRecord: { term: 'Change record', text: 'The ticket that records a change to production, such as CHG-204118. During an incident, create an emergency change in the change-management tool (it takes about a minute and can be completed afterwards), or ask the approver to attach one. OperA needs the number so the change can be audited later.' },
    attributes: { term: 'Resource attributes', text: 'Labels attached to every piece of telemetry (application, service, component, environment). They are how OperA knows the data is yours.' },
  };

  OperA.data = {
    NOW, ago, personas, applications, telemetry, escalationPolicies, runbooks, remediations, alerts, requests, glossary,
    signals: ['metrics', 'logs', 'traces'],
    envs: ['dev', 'qa', 'prod'],
  };
})();
