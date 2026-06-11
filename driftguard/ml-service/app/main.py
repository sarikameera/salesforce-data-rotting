"""DriftGuard ML service — health scoring API.

Separate service from the Node backend, per PRD Section 6: the model can
be retrained and redeployed without touching the app. The backend calls
POST /score; this service owns the model lifecycle.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .model import train, health_score, FEATURES

state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Train at startup for the demo. Production would load a versioned
    # artifact from object storage instead.
    model, report = train()
    state["model"] = model
    state["importances"] = report.feature_importances
    state["report"] = report
    yield
    state.clear()


app = FastAPI(title="DriftGuard ML Service", lifespan=lifespan)


class RecordFeatures(BaseModel):
    days_since_verified: float = Field(ge=0)
    days_since_activity: float = Field(ge=0)
    email_bounce_rate: float = Field(ge=0, le=1)
    field_completeness: float = Field(ge=0, le=1)
    title_changed_signal: int = Field(ge=0, le=1)
    domain_mx_valid: int = Field(ge=0, le=1)
    edit_source_agent_pct: float = Field(ge=0, le=1)


@app.post("/score")
def score(record: RecordFeatures):
    if "model" not in state:
        raise HTTPException(503, "Model not loaded yet. Retry shortly.")
    return health_score(state["model"], record.model_dump(), state["importances"])


@app.get("/model/card")
def model_card():
    r = state["report"]
    return {
        "classic_detection": r.classic_detection,
        "silent_detection": r.silent_detection,
        "false_positive_rate": r.false_positive_rate,
        "precision": r.precision,
        "roc_auc": r.roc_auc,
        "meets_acceptance_criteria": r.meets_acceptance_criteria(),
        "features": FEATURES,
    }


@app.get("/healthz")
def healthz():
    return {"ok": True, "model_loaded": "model" in state}
