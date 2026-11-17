# OperA design review

**Prototype v0.3 · November 2026 · All applications, people and data are fictional**

> **Starting point.** There was no earlier OperA prototype in this repository, so v0.1 was built from the mission brief. v0.2 offered two layouts to choose from (Guided and Console). **v0.3 replaces both with one interface for everyone** (section 5), on the product owner's direction: no beginner mode, no expert mode, no layout to pick. It adds a box you can ask, paste into or jump from, and six built-in helpers that do work people used to do by hand. Everything below describes what the prototype in `opera/` does and why.

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
| Onboard telemetry (one page) | `#/onboard` | App team |
| Check my setup (Fix-it) | `#/fix` | App team |
| Onboarding requests and request page | `#/requests`, `#/requests/:id` | App team (platform and approvers secondary) |
| Coverage review | `#/coverage` | Both |
| Alerts (list, alert and ownership on one screen) | `#/alerts`, `#/alerts/:id` | DevOps (app on-call secondary) |
| Telemetry health, with "Is it me or the platform?" | `#/health` | Both |
| Applications and application page | `#/apps`, `#/apps/:camrId` | Both |
| Handling procedures | `#/runbooks`, `#/runbooks/:id` | DevOps, procedure owners |
| Search | `#/search?q=` | Both (reached from the box) |
| About and scenario launcher | `#/about` | Design reviewers |

The navigation is one row across the top, **ordered by role**. Application teams see Onboard → Check my setup → Requests first. DevOps sees Alerts → Telemetry health → Applications first. Switching roles reorders the row; it doesn't hide anything. Below 1100 px wide the row becomes a menu.

The box in the top bar reaches every screen and every application, alert, request and procedure, so the navigation is a second way in, not the only one.

---

## 5. One interface for everyone

### What changed from v0.2, and why

v0.2 had two layouts: *Guided* (step by step, light) and *Console* (dense, dark, three panes). A person chose one per role. v0.3 removes the choice.

| v0.2 | v0.3 | Why |
|---|---|---|
| Choose Guided or Console on the first visit | No chooser. First visit opens Home. | A newcomer can't know which layout suits them before they've used the product. The choice was a question the system could not help with. |
| Guided: four-step onboarding wizard. Console: one page. | One page with four numbered sections and a "What's left" checklist. | The page keeps the wizard's order and explanations, and drops its Continue clicks. |
| Guided: alert queue, then a page per alert. Console: three panes. | One alerts screen: list, alert, ownership. One pane at a time on a narrow screen. | Responders keep the queue in view. A first-timer still reads the same "Next step" box first. |
| Help visible in Guided, folded away in Console | Help beside each choice, closed by default, always in the same place | Nobody is punished for not knowing a term, and nobody has to scroll past explanations they don't need. |
| Dark theme meant "Console" | Light or dark is appearance only. Follows the system until changed. | Colour should not change what the product does. |
| Two sets of screens to maintain | One | Open finding 19 in v0.2. |

The product owner's direction was explicit: do not make separate interfaces for beginners and experts; make one that every user can use. A Guided/Expert switch was considered and rejected for the same reason (see `specs/2026-11-17-one-ui-design.md`).

### The idea: ask, paste or pick

Every task can be started three ways, and all three are on Home.

- **Ask.** Type what you want in the box: "onboard rewards-api in qa", "who owns merchant portal", "alr2041", "why are my logs missing?". The best match is first; Enter takes it.
- **Paste.** Paste a log line or settings anywhere in the box, or on *Check my setup*. Fix-it says what's wrong and shows the corrected version.
- **Pick.** Four goal cards for your role, then the role-ordered navigation.

### How one interface serves a beginner and an expert

Same screen, same controls. The difference is what each person uses on it.

