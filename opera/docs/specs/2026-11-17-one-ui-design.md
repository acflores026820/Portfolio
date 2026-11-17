# OperA v0.3 design: one self-service interface for every user

**Date:** 2026-11-17 · **Status:** built in this change · **Decisions marked "my call" were made by the builder, not requested**

## Intent

Recreate the OperA interface as **one UI that every user can use**, easy for a beginner and fast for an expert, with self-service as the purpose: a person should be able to get telemetry set up, find out what's wrong, and handle an alert without asking another team.

**Owner's direction (given during the build):** do not make two different UIs for guided and expert use. There are no modes and no layout switch.

## Why change v0.2

v0.2 had two separate layouts (Guided and Console) and a chooser page. Review of that design left three problems open:

- A newcomer had to **choose a layout before knowing what either meant**.
- The expert layout **hid explanations**, and the beginner layout hid the fast paths, so growing from one to the other meant relearning the product.
- **Two layouts cost more to maintain** than one.

And the most common self-service failure, a setup that doesn't work, was only caught *after* deploying.

## Goals

1. One entry point that works for both audiences: **ask, paste or pick**.
2. Catch setup mistakes **before** deploying.
3. Built-in **helpers** for the jobs people otherwise ask another team to do.
4. **One UI with no modes.** Help is available in place for anyone who wants it; fast paths are always present for anyone who wants them.
5. Keep every safeguard: approvals, escalation rules, read-only assistant.

## Non-goals

- No new back end. Data stays fictional and local.
- No live AI model. The assistant stays scripted; the new checker is deterministic rules, not AI.
- No redesign of the telemetry, alert or request rules themselves.

## Anti-goals (would make this a failure even if it works)

- A chat-only interface where state can't be seen at a glance.
- Anything that lets a faster path skip an approval.
- A mode, layout or "expert view" switch of any kind.
- Beginner help that gets in an expert's way, or expert speed that a beginner can't reach.

## Approaches considered

| | Approach | Trade-off | Verdict |
|---|---|---|---|
| A | Keep the two layouts and add features to each | Cheapest. Keeps the either/or choice and doubles every new feature. | Rejected |
| B | One UI with a Guided/Expert depth switch | Simpler than two layouts, but still two experiences to learn and maintain. | Rejected on the owner's direction |
| B2 | **One UI, no modes**: single entry point, built-in helpers, help in place, fast paths always present | Reuses the shared engines. Each screen has to work for both audiences at once, so each needs care. | **Chosen** |
| C | Chat-first: the assistant is the interface | Novel, but slow for experts, hard to scan, and weak for showing operational state. | Rejected; chat stays one input inside B |

## The design

### 1. Command bar: ask, paste or jump

One box in the top bar (and large on the home screen). Ctrl+K focuses it.

- **Ask** a question → the assistant.
- **Jump** by typing an ID or name (`ALR-2041`, `CAMR-108840`, `rewards-api`).
- **Say what you want** (`onboard rewards-api qa`, `who owns checkout`) → the right screen, pre-filled.
- **Paste** a log line or OpenTelemetry settings → OperA recognises it and opens Fix-it with the result.

Beginners get suggestions before they type. Experts never need the mouse.

### 2. Fix-it: check before you deploy

Paste a log line or settings; get pass/fail findings with the fix, checked against the registry:

- `camr.id` present, well-formed, registered, not retired
- service belongs to that application; component and environment exist
- collector address matches the environment and region
- log lines are JSON with timestamp, level and message

When settings are wrong it shows the corrected version. These are real rules that run in the browser, with unit tests.

### 3. Helpers

Goal cards on the home screen, also reachable from the command bar.

| For | Helper | What it does |
|---|---|---|
| Application teams | Onboarding coach | The onboarding page, now with an "as code" option |
| | Fix-it | Above |
| | Is it me or the platform? | One verdict for an application and environment |
| | Coverage review | Readiness score per application, ranked gaps, one click to fix each |
| DevOps | Triage | App-or-telemetry assessment (existing) |
| | Handoff note | Writes the shift or escalation note from the alert's state |
| | Procedure draft | Drafts a handling procedure from an alert that has none |
| | Approval request | Existing dialog |

### 4. One UI for everyone

Each screen is built once, for both audiences:

| Screen | How it serves a beginner | How it serves an expert |
|---|---|---|
| Home | Goal cards in plain words; "Needs you" list | Command bar; everything one keystroke away |
| Onboarding | One page with numbered sections, definitions and "how do I check?" in place, a readiness checklist that says what's left | Same page: values pre-filled, 8 interactions end to end, deep links, "as code" |
| Alerts | "Next step" box first; assessment in plain words; procedure embedded | Queue always visible beside the alert; J/K/A/E shortcuts (can be turned off) |
| Fix-it | Paste and read the answer | Paste straight into the command bar |

- The two v0.2 layouts, the layout switch and the chooser page are removed.
- **Appearance (light or dark) is a display preference only.** It changes colours, never layout or content. *My call:* it follows the operating system setting until changed.
- The persona switch ("View as") stays, because application teams and DevOps do different jobs. In a real deployment the role would come from sign-in.

### 5. Readiness score

Six checks per application: metrics, logs and traces active in production; data linked to the application; on-call registered; a current handling procedure. Shown on the coverage review, the application page and the home screen.

## Builder's calls

- For each screen I kept the stronger of the two v0.2 designs and folded in what the other did better: the one-page onboarding gains the wizard's explanations; the queue-beside-alert view becomes the alert screen for everyone.
- Dark colours move from the Console layout to a `data-theme` attribute.
- Alert filters move into the address, so a filtered queue can be bookmarked or shared.
- Fix-it lives in `js/lint.js` with no dependency on the UI, so it can be unit-tested with Node.
- The design doc lives beside the other OperA docs rather than at the repository root, because the repository is a personal portfolio.

## How it will be checked

- Unit tests for the Fix-it rules.
- The scripted scenarios, updated, plus new ones for Fix-it and the command bar.
- Accessibility scan in both appearances (light and dark); keyboard checks for the command bar.
- These are scripted checks and simulated personas, not user testing.
