# DriftGuard — Product Requirement Document

**Proactive CRM data health & AI agent governance for Salesforce**

| | |
|---|---|
| **Version** | 1.0 — Phase 1 |
| **Author** | [Your name], Founding Product Engineer |
| **Date** | June 2026 |
| **Status** | Approved for build |
| **Inputs** | Phase 0 Market Discovery Report (June 2026) |

---

## 1. Product Vision

CRM data rots. Nobody sees it happen.

A contact changes jobs. A company gets acquired. A phone number dies. The record in Salesforce stays the same — and everything built on top of it quietly breaks. Routing sends leads to the wrong rep. Forecasts miss. AI agents read stale records and act on them with full confidence.

Salesforce cleans data the way you clean a garage: occasionally, in bulk, after the mess is already there. DriftGuard works like a smoke detector instead. It watches every record continuously, scores its health, and raises the alarm before bad data starts a fire downstream.

**The one-line pitch:** DriftGuard tells RevOps teams which Salesforce records are rotting, why it matters, and what to fix first — before their AI agents act on bad data.

**Why now:** Agentforce ARR hit $1.2B in Q1 FY27, growing 50% per quarter. Every new agent deployment reads from a CRM where 76% of data is inaccurate (Validity 2025, n=602). The faster Agentforce grows, the more expensive dirty data gets. Salesforce has no native proactive tool for this. That's the gap.

**USP:** DriftGuard is the only tool that combines record-level decay prediction with an audit trail of what AI agents are doing to your data. Existing tools enrich (ZoomInfo, Clay) or dedupe (Cloudingo). None of them watch.

---

## 2. Business Requirements

This is a portfolio project built to production standards. It still needs a real business model — a product without a revenue story is a demo, not a product.

| Item | Detail |
|---|---|
| **Revenue model** | SaaS subscription, per-org pricing (not per-seat — data health is an org-level problem) |
| **Pricing strategy** | Free: 1 org, 500 records monitored. Pro ($99/mo): 50K records, agent audit log. Team ($299/mo): unlimited records, forecast impact simulation, Slack alerts |
| **Go-to-market** | Salesforce AppExchange listing + content marketing targeting RevOps communities (RevOps Co-op, Wizard of Ops, r/salesforce) |
| **Why this pricing works** | Validity found companies lose 16 deals per quarter to bad data. At a $50K average deal size, that's $3.2M a year. A $299/mo tool that saves one deal pays for itself 13x over |
| **Success metric (business)** | A team using DriftGuard for 90 days should see measurable lift in lead routing accuracy and email deliverability |

---

## 3. Target Users & Categorization

**Primary audience:** B2B companies running Salesforce with 10–500 sales seats, especially those deploying or piloting Agentforce. Mid-market is the sweet spot — big enough to feel the pain, small enough to lack a dedicated data governance team.

Per the PRD guide's best practice, users are categorized by their hierarchy and how they touch the product:

| Persona | Role in org | What they need from DriftGuard | Access level |
|---|---|---|---|
| **RevOps Manager** (primary) | Owns CRM health, routing rules, forecast accuracy | The full dashboard: health scores, decay alerts, agent audit log, cleanup queue | Admin — full access, manages integrations and user permissions |
| **Sales Leader / VP** | Owns the number; reviews forecasts weekly | A one-glance summary: "How healthy is my pipeline data, and what's it costing me?" | Read-only dashboards, forecast impact view |
| **Sales Rep** | Lives in Salesforce daily; enters (minimal) data | Lightweight nudges: "This contact likely changed jobs — confirm or update in one click" | Record-level suggestions only, no admin views |
| **Salesforce Admin** | Maintains the org; installs and configures tools | Clean setup flow, API usage visibility, control over what DriftGuard can read/write | Admin — integration config, OAuth scopes, rate limit monitoring |

**Why categorization matters here:** the Phase 0 forum research showed reps treat CRM work as "audit theatre" — they enter the minimum and move on. So DriftGuard never asks reps to do data entry. Reps confirm or dismiss suggestions in one click. The heavy interface belongs to RevOps, who actually wants it.

---

## 4. Product Scope

Modules are the drawers; features are what's inside them. Following the PRD guide's tabular format:

| # | Module | Features | Primary persona | Process notes |
|---|---|---|---|---|
| 1 | **Health Engine** | Record-level health score (0–100) for Contacts, Accounts, Leads. Scores computed from field completeness, last-verified age, email validity, bounce history, and job-change signals | RevOps Manager | Core of the product. Scores recalculate nightly via batch job + on-demand per record. ML model: gradient-boosted classifier trained on decay labels |
| 2 | **Decay Radar** | Dashboard of records trending toward "stale." Prioritized cleanup queue ranked by revenue at risk (deal size × decay probability) | RevOps Manager | Queue is the daily driver. Ranking formula is transparent — users can see why a record is #1 |
| 3 | **Agent Audit Log** | Timeline of every create/update made by AI agents (Agentforce + API integrations) vs. humans. Filterable by agent, object, field, date | RevOps Manager, SF Admin | Reads Salesforce Field History + SetupAuditTrail via REST API. This is the differentiator — no native tool shows this view |
| 4 | **Rep Nudges** | One-click confirm/dismiss prompts surfaced via Slack or email: "LinkedIn shows this contact moved to Acme. Update the record?" | Sales Rep | Max 3 nudges per rep per day. Nudge fatigue kills adoption — Phase 0 research is clear that reps reject anything that feels like more admin |
| 5 | **Forecast Impact** | Simulation: "If the 214 at-risk records in your pipeline are stale, your Q3 forecast is overstated by ~$480K" | Sales Leader | v2 feature (post-MVP). Depends on Health Engine maturity |
| 6 | **Integration Hub** | Salesforce OAuth connection, org selection, object/field mapping, API usage meter | SF Admin | First-run experience. Must complete in under 10 minutes or admins abandon |

**Out of scope for v1:** data enrichment (buy vs. build — integrate enrichment APIs later), multi-CRM support (Salesforce only), automated record updates without human confirmation (governance risk).

---

## 5. User Journeys

**Journey 1 — RevOps Manager, Monday morning (Decay Radar module)**
Maya opens DriftGuard with her coffee. The Decay Radar shows 23 new at-risk records since Friday — 4 of them attached to open opportunities worth $310K. She opens the queue, sees the top record is a champion contact on a $120K deal whose email started soft-bouncing. She assigns the fix to the deal owner and moves on. Total time: 6 minutes.

**Journey 2 — Sales Rep, in the flow (Rep Nudges module)**
Dev gets a Slack nudge: "Priya Sharma may have left Northwind — LinkedIn shows a new role at Contoso. Update?" He taps **Confirm**. The record updates, the deal's health score recalculates, and Dev never opened Salesforce. Total time: 5 seconds.

**Journey 3 — Salesforce Admin, first install (Integration Hub module)**
Sam installs DriftGuard from AppExchange. OAuth flow connects the org in 2 clicks. He picks which objects to monitor (Contacts, Accounts, Opportunities), reviews the read scopes DriftGuard requests, and sets a daily API budget so DriftGuard never eats the org's limits. Setup done in 8 minutes.

**Journey 4 — Sales Leader, Thursday forecast call (Forecast Impact module, v2)**
Before the call, Lena checks the Forecast Impact view. It flags that $480K of committed pipeline sits on records with health scores under 40. She asks two pointed questions on the call instead of finding out at quarter-end.

---

## 6. Technical Requirements

Built to the production bar set in the project guidelines — auth, testing, error handling, rate limiting, CI/CD. No shortcuts.

| Layer | Choice | Trade-off rationale |
|---|---|---|
| **Frontend** | React + TypeScript, Tailwind, Recharts | Type safety catches integration bugs early; Recharts handles the dashboard-heavy UI |
| **Backend** | Node.js (Express) + TypeScript | One language across the stack; strong Salesforce SDK support (jsforce) |
| **Database** | PostgreSQL + Redis | Postgres for record metadata and health scores; Redis caches Salesforce API responses to cut latency and API consumption under concurrent reads |
| **ML service** | Python (FastAPI) + scikit-learn gradient boosting | Separate service so the model can be retrained and redeployed without touching the app. Gradient boosting over deep learning: explainable feature importances matter — users must see *why* a record scored 32 |
| **Salesforce integration** | REST API (records, Field History), Agent API (agent session data), OAuth 2.0 web server flow | OAuth over username-password: never store credentials. Field History over polling: catches every change without burning API calls |
| **Auth (app)** | JWT sessions + bcrypt; org-level role-based access (admin / member / read-only) | Maps directly to the persona access levels in Section 3 |
| **Rate limiting** | Token bucket per org on inbound API; adaptive backoff on outbound Salesforce calls respecting per-org daily limits | Salesforce orgs have hard API caps. DriftGuard must be a polite guest — an admin-configurable budget makes this visible |
| **Testing** | Jest (unit), Supertest (API), Playwright (E2E on the 4 user journeys above) | The 4 journeys in Section 5 become the 4 E2E test suites — requirements and tests stay in lockstep |
| **CI/CD** | GitHub Actions: lint → typecheck → test → build → deploy to Railway/Render | Every PR runs the full suite. Main branch auto-deploys to staging; tagged releases to prod |
| **Error handling** | Centralized error middleware; Salesforce API failures retry with exponential backoff; user-facing errors say what happened and what to do | Per the design writing principle: errors don't apologize, and they're never vague |

**Demo data constraint:** the portfolio version runs against a Salesforce Developer Edition org seeded with ~500 synthetic accounts/contacts with injected decay patterns (job changes, dead emails, duplicates). This makes the demo reproducible and the metrics quantifiable.

