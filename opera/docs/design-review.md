# OperA design review

**Prototype v0.1 · November 2026 · All applications, people and data are fictional**

> **Starting point.** There was no earlier OperA prototype in this repository, so this is the first version, built from the mission brief. Everything below describes what the prototype in `opera/` does and why.

---

## 1. Mission

Make OperA an intuitive, reliable, **application-centred self-service observability platform**.

**North Star: Less chasing. More solving.**

"Chasing" means the work that happens *around* a problem rather than on it: finding the owner, asking what a CAMR ID is, waiting on an unanswered approval, re-explaining an issue to the next responder, or paging a team for a problem that turned out to be the telemetry pipeline. Each feature below is judged on how much of that work it **removes**, not just moves somewhere else.

---

## 2. How this review was done

### Expert lenses

The design was reviewed through eight roles. They are review lenses applied by one designer, not eight separate people.

| Lens | Focus in this review |
|---|---|
| Principal Software Engineer | Architecture of the prototype, escaping of untrusted input, one shared validation and assessment engine (no duplicated logic between screens), testability |
| Senior Enterprise UX/UI Designer | Journeys, information hierarchy, copy, error recovery, empty and failure states, accessibility |
| Observability Platform Architect | Data model: CAMR ID as the join key, required resource attributes, coverage per service, component and environment |
| Telemetry Platform Engineer | Collector pools, ingestion lag, data loss, how "missing data" differs from "bad application" |
| Platform Engineering Specialist | Self-service boundaries: what app teams can do alone, what needs the registry, what needs approval |
| Senior DevOps Engineer | Triage order, escalation timing, handling procedures, approval-gated remediation, hand-offs |
| Application Developer / Owner | Can I do this alone in 15 minutes? Do I understand what failed? Am I being asked things the system already knows? |
| AI and MCP Integration Specialist | Read-only tool design, visible tool calls, citations, guardrails against prompt injection and unsafe actions |

### Simulated personas

These are **simulated personas** used for design review. **They are not research participants, and nothing in this document is real user feedback.**

| Persona | Role | Context |
|---|---|---|
| **Jordan Kim** | Application developer, Loyalty Engineering | Knows their service well. Limited observability experience. Primary on-call for Rewards Engine. Has never onboarded telemetry. |
| **Sam Ortiz** | DevOps engineer, Production Operations (on shift) | Experienced responder. Handles alerts for many applications they don't own. Wants answers fast and hates paging the wrong team. |
| Alex Morgan | App owner (Rewards Engine, Statement Generator) | Approver for production onboarding and remediation. Appears as an approver only. |
| Kai Rivera | Telemetry Platform on-call | Owns collector incidents. Appears as an escalation target only. |

---

## 3. Design principles

These came out of the review and were applied to every screen.

1. **Start from the application.** The CAMR ID ties everything together: telemetry, owners, on-call, procedures, alerts and requests. Every screen tells you which application you're looking at.
2. **Always show the next step and who owns it.** Every request and alert has a "Next step" box that names the action and the person or system responsible (You / Approver / Platform / On-call).
3. **Explain failures in four parts:** *what happened*, *why*, *how to fix it* (with copyable fixes), and *check again*. Never just "validation failed".
4. **Separate "the app is broken" from "the data is broken".** Every alert carries an assessment with its evidence, so responders don't page application teams for pipeline problems.
5. **Never ask for what the system already knows.** Services, components, environments, collector endpoints and configuration come from the registry. Users choose from what's there; they don't type configuration.
6. **People decide; the AI reads, cites and suggests.** Remediation in production keeps the two-person rule. The assistant can't act.
7. **Remove work, don't move it.** Each feature is checked for whether it removes a stakeholder interaction or just shifts it to someone else (see the "Stakeholder involvement" rows below).
8. **Accessible by default.** Status is icon plus text, never colour alone. Everything works by keyboard. Errors are linked, focused and announced.

---

