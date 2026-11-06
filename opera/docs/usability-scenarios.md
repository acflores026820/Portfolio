# OperA usability scenarios and design validation

**Prototype v0.1 · November 2026**

> ### ⚠️ These are simulated walkthroughs, not user testing
> Every scenario below was walked through by the design team using **simulated personas** (a cognitive walkthrough), then re-run as a **script** (`opera/tests/walkthroughs.js`) that drives the prototype in a real browser and counts interactions.
>
> **No real users took part. Nothing here is user feedback, and the ratings are design judgements, not measured outcomes.** They tell us where the design is most likely to work or fail, so that real testing (section 5) can focus there.

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

**How to reproduce:** open `#/about` in the prototype and choose **Start** next to a scenario, or run:

```bash
python3 -m http.server 8765          # from the repository root
node opera/tests/walkthroughs.js     # needs the playwright package
```

---

## 2. Results at a glance

Interaction counts were measured by `tests/walkthroughs.js` (one click, typed field, checkbox or selection = one interaction). All seven scripted runs pass.

| Scenario | Interactions | Completion | Clarity | Steps | Error recovery | Stakeholders | Accuracy | Accessibility |
|---|---|---|---|---|---|---|---|---|
| A-App · Onboard rewards-api to qa | 11 | ✅ | ✅ | ✅ | ✅ | ✅ 0 people | ✅ | ✅ |
| A-Ops · ALR-2044, incomplete ownership | 10 (7 core) | ✅ | ✅ | ✅ | ✅ | ✅ 1 page, necessary | ⚠️ | ✅ |
| B-Ops · ALR-2041, rollback | 15 (13 without the deliberate error) | ✅ | ✅ | ⚠️ | ✅ | ⚠️ same person notified twice | ✅ | ✅ |
| B-App · ALR-2045, first on-call | 10 | ✅ | ⚠️ | ✅ | ✅ | ✅ 1 approver, necessary | ✅ | ✅ |
| C-Ops · ALR-2042, pipeline "no data" | 5 | ✅ | ✅ | ✅ | ✅ | ✅ 0 pages (1 avoided) | ✅ | ✅ |
| C-App · "Are my missing logs my fault?" | 2 | ✅ | ✅ | ✅ | n/a | ✅ 0 people | ✅ | ✅ |
| Recovery · wizard errors and bad IDs | 6 | ✅ | ✅ | ✅ | ✅ | n/a | ✅ | ✅ |

---

## 3. Scenarios

### A-App · A developer onboards telemetry without assistance

**Persona:** Jordan Kim (application team, new to observability)
**Goal:** Get metrics, logs and traces flowing for `rewards-api` in **qa**, without asking anyone.
**Start:** Home → *Onboard telemetry*
**Built-in difficulty:** logs fail on the first check (plain-text logs); traces haven't arrived yet (no traffic).
**Done when:** the request is submitted and moving to set-up with nothing left for Jordan to do.

**Walkthrough (11 interactions):**

| # | Action | What Jordan sees |
|---|---|---|
| 1 | Onboard telemetry | Step 1 "Which application?" with *Your applications* quick picks |
| 2 | Pick *Rewards Engine · CAMR-108840* | Selected-app confirmation (team, owner, tier). "What's a CAMR ID?" help if needed. |
| 3 | Choose service `rewards-api` | Component auto-selected ("the only component, so it's selected for you") |
| 4 | Choose `qa` | Each environment shows what's already set up. prod shows "Needs app owner approval". |
| 5 | Continue | Signals step with recommended signals **pre-selected**, plus prerequisites and "How do I check?" |
| 6 | Continue | Configuration pre-filled from the registry (Kubernetes tab pre-selected) |
| 7 | Run checks | Progress announced. 4 passed, logs **Needs your action**, traces **Waiting for data**. |
| 8 | *I've fixed it, check again* (logs) | Logs pass, with a platform note: search is about 11 min behind (TEL-553), nothing to fix |
| 9 | *Check again* (traces) | Traces pass |
| 10 | Continue | Review: summary, "Approved automatically", what happens next |
| 11 | Submit request | Request page: "Nothing for you to do. Setting up automatically." |