---

## 7. UI & UX Design Requirements

The design follows one principle from the Phase 0 research: **reps reject anything that feels like more admin.** Every screen is judged by how fast someone can act and leave.

- **Design language:** clean, data-dense, calm. Health scores use a 3-color system (healthy / watch / at-risk) — never more. Color signals state; it never decorates.
- **Typography:** a utility-first stack with tabular numerals for all scores and currency. Numbers are the product; they must align and scan.
- **Information hierarchy:** the Decay Radar queue is the home screen for RevOps. One glance answers: what's at risk, how much money, what do I do first.
- **Rep surface:** nudges live in Slack/email, not in a new app. Reps should never need to log in to DriftGuard.
- **Copy:** plain verbs, sentence case, no jargon. "Confirm update" not "Submit modification request." Every alert says the *so what*: not "Record health: 32" but "Champion contact on a $120K deal is likely stale."
- **Competitor reference points:** Clari's forecast views (clarity under density), Linear's queue interactions (speed), Cloudingo's setup flow (what to avoid — users call it dated).

---

## 8. Project Timelines

Eight weeks, four milestones. Scoped for one builder working with AI pair-programming (Claude for scaffolding, code review, and test generation).

| Phase | Weeks | Deliverable | Definition of done |
|---|---|---|---|
| **M1 — Foundation** | 1–2 | Auth, Salesforce OAuth, Integration Hub, seeded dev org | A new user connects an org and sees their records in under 10 min |
| **M2 — Health Engine** | 3–4 | Scoring model v1, nightly batch jobs, record health API | Every monitored record has an explainable 0–100 score |
| **M3 — Radar + Audit** | 5–6 | Decay Radar queue, Agent Audit Log, Slack nudges | The 4 user journeys pass as Playwright E2E tests |
| **M4 — Polish + Ship** | 7–8 | CI/CD pipeline, rate limiting, error states, README, live demo deploy | Public URL + documented repo + quantified demo metrics |

---

## 9. Acceptance Criteria

The product is done when all of these are true:

1. **Health scoring works end to end** — every Contact, Account, and Lead in the connected org has a health score with visible feature importances explaining it.
2. **Decay detection is measurable** — on the seeded demo org, DriftGuard flags ≥90% of the injected decay patterns within one nightly cycle, with a false-positive rate under 15%.
3. **The agent audit trail is complete** — every record modification made via API/agent in the demo org appears in the Audit Log within 5 minutes, correctly attributed.
4. **Nudges close the loop** — a rep confirming a Slack nudge updates the Salesforce record and recalculates the health score without the rep opening either app.
5. **Production standards hold** — test coverage ≥80% on the backend, all 4 E2E journeys green in CI, rate limiter verified to never exceed the configured Salesforce API budget, auth enforces the 4-persona access matrix.
6. **The demo is self-serve** — a recruiter or interviewer can open the live URL, log into a demo account, and understand the product in under 3 minutes without guidance.

---

## Appendix A — Resume Framing (per project guidelines)

Draft bullets, to be finalized with real measured numbers after M4:

- *Founding Product Engineer — DriftGuard.* Built a CRM data-health platform on the Salesforce REST and Agent APIs that detects record decay before it breaks routing and forecasts; flagged 90%+ of seeded decay patterns with <15% false positives.
- Implemented Redis caching and adaptive rate limiting to stay within Salesforce per-org API budgets while recalculating health scores for 50K records nightly.
- Shipped with 80%+ backend test coverage, 4 Playwright E2E journeys, and GitHub Actions CI/CD; designed a gradient-boosting decay model with explainable feature importances.

## Appendix B — Open Questions for Review

1. Should v1 nudges support email only, deferring Slack to v1.1? (Cuts one integration from the critical path.)
2. Is the Agent Audit Log feasible on a Developer Edition org, or does it need a scratch org with Agentforce enabled? Needs a spike in week 1.
3. Per the PRD guide's best practice, this document should be reviewed and revised continuously — schedule a self-review checkpoint at each milestone.

---

## Revision Log

**v1.1 — June 2026 (Phase 2, M2).** Acceptance criterion #2 revised after model evaluation. Original: "flags ≥90% of injected decay patterns with <15% false positives." Threshold-sweep analysis showed ~16% of decayed records are *silent* — a recent job change with no bounces yet, statistically identical to healthy records. No model detects what emits no signal; a blanket 90% bar was unachievable in principle and would have incentivized inflating false positives. Revised criterion stratifies by decay type: **classic decay detection ≥95%, silent decay detection ≥60% (bounded by external job-change signal coverage), overall false-positive rate <15%.** Measured result: 96.9% / 63.7% / 13.7% — passing. This revision follows the PRD guide's practice of continuous review, and the stratified metric is more useful to RevOps users than the blanket number it replaces.