## 4. Information architecture

| Screen | Route | Primary user |
|---|---|---|
| Home (role-aware) | `#/home` | Both, with different content |
| Applications and application page | `#/apps`, `#/apps/:camrId` | Both |
| Onboard telemetry (4-step wizard) | `#/onboard` | App team |
| Onboarding requests and request page | `#/requests`, `#/requests/:id` | App team (platform and approvers secondary) |
| Alerts and alert page | `#/alerts`, `#/alerts/:id` | DevOps (app on-call secondary) |
| Telemetry health | `#/health` | Both |
| Handling procedures | `#/runbooks`, `#/runbooks/:id` | DevOps, procedure owners |
| Search | `#/search?q=` | Both (exact IDs jump straight to the item) |
| About and scenario launcher | `#/about` | Design reviewers |

The side navigation is **ordered by role**. Application teams see Applications → Onboard → Requests first. DevOps sees Alerts → Telemetry health → Applications first. The items and labels stay the same, so switching roles doesn't hide anything.

---

## 5. Feature reviews

Each feature is reviewed against the eight UX questions in the brief:

1. Primary user and goal
2. Problem it solves
3. Simplest successful journey
4. Steps and information removed
5. Success, failure and incomplete-data states
6. Does the user understand what happened and what to do next?
7. Beginner and experienced perspectives
8. Does it reduce stakeholder involvement, or just move it?

### F1 · Role-aware home with "Your next actions"

| | |
|---|---|
| **Primary user and goal** | Both. App team: "What needs me today?" DevOps: "What's most urgent, and is any of it a telemetry problem?" |
| **Problem** | Work is scattered across alert tools, tickets, chat and the registry. People check five places, or wait to be chased. |
| **Simplest journey** | Open OperA → read the top item in *Your next actions* → one button takes you to the exact place to act. |
| **Removed** | Separate dashboards for alerts and requests. Things waiting on *other* people are moved to a separate *Waiting on someone else* list, so they don't compete for attention. |
| **States** | Success: "Nothing needs you right now." Failure: a list fails to load and shows an error that says paging is unaffected (Prototype controls → Unavailable). Incomplete: a telemetry incident banner appears when one of *your* applications is affected, with "This is a platform problem, not something your team needs to fix." |
| **What happened, what next** | Every item has a *why* line and one call to action. |
| **Beginner / expert** | Beginner: the "New to observability? Start here" primer explains metrics, logs and traces in one sentence each. Expert: stat tiles (DevOps) link straight to filtered queues. |
| **Stakeholder involvement** | **Reduces.** People stop asking "is anything waiting on me?" Requests waiting on approvers name the approver, so nobody has to guess who to chase. |

### F2 · Application pages (the centre of the product)

| | |
|---|---|
| **Primary user and goal** | Both. "Show me everything about this application in one place." |
| **Problem** | Ownership, coverage, alerts and procedures live in different systems with different identifiers. |
| **Simplest journey** | Search by name or CAMR ID → application page: who owns it, coverage per environment, open alerts, requests, procedures, routing. |
| **Removed** | Re-typing identifiers between tools. Environment tabs replace three separate coverage pages. |
| **States** | Success: full coverage table. Failure: an unknown CAMR ID gets a clear "not found" page with the ID format and next steps. Retired applications are labelled and onboarding is blocked, with the reason. Incomplete: coverage chips show *Not set up* or *Partial* (arriving without required attributes), plus *Missing* or *Delayed* when a platform incident affects freshness. A row with gaps has a **Set up** button that opens the wizard pre-filled. |
| **What happened, what next** | Coverage gaps carry their own action. Ownership has "Report wrong or missing details", routed to the app owner. |
| **Beginner / expert** | Beginner: plain labels ("Not set up"). Expert: routing card (region, collector pool, per-signal lag). |
| **Stakeholder involvement** | **Reduces.** "Who owns X?" and "Is X onboarded?" become self-serve. Registry corrections go straight to the one person who can make them, instead of a general channel. |