| Criterion | Rating | Evidence |
|---|---|---|
| Task completion | ✅ | Completed with no outside help. Every failure state has an in-place fix. |
| Clarity of instructions | ✅ | One decision per screen. Glossary toggles for CAMR ID, service, component, environment and each signal. Every configuration line is explained. |
| Unnecessary steps | ✅ | 2 of 11 are re-checks that are part of the task, and 4 are Continue/Submit. Candidate saving: skip Review for dev/qa when everything passes (−1). Kept, because Review is where approvals and "what happens next" are explained. |
| Validation and error recovery | ✅ | Logs failure shows the actual bad line received, the cause and a copyable fix. "Waiting" is clearly not an error. Blocking failures (Prototype controls → *Collector unreachable* / *Missing camr.id*) block submission with a fix. **Get help** (diagnostics attached) is offered on every failure, with stronger guidance after repeated attempts. |
| Stakeholder assistance | ✅ | **0 people.** qa is auto-approved for the owning team. |
| Operational accuracy | ✅ | Generated configuration carries all required attributes, the region-correct collector endpoint and environment-appropriate sampling (1.0 in qa, 0.1 in prod). The platform-incident note stops Jordan "fixing" working logs. |
| Accessibility | ✅ | Completed using only roles and accessible names. Progress and results announced. Error summary focused and linked. |

**Changes made after this walkthrough**

- Signals originally started unchecked even though the copy said "we recommend all three". Recommended signals are now pre-selected (saves up to 3 interactions and a decision).
- The *Next step* for a failed check read "Fix logs received, then check again". It now names the fix: "Switch your logger to JSON output and redeploy".
- The wizard's error summary appeared but didn't receive focus, because the router moved focus to the heading afterwards. Fixed: views can now own focus after rendering.

**Risks to validate with real users**

- Developers who don't own their Kubernetes manifests may stall at step 6. Test whether "Environment variables" is a better default for them.
- The JSON-logging fix assumes Java/Logback first. Check that Node.js and Python developers find their path.
- "I've fixed it, check again": will people redeploy before re-checking? The real product should detect "no new deploy since the last check".

---

### A-Ops · An alert where ownership and onboarding data are incomplete

**Persona:** Sam Ortiz (DevOps, on shift)
**Goal:** Handle **ALR-2044**: Merchant Portal 5xx at 6%. Find the responsible team, the procedure and the right next action, when the registry has **no on-call schedule**, there's **no procedure**, and **traces arrive without required attributes**.
**Start:** Alerts queue
**Done when:** the right contact has been reached with context, and the gaps are reported so the next responder isn't stuck.

**Walkthrough (10 interactions; 7 to handle the alert, 3 to fix gaps for next time):**

| # | Action | What Sam sees |
|---|---|---|
| 1 | Alerts | Row shows *Merchant Experience* with a **No on-call registered** chip |
| 2 | Open ALR-2044 | Assessment: likely application (traces "arriving, attributes missing" lowers confidence). Ownership warning with fallback guidance. "No procedure is linked", so generic triage is used. |
| 3 | Acknowledge | Owner set; escalation ladder: support group after 60 min, incident commander after 120 min |
| 4–7 | Escalate → choose *SG-MERCHANT-EXP* (business hours) → reason → Send | Context packet attached automatically |
| 8–9 | Report wrong or missing details → Send to registry owner | Routed to the app owner (Taylor Brooks), not a general channel |
| 10 | Ask Merchant Experience for a procedure | Logged on the alert timeline |

| Criterion | Rating | Evidence |
|---|---|---|
| Task completion | ✅ | Correct contact reached. Gaps reported. |
| Clarity of instructions | ✅ | The gap is stated plainly, with what to do instead. Generic triage steps are actionable. |
| Unnecessary steps | ✅ | The 3 gap-reporting interactions are optional for the incident but stop the next responder repeating it. |
| Validation and error recovery | ✅ | Paging needs a reason (validated). The support group is labelled "business hours only". |
| Stakeholder assistance | ✅ | 1 page (necessary). Registry and procedure fixes go straight to the owner. |
| Operational accuracy | ⚠️ | The fallback is correct, but see the finding below. |
| Accessibility | ✅ | Role/name-only run. Dialog focus is managed. |

**Changes made after this walkthrough**