| Need | What a beginner uses | What an expert uses |
|---|---|---|
| Start a task | Goal cards; example chips under the box | The box (`Ctrl`/`⌘`+`K` from anywhere), or a deep link |
| Identify the application | "Your applications" quick picks; "What's a CAMR ID?" | Type the CAMR ID or service name; typos are forgiven |
| Understand a term | "What's a service?", "How do I check?" beside the field | Leaves them closed |
| Configure telemetry | Copy the pre-filled settings; "What does this do?" | "Prefer to do this from code or a pipeline?": an `opera.yaml` or one command |
| Know if it's right | Run checks; read *what happened / why / how to fix* | Paste into Fix-it before deploying |
| Work alerts | Click an alert; read "Next step" | `J`/`K` to move, `A` to acknowledge, `E` to escalate; filters in the URL |
| Know what to do next | "Needs you" on Home; "What's left" on onboarding | The same lists; coverage board for the whole picture |

No setting is needed to move from the left column to the right. That is the design.

### F12 · The box: ask, paste or jump

| | |
|---|---|
| **Primary user and goal** | Both. "Take me to the thing, or tell me the answer, without my knowing where it lives." |
| **Problem** | Navigation assumes you know the product's map. Beginners don't; experts find it slow. A plain search box returns lists, not actions. |
| **Simplest journey** | Type → the first suggestion is the best match → Enter. Two interactions to reach any alert, application, request or procedure, or to start onboarding with the service and environment filled in. |
| **Removed** | Choosing a screen before knowing which one. Typing exact IDs (`alr2041` and `camr108840` work). The separate global search field. |
| **States** | Empty box: starting points for your role. Recognised ID, intent, pasted log or settings: a "Best match". Names: "Go to". A question: "Ask OperA". Always last: "Search everything". Nothing recognised still leaves Ask and Search, so the box never dead-ends. |
| **What happened, what next** | Each suggestion says what it will do in its second line ("Opens onboarding with this filled in"). After Enter, focus lands on the new page's heading. |
| **Beginner / expert** | Beginner: placeholder and example chips show what can be typed. Expert: `Ctrl`/`⌘`+`K`, arrow keys, Enter. A multi-line paste goes straight to Fix-it. |
| **Stakeholder involvement** | **Reduces.** "Where do I find…?" and "who owns…?" stop being questions for a colleague. |

It is a standard WAI-ARIA combobox with a listbox popup, so screen readers announce the options and the active one. The matching is keyword rules, not a language model: the same input always gives the same suggestions.

### Measured interactions (scripted walkthroughs)

One click, typed field, key press, tick or selection is one interaction. Measured by `tests/walkthroughs.js`. The v0.2 columns are kept for comparison.

| Scenario | v0.2 Guided | v0.2 Console | **v0.3** | Note |
|---|---|---|---|---|
| A-App · Onboard a service to qa | 11 | 8 | **8** | One page; no Continue clicks |
| A-Ops · Alert with incomplete ownership | 10 | 9 | **11** | One more than Guided: the responder now sends a *drafted* procedure (2) instead of a bare request (1). See below. |
| B-Ops · Rollback approval and page | 10 | 9 | **10** | Includes one deliberate mistake |
| B-App · First on-call shift | 10 | 10 | **10** | Same alert parts |
| C-Ops · "No data" from the pipeline | 5 | 3 | **4** | One click to open Alerts; the most urgent alert is already selected |
| C-App · "Are my missing logs my fault?" | 2 | 2 | **2** | Goal card, then choose the environment |
| D-App · Check a log line and settings | — | — | **4** | New in v0.3 |
| D-Ops · Jump by ID, hand over, find an owner | — | — | **7** | New in v0.3 |
| Recovery · Errors and bad identifiers | 6 | 6 | **6** | Same handling |

v0.3 is not the lowest count in every row, and that is deliberate in two places. DevOps Home is no longer the alert console, so C-Ops costs one click more than the Console did; in exchange Home is the same kind of screen for both roles. A-Ops costs one more than Guided because the responder sends the owning team a draft to review rather than an empty request, which moves work *off* the team that has to write the procedure.

Fewer interactions is not the same as easier. Counts say nothing about whether someone understood what they were looking at.

### Risks of one interface