### F3 · Guided onboarding (4 steps)

| | |
|---|---|
| **Primary user and goal** | App team developer with limited observability experience: "Get telemetry flowing for my service without opening a ticket." |
| **Problem** | Onboarding usually needs a platform engineer to explain prerequisites, write configuration and debug why data isn't showing up. |
| **Simplest journey** | **Identify** (pick your app from quick picks; service, component and environment come from the registry, and single options are selected for you) → **Choose signals** (recommended ones pre-selected) → **Connect and check** (copy pre-filled configuration, deploy, run checks) → **Review and submit**. 11 interactions in the realistic scenario, including two re-checks. |
| **Removed** | Typing the CAMR ID (quick picks), service names, collector endpoints or attribute strings. Picking a component when there is only one. "Do you meet the prerequisites?" questions, which were replaced by automatic validation. A separate "configuration" step, merged into "Connect and check". |
| **States** | Success: all checks pass and review says "Approved automatically" (dev and qa from the owning team). Failure: blocking failures (collector unreachable, missing `camr.id`) stop submission with a fix. Non-blocking failures (logs not JSON) can be submitted and tracked as *Needs your action*. Incomplete: "No data yet" is a *waiting* state, not a failure, and OperA keeps checking for 30 minutes after submission. Other cases: unknown CAMR ID, malformed CAMR ID (forgiving search plus format hint), retired application, service not in the registry, environment already fully set up (disabled with explanation), not a member of the owning team (allowed, but needs owner approval). |
| **What happened, what next** | GOV.UK-style error summary, focused and linked to each field. "What happens after you submit" lists approvals, automatic set-up, and when you'll be notified. |
| **Beginner / expert** | Beginner: inline "What's a…?" glossary toggles, "How do I check?" per prerequisite, and an explanation of each configuration line. Expert: deep links (`#/onboard?app=…&service=…&env=…`) from coverage gaps skip straight to the right step. Kubernetes, environment-variable and VM variants are tabs; the platform from the registry is pre-selected. |
| **Stakeholder involvement** | **Reduces** for dev and qa (no platform engineer, no approver). **Deliberately keeps** one approver for production and for non-members. That's a safeguard, and the approver is named and can be reminded. Unregistered services are sent to the app owner (registry), **not** to the platform team. That's a small, intentional transfer to the person who owns the data. |

### F4 · Validation with explain-and-fix

| | |
|---|---|
| **Primary user and goal** | App team: "Did it work? If not, what exactly do I change?" |
| **Problem** | "No data" has many causes (network, attributes, log format, no traffic, platform lag) that look the same to a beginner. |
| **Simplest journey** | Run checks → read the failed item → copy the fix → redeploy → **I've fixed it, check again**. |
| **Removed** | Searching logs or asking in chat to find out *why* data is missing. Checks are ordered by dependency: if the connection fails, signal checks show *Not checked yet* rather than adding three more failures. |
| **States** | Pass, Needs your action, Waiting for data and Not checked yet, each with icon and text. A platform note appears on a *passing* check when a platform incident is in progress ("Your logs are fine. Search is running about 11 minutes behind (TEL-553). Nothing to fix."). That prevents a beginner from "fixing" a working configuration. After repeated blocking failures, the copy points to **Get help**, which attaches the full diagnostics automatically. |
| **What happened, what next** | Every non-passing check has *What happened / Why / How to fix it / Check again*. Results are announced to screen readers. |
| **Beginner / expert** | Beginner: a real example of the bad log line received and the exact encoder snippet. Expert: endpoint and attribute details are in the check text, and "Run all checks again" re-runs only what isn't passing. |
| **Stakeholder involvement** | **Reduces.** Most failures are fixed without contact. When help *is* needed, the diagnostics packet removes the usual back-and-forth of "which app? which env? what did you try?". |