- The ownership warning told Sam to "contact the incident commander if customers are affected", but the Tier 3 escalation path never reached the incident commander. **Added the incident commander to the Tier 3 path** (after 120 min). The warning text keeps the "sooner if customers are affected" judgement call.

**Risks to validate**

- After hours, with customer impact, the support group can't be reached. Do responders understand they should go straight to the incident commander? A conditional rule may be needed ("customer impact > X% → IC now").
- Will owners act on registry reports? This needs a follow-up mechanism (see open questions in `design-review.md` § 10).

---

### B-Ops · Deploy-correlated alert with an approval-gated rollback

**Persona:** Sam Ortiz
**Goal:** Handle **ALR-2041**: Checkout API p99 latency at 1.9 s, 18 minutes in. Determine the cause, take the appropriate action **without running anything unapproved**, and escalate on time.
**Start:** Alerts queue
**Done when:** rollback approval is requested with a valid change record, and the due escalation is sent with context.

**Walkthrough (15 interactions, including one deliberate mistake):**

| # | Action | What Sam sees |
|---|---|---|
| 1–2 | Alerts → ALR-2041 | Next step: "Acknowledge… Escalation is due now: Priya Raman". Assessment: application, high confidence. Evidence: deploy v2.14.0 **8 minutes before** the alert; 71% of slow traces wait on checkout-pricing. |
| 3 | Acknowledge | Procedure RB-101 with step 1 marked *Next* |
| 4–5 | Recent changes → Close | Deploy flagged "Just before the alert" |
| 6 | Request rollback | Approval dialog: action, target, blast radius, rollback plan, approver. "Nothing changes until Priya Raman approves." |
| 7–10 | Change record `204118` (wrong format), reason, confirm, submit | Specific error: "'204118' isn't a change record number. It should look like CHG-204118." Focus moves to the field. |
| 11–12 | Fix to `CHG-204118` → resubmit | "Waiting for Priya Raman" |
| 13–15 | Page Priya Raman (ladder) → reason → Send | Ladder step marked "Paged just now" |

| Criterion | Rating | Evidence |
|---|---|---|
| Task completion | ✅ | Rollback requested correctly. Escalation sent on time. |
| Clarity of instructions | ✅ | Next step names both the action and the due escalation. The procedure's decision callout covers the "errors too?" branch. |
| Unnecessary steps | ⚠️ | Steps 4–5 (opening changes) are redundant, because the deploy is already in the evidence list. They're optional, but people will probably click. Consider showing the change inline. |
| Validation and error recovery | ✅ | Format error is specific, focused and fixable without losing the other fields. |
| Stakeholder assistance | ⚠️ | Priya gets **two** notifications, an approval request and a page, for one situation. Both are needed, but should arrive as one message. |
| Operational accuracy | ✅ | Nothing ran. Approver is the app on-call. Tier 1 timer (15 min) is correct. You can't approve your own request. |
| Accessibility | ✅ | Dialog opens with Enter, traps focus, Escape returns focus. Invalid field gets `aria-invalid` plus linked error. |

**Open finding (not yet fixed):** when the approver is also the person being paged, offer "Page and request approval" as one action with one notification.

---

### B-App · First on-call shift: an alert on your own application

**Persona:** Jordan Kim, primary on-call for Rewards Engine for the first time
**Goal:** **ALR-2045**: points accrual lag at 22 min. Understand what's wrong and what Jordan is allowed to do.
**Start:** Home (*Your next actions* lists the alert first: "You're primary on-call for Rewards Engine")
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
| Clarity of instructions | ⚠️ | Mostly clear. Terms like "Tier 2 policy" and "change record" assume organisational knowledge a first-time on-call may not have. |
| Unnecessary steps | ✅ | Ticking steps is optional but gives the hand-off a record. |
| Validation and error recovery | ✅ | Same approval validations as B-Ops. |
| Stakeholder assistance | ✅ | 1 approver (necessary). No platform team involved. |
| Operational accuracy | ✅ | App owner approves. The assistant suggested, never acted. Gaps in evidence are shown, with a link to onboard logs and traces afterwards. |
| Accessibility | ✅ | Assistant answer is announced (live log) and scrolled to its start. |

**Changes made after this walkthrough**

- The assistant scrolled to the *end* of long answers, so the summary's first lines were hidden. It now scrolls to the start of the newest answer.
- With the assistant open, the alert page kept its two-column layout and squeezed the chart. The layout now responds to the space actually available (container queries).

