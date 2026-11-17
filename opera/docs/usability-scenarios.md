# OperA usability scenarios and design validation

**Prototype v0.3 · November 2026**

> ### ⚠️ These are simulated walkthroughs, not user testing
> Every scenario below was walked through by the design team using **simulated personas** (a cognitive walkthrough), then re-run as a **script** (`opera/tests/walkthroughs.js`) that drives the prototype in a real browser and counts interactions.
>
> **No real users took part. Nothing here is user feedback, and the ratings are design judgements, not measured outcomes.** They tell us where the design is most likely to work or fail, so that real testing (section 5) can focus there.
>
> **What changed in v0.3:** the two layouts of v0.2 (Guided and Console) are replaced by **one interface for everyone**. There is a new workflow, **D. Ask, paste or jump**, with its own application-team and DevOps scenarios. Every scenario was walked through again and every interaction count re-measured.

---

## 1. Method

**Personas** (simulated; see `design-review.md` § 2):

- **Jordan Kim**: application developer, limited observability experience, primary on-call for Rewards Engine.
- **Sam Ortiz**: experienced DevOps engineer on shift, handles alerts for applications they don't own.

**Major workflows.** Each has one application-team scenario and one DevOps scenario:

| Workflow | App team scenario | DevOps scenario |
|---|---|---|
| **A. Telemetry onboarding** | A-App: a developer onboards a service without assistance | A-Ops: an alert where onboarding and ownership data are incomplete |
| **B. Alert investigation and response** | B-App: first on-call shift, an alert on your own app | B-Ops: deploy-correlated alert, approval-gated rollback |
| **C. Application or telemetry?** | C-App: "my logs aren't showing up, did I break it?" | C-Ops: "no data" alert caused by the pipeline |
| **D. Ask, paste or jump** (new in v0.3) | D-App: check a log line and hand-edited settings before deploying | D-Ops: jump to an alert by ID, hand it over, find an owner |

**Evaluation criteria** (from the brief):

| Criterion | What we looked for |
|---|---|
| Task completion | Can the persona reach the goal state with no outside help? |
| Clarity of instructions | Is each screen's purpose and next action obvious? Is jargon explained? |
| Unnecessary steps | Interactions that don't move the task forward. Counted by the script. |
| Validation and error recovery | Are errors specific, findable and fixable in place? |
| Required stakeholder assistance | People the persona must involve, and whether each one is *necessary* (a safeguard) or *avoidable* |
| Operational accuracy | Does the path lead to the correct, safe operational outcome (right team, right routing, nothing unapproved)? |
| Accessibility | Can the path be done by keyboard with assistive-technology semantics? (The script uses roles and accessible names only.) |

**Ratings:** ✅ Good · ⚠️ Watch (works, with a risk to validate) · ❌ Problem (must fix)

**One interface.** There is no beginner or expert mode to set up before a scenario. Each walkthrough notes where a newcomer and an experienced person would take different paths on the same screen (see `design-review.md` § 5).

**How to reproduce:** open `#/about` in the prototype and choose **Start** next to a scenario, or run:

```bash
python3 -m http.server 8765          # from the repository root
node opera/tests/walkthroughs.js     # needs the playwright package
```

---

## 2. Results at a glance

Interaction counts were measured by `tests/walkthroughs.js` (one click, typed field, key press, tick or selection = one interaction). All 10 scripted runs pass: the eight scenarios, the recovery scenario, and a keyboard-shortcut check.

### Interactions

| Scenario | v0.2 Guided | v0.2 Console | **v0.3** | Why it changed |
|---|---|---|---|---|
| A-App · Onboard rewards-api to qa | 11 | 8 | **8** (6 from the box) | One page, no Continue clicks. Typing "onboard rewards-api in qa" fills the page in. |
| A-Ops · ALR-2044, incomplete ownership | 10 | 9 | **11** (7 core) | The responder sends a drafted procedure (2) rather than a bare request (1) |
| B-Ops · ALR-2041, rollback | 10 | 9 | **10** (8 without the deliberate error) | Same parts as before |
| B-App · ALR-2045, first on-call | 10 | 10 | **10** | Same alert parts once the alert is open |
| C-Ops · ALR-2042, pipeline "no data" | 5 | 3 | **4** | One click to Alerts; the most urgent alert is already open |
| C-App · "Are my missing logs my fault?" | 2 | 2 | **2** | A goal card on Home, then choose the environment |
| D-App · Check a log line and settings | — | — | **4** | New |
| D-Ops · Jump by ID, hand over, find an owner | — | — | **7** | New |
| Recovery · onboarding errors and bad IDs | 6 | 6 | **6** | Same handling |