### F5 · Onboarding request tracker

| | |
|---|---|
| **Primary user and goal** | App team: "Where is my request and who's holding it up?" |
| **Problem** | Requests vanish into a queue. People chase the platform team, who chase approvers. |
| **Simplest journey** | Requests list → each row shows stage progress and **who acts next** → open the request to see the fix or send a reminder. |
| **Removed** | Status-check messages to the platform team. Resubmission after a fix, because fixing a failed check moves the request on by itself. |
| **States** | Five stages: Submitted → Validated → Approved → Set up → Data flowing. A failed stage is marked in red with an icon, not just colour. Waiting on an approver shows how long it's been waiting; after 24 hours a reminder can be sent (rate-limited to once a day). Rejected requests show the approver's reason and **Update and resubmit**, which copies the request into a draft. Empty, "nothing needs your action" and unavailable states all exist. |
| **What happened, what next** | The *Next step* box on each request names the owner (You / Approver / Platform). Activity is time-stamped. |
| **Beginner / expert** | Beginner: plain stage names. Expert: "Needs my action" filter. |
| **Stakeholder involvement** | **Reduces** chasing by making ownership visible. Reminders do add a small new interaction with approvers, but they're targeted, rate-limited, and replace untargeted chasing. |

### F6 · Alert queue

| | |
|---|---|
| **Primary user and goal** | DevOps: "What do I handle first, and should I page anyone?" |
| **Problem** | Queues sorted by time hide severity. They don't show ownership gaps or whether the data itself is trustworthy. |
| **Simplest journey** | Queue sorted by severity → unacknowledged → age. Each row shows the responsible team and on-call, an **App or telemetry?** chip, status, and the next step. |
| **Removed** | Opening each alert to find the owner. Separate lookups in the registry and on-call tool. |
| **States** | Telemetry incident banner above the queue. "No on-call registered" chip on rows with ownership gaps. Empty ("No alerts match these filters" with Clear filters). Unavailable ("Paging still works" reassurance). |
| **What happened, what next** | Every row has its next step in plain language. |
| **Beginner / expert** | Beginner: the app team defaults to "Mine". Expert: one row of filters (status, assessment, application, environment) that are shareable via the URL. |
| **Stakeholder involvement** | **Reduces** wrong pages, because telemetry problems are visible before anyone is paged. |

### F7 · "Application or telemetry?" assessment

| | |
|---|---|
| **Primary user and goal** | DevOps, and the app on-call: "Is the application broken, or is the data?" |
| **Problem** | "No data" and "values look wrong" alerts during pipeline incidents cause wrong pages, wasted debugging and lost trust in alerts. |
| **Simplest journey** | Open the alert → read the assessment headline and confidence → scan the per-signal freshness and evidence → follow the routing it recommends. |
| **How it decides** (transparent rules, not a black box) | *Telemetry* when the alert's own signal is missing because of an active incident and the alert is a no-data alert. *Unclear* when the alert's signal is affected by an incident but the alert is a threshold alert (its value may be wrong). *Application* when the alert's signal is fresh. Confidence drops to *medium* when other signals are delayed or not set up. Evidence lists the alert's own signal, every other signal, recent changes (with "minutes before the alert"), and alert-specific findings. |
| **States** | All three outcomes are in the prototype: ALR-2042 (telemetry), ALR-2040 (unclear), ALR-2041 (application, high confidence). Incomplete data is surfaced, not hidden: ALR-2043's logs are delayed, and ALR-2045 has logs and traces not set up, with a link to set them up (app team) or flag the gap (DevOps). |
| **What happened, what next** | The guidance line says what to do: link to the incident and don't page; check logs before paging; or follow the procedure. |
| **Beginner / expert** | Beginner: headline plus one sentence. Expert: evidence list, freshness per signal, and the exact incident. |
| **Stakeholder involvement** | **Reduces.** Prevents pages to application teams during pipeline incidents (ALR-2042 → TEL-552 with optional paging hold). Avoids re-paging the Telemetry Platform on-call, who is already on the incident ("Already on it"). |