**Risks to validate:** how does a first-time on-call get a change record number at 3 a.m.? The product should link to "create emergency change" or let an approver attach one.

---

### C-Ops · A "no data" alert caused by the telemetry pipeline

**Persona:** Sam Ortiz
**Goal:** **ALR-2042**: Ledger Sync reconciliation throughput, *no data* for 30 min (Critical). Decide whether to page Core Ledger.
**Start:** Alerts queue (row already marked **Telemetry issue**)
**Done when:** the alert is linked to the telemetry incident, and the application team is not paged.

**Walkthrough (5 interactions):** open queue → open alert → *Link to TEL-552* (next step) → tick "Hold paging Core Ledger…" → confirm.

| Criterion | Rating | Evidence |
|---|---|---|
| Task completion | ✅ | Linked, with paging held. |
| Clarity of instructions | ✅ | Headline "Likely a telemetry problem, not the application". Evidence: metrics missing (TEL-552); logs fresh and showing reconcile batches completing with 0 errors. |
| Unnecessary steps | ✅ | 5 is the minimum for a deliberate, confirmed decision. |
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
**Start:** Home (banner: "Telemetry platform issue affecting Rewards Engine… not something your team needs to fix")
**Done when:** Jordan knows it's the platform and that nothing needs changing.

**Walkthrough (2 interactions):** Telemetry health → *Check one application* (Rewards Engine pre-selected) → choose `qa` → "Rewards Engine is affected by TEL-553… doesn't need to change anything."

| Criterion | Rating | Evidence |
|---|---|---|
| Task completion | ✅ | |
| Clarity of instructions | ✅ | Separate guidance cards: "If you're responding to alerts" and "If you're on an application team". |
| Unnecessary steps | ✅ | The home banner and the validation note often answer this before Jordan navigates at all. |
| Stakeholder assistance | ✅ | 0 people. This is the "is it you or us?" question the Telemetry Platform team usually answers by hand. |
| Operational accuracy | ✅ | Stops a working configuration from being changed. |
| Accessibility | ✅ | Result region is live, so changes are announced. |

---

### Recovery · Errors and bad identifiers (supporting scenario)

**Walkthrough (6 interactions):**

| # | Action | Outcome |
|---|---|---|
| 1–2 | Onboard → Continue with nothing chosen | "There's a problem" summary, focused, with links to fields |
| 3 | Type `camr108840` | Forgiving search finds Rewards Engine and explains the correct format |
| 4 | Type `CAMR-123456` | "No application found" with what to check and who registers applications |
| 5–6 | Type `CAMR-099120`, select it | "This application is retired… ask Alex Morgan to reactivate it". Continue is hidden. |

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
| 9 | Approver and paged on-call can be the same person → two notifications | ⚠️ Open |
| 10 | Opening "Recent changes" duplicates evidence already shown | ⚠️ Open (show inline) |
| 11 | Organisational terms (tier policy, change record) for first-time on-call | ⚠️ Open (glossary and links) |
| 12 | After-hours Tier 3 with customer impact relies on judgement | ⚠️ Open (conditional rule) |

---

## 5. Plan for real usability testing

The scenarios above are the task set. Real testing should check the ⚠️ risks first.

**Participants**

- 5–6 application developers with little or no observability experience, from at least 3 teams and 2 languages (Java plus Node.js or Python).
- 5–6 DevOps or operations engineers who handle alerts for applications they don't own.
- At least 2 participants who use a screen reader, and 1 who uses keyboard only or magnification. Recruit for this; don't assume it.

**Format:** 60-minute moderated sessions, think-aloud, on a staging build with realistic but synthetic data. Use the **prototype controls** to set each scenario's state before the session, not in front of the participant.

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
| Screen reader participants complete A-App and B-Ops | Yes, without workarounds |

**Questions to answer**

1. Do developers trust "I've fixed it, check again", or do they open a ticket anyway?
2. Do responders trust the "Application or telemetry?" assessment enough to *not* page? What evidence do they look at first?
3. Is the role-ordered navigation helpful, or confusing for people who do both jobs?
4. Does the assistant reduce questions to platform engineers, or create new "the AI said…" escalations?