Two counts went up from the v0.2 Console, on purpose. C-Ops: DevOps Home is no longer the alert console, so reaching it is one click. A-Ops: the owning team now receives a draft procedure to review instead of a request to write one.

Fewer interactions is not the same as easier. The counts show how much navigation a task needs. They say nothing about whether someone understood the screen.

### Ratings by scenario

| Scenario | Completion | Clarity | Steps | Error recovery | Stakeholders | Accuracy | Accessibility | Watch |
|---|---|---|---|---|---|---|---|---|
| A-App | ✅ | ✅ | ✅ | ✅ | ✅ 0 people | ✅ | ✅ | Will a newcomer scroll a long page as confidently as they followed a wizard? |
| A-Ops | ✅ | ✅ | ✅ | ✅ | ✅ 1 page, necessary | ✅ | ✅ | Will owning teams act on drafts? |
| B-Ops | ✅ | ✅ | ✅ | ✅ | ✅ 1 notification | ✅ | ✅ | |
| B-App | ✅ | ⚠️ | ✅ | ✅ | ✅ 1 approver, necessary | ✅ | ✅ | A first-timer sees the list, the alert and ownership together |
| C-Ops | ✅ | ✅ | ✅ | ✅ | ✅ 0 pages (1 avoided) | ✅ | ✅ | |
| C-App | ✅ | ✅ | ✅ | n/a | ✅ 0 people | ✅ | ✅ | |
| D-App | ✅ | ✅ | ✅ | ✅ | ✅ 0 people | ✅ | ✅ | Will people think to paste into a search-shaped box? |
| D-Ops | ✅ | ✅ | ✅ | ✅ | ✅ 0 people asked | ✅ | ✅ | Will responders trust a generated handoff note enough to send it? |
| Recovery | ✅ | ✅ | ✅ | ✅ | n/a | ✅ | ✅ | |

---

## 3. Scenarios

### A-App · A developer onboards telemetry without assistance

**Persona:** Jordan Kim (application team, new to observability)
**Goal:** Get metrics, logs and traces flowing for `rewards-api` in **qa**, without asking anyone.
**Start:** Home → *Onboard*
**Built-in difficulty:** logs fail on the first check (plain-text logs); traces haven't arrived yet (no traffic).
**Done when:** the request is submitted and moving to set-up with nothing left for Jordan to do.

**Walkthrough (8 interactions):**

| # | Action | What Jordan sees |
|---|---|---|
| 1 | Onboard | One page with four numbered sections and a "What's left" checklist. Section 1 offers *Your applications* quick picks. |
| 2 | Pick *Rewards Engine · CAMR-108840* | Selected-app confirmation (team, owner, tier). "What's a CAMR ID?" help if needed. Services appear. |
| 3 | Choose service `rewards-api` | Component selected for Jordan ("the only component of rewards-api, so it's selected for you") |
| 4 | Choose `qa` | Each environment shows what's already set up; prod is marked "Needs approval". Sections 2 and 3 fill in: recommended signals **already ticked**, settings pre-filled (Kubernetes tab chosen from the registry). "What's left" says **Approved automatically**. |
| 5 | Run checks | Progress announced. 4 passed, logs **Needs your action**, traces **Waiting for data**. |
| 6 | *I've fixed it, check again* (logs) | Logs pass, with a platform note: search is about 11 min behind (TEL-553), nothing to fix |
| 7 | *Check again* (traces) | Traces pass |
| 8 | Submit request | Request page: "Nothing for you to do. Setting up automatically." |

**Other ways in, on the same screen.** Typing `onboard rewards-api in qa` in the box and pressing Enter opens the page with steps 2 to 4 done: **6 interactions** (measured). The "Set up telemetry" goal card does the same as step 1. Someone who manages settings in a repository can open "Prefer to do this from code or a pipeline?" under the settings and copy an `opera.yaml` instead.