- **Density on the alerts screen.** A first-time on-call developer sees the list, the alert and the ownership panel together. Mitigation: the "Next step" box is the first thing in the alert pane, and on narrow screens only one pane shows. Worth testing with real first-timers.
- **Discoverability of the box.** People may not expect a search-shaped box to take pasted logs or questions. Mitigation: the Home heading says so, the placeholder gives an example, and there are example chips. Worth testing.
- **Single-key shortcuts** can surprise people using speech input. They can be turned off (WCAG 2.1.4), don't fire while typing, and none of them triggers an approval, resolution or incident link.
- **The alert list re-sorts** when an alert is acknowledged (unacknowledged first). The selection follows the alert, but the row moves.
- **No density preference.** Someone who wants a more compact or more spacious product can't ask for one. That was a deliberate trade for having no modes.

---

## 6. Feature reviews

Each feature is reviewed against the eight UX questions in the brief:

1. Primary user and goal
2. Problem it solves
3. Simplest successful journey
4. Steps and information removed
5. Success, failure and incomplete-data states
6. Does the user understand what happened and what to do next?
7. Beginner and experienced perspectives
8. Does it reduce stakeholder involvement, or just move it?

### F1 · Home: "What do you need to do?"

| | |
|---|---|
| **Primary user and goal** | Both. App team: "What needs me today, and how do I start?" DevOps: "What's most urgent, and is any of it a telemetry problem?" |
| **Problem** | Work is scattered across alert tools, tickets, chat and the registry. People check five places, or wait to be chased. A newcomer doesn't know which screen their task belongs to. |
| **Simplest journey** | Open OperA → type or paste in the box, or pick a goal card → one step takes you to the exact place to act. Below that, *Needs you* lists what's waiting, most urgent first. |
| **Removed** | Separate dashboards for alerts and requests. Choosing a layout. Things waiting on *other* people are in a separate *Waiting on someone else* list, so they don't compete for attention. |
| **States** | Success: "Nothing needs you right now." Failure: a list fails to load and shows an error that says paging is unaffected (Prototype controls → Unavailable). Incomplete: a one-line telemetry strip appears when one of *your* applications is affected, ending "A platform problem, not yours to fix." Readiness gaps appear in *Needs you* with a link to close them. |
| **What happened, what next** | Every item has a *why* line and one call to action. Each application card shows "4 of 6 ready" and what's missing. |
| **Beginner / expert** | Beginner: goal cards in plain words, example chips, and a "New to observability?" primer that explains metrics, logs and traces in one sentence each. Expert: the box, and (DevOps) stat tiles that link straight to filtered alert lists. |
| **Stakeholder involvement** | **Reduces.** People stop asking "is anything waiting on me?" Requests waiting on approvers name the approver, so nobody has to guess who to chase. |

### F2 · Application pages (the centre of the product)

| | |
|---|---|
| **Primary user and goal** | Both. "Show me everything about this application in one place." |
| **Problem** | Ownership, coverage, alerts and procedures live in different systems with different identifiers. |
| **Simplest journey** | Search by name or CAMR ID → application page: who owns it, coverage per environment, open alerts, requests, procedures, routing. |
| **Removed** | Re-typing identifiers between tools. Environment tabs replace three separate coverage pages. |
| **States** | Success: full coverage table. Failure: an unknown CAMR ID gets a clear "not found" page with the ID format and next steps. Retired applications are labelled and onboarding is blocked, with the reason. Incomplete: coverage chips show *Not set up* or *Partial* (arriving without required attributes), plus *Missing* or *Delayed* when a platform incident affects freshness. A row with gaps has a **Set up** button that opens onboarding pre-filled. |
| **What happened, what next** | Coverage gaps carry their own action. Ownership has "Report wrong or missing details", routed to the app owner. |
| **Beginner / expert** | Beginner: plain labels ("Not set up"). Expert: routing card (region, collector pool, per-signal lag). |
| **Stakeholder involvement** | **Reduces.** "Who owns X?" and "Is X onboarded?" become self-serve. Registry corrections go straight to the one person who can make them, instead of a general channel. |

### F3 · Onboarding on one page