### F8 · Ownership and escalation path

| | |
|---|---|
| **Primary user and goal** | DevOps: "Who do I contact, and when must I escalate?" |
| **Problem** | Escalation policies live in wikis, timers in people's heads, and the registry is sometimes wrong. |
| **Simplest journey** | *Responsible team* card (owner, on-call, support group, chat) plus an *Escalation path* ladder with **Due now** and **In 12 min** markers. The due step has a one-click **Page** button. |
| **Removed** | Looking up the policy and doing the time maths. Writing the context for a page, which OperA attaches automatically (summary, impact, assessment, evidence, steps done). |
| **States** | Ownership gap: no on-call registered → falls back to the support group (business hours) or the incident commander, with a warning. Stale registry (>180 days) → "may be out of date". Telemetry routing replaces the app ladder. Acknowledged or paged steps show who and when. |
| **What happened, what next** | The paging dialog requires a reason and shows the exact context packet that will be sent. |
| **Beginner / expert** | Beginner: one recommended person, preselected. Expert: any step on the ladder can be chosen. |
| **Stakeholder involvement** | **Reduces** "what's going on?" follow-ups from the person paged. Registry gaps are reported to the owner in two clicks, so the same gap doesn't cost the next responder. |

### F9 · Handling procedures and approval-gated remediation

| | |
|---|---|
| **Primary user and goal** | DevOps and app on-call: "What's the agreed procedure, and what am I allowed to do?" |
| **Problem** | Runbooks are hard to find, often stale, and risky steps get done without a second pair of eyes. |
| **Simplest journey** | The linked procedure is embedded in the alert. Steps can be ticked off (logged), each step's links open pre-filtered telemetry, and the risky step opens an **approval request**. |
| **Removed** | Hunting for the runbook. Re-typing filters into the logs tool, because each "Open logs/traces" link shows the exact pre-scoped query to paste plus sample results. |
| **States** | No procedure → falls back to generic triage (RB-000) or telemetry gap (RB-900), with "Ask the owning team for a procedure". Stale procedure (>6 months) → warning to confirm risky steps. Approval: pending → approved or rejected (with reason). The approval form requires a change record (format-checked with a specific error), a reason, and confirmation of blast radius and rollback plan. You can't approve your own request; an alternate approver is used. |
| **What happened, what next** | "Nothing changes until X approves." Every action is recorded on the alert timeline. |
| **Beginner / expert** | Beginner: the *Next* tag on the current step, and decision callouts ("If the error rate is above 2%…"). Expert: can tick steps out of order. |
| **Stakeholder involvement** | **Keeps** one approver for production changes on purpose (a safeguard). **Removes** the approver's need to ask for context, because the request carries it. |

### F10 · Telemetry health

| | |
|---|---|
| **Primary user and goal** | Both. "Is it the platform?" |
| **Problem** | Platform incidents are announced in a channel that app teams don't read. Teams debug configurations that were never broken. |
| **Simplest journey** | Incident cards with separate guidance for responders and for application teams → affected applications and alerts → per-region pipeline table → **Check one application** (per-component freshness). |
| **States** | No incidents ("All telemetry pipelines are healthy"). Delayed (backfills, no loss). Missing (data lost while the incident lasts). Per-application result: affected by an incident, or "No platform problems affect this app, so the cause is probably the application or its configuration." |
| **Stakeholder involvement** | **Reduces** inbound "is it you or us?" questions to the Telemetry Platform team. |

### F11 · OperA Assistant (AI + MCP)