| Criterion | Rating | Evidence |
|---|---|---|
| Task completion | ✅ | Completed with no outside help. Every failure state has an in-place fix. |
| Clarity of instructions | ✅ | Sections are numbered and fill in as Jordan goes, and "What's left" names the one thing to do next. Glossary toggles for CAMR ID, service, component, environment and each signal. "What does this do?" explains the settings. |
| Unnecessary steps | ✅ | 2 of 8 are re-checks that are part of the task. The wizard's three Continue clicks are gone; what its Review step said is in the "What's left" panel throughout. |
| Validation and error recovery | ✅ | Logs failure shows the actual bad line received, the cause and a copyable fix. "Waiting" is clearly not an error. Blocking failures (Prototype controls → *Collector unreachable* / *Missing camr.id*) block submission with a fix. **Get help** (diagnostics attached) is offered on every failure. Submitting early lists every missing item at once. |
| Stakeholder assistance | ✅ | **0 people.** qa is auto-approved for the owning team. |
| Operational accuracy | ✅ | Generated settings carry all required attributes, the region-correct collector address and environment-appropriate sampling (1.0 in qa, 0.1 in prod). A unit test confirms every generated configuration passes Fix-it's own rules. The platform-incident note stops Jordan "fixing" working logs. |
| Accessibility | ✅ | Completed using only roles and accessible names. Focus stays on the control just used while the page updates around it. Progress and results announced. Error summary focused and linked. |

**Changes made after this walkthrough**

- v0.1: recommended signals are pre-selected; the failed-check next step names the fix; the error summary receives focus.
- v0.3: the wizard became one page. Choosing a service or environment re-renders the page; a scripted check confirms keyboard focus stays on the control just used.

**Risks to validate with real users**

- A long page instead of a wizard: do newcomers notice sections 2 and 3 filling in below their choice? The "What's left" panel is the mitigation.
- Developers who don't own their Kubernetes manifests may stall at the settings. Test whether "Environment variables" is a better default for them.
- The JSON-logging fix assumes Java/Logback first. Check that Node.js and Python developers find their path.
- "I've fixed it, check again": will people redeploy before re-checking? The real product should detect "no new deploy since the last check".

---

### A-Ops · An alert where ownership and onboarding data are incomplete

**Persona:** Sam Ortiz (DevOps, on shift)
**Goal:** Handle **ALR-2044**: Merchant Portal 5xx at 6%. Find the responsible team, the procedure and the right next action, when the registry has **no on-call schedule**, there's **no procedure**, and **traces arrive without required attributes**.
**Start:** Home → *Alerts*
**Done when:** the right contact has been reached with context, and the gaps are reported so the next responder isn't stuck.

**Walkthrough (11 interactions; 7 to handle the alert, 4 to fix gaps for next time):**

| # | Action | What Sam sees |
|---|---|---|
| 1 | Alerts | The list, with the most urgent alert open beside it. The ALR-2044 row carries **No on-call** and **No procedure** chips. |
| 2 | Choose ALR-2044 in the list | Assessment: likely application (traces "arriving, attributes missing" lowers confidence). Ownership warning with fallback guidance. "No procedure is linked", so generic triage is used. |
| 3 | Acknowledge | Owner set; escalation ladder: support group after 60 min, incident commander after 120 min |
| 4–7 | Escalate → choose *SG-MERCHANT-EXP* (business hours) → reason → Send | Context packet attached automatically |
| 8–9 | Report wrong or missing details → Send to registry owner | Routed to the app owner (Taylor Brooks), not a general channel |
| 10 | Draft a procedure from this alert | A draft built from what Sam just did, editable. "Nothing is published from here." |
| 11 | Send draft to Merchant Experience | Goes to the app owner to review and publish. Logged on the alert timeline. |

| Criterion | Rating | Evidence |
|---|---|---|
| Task completion | ✅ | Correct contact reached. Gaps reported. |
| Clarity of instructions | ✅ | The gap is stated plainly, with what to do instead. Generic triage steps are actionable. |
| Unnecessary steps | ✅ | The 4 gap-fixing interactions are optional for the incident but stop the next responder repeating it. One more than v0.2, because Sam sends a draft rather than a request. |
| Validation and error recovery | ✅ | Paging needs a reason (validated). The support group is labelled "business hours only". |
| Stakeholder assistance | ✅ | 1 page (necessary). The registry report goes straight to the owner. The owning team gets a procedure draft to review instead of a request to write one from nothing. |
| Operational accuracy | ✅ | The fallback is correct. The escalation card now carries a standing rule: "Customers affected right now? Don't wait for the timers", which pages the incident commander directly. |
| Accessibility | ✅ | Role/name-only run. Dialog focus is managed. |

