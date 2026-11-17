/*
 * Unit tests for the Fix-it rule engine (js/lint.js).
 * Run:  node --test opera/tests/lint.test.js
 * No browser and no dependencies: the engine only needs the registry data.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

global.window = {};
require('../js/data.js');
require('../js/lint.js');
const { lint, data } = global.window.OperA;

const app = (id) => data.applications.find((a) => a.camrId === id);
const rewards = { app: app('CAMR-108840'), service: 'rewards-api', component: 'api', env: 'qa', signals: ['metrics', 'logs', 'traces'] };
const state = (result, id) => { const f = result.findings.find((x) => x.id === id); return f ? f.state : 'absent'; };
const GOOD_ENV = lint.generate(rewards).env;

test('detect tells settings, log lines and other text apart', () => {
  assert.equal(lint.detect(GOOD_ENV), 'config');
  assert.equal(lint.detect('- name: OTEL_SERVICE_NAME\n  value: "rewards-api"'), 'config');
  assert.equal(lint.detect('sudo opera-agent enroll --camr-id CAMR-108840 --service rewards-api'), 'config');
  assert.equal(lint.detect('{"timestamp":"2026-11-06T09:14:02Z","level":"INFO","message":"ok"}'), 'log');
  assert.equal(lint.detect('2026-11-06 09:14:02 INFO Accrual batch 8812 complete'), 'log');
  assert.equal(lint.detect('who owns checkout?'), 'unknown');
  assert.equal(lint.detect('   '), 'unknown');
});

test('settings OperA generated pass every check, for every registered service', () => {
  let n = 0;
  data.applications.filter((a) => a.status === 'active').forEach((a) => a.services.forEach((s) => s.components.forEach((c) => s.envs.forEach((env) => {
    const g = lint.generate({ app: a, service: s.name, component: c.name, env, signals: ['metrics', 'logs', 'traces'] });
    ['env', 'k8s', 'vm', 'manifest'].forEach((style) => {
      const r = lint.config(g[style]);
      const fails = r.findings.filter((f) => f.state === 'fail').map((f) => `${f.id}: ${f.detail}`);
      assert.deepEqual(fails, [], `${a.name} ${s.name}/${c.name} ${env} (${style})`);
      assert.equal(r.context.app.camrId, a.camrId);
      assert.equal(r.context.service, s.name);
      assert.equal(r.context.component, c.name);
      assert.equal(r.context.env, env);
      n++;
    });
  }))));
  assert.ok(n > 80, `expected many combinations, got ${n}`);
});

test('missing camr.id fails, and the corrected settings include it', () => {
  const r = lint.config(GOOD_ENV.replace('camr.id=CAMR-108840,', ''));
  assert.equal(r.ok, false);
  assert.equal(state(r, 'camr'), 'fail');
  assert.equal(r.context.app.camrId, 'CAMR-108840', 'application worked out from the service name');
  assert.match(r.corrected, /camr\.id=CAMR-108840/);
  assert.equal(lint.config(r.corrected).ok, true, 'the corrected settings pass');
});

test('a mistyped CAMR ID gets a suggestion', () => {
  const r = lint.config(GOOD_ENV.replace('CAMR-108840', 'CAMR108840'));
  assert.equal(state(r, 'camr'), 'fail');
  assert.match(r.findings.find((f) => f.id === 'camr').detail, /CAMR-108840/);
});

test('an unknown or retired application fails', () => {
  assert.equal(state(lint.config(GOOD_ENV.replace('CAMR-108840', 'CAMR-123456').replace('rewards-api', 'mystery-svc')), 'camr'), 'fail');
  const retired = lint.config('export OTEL_SERVICE_NAME=points-ledger\nexport OTEL_RESOURCE_ATTRIBUTES=camr.id=CAMR-099120,deployment.environment=prod,app.component=app');
  assert.equal(state(retired, 'camr'), 'fail');
  assert.match(retired.findings.find((f) => f.id === 'camr').detail, /retired/i);
});

test('a service that is not registered for the application fails with the nearest name', () => {
  const r = lint.config(GOOD_ENV.replace('OTEL_SERVICE_NAME=rewards-api', 'OTEL_SERVICE_NAME=rewards-apii'));
  assert.equal(state(r, 'service'), 'fail');
  assert.match(r.findings.find((f) => f.id === 'service').detail, /rewards-api\b/);
});

test('component and environment are checked against the registry', () => {
  assert.equal(state(lint.config(GOOD_ENV.replace('app.component=api', 'app.component=worker')), 'component'), 'fail');
  assert.equal(state(lint.config(GOOD_ENV.replace(',app.component=api', '')), 'component'), 'fail');
  assert.equal(state(lint.config(GOOD_ENV.replace('deployment.environment=qa', 'deployment.environment=staging')), 'environment'), 'fail');
  const batch = lint.generate({ app: app('CAMR-110425'), service: 'statements-batch', component: 'batch', env: 'qa', signals: ['logs'] }).env;
  const prod = lint.config(batch.replace('deployment.environment=qa', 'deployment.environment=prod'));
  assert.equal(state(prod, 'environment'), 'fail', 'statements-batch is not registered in prod');
});

test('the collector address must match the environment and region, use https and port 4317', () => {
  const ep = (to) => lint.config(GOOD_ENV.replace(/OTEL_EXPORTER_OTLP_ENDPOINT=\S+/, `OTEL_EXPORTER_OTLP_ENDPOINT=${to}`));
  assert.equal(state(ep('https://otlp.qa.eu-central.opera.example:4317'), 'endpoint'), 'pass');
  assert.match(ep('https://otlp.prod.eu-central.opera.example:4317').findings.find((f) => f.id === 'endpoint').detail, /prod/);
  assert.equal(state(ep('https://otlp.prod.eu-central.opera.example:4317'), 'endpoint'), 'fail');
  assert.equal(state(ep('https://otlp.qa.us-east.opera.example:4317'), 'endpoint'), 'fail');
  assert.equal(state(ep('http://otlp.qa.eu-central.opera.example:4317'), 'endpoint'), 'fail');
  assert.equal(state(ep('https://otlp.qa.eu-central.opera.example'), 'endpoint'), 'fail');
  assert.equal(state(lint.config(GOOD_ENV.replace(/export OTEL_EXPORTER_OTLP_ENDPOINT=\S+\n/, '')), 'endpoint'), 'fail');
});

test('Kubernetes YAML and the agent command are read the same way', () => {
  const g = lint.generate(rewards);
  const yaml = lint.config(g.k8s.replace('camr.id=CAMR-108840,', ''));
  assert.equal(state(yaml, 'camr'), 'fail');
  assert.match(yaml.corrected, /- name: OTEL_RESOURCE_ATTRIBUTES/, 'correction keeps the YAML style');
  const cli = lint.config('sudo opera-agent enroll --camr-id CAMR-108840 --service rewards-api --component worker --env qa --signals logs');
  assert.equal(state(cli, 'component'), 'fail');
  assert.match(cli.corrected, /opera-agent enroll[\s\S]*--component api/, 'correction keeps the command style');
  const unknownEnv = lint.config('sudo opera-agent enroll --camr-id CAMR-108840 --service rewards-api --component api --env staging --signals logs');
  assert.equal(state(unknownEnv, 'environment'), 'fail');
  assert.equal(unknownEnv.corrected, null, 'no corrected version is offered when the environment can’t be known');
});

test('production settings that keep every trace get a warning, not a failure', () => {
  const g = lint.generate(Object.assign({}, rewards, { env: 'prod' })).env.replace(/OTEL_TRACES_SAMPLER_ARG=\S+/, 'OTEL_TRACES_SAMPLER_ARG=1.0');
  const r = lint.config(g.includes('SAMPLER_ARG') ? g : `${g}\nexport OTEL_TRACES_SAMPLER_ARG=1.0`);
  assert.equal(r.ok, true);
  assert.equal(state(r, 'sampling'), 'warn');
});

test('plain-text log lines fail with the reason', () => {
  const r = lint.log('2026-11-06 09:14:02 INFO Accrual batch 8812 complete');
  assert.equal(r.ok, false);
  assert.equal(state(r, 'format'), 'fail');
});

test('a complete JSON log line passes, including common field names', () => {
  assert.equal(lint.log('{"timestamp":"2026-11-06T09:14:02Z","level":"INFO","message":"Accrual batch complete","trace_id":"abc"}').ok, true);
  const alias = lint.log('{"ts":1794000000,"severity":"warn","msg":"slow"}');
  assert.equal(alias.ok, true);
  assert.match(alias.findings.find((f) => f.id === 'message').detail, /msg/);
});

test('JSON log lines missing a required field fail on that field only', () => {
  const r = lint.log('{"timestamp":"2026-11-06T09:14:02Z","message":"no level here"}');
  assert.equal(state(r, 'format'), 'pass');
  assert.equal(state(r, 'level'), 'fail');
  assert.equal(state(r, 'timestamp'), 'pass');
  assert.equal(state(r, 'message'), 'pass');
});

test('a mix of JSON and plain lines is reported as a mix', () => {
  const r = lint.log('{"timestamp":"2026-11-06T09:14:02Z","level":"ERROR","message":"boom"}\njava.lang.IllegalStateException: boom\n\tat com.example.Accrual.run(Accrual.java:42)');
  assert.equal(state(r, 'format'), 'fail');
  assert.match(r.findings.find((f) => f.id === 'format').detail, /2 of 3/);
});

test('run picks the right checker and says what it recognised', () => {
  assert.equal(lint.run(GOOD_ENV).kind, 'config');
  assert.equal(lint.run('{"timestamp":"t","level":"INFO","message":"m"}').kind, 'log');
  assert.equal(lint.run('hello').kind, 'unknown');
});