| | |
|---|---|
| **Primary user and goal** | Both. "Explain this to me", "who do I call?", "why did this fail?" |
| **Problem** | Beginners don't know what to ask. Experts want a fast summary with sources they can verify. |
| **Simplest journey** | **Ask OperA** (or "Ask OperA to summarize" on an alert). The context is the current page. Suggested questions are relevant to it. Answers cite sources, show the tool calls they made, and list suggested actions as **Review and confirm** buttons that open the normal human dialogs. |
| **States** | Answer with sources; "I don't have an answer for that in this prototype"; requests to act ("restart it") are declined with an explanation and a pointer to the approval-gated action. |
| **Beginner / expert** | Beginner: suggested questions, plain language. Expert: expandable list of MCP tool calls with arguments. |
| **Stakeholder involvement** | **Reduces** repetitive questions to platform and on-call engineers. It creates no new approval paths and can't skip existing ones. |

---

## 6. AI and MCP integration design

The assistant in the prototype is scripted, but it follows the integration contract a real implementation should follow.

### Tool catalogue (OperA MCP server)

| Tier | Tools | Who can invoke | Guardrail |
|---|---|---|---|
| **0 · Read** | `registry.lookup_application`, `registry.get_ownership`, `registry.search_applications`, `telemetry.get_freshness`, `telemetry.list_incidents`, `alerts.get`, `alerts.list`, `alerts.get_escalation_policy`, `changes.list_recent`, `runbooks.get`, `onboarding.get_request`, `onboarding.get_validation`, `onboarding.get_coverage`, `logs.search`, `traces.search`, `metrics.query` | Assistant and users | Scoped to the signed-in user's permissions. Every call shown in the answer and logged for audit. |
| **1 · User-confirmed write** | `alerts.acknowledge`, `alerts.add_note`, `alerts.escalate`, `alerts.link_incident`, `onboarding.submit`, `registry.report_issue` | **Users only**, through the UI | The assistant may *suggest* these; the user reviews a dialog and confirms. |
| **2 · Two-person approval** | `remediation.request` (rollback, scale, restart), production onboarding approval | Users request; a different person approves | Change record required. You can't approve your own request. Blast radius and rollback plan shown. |
| **3 · Never through the assistant** | Deleting telemetry, permanent alert suppression, changing escalation policies, editing the registry | Owning teams, in their own tools | Not exposed on the MCP server at all. |

### Guardrails

- **Read-only by design.** The assistant has only Tier 0 tools. That's enforced by the server, not just by the prompt.
- **Visible and auditable.** Each answer lists its tool calls and sources. A reader can check every claim against OperA data.
- **Untrusted content stays data.** Log lines, ticket text and runbook text can contain instructions ("ignore previous instructions…"). The assistant treats them as quoted evidence, never as commands. Tier 0 tools return structured fields, and free text is labelled as untrusted.
- **No hidden autonomy.** Suggested actions use the same dialogs, validations and approvals as a person clicking the button.
- **Honest limits.** "I don't have an answer for that" beats a guess. Answers carry a reminder that they are AI-generated, with sources to check.

---

## 7. Operational safeguards preserved

| Safeguard | Where |
|---|---|
| Two-person rule for production remediation, with change record | Alert → procedure → *Request approval* |
| You can't approve your own request | Alternate approver chosen automatically |
| Production onboarding needs app owner approval | Wizard review step, request tracker |
| Non-members of the owning team need owner approval even in dev/qa | Wizard identify step |
| Retired applications and unregistered services can't be onboarded | Wizard identify step |
| Paging hold for telemetry-caused alerts is **opt-in**, and auto-reopens 15 min after the incident resolves | *Link to incident* dialog |
| Escalation timers per tier, visible and actionable | Escalation path card |
| Every action recorded with who and when | Alert activity, request activity |
| Reminders are rate-limited | Request tracker (once per 24 h) |

---

## 8. Platform and telemetry assumptions