| | |
|---|---|
| **Primary user and goal** | App team developer with limited observability experience: "Get telemetry flowing for my service without opening a ticket." |
| **Problem** | Onboarding usually needs a platform engineer to explain prerequisites, write configuration and debug why data isn't showing up. |
| **Simplest journey** | Four numbered sections on one page: **1 Which part of your application?** (pick your app from quick picks; service, component and environment come from the registry, and single options are selected for you) → **2 What do you want to collect?** (recommended signals already ticked) → **3 Add these settings and deploy** (pre-filled; copy) → **4 Check that data arrives**. Then Submit. 8 interactions in the realistic scenario, including two re-checks. |
| **Removed** | The wizard's three Continue clicks and its separate Review step: what Review said (approval, what happens next) is now in the "What's left" panel beside the form the whole time. Typing the CAMR ID, service names, collector endpoints or attribute strings. Picking a component when there is only one. "Do you meet the prerequisites?" questions, replaced by automatic validation. |
| **States** | Success: all checks pass and the panel says "Approved automatically" (dev and qa from the owning team). Failure: blocking failures (collector unreachable, missing `camr.id`) stop submission with a fix. Non-blocking failures (logs not JSON) can be submitted and tracked as *Needs your action*. Incomplete: "No data yet" is a *waiting* state, not a failure, and OperA keeps checking for 30 minutes after submission. Other cases: unknown CAMR ID, malformed CAMR ID (forgiving search plus format hint), retired application, service not in the registry, environment already fully set up (disabled with explanation), not a member of the owning team (allowed, but needs owner approval), an unfinished draft for a different application (asks before replacing it). |
| **What happened, what next** | "What's left" ticks off application, service and component, environment, signals and checks as you go, and says whether approval is needed. Submitting with something missing shows a GOV.UK-style error summary, focused, listing every problem at once with a link to each field. The draft saves automatically. |
| **Beginner / expert** | Beginner: "What's a…?" toggles, "How do I check?" per prerequisite, "What does this do?" for the settings. Expert: deep links (`#/onboard?app=…&service=…&env=…`) from coverage gaps and from the box fill the page in; Kubernetes, environment-variable and VM variants are tabs with the registry's platform pre-selected; **onboard as code** (F16). |
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

### F6 · Alerts on one screen

| | |
|---|---|
| **Primary user and goal** | DevOps: "What do I handle first, and should I page anyone?" App on-call: "What's wrong with my application and what am I allowed to do?" |
| **Problem** | Queues sorted by time hide severity. They don't show ownership gaps or whether the data itself is trustworthy. Opening an alert on its own page loses the queue. |
| **Simplest journey** | Open Alerts: the list is sorted by severity → unacknowledged → age, and the most urgent alert is already open beside it, with the responsible team in a third column. Each row shows an **App or telemetry?** chip and any "No on-call" or "No procedure" gap. |
| **Removed** | A page change between the queue and each alert. Opening each alert to find the owner. Separate lookups in the registry and on-call tool. |
| **States** | Telemetry incident strip above the list. Empty ("No alerts match these filters" with a way to clear them). Unavailable ("Paging still works" reassurance). On a narrow screen: the list, then the alert, one at a time. |
| **What happened, what next** | The alert pane opens with a "Next step" box in plain language. Filters (status, mine or all, application, telemetry-related, gaps) live in the URL, so a filtered list can be shared and survives moving between alerts. |
| **Beginner / expert** | Beginner: application teams start on "Mine"; click a row. Expert: `J`/`K` move through the list, `A` acknowledges, `E` opens escalation, `?` lists the shortcuts. They don't fire while typing and can be turned off. |
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
| **What happened, what next** | The paging dialog requires a reason and shows the exact context packet that will be sent. The card explains what the tier means ("What does Tier 2 mean?"). A standing line, "Customers affected right now? Don't wait for the timers", pages the incident commander directly, so the rule doesn't rely on memory. |
| **Beginner / expert** | Beginner: one recommended person, preselected. Expert: any step on the ladder can be chosen. |
| **Stakeholder involvement** | **Reduces** "what's going on?" follow-ups from the person paged. Registry gaps are reported to the owner in two clicks, so the same gap doesn't cost the next responder. |

### F9 · Handling procedures and approval-gated remediation