**Changes made after this walkthrough**

- The ownership warning told Sam to "contact the incident commander if customers are affected", but the Tier 3 escalation path never reached the incident commander. **Added the incident commander to the Tier 3 path** (after 120 min). The warning text keeps the "sooner if customers are affected" judgement call.

**Risks to validate**

- After hours, with customer impact, the support group can't be reached. The card now says to page the incident commander without waiting (v0.2). Still to validate: do responders notice and use it, and should it become an automatic rule ("customer impact > X% → IC now")?
- Will owners act on registry reports and procedure drafts? This needs a follow-up mechanism (see open questions in `design-review.md` § 11).
- Is a draft written by a responder mid-incident good enough to be worth reviewing, or does it need a prompt to add what they'd do differently?

---

### B-Ops · Deploy-correlated alert with an approval-gated rollback

**Persona:** Sam Ortiz
**Goal:** Handle **ALR-2041**: Checkout API p99 latency at 1.9 s, 18 minutes in. Determine the cause, take the appropriate action **without running anything unapproved**, and escalate on time.
**Start:** Home → *Alerts*
**Done when:** rollback approval is requested with a valid change record, and the due escalation has gone out with context.

**Walkthrough (10 interactions, including one deliberate mistake):**

| # | Action | What Sam sees |
|---|---|---|
| 1–2 | Alerts → choose ALR-2041 in the list | Next step: "Acknowledge… Escalation is due now: Priya Raman". Assessment: application, high confidence. Evidence: deploy v2.14.0 **8 minutes before** the alert; 71% of slow traces wait on checkout-pricing. |
| 3 | Acknowledge | Procedure RB-101 with step 1 marked *Next*. Step 2 ("Check for recent changes") already shows the deploy, flagged "Just before the alert". Nothing to open. |
| 4 | Request rollback | Approval dialog: action, target, blast radius, rollback plan, approver. "Nothing changes until Priya Raman approves." **"Also page Priya Raman now, in the same notification"** is ticked, because Priya is due on the escalation path. |
| 5–8 | Change record `204118` (wrong format), reason, confirm, submit | Specific error: "'204118' isn't a change record number. It should look like CHG-204118." Focus moves to the field. "What's a change record, and how do I get one?" is beside it. |
| 9–10 | Fix to `CHG-204118` → resubmit | "Waiting for Priya Raman". Activity: "Paged Priya Raman and requested approval in one notification". The escalation ladder shows Priya as paged. |

| Criterion | Rating | Evidence |
|---|---|---|
| Task completion | ✅ | Rollback requested correctly. Escalation sent on time, in the same action. |
| Clarity of instructions | ✅ | Next step names both the action and the due escalation. The procedure's decision callout covers the "errors too?" branch. |
| Unnecessary steps | ✅ | v0.1 needed 15 interactions. Showing the deploy inline removed 2, and combining the page with the approval request removed 3. An experienced responder can do steps 1 to 3 from the keyboard (`J`, `A`) or type `alr2041` in the box. |
| Validation and error recovery | ✅ | Format error is specific, focused and fixable without losing the other fields. |
| Stakeholder assistance | ✅ | Priya gets **one** notification carrying both the page and the approval request. The option can be unticked if a page isn't wanted. |
| Operational accuracy | ✅ | Nothing ran. Approver is the app on-call. Tier 1 timer (15 min) is correct. You can't approve your own request. |
| Accessibility | ✅ | Dialog opens with Enter, traps focus, Escape returns focus. Invalid field gets `aria-invalid` plus linked error. |

**Changes made after the v0.1 walkthrough (both now fixed)**

- Recent changes are shown inside the procedure step that asks for them.
- When the approver is also next on the escalation path, the page and the approval request are one notification.

---

### B-App · First on-call shift: an alert on your own application

**Persona:** Jordan Kim, primary on-call for Rewards Engine for the first time
**Goal:** **ALR-2045**: points accrual lag at 22 min. Understand what's wrong and what Jordan is allowed to do.
**Start:** Home (*Needs you* lists the alert first: "You're primary on-call for Rewards Engine")
**Done when:** the procedure is followed and the stuck-scheduler restart is requested from the right approver.

