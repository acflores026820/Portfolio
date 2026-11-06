# OperA: self-service observability (prototype)

**Less chasing. More solving.**

OperA is an application-centred observability platform prototype for two kinds of users:

- **Application teams** onboard metrics, logs and traces themselves. They understand exactly what failed and how to fix it, and always see their next step.
- **DevOps and operations** see who owns an alert, whether it's the application or the telemetry, the procedure to follow, and when to escalate. Production changes still need human approval.

> **Prototype.** All applications, people, alerts and telemetry are fictional, and no real systems are connected. The AI assistant is scripted to show the intended behaviour and guardrails. It is not a live model.

## Run it

It's a static site with no build step and no dependencies.

```bash
# from the repository root
python3 -m http.server 8765
# open http://127.0.0.1:8765/opera/
```

On GitHub Pages it's served at `/opera/`. Opening `index.html` straight from disk also works.

## Try it

- **View as** (top bar) switches between *Application team* (Jordan Kim) and *DevOps / Ops* (Sam Ortiz).
- **About and scenarios** (bottom of the side navigation, `#/about`) launches each usability scenario with a clean state.
- **Prototype controls** (bottom left) force validation outcomes (realistic, all pass, blocked, misconfigured, no data yet) and list states (normal, empty, unavailable). Purple dashed boxes simulate other people's decisions, such as an approver approving.

## What's inside

| Area | Highlights |
|---|---|
| Home | Role-aware. "Your next actions" for app teams; triage stats and "Needs attention" for DevOps. |
| Applications | Ownership, coverage per service, component and environment, alerts, requests and procedures in one place. Gaps link to a pre-filled wizard. |
| Onboard telemetry | 4 steps: Identify → Choose signals → Connect and check → Review. Everything pre-filled from the registry. Validation explains *what happened / why / how to fix / check again*. |
| Onboarding requests | Stage progress, and **who acts next** on every request. Reminders, rejection with reason, resubmit. |
| Alerts | Severity-first queue. Each alert gets an **Application or telemetry?** assessment with evidence, plus ownership, an escalation ladder with timers, the embedded handling procedure, pre-scoped telemetry queries, and approval-gated remediation. |
| Telemetry health | Platform incidents with separate guidance for responders and app teams, and a per-application data freshness check. |
| Ask OperA | Context-aware assistant that uses read-only MCP tools, shows its tool calls and sources, and can only *suggest* actions. You confirm them, and production changes need a second approver. |

## Documentation

- [`docs/design-review.md`](docs/design-review.md): mission, principles, feature-by-feature UX review, AI and MCP integration design, operational safeguards, accessibility results, limitations.
- [`docs/usability-scenarios.md`](docs/usability-scenarios.md): six scenarios (application team and DevOps for each major workflow), evaluated with **simulated personas**, plus a plan for real usability testing.

## Tests

```bash
python3 -m http.server 8765 &          # from the repository root
node opera/tests/walkthroughs.js       # needs the `playwright` package with Chromium
```

The script runs every usability scenario end to end. It finds elements only by accessible role and name, counts interactions, and fails on console errors.

## Structure

```
opera/
  index.html            app shell (landmarks, skip link, live regions, dialog)
  css/opera.css         design tokens and components (WCAG 2.2 AA minded)
  js/data.js            fictional registry, alerts, runbooks, telemetry, requests
  js/core.js            safe templating, store, router, domain logic
                        (freshness, app-vs-telemetry assessment, escalation,
                        validation engine, request next-step model)
  js/components.js      chips, chart, ownership, escalation ladder, stepper, nav
  js/views/*.js         one file per screen
  js/assistant.js       scripted assistant with MCP tool traces
  js/main.js            boot, tabs, dialog focus return
  docs/                 design review and usability scenarios
  tests/                scripted walkthroughs
```

Engineering notes:

- All interpolated text is HTML-escaped by the `html` template helper.
- Only user actions are stored, in `localStorage` under `opera.prototype.v1`. Seed data is regenerated on load, so times always look current.
- One validation engine and one assessment model feed every screen, so the screens can't disagree.

Icons are adapted from [Feather Icons](https://feathericons.com) (MIT License).