| | |
|---|---|
| **Primary user and goal** | DevOps and app on-call: "What's the agreed procedure, and what am I allowed to do?" |
| **Problem** | Runbooks are hard to find, often stale, and risky steps get done without a second pair of eyes. |
| **Simplest journey** | The linked procedure is embedded in the alert. Steps can be ticked off (logged), each step's links open pre-filtered telemetry, and the risky step opens an **approval request**. |
| **Removed** | Hunting for the runbook. Re-typing filters into the logs tool, because each "Open logs/traces" link shows the exact pre-scoped query to paste plus sample results. Opening a dialog to see recent changes: the procedure step that asks for them now shows them inline ("Deploy v2.14.0, 8 minutes before the alert"). A second notification to the same person: when the approver is also next on the escalation path, the approval request and the page go out as one message. |
| **States** | No procedure → falls back to generic triage (RB-000) or telemetry gap (RB-900), with "Draft a procedure from this alert" (F15). Stale procedure (>6 months) → warning to confirm risky steps. Approval: pending → approved or rejected (with reason). The approval form requires a change record (format-checked with a specific error), a reason, and confirmation of blast radius and rollback plan. You can't approve your own request; an alternate approver is used. |
| **What happened, what next** | "Nothing changes until X approves." Every action is recorded on the alert timeline. |
| **Beginner / expert** | Beginner: the *Next* tag on the current step, decision callouts ("If the error rate is above 2%…"), and "What's a change record, and how do I get one?" in the approval dialog. Expert: can tick steps out of order. |
| **Stakeholder involvement** | **Keeps** one approver for production changes on purpose (a safeguard). **Removes** the approver's need to ask for context, because the request carries it. |

### F10 · Telemetry health: "Is it me or the platform?"

| | |
|---|---|
| **Primary user and goal** | Both. App team: "My data is missing or late. Did I break something?" DevOps: "Should I page this team, or is it the pipeline?" |
| **Problem** | Platform incidents are announced in a channel that app teams don't read. Teams debug configurations that were never broken, and the Telemetry Platform team answers the same question by hand. |
| **Simplest journey** | The first thing on the page: choose an application and environment → one verdict. **"It's the platform."** (with the incident and its impact) or **"It's probably on your side."** (with a link to Fix-it) → the per-component freshness table as evidence. Below it: incident cards with separate guidance for responders and for application teams, then pipelines by region. |
| **Removed** | Reading incident cards and a region table to work out whether they apply to you. The verdict used to be the last thing on the page; it is now the first. |
| **States** | No incidents ("All telemetry pipelines are healthy"). Delayed (backfills, no loss). Missing (data lost while the incident lasts). Component not registered in that environment. The box and Home's goal card both open the page with the application already chosen. |
| **What happened, what next** | The verdict says whose problem it is and what to do: nothing, or check your settings. |
| **Beginner / expert** | Beginner: one sentence. Expert: freshness per signal per component, lag and drop figures by region, collector pools. |
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

### F13 · Fix-it: check my setup