**Walkthrough (10 interactions):**

| # | Action | What Jordan sees |
|---|---|---|
| 1 | Open alert (from Home) | Summary, impact ("no points are lost"), assessment: application, **medium** confidence, because logs and traces aren't set up in prod |
| 2 | Ask OperA to summarize | Plain-language summary with sources, 4 read-only tool calls, and one suggested action: "Restart rewards-worker scheduler, needs approval from Alex Morgan" |
| 3 | Acknowledge | |
| 4–5 | Tick procedure steps 1 and 2 | Each is logged for the next responder |
| 6–10 | Request restart → change record → reason → confirm → submit | "Nothing changes until Alex Morgan approves" |

| Criterion | Rating | Evidence |
|---|---|---|
| Task completion | ✅ | Correct action requested from the correct approver. |
| Clarity of instructions | ⚠️ | The "Next step" box is the first thing in the alert, and the terms a first-timer may not know are explained where they appear: "What does Tier 2 mean?" on the escalation card, and "What's a change record, and how do I get one?" in the approval dialog. The risk: on a wide screen Jordan sees the alert list, the alert and the ownership panel together. For Jordan the list is short (one alert, filtered to *Mine*), which helps. Validate with real first-timers. |
| Unnecessary steps | ✅ | Ticking steps is optional but gives the hand-off a record. |
| Validation and error recovery | ✅ | Same approval validations as B-Ops. |
| Stakeholder assistance | ✅ | 1 approver (necessary). No platform team involved. |
| Operational accuracy | ✅ | App owner approves. The assistant suggested, never acted. Gaps in evidence are shown, with a link to onboard logs and traces afterwards. |
| Accessibility | ✅ | Assistant answer is announced (live log) and scrolled to its start. |

**Changes made after this walkthrough**

- The assistant scrolled to the *end* of long answers, so the summary's first lines were hidden. It now scrolls to the start of the newest answer.
- With the assistant open, the alert page kept its two-column layout and squeezed the chart. The layout now responds to the space actually available (container queries).

**Risks to validate:** the dialog now explains how to get a change record (create an emergency change, or ask the approver to attach one). Is that enough at 3 a.m., or should the product create one itself?

---

### C-Ops · A "no data" alert caused by the telemetry pipeline

**Persona:** Sam Ortiz
**Goal:** **ALR-2042**: Ledger Sync reconciliation throughput, *no data* for 30 min (Critical). Decide whether to page Core Ledger.
**Start:** Home → *Alerts* (the row is already marked **Telemetry issue**)
**Done when:** the alert is linked to the telemetry incident, and the application team is not paged.

**Walkthrough (4 interactions):** Alerts (the most urgent alert, this one, is already open) → *Link to TEL-552* (the next step) → tick "Hold paging Core Ledger…" → confirm.

| Criterion | Rating | Evidence |
|---|---|---|
| Task completion | ✅ | Linked, with paging held. |
| Clarity of instructions | ✅ | Headline "Likely a telemetry problem, not the application". Evidence: metrics missing (TEL-552); logs fresh and showing reconcile batches completing with 0 errors. |
| Unnecessary steps | ✅ | 4: one to reach the alerts, three for a deliberate, confirmed decision. |
| Validation and error recovery | ✅ | Paging hold is opt-in and auto-reopens 15 min after the incident resolves if the alert still fires. |
| Stakeholder assistance | ✅ | **0 pages. One wrong page avoided** (Core Ledger), and one redundant page avoided (Telemetry on-call, already on TEL-552). |
| Operational accuracy | ✅ | A critical alert isn't silenced, just correctly attributed. The safety net reopens it. |
| Accessibility | ✅ | |

**Changes made after this walkthrough**

- The escalation ladder showed "Page Kai Rivera — **Due now**", though Kai was already running TEL-552. It now shows **"Already on it — no need to page."**
- In the related ALR-2040 (*Unclear* assessment), the next step said "Escalation is due now: page Tom Becker", contradicting the guidance to check logs first. It now says: "Acknowledge, then check logs and traces before paging Core Ledger. This alert's own data is unreliable (TEL-552)."

---

### C-App · "My logs aren't showing up. Did I break it?"

