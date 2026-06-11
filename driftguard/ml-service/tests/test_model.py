"""Model tests gate CI: if a retrain regresses below the PRD acceptance
criteria, the pipeline fails before anything ships."""
import pytest
from app.model import train, health_score, DECISION_THRESHOLD
from app.data_gen import generate, FEATURES


@pytest.fixture(scope="module")
def trained():
    return train(n=8000, seed=42)


def test_meets_acceptance_criteria(trained):
    _, report = trained
    assert report.classic_detection >= 0.95, "classic decay detection regressed"
    assert report.silent_detection >= 0.60, "silent decay detection regressed"
    assert report.false_positive_rate < 0.15, "false positive rate above bar"


def test_health_score_contract(trained):
    model, report = trained
    record = generate(n=10, seed=7).iloc[0][FEATURES].to_dict()
    out = health_score(model, record, report.feature_importances)
    assert 0 <= out["health_score"] <= 100
    assert out["status"] in {"healthy", "watch", "at_risk"}
    assert len(out["top_reasons"]) == 3


def test_decayed_records_score_lower_on_average(trained):
    model, report = trained
    df = generate(n=2000, seed=99)
    scores = {0: [], 1: []}
    for _, row in df.sample(200, random_state=1).iterrows():
        s = health_score(model, row[FEATURES].to_dict(), report.feature_importances)
        scores[int(row["is_decayed"])].append(s["health_score"])
    avg_healthy = sum(scores[0]) / len(scores[0])
    avg_decayed = sum(scores[1]) / len(scores[1])
    assert avg_decayed < avg_healthy - 15, "model isn't separating classes meaningfully"


def test_threshold_is_documented_operating_point():
    assert DECISION_THRESHOLD == 0.25