- **OpenTelemetry** is the standard. Required resource attributes are `service.name`, `deployment.environment`, `camr.id` and `app.component`. Data without `camr.id` is shown as *Partial* because it can't be linked to an owner.
- **Collectors run in regional pools.** The registry records each application's region and pool, which is how incidents are mapped to applications.
- **Validation taps data at the collector gateway**, before indexing. That's why validation can pass while search is delayed, and the UI says so.
- **Freshness per signal:** Arriving normally, Delayed, Missing or partial, Arriving with attributes missing, Not set up. The same model drives coverage pages, health checks and the alert assessment, so the screens can't disagree.

---

## 9. Accessibility

Target: **WCAG 2.2 AA**.

**Automated (axe-core 4.14).** 0 violations across 54 screens and states: every route in both roles, empty and unavailable states, every wizard step including errors and validation results, the help, approval, escalation and explorer dialogs, the assistant, and the prototype panel. The first run found 4 issues, all fixed:

- logo link name didn't match its visible text
- prototype notice outside a landmark
- skipped heading level in fix guidance
- scrollable context packet not keyboard-reachable

**Scripted keyboard and layout checks.** All pass:

- Skip link is the first Tab stop and moves focus to main without changing the route.
- On route changes, focus moves to the new page's heading so screen readers announce it.
- Visible 3 px focus ring on every Tab stop.
- Dialogs: open with Enter, keep focus inside, close with Escape, and return focus to the trigger (or its re-rendered twin).
- Invalid submissions focus the first invalid field (`aria-invalid`, linked error text). The wizard focuses a linked error summary.
- Environment tabs follow the WAI-ARIA tabs pattern (arrow keys, Home, End).
- Charts can be read by keyboard (arrow keys move the crosshair) and have a text summary plus a "Show data as a table" alternative.
- Standalone targets are at least 24 × 24 px (WCAG 2.2 2.5.8).
- No horizontal page scrolling at 320 px wide (1.4.10 Reflow). Wide tables scroll inside their own container.

**Design-level.** Status is always icon plus text. Severity, environment and verdict chips are readable in greyscale. `prefers-reduced-motion` and `forced-colors` are respected. Live regions announce validation progress, results and toasts. Copy is plain language (short sentences, "you", no jargon without a definition).

**Not yet done.** Manual testing with screen readers (NVDA, JAWS, VoiceOver) and with users with disabilities. Automated tools catch a minority of real issues. See the test plan in `usability-scenarios.md`.

---

## 10. Known limitations and open questions

- **Fictional data, no backend.** All state lives in `localStorage`. Times are generated relative to page load.
- **The assistant is scripted.** A real model would need evaluation for answer accuracy, citation faithfulness and refusal behaviour before release.
- **Assessment rules are deliberately simple.** Real pipelines need per-signal data-loss metrics, collector-to-application mapping that's kept current, and a calibrated confidence model.
- **Registry quality is the biggest dependency.** OperA makes gaps visible and reportable, but can't fix them. Open question: should repeated gaps (e.g. no on-call for 30 days) escalate to the owning team's manager automatically?
- **Approvals are simulated.** Production needs integration with the change-management system and the paging provider.
- **Open question:** should production onboarding require a passing qa validation first, rather than just recommending it? Stricter is safer but adds a step for teams without qa.

---

## 11. Suggested next steps

1. Run the usability study in `usability-scenarios.md` with real participants (5–6 per role), including screen reader and keyboard-only users.
2. Instrument the real product with the success metrics below and set baselines before launch.
3. Pilot with two application teams and one operations shift, then compare pages-to-wrong-team and onboarding tickets before and after.

| Metric | Why it matters |
|---|---|
| Onboarding completed without a support ticket (%) | Self-service is working |
| Median time from request to data flowing | Less waiting |
| Requests stuck "Needs your action" for more than 3 days | Fix guidance is effective |
| Pages to app teams later linked to a telemetry incident | Fewer wrong pages |
| Time to acknowledge, and time to first correct escalation | Faster, more accurate response |
| "Who owns this?" questions in ops channels | Less chasing |
| Registry gaps reported → fixed within 7 days | Ownership data improving |