**Persona:** Jordan Kim, just after onboarding qa
**Goal:** Find out whether missing logs in search are Jordan's fault.
**Start:** Home (a one-line strip: "1 telemetry incident: TEL-553 Log ingestion delayed in EU Central. A platform problem, not yours to fix.")
**Done when:** Jordan knows it's the platform and that nothing needs changing.

**Walkthrough (2 interactions):** the goal card *Is it me or the platform?* (Rewards Engine is already chosen) → choose `qa` → "Rewards Engine is affected by TEL-553… **It's the platform.** … Loyalty Engineering doesn't need to change anything."

Typing "why are my logs missing?" in the box offers the same check as its best match.

| Criterion | Rating | Evidence |
|---|---|---|
| Task completion | ✅ | |
| Clarity of instructions | ✅ | The verdict is the first thing on the page and is one sentence. Below it, separate guidance: "If you're responding to alerts" and "If you're on an application team". |
| Unnecessary steps | ✅ | The strip on Home and the note on the validation check often answer this before Jordan navigates at all. |
| Stakeholder assistance | ✅ | 0 people. This is the "is it you or us?" question the Telemetry Platform team usually answers by hand. |
| Operational accuracy | ✅ | Stops a working configuration from being changed. |
| Accessibility | ✅ | Result region is live, so changes are announced. |

---

### D-App · Check a log line and hand-edited settings before deploying

**Persona:** Jordan Kim
**Goal:** Jordan changed the logging and edited the OpenTelemetry settings by hand. Find out whether they're right **before** deploying and waiting.
**Start:** Home
**Done when:** Jordan knows what to change, has the corrected settings, and knows when settings are right.

**Walkthrough (4 interactions):**

| # | Action | What Jordan sees |
|---|---|---|
| 1 | Paste a log line into the box: `2026-11-17 10:02:11 ERROR payment failed order=1182` | Best match: "Check this log line with Fix-it" |
| 2 | Enter | *Check my setup*, with the result focused: "This line is plain text, not JSON, so it can't be searched by field", why that matters, and how to switch the logger to JSON |
| 3 | Try the example *Settings sent to the wrong environment* | "1 thing to fix before you deploy." Five checks pass. **Collector address** fails: "The settings say qa, but the address is the prod collector. Your qa data would land in prod." The corrected line, then the full corrected settings, each with Copy. "Nothing has been changed for you." |
| 4 | Try *Settings that are right* | "These settings are right", with a button to continue onboarding that service |

| Criterion | Rating | Evidence |
|---|---|---|
| Task completion | ✅ | Each mistake is found and its fix shown, without deploying. |
| Clarity of instructions | ✅ | Every finding has a plain title, what's wrong in one sentence, and "How to fix it". Fix-it says how it read the paste ("environment variables for rewards-api in Rewards Engine (qa)"). |
| Unnecessary steps | ✅ | Paste and read. No form, no choosing what kind of text it is. |
| Validation and error recovery | ✅ | Text that isn't a log line or settings gets "OperA didn't recognise this" with what Fix-it can check. Partial settings get "Nothing wrong in what you pasted", not a false all-clear. When the right value can't be known (an unknown environment), no corrected version is offered. |
| Stakeholder assistance | ✅ | **0 people.** This replaces "can someone look at my config?" in the platform channel. |
| Operational accuracy | ✅ | Checked against the registry: the right application, a registered service and component, an environment the service runs in, and the collector for that environment and region. The rules are unit-tested (15 tests). Fix-it never applies a change. |
| Accessibility | ✅ | The result heading takes focus; each finding's state is icon plus text; code blocks have a Copy button with a text label. |

**Risks to validate**

- Will developers think to paste into a box that looks like search? The Home heading, the placeholder and an example chip say so. If not, the *Check my setup* goal card and navigation item still lead there.
- Fix-it can only judge the text. Settings that are right on paper can still fail in a cluster (network, secrets). The copy says "before you deploy", and onboarding's own checks cover what happens after.

---

### D-Ops · Jump to an alert by ID, hand it over, find an owner

**Persona:** Sam Ortiz, near the end of a shift
**Goal:** A colleague messages "ALR-2041?". Get to it, leave a handoff note for the next shift, then answer "who owns Merchant Portal?".
**Start:** Home
**Done when:** the note is on the alert, and Sam has the owning team and on-call situation for Merchant Portal.

**Walkthrough (7 interactions):**