| | |
|---|---|
| **Primary user and goal** | App team: "Are my log format and my settings right, before I deploy and wait?" |
| **Problem** | The usual way to find a mistake is to deploy, wait, see no data, and ask in chat. The commonest mistakes (plain-text logs, missing `camr.id`, the wrong environment's collector) are mechanical and can be caught from the text alone. |
| **Simplest journey** | Paste a log line or settings into the box or the *Check my setup* page → each finding says what's wrong, why it matters and the fix → copy the corrected settings. |
| **Removed** | A deploy-and-wait cycle per mistake. A question to the platform team. Working out which of several settings is the wrong one. |
| **States** | Everything right ("These settings are right", with a button to continue onboarding that service). Things to fix (each with its fix, plus the full corrected settings when OperA can work them out). Worth changing (warnings, such as 100% trace sampling in prod). Partial ("Nothing wrong in what you pasted", when not every setting was visible). Not recognised (says what Fix-it can check, and points questions to the box). When the environment can't be known, no correction is offered rather than a guess. |
| **What happened, what next** | Results take focus and are announced. The summary says "1 thing to fix before you deploy" and "Nothing has been changed for you." |
| **Beginner / expert** | Beginner: five examples to try, one click each. Expert: accepts environment variables, Kubernetes YAML, an agent command, an OperA command or an `opera.yaml`; paste and read. |
| **Stakeholder involvement** | **Reduces.** The fix arrives without anyone being asked. |

Fix-it checks against the application registry, so it knows that `rewards-api` belongs to CAMR-108840, which components it has, which environments it's registered in, and which collector its region uses. It is a fixed set of rules running in the browser, not a language model, and nothing pasted leaves the page. The rules are unit-tested, including a test that every configuration OperA generates passes its own checks.

### F14 · Coverage review and incident readiness

| | |
|---|---|
| **Primary user and goal** | App owner or developer: "Would a responder be able to investigate my application tonight?" DevOps: "Which applications would be hard to investigate?" |
| **Problem** | Coverage is usually a grid of ticks nobody reads until an incident shows the gap. "Onboarded" doesn't mean "ready": an application with metrics but no on-call and no procedure is not ready. |
| **Simplest journey** | Coverage → each application shows "4 of 6 ready" and the six checks: metrics, logs and traces in production (or the highest environment it runs in), data linked to the application, on-call registered, a current handling procedure. Each gap has a link that fixes it. |
| **Removed** | Reading a component × environment grid to work out what matters. Opening onboarding and filling it in: a gap's link opens onboarding with that component and environment chosen. |
| **States** | All ready. Gaps (with the affected components named). In progress (onboarding under way). Empty (no applications to review). *Mine* or *All*. |
| **What happened, what next** | Each failed check says what's missing in a sentence and where to fix it. The board beside it shows every component in every environment for people who want the whole picture. |
| **Beginner / expert** | Beginner: six plain checks and a count. Expert: the board, with `M`, `L`, `T` cells that link to onboarding. |
| **Stakeholder involvement** | **Reduces** discovery of gaps mid-incident. Application teams see their own gaps on Home under *Needs you*, so DevOps doesn't have to chase them. |

The six checks are equally weighted and the list is a design proposal. It should be agreed with operations before it's treated as a standard.

### F15 · Handoff note and procedure draft

| | |
|---|---|
| **Primary user and goal** | DevOps and app on-call: "Hand this alert over without making the next person start again", and "leave a procedure behind so the next alert like this is easier." |
| **Problem** | Handoffs are typed from memory into chat and lose facts. Alerts with no procedure stay that way, because the team who should write one wasn't there and the person who was has moved on. |
| **Simplest journey** | **Write handoff note** on an alert → a note already filled from the alert's record: status and owner; what's known (summary, impact, the assessment and its strongest evidence); what's been done (procedure steps, pages, approval requests, notes); and what's next (the next step, the next escalation, the procedure) → edit, copy, or save to the alert's activity. For an alert with no procedure: **Draft a procedure from this alert** → a draft built from the steps taken → **Send draft to** the owning team. |
| **Removed** | Re-typing what the alert already knows. For the owning team: starting a procedure from a blank page with no record of what worked. |
| **States** | The note and the draft are editable before anything is saved or sent. An empty draft can't be sent. A draft is never published from here: the owning team reviews, corrects and publishes it. |
| **What happened, what next** | Both are recorded on the alert's activity, with who and when. |
| **Beginner / expert** | Beginner: a complete note without knowing what a good handoff contains. Expert: edit freely; it's plain text. |
| **Stakeholder involvement** | **Reduces** follow-up questions to the previous responder. The procedure draft **moves work in the right direction**: v0.2 sent the owning team a request to write a procedure; v0.3 sends them a draft to review. |

### F16 · Onboard as code

| | |
|---|---|
| **Primary user and goal** | Experienced developer or platform-minded team: "I don't want to click through this for twelve services. Give me something I can commit." |
| **Problem** | A form is right for the first service and tedious for the tenth. Teams that manage configuration in a repository want onboarding there too. |
| **Simplest journey** | On the onboarding page, under the settings: "Prefer to do this from code or a pipeline?" → an `opera.yaml` to commit, or one `opera onboard …` command, filled with the same values as the form. |
| **Removed** | Repeating the form per service. Translating what the form did into a file by hand. |
| **States** | The file and command always match what's selected on the page. Both can be pasted into Fix-it and checked. |
| **What happened, what next** | The text says what each one does and that approvals still apply: production still needs the app owner. |
| **Beginner / expert** | Beginner: closed by default; nothing to understand. Expert: one click from the form they're already on. |
| **Stakeholder involvement** | Neutral. The same approvals apply whichever way the request is made. |

The command-line tool and the manifest format are illustrative. The prototype shows the shape of the feature; it doesn't ship a CLI.

---

## 7. AI and MCP integration design

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

## 8. Operational safeguards preserved

| Safeguard | Where |
|---|---|
| Two-person rule for production remediation, with change record | Alert → procedure → *Request approval* |
| You can't approve your own request | Alternate approver chosen automatically |
| Production onboarding needs app owner approval | Onboarding page ("What's left" panel), request tracker |
| Non-members of the owning team need owner approval even in dev/qa | Onboarding page, section 1 |
| Retired applications and unregistered services can't be onboarded | Onboarding page, section 1; Fix-it says so too |
| Paging hold for telemetry-caused alerts is **opt-in**, and auto-reopens 15 min after the incident resolves | *Link to incident* dialog |
| Escalation timers per tier, visible and actionable | Escalation path card |
| Every action recorded with who and when | Alert activity, request activity |
| Reminders are rate-limited | Request tracker (once per 24 h) |
| Fix-it never changes anything | It shows corrected settings to copy. Applying them is the developer's deploy. |
| A drafted procedure is not a published procedure | The owning team reviews and publishes it |
| The box and keyboard shortcuts can't approve, resolve or link an incident | Those stay behind their dialogs |
| Onboarding as code uses the same approvals | Production still needs the app owner |

---

## 9. Platform and telemetry assumptions

- **OpenTelemetry** is the standard. Required resource attributes are `service.name`, `deployment.environment`, `camr.id` and `app.component`. Data without `camr.id` is shown as *Partial* because it can't be linked to an owner.
- **Collectors run in regional pools.** The registry records each application's region and pool, which is how incidents are mapped to applications.
- **Validation taps data at the collector gateway**, before indexing. That's why validation can pass while search is delayed, and the UI says so.
- **Freshness per signal:** Arriving normally, Delayed, Missing or partial, Arriving with attributes missing, Not set up. The same model drives coverage pages, health checks and the alert assessment, so the screens can't disagree.

---

## 10. Accessibility

Target: **WCAG 2.2 AA**.

**Automated (axe-core 4.14).** 0 violations, in light and dark:

- 190 screens and states: every route in both roles, empty and unavailable states, the box with its suggestions open, every Fix-it result, onboarding with errors and with validation results, the help, approval, escalation, handoff, procedure-draft, telemetry-explorer, shortcuts and resolve dialogs, the assistant, the prototype panel, the alerts screen and the open menu at tablet width, and five screens at phone width.
- 88 more at 320 px and 800 px wide (11 screens × 2 roles × 2 widths × 2 appearances).

The dark appearance was designed for contrast, not flipped from the light one: text is at least 4.5:1 and control boundaries at least 3:1 on the dark surfaces, and filled buttons use separate fill colours so white text stays readable.

Issues the audits and checks found, all fixed:

- v0.1: logo link name didn't match its visible text; prototype notice outside a landmark; skipped heading level in fix guidance; scrollable context packet not keyboard-reachable.
- v0.2: the assistant button lost its accessible name when its label was hidden; the user chip had a label without a role; a few standalone links were under 24 px tall; a wide table couldn't be scrolled by keyboard on a phone-width screen.
- v0.3: the logo link lost its name at phone width; the navigation row was clipped on laptop-width screens (now fits from 1101 px, a menu below that); "Show data as a table", the primer and the application names on Coverage were under 24 px tall; Home scrolled sideways at 320 px; the closed phone menu could still be reached with Tab; opening it didn't move focus into it.

**Scripted keyboard and layout checks.** 27 checks per appearance, all pass in both, plus 7 for the phone menu:

- Skip link is the first Tab stop and moves focus to main without changing the route.
- On route changes, focus moves to the new page's heading so screen readers announce it. On the alerts screen that heading is the selected alert's title.
- Visible focus ring on 50 consecutive Tab stops.
- **The box** follows the combobox pattern: `Ctrl`+`K` focuses it; it opens with starting points; arrow keys move the active option while focus stays in the field; exactly one option is selected; Escape closes the list and keeps the text; Enter runs the best match and focus lands on the new page's heading.
- Dialogs: open with Enter, keep focus inside, close with Escape, and return focus to the trigger (or its re-rendered twin).
- Invalid submissions focus the first invalid field (`aria-invalid`, linked error text). Onboarding focuses a linked error summary, and keeps focus on the control just used as the page updates around it.
- Fix-it results take focus, so they are read out.
- Tabs follow the WAI-ARIA tabs pattern (arrow keys, Home, End).
- Charts can be read by keyboard and have a text summary plus a "Show data as a table" alternative.
- The appearance button works by keyboard and reports its state (`aria-pressed`).
- Single-key shortcuts don't fire while typing in a field, and can be turned off (WCAG 2.1.4).
- Standalone targets are at least 24 × 24 px (WCAG 2.2 2.5.8).
- No horizontal page scrolling at 320, 800, 1101 or 1280 px wide (1.4.10 Reflow), and the navigation row isn't clipped. Wide tables scroll inside their own box, which becomes focusable and labelled when it scrolls.
- Phone menu: skipped by Tab while closed; opens with focus inside; closes on Escape (focus returns to the menu button), on a click outside, and on choosing a link.

**Design-level.** Status is always icon plus text. Severity, environment and verdict chips are readable in greyscale. `prefers-reduced-motion` and `forced-colors` are respected. Live regions announce validation progress, results and toasts. Copy is plain language (short sentences, "you", no jargon without a definition).

**Not yet done.** Manual testing with screen readers (NVDA, JAWS, VoiceOver) and with users with disabilities. Automated tools catch a minority of real issues. See the test plan in `usability-scenarios.md`.

---

## 11. Known limitations and open questions

- **Fictional data, no backend.** All state lives in `localStorage`. Times are generated relative to page load.
- **The box matches keywords, not meaning.** It handles IDs, names, pasted text and a fixed set of intents. Anything else falls through to the scripted assistant or to search. A real product could put a language model behind it, but the deterministic layer should stay first: it is fast, testable and can't invent an answer.
- **Fix-it covers a fixed set of mistakes.** It checks identity (CAMR ID, service, component, environment), the collector address, which signals are on, trace sampling, and log format. It can't see what a service actually emits; that's what the onboarding checks are for.
- **The readiness checks are a proposal.** Six equally weighted checks. Operations should agree the list and whether some matter more.
- **Onboard as code is illustrative.** There is no CLI behind the command.
- **The assistant is scripted.** A real model would need evaluation for answer accuracy, citation faithfulness and refusal behaviour before release.
- **Assessment rules are deliberately simple.** Real pipelines need per-signal data-loss metrics, collector-to-application mapping that's kept current, and a calibrated confidence model.
- **Registry quality is the biggest dependency.** OperA makes gaps visible and reportable, and Fix-it is only as right as the registry. Open question: should repeated gaps (e.g. no on-call for 30 days) escalate to the owning team's manager automatically?
- **Approvals are simulated.** Production needs integration with the change-management system and the paging provider.
- **Open question:** should production onboarding require a passing qa validation first, rather than just recommending it? Stricter is safer but adds a step for teams without qa.
- **Open question:** is one interface right for both a first-time developer and an on-shift responder on the alerts screen? v0.2's answer was two layouts; v0.3's is one screen with the next step first. Only testing with real users settles it.

---

## 12. Suggested next steps

1. Run the usability study in `usability-scenarios.md` with real participants (5–6 per role), including screen reader and keyboard-only users. Record how each participant starts a task (box, goal card or navigation) and whether first-time on-call developers find the alerts screen too dense.
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
| Share of tasks started from the box | The box is being found and trusted |
| Settings checked in Fix-it before the first deploy (%) | Mistakes caught before the wait |
| Applications at 6 of 6 ready | Incident readiness improving |
