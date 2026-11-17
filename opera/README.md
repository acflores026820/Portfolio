# OperA: self-service observability (prototype)

**Less chasing. More solving.**

OperA is an application-centred observability platform prototype for two kinds of users:

- **Application teams** onboard metrics, logs and traces themselves. They check their setup before deploying, understand exactly what failed and how to fix it, and always see their next step.
- **DevOps and operations** see who owns an alert, whether it's the application or the telemetry, the procedure to follow, and when to escalate. Production changes still need human approval.

There is **one interface for everyone**, with no beginner or expert mode. The idea is **ask, paste or pick**:

| | What it is | Who it helps |
|---|---|---|
| **Ask** | One box (top of every screen, and large on Home). Type a question, an alert or CAMR ID, or what you want to do. `Ctrl`/`⌘`+`K` jumps to it. | Beginners don't need to know where things live. Experts never touch the navigation. |
| **Paste** | Paste a log line or your OpenTelemetry settings. **Fix-it** checks them against the registry and shows the corrected version. | Beginners get the fix, not just the error. Experts check before they deploy. |
| **Pick** | Goal cards on Home ("Set up telemetry", "Is it me or the platform?") and a navigation ordered by role. | People who prefer to browse. |

Help sits beside each choice for anyone who wants it, and the fast paths (the box, keyboard shortcuts, "as code") are always there. Nobody has to choose a mode first.

> **Prototype.** All applications, people, alerts and telemetry are fictional, and no real systems are connected. The AI assistant is scripted to show the intended behaviour and guardrails. It is not a live model. Fix-it is real: it runs fixed rules in the browser against the fictional registry.

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
- The **sun/moon button** switches light and dark. It changes colours only, and follows your system setting until you use it.
- **About** (`#/about`) launches each usability scenario with a clean state.
- **Prototype controls** (in the dark strip at the very top) force validation outcomes (realistic, all pass, blocked, misconfigured, no data yet) and list states (normal, empty, unavailable). Purple dashed boxes simulate other people's decisions, such as an approver approving.

Things worth trying in the box: `onboard rewards-api in qa`, `alr2041`, `who owns merchant portal`, `why are my logs missing?`, or paste a log line.

## What's inside

| Area | Highlights |
|---|---|
| Home | One question: "What do you need to do?" The box, four goal cards for your role, then what needs you and what's waiting on someone else. |
| The box (command bar) | Understands IDs (forgiving of typos), pasted logs and settings, intents ("onboard…", "who owns…", "is … data missing?"), names, and questions. A standard combobox: arrow keys, Enter, Escape. |
| Check my setup (Fix-it) | Paste a log line, environment variables, Kubernetes YAML, an agent command or an `opera.yaml`. Each finding says what's wrong, why, and the fix. Corrected settings are ready to copy. Nothing leaves the browser. |
| Onboard | One page, four numbered sections, with a "What's left" checklist. Everything pre-filled from the registry. Validation explains *what happened / why / how to fix / check again*. Also available as code (`opera.yaml` or one command). |
| Requests | Stage progress, and **who acts next** on every request. Reminders, rejection with reason, resubmit. |
| Coverage | How ready each application is for an incident (six checks), and a board of every component × environment with one click to close a gap. |
| Alerts | One screen: the list, the alert, and who's responsible. Each alert gets an **Application or telemetry?** assessment with evidence, an escalation path with timers, the handling procedure, pre-scoped telemetry queries, and approval-gated remediation. Write a **handoff note** or **draft a procedure** from what you did. Filters live in the URL. `J`/`K`/`A`/`E` shortcuts, which can be turned off. |
| Telemetry health | **Is it me or the platform?** One verdict for an application and environment, then platform incidents and pipelines by region. |
| Applications | Ownership, coverage, incident readiness, alerts, requests and procedures in one place. |
| Ask OperA | Context-aware assistant that uses read-only MCP tools, shows its tool calls and sources, and can only *suggest* actions. You confirm them, and production changes need a second approver. |

## Documentation

- [`docs/design-review.md`](docs/design-review.md): mission, principles, why one interface (section 5), feature-by-feature UX review, AI and MCP integration design, operational safeguards, accessibility results, limitations.
- [`docs/usability-scenarios.md`](docs/usability-scenarios.md): eight scenarios (application team and DevOps for each major workflow), evaluated with **simulated personas**, plus a plan for real usability testing.
- [`docs/specs/2026-11-17-one-ui-design.md`](docs/specs/2026-11-17-one-ui-design.md): the short design note for this version, including the approaches that were rejected.

## Tests

```bash
node --test opera/tests/lint.test.js   # Fix-it rules: 15 unit tests, no browser needed

python3 -m http.server 8765 &          # from the repository root
node opera/tests/walkthroughs.js       # needs the `playwright` package with Chromium
```

The walkthrough script runs every usability scenario end to end (10 runs). It finds elements only by accessible role and name, counts interactions, and fails on console errors.

## Structure

```
opera/
  index.html            app shell (landmarks, skip link, live regions, dialog)
  css/opera.css         design tokens and components (WCAG 2.2 AA minded)
  css/theme-dark.css    dark appearance: token overrides only
  js/data.js            fictional registry, alerts, runbooks, telemetry, requests
  js/lint.js            Fix-it rules and the settings generator (no DOM; unit-tested)
  js/core.js            safe templating, store, router, domain logic
                        (freshness, app-vs-telemetry assessment, escalation,
                        validation engine, request next-step model)
  js/components.js      chips, chart, ownership, escalation ladder, stepper, nav
  js/command.js         the box: suggestions and the combobox behaviour
  js/views/*.js         one file per screen (helpers.js holds Fix-it and Coverage)
  js/assistant.js       scripted assistant with MCP tool traces
  js/main.js            boot, tabs, dialog focus return
  docs/                 design review, usability scenarios, design note
  tests/                Fix-it unit tests and scripted walkthroughs
```

Engineering notes:

- All interpolated text is HTML-escaped by the `html` template helper.
- Only user actions are stored, in `localStorage` under `opera.prototype.v1`. Seed data is regenerated on load, so times always look current.
- One validation engine and one assessment model feed every screen, so the screens can't disagree.
- The settings OperA generates and the settings Fix-it checks come from the same module. A test confirms every generated configuration passes its own checks.
- Fix-it and the box are fixed rules, not a language model. They give the same answer every time and can be tested.
- Colours are tokens. The dark appearance overrides tokens only, so it can't change behaviour.

Icons are adapted from [Feather Icons](https://feathericons.com) (MIT License).