| # | Action | What Sam sees |
|---|---|---|
| 1 | Type `alr2041` in the box (no dash) | Best match: "Open alert ALR-2041 · Checkout API p99 latency above 1.5 s" |
| 2 | Enter | The alert, with the list beside it and Priya Raman (primary on-call) in the ownership panel |
| 3 | Write handoff note | A note already filled in: the alert, application, status; **What we know** (summary, impact, "Likely an application problem", the strongest evidence); **Done so far**; **Next** (next step, the next escalation, the procedure) |
| 4 | Save to the alert's activity | "Handoff note saved." It can also be copied into chat. |
| 5 | `Ctrl`+`K` | Focus in the box |
| 6 | Type `who owns merchant portal` | Best match: "See who owns Merchant Portal · Merchant Experience · no on-call registered" |
| 7 | Enter | The application page: owning team, app owner, and a warning that no on-call schedule is registered |

| Criterion | Rating | Evidence |
|---|---|---|
| Task completion | ✅ | Both questions answered and the handoff recorded. |
| Clarity of instructions | ✅ | Each suggestion says what it will do. The ownership answer is in the suggestion itself, before Sam opens anything. |
| Unnecessary steps | ✅ | No navigation at all: every move starts from the box. Writing the note is one click plus any edits. |
| Validation and error recovery | ✅ | The ID is accepted without its dash. An unknown ID or name still leaves "Search everything", so the box never dead-ends. The note is editable before it's saved. |
| Stakeholder assistance | ✅ | **0 people asked.** The next shift doesn't need to message Sam, and Sam didn't need to ask who owns the application. |
| Operational accuracy | ✅ | The note is built from the alert's record, not from memory, and includes the assessment and what's pending approval. The ownership gap is stated, not hidden. Nothing in the box or the note can approve, resolve or page. |
| Accessibility | ✅ | The box is a standard combobox: options are announced, arrow keys move the active option, focus lands on the new page's heading after Enter. The dialog traps focus and returns it. |

**Risks to validate**

- Will responders send a generated note as it is, or rewrite it? If they rewrite it every time, the template is wrong.
- `Ctrl`+`K` is known to people who use developer tools. Others will click the box, which works the same.

---

### Recovery · Errors and bad identifiers (supporting scenario)

**Walkthrough (6 interactions):**

| # | Action | Outcome |
|---|---|---|
| 1–2 | Onboard → Submit request with nothing chosen | "There's a problem" summary, focused, with links to fields |
| 3 | Type `camr108840` | Forgiving search finds Rewards Engine and explains the correct format |
| 4 | Type `CAMR-123456` | "No application found" with what to check and who registers applications |
| 5–6 | Type `CAMR-099120`, select it | "This application is retired… ask Alex Morgan to reactivate it". Submit is hidden. |

---

## 4. Cross-cutting findings

