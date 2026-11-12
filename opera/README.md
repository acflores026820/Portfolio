# OperA: self-service observability (prototype)

**Less chasing. More solving.**

OperA is an application-centred observability platform prototype for two kinds of users:

- **Application teams** onboard metrics, logs and traces themselves. They understand exactly what failed and how to fix it, and always see their next step.
- **DevOps and operations** see who owns an alert, whether it's the application or the telemetry, the procedure to follow, and when to escalate. Production changes still need human approval.

It comes in **two layouts to choose from**, for both kinds of user:

| | Guided | Console |
|---|---|---|
| Idea | Step by step, with explanations beside each choice | Everything on one screen, built for repeat work |
| Look | Light, roomy, navigation down the side | Dark, compact, navigation across the top |
| Application teams | "Your next actions" home, four-step onboarding | Workspace board (coverage grid and request pipeline), one-page onboarding |
| DevOps | Alert queue, then a full page per alert | Three-pane triage console with J/K/A/E shortcuts |

Both use the same data, checks, procedures and approvals. Only the presentation differs.

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

- The **first visit** opens the layout chooser (`#/choose`). Pick Guided or Console for each role.
- **View as** (top bar) switches between *Application team* (Jordan Kim) and *DevOps / Ops* (Sam Ortiz).
- **Layout** (top bar) switches between *Guided* and *Console*. Each role remembers its own layout.
- **About and scenarios** (`#/about`) launches each usability scenario with a clean state, in either layout.
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
| Layout chooser | Two layouts per role, each with a preview, who it suits, its trade-off and a measured interaction count. |
| Ask OperA | Context-aware assistant that uses read-only MCP tools, shows its tool calls and sources, and can only *suggest* actions. You confirm them, and production changes need a second approver. |

## Documentation

- [`docs/design-review.md`](docs/design-review.md): mission, principles, the two layouts compared (section 5), feature-by-feature UX review, AI and MCP integration design, operational safeguards, accessibility results, limitations.
- [`docs/usability-scenarios.md`](docs/usability-scenarios.md): six scenarios (application team and DevOps for each major workflow), run in both layouts and evaluated with **simulated personas**, plus a plan for real usability testing.

## Tests

```bash
python3 -m http.server 8765 &          # from the repository root
node opera/tests/walkthroughs.js       # needs the `playwright` package with Chromium
```

The script runs every usability scenario end to end in both layouts (15 runs). It finds elements only by accessible role and name, counts interactions per layout, and fails on console errors.

## Structure

```
opera/
  index.html            app shell (landmarks, skip link, live regions, dialog)
  css/opera.css         design tokens and components (WCAG 2.2 AA minded)
  css/console.css       Console layout: dark tokens, top navigation, triage panes, board
  js/data.js            fictional registry, alerts, runbooks, telemetry, requests
  js/core.js            safe templating, store, router, domain logic
                        (freshness, app-vs-telemetry assessment, escalation,
                        validation engine, request next-step model)
  js/components.js      chips, chart, ownership, escalation ladder, stepper, nav
  js/views/*.js         one file per screen
  js/views/console.js   Console layout screens (triage console, workspace, one-page onboarding)
  js/views/choose.js    layout chooser
  js/assistant.js       scripted assistant with MCP tool traces
  js/main.js            boot, tabs, dialog focus return
  docs/                 design review and usability scenarios
  tests/                scripted walkthroughs
```

Engineering notes:

- All interpolated text is HTML-escaped by the `html` template helper.
- Only user actions are stored, in `localStorage` under `opera.prototype.v1`. Seed data is regenerated on load, so times always look current.
- One validation engine and one assessment model feed every screen, so the screens can't disagree.
- The two layouts share the alert parts, dialogs and onboarding handlers. A layout changes presentation only, so it can't weaken a safeguard.
- Colours are tokens. The Console layout overrides them with values chosen for a dark surface.

Icons are adapted from [Feather Icons](https://feathericons.com) (MIT License).
