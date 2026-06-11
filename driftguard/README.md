# DriftGuard

**Proactive CRM data health & AI agent governance for Salesforce.**

CRM data rots. 70% of B2B records degrade every year, and AI agents read
those records as truth. Salesforce cleans data reactively — DriftGuard is
the smoke detector: it watches every record, scores its health, and raises
the alarm before bad data breaks routing, forecasts, and agent decisions.

Built on the Salesforce REST API and Agent API. [PRD](docs/driftguard_prd.md) ·
[Phase 0 market research](docs/phase0.md)

## Measured model performance

Trained on a seeded org with injected decay patterns (labels known by
construction — metrics are real, not estimated). Held-out test set:

| Metric | Result | Bar |
|---|---|---|
| Classic decay detection | **96.9%** | ≥ 95% |
| Silent decay detection | **63.7%** | ≥ 60% |
| False positive rate | **13.7%** | < 15% |
| ROC AUC | 0.905 | — |

*Why two detection rates: ~16% of decayed records are "silent" — a recent
job change that hasn't produced bounces yet. They're statistically identical
to healthy records and bounded by external signal coverage. Reporting one
blanket number would hide that. See the model card in `ml-service/app/model.py`.*

## Architecture

```
frontend (React+TS)  →  backend (Node/Express+TS)  →  Salesforce REST + Agent API
                              │        │
                          Postgres   Redis (cache + rate-limit buckets)
                              │
                        ml-service (FastAPI + scikit-learn HistGB)
```

Key production decisions (full rationale in the PRD):
- **Token-bucket rate limiting per org** — absorbs legitimate bursts, throttles abuse
- **Per-org daily Salesforce API budget** — enforced *before* each outbound call; DriftGuard is a polite guest in orgs with hard API caps
- **Exponential backoff with full jitter** on transient Salesforce failures
- **JWT + 3-tier RBAC** mapping to the PRD persona matrix (admin / member / readonly)
- **Gradient boosting over deep learning** — explainability is the feature; every score ships with its top reasons
- **CI gates**: lint → typecheck → unit tests (80% coverage threshold) → model acceptance tests → E2E journeys → deploy

## Run it

```bash
# ML service
cd ml-service && pip install -r requirements.txt
uvicorn app.main:app --port 8000

# Backend
cd backend && cp .env.example .env && npm install
npm run dev   # :4000

# Tests
cd backend && npm test
cd ml-service && python -m pytest tests/ -v
```

Demo logins: `maya@demo.driftguard.app / demo-revops` (admin),
`dev@demo.driftguard.app / demo-rep` (rep), `lena@demo.driftguard.app / demo-vp` (read-only).

## Project status

- [x] M1 partial — auth, RBAC, rate limiting, Salesforce client w/ budget + backoff
- [x] M2 partial — decay model trained, evaluated, acceptance-gated in CI
- [ ] M1 — Salesforce OAuth flow + Integration Hub UI
- [ ] M3 — Decay Radar queue, Agent Audit Log, Slack nudges
- [ ] M4 — deploy, README demo links, quantified live metrics