| # | Finding | Status |
|---|---|---|
| 1 | Error summary not focused (router overrode focus) | ✅ Fixed |
| 2 | Recommended signals not pre-selected | ✅ Fixed |
| 3 | Failed-check next step was vague | ✅ Fixed |
| 4 | Telemetry on-call shown as "due" while already on the incident | ✅ Fixed |
| 5 | "Unclear" alerts recommended paging before checking other signals | ✅ Fixed |
| 6 | Tier 3 escalation path never reached the incident commander | ✅ Fixed |
| 7 | Assistant answers scrolled out of view; layout squeezed with assistant open | ✅ Fixed |
| 8 | axe: logo name mismatch, notice outside landmark, heading skip, unreachable scroll region | ✅ Fixed |
| 9 | Approver and paged on-call can be the same person → two notifications | ✅ Fixed in v0.2 (one combined notification) |
| 10 | Opening "Recent changes" duplicates evidence already shown | ✅ Fixed in v0.2 (shown inside the procedure step) |
| 11 | Organisational terms (tier policy, change record) for first-time on-call | ✅ Fixed in v0.2 (explained where they appear) |
| 12 | After-hours Tier 3 with customer impact relies on judgement | ✅ Fixed in v0.2 (standing "customers affected?" rule on the escalation card). Still worth testing. |
| 13 | At narrow widths the assistant button had no accessible name, and the user chip had a label without a role | ✅ Fixed (found by auditing phone and tablet widths) |
| 14 | A few standalone links were under 24 px tall | ✅ Fixed |
| 15 | A wide table couldn't be scrolled by keyboard on a phone-width screen | ✅ Fixed |
| 16 | Cards in a grid were misaligned by a stray margin | ✅ Fixed |
| 17 | The alert list re-sorts when an alert is acknowledged, so the selected row moves | ⚠️ Open (selection follows the alert; watch in real use) |
| 18 | v0.2 Console: prerequisites and definitions were folded away, which could lose newcomers | ✅ Closed in v0.3 (one interface; help sits beside each choice, in the same place for everyone) |
| 19 | Two layouts cost more to maintain than one, and asked newcomers to choose before they could know | ✅ Closed in v0.3 (one interface, on the product owner's direction) |
| 20 | The navigation row was clipped on laptop-width screens | ✅ Fixed in v0.3 (shorter labels; fits from 1101 px; a menu below that) |
| 21 | The fixed "Prototype controls" button sat on top of page content | ✅ Fixed in v0.3 (moved into the prototype strip at the top) |
| 22 | At phone width the logo link had no accessible name | ✅ Fixed in v0.3 |
| 23 | "Show data as a table", the primer and application names on Coverage were under 24 px tall | ✅ Fixed in v0.3 |
| 24 | Home scrolled sideways at 320 px, and the top bar wrapped unpredictably on phones | ✅ Fixed in v0.3 (two fixed rows on phones) |
| 25 | The closed phone menu could be reached with Tab, and opening it left focus behind it | ✅ Fixed in v0.3 (hidden when closed; opens with focus inside; closes on Escape, a click outside, or choosing a link) |
| 26 | A first-time on-call developer sees the alert list, the alert and ownership together | ⚠️ Open (the next step is first; one pane at a time on narrow screens; test with real first-timers) |
| 27 | Pasting into a search-shaped box may not occur to people | ⚠️ Open (heading, placeholder and example chip say so; *Check my setup* is also a goal card and a navigation item) |
| 28 | A-Ops takes one more interaction than in v0.2 | Accepted (the responder sends a draft procedure, which saves the owning team more than it costs the responder) |

---

## 5. Plan for real usability testing

The scenarios above are the task set. Real testing should check the ⚠️ risks first.

**Participants**

- 5–6 application developers with little or no observability experience, from at least 3 teams and 2 languages (Java plus Node.js or Python).
- 5–6 DevOps or operations engineers who handle alerts for applications they don't own.
- At least 2 participants who use a screen reader, and 1 who uses keyboard only or magnification. Recruit for this; don't assume it.

**How people start:** don't tell participants about the box, the goal cards or the navigation. Record which one each person uses first for each task, and whether they ever paste.

**Format:** 75-minute moderated sessions, think-aloud, on a staging build with realistic but synthetic data. Use the **prototype controls** to set each scenario's state before the session, not in front of the participant.

**Measures**

| Measure | Target for v1 |
|---|---|
| Unassisted completion rate (per scenario) | ≥ 80% |
| Moderator assists | ≤ 1 per session |
| Time on task: A-App onboarding (excluding deploy time) | ≤ 15 min |
| Time to correct decision: C-Ops (page or don't page) | ≤ 2 min |
| Wrong-team pages in B and C scenarios | 0 |
| Single Ease Question (1–7) per task | ≥ 5.5 median |
| System Usability Scale | ≥ 75 |
| Screen reader participants complete A-App, B-Ops and D-Ops | Yes, without workarounds |
| How each task was started (box, goal card, navigation) | Recorded. No target; this shows whether the box is found. |
| D-App: mistakes found before the first deploy | All three, unassisted |
| B-App: first-time on-call participants who read "Next step" before anything else | Recorded |

**Questions to answer**

1. Do developers trust "I've fixed it, check again", or do they open a ticket anyway?
2. Do responders trust the "Application or telemetry?" assessment enough to *not* page? What evidence do they look at first?
3. Is the role-ordered navigation helpful, or confusing for people who do both jobs?
4. Does the assistant reduce questions to platform engineers, or create new "the AI said…" escalations?
5. Does one interface work for both a newcomer and an experienced person, or does either group say it's too much or too little? Where?
6. Do people find the box, and do they paste into it? If not, what did they expect it to do?
7. Do application teams act on the readiness gaps in *Needs you*, and do owning teams publish the procedure drafts they're sent?
