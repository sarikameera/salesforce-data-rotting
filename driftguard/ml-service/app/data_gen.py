"""
Synthetic CRM record generator with injected decay patterns.

Mirrors the PRD's demo-org seeding strategy: ~N contact records where a
known subset has decay injected (job changes, dead emails, staleness).
Because labels are known by construction, model metrics are real and
reproducible — the basis for honest resume numbers.

Features (all computable from Salesforce REST API + Field History):
  days_since_verified    days since a human or enrichment source confirmed the record
  days_since_activity    days since any logged activity (email, call, meeting)
  email_bounce_rate      soft+hard bounces / sends, trailing 90 days
  field_completeness     fraction of key fields populated (0-1)
  title_changed_signal   1 if an external signal suggests a job change
  domain_mx_valid        1 if the email domain still has valid MX records
  edit_source_agent_pct  fraction of recent edits made by AI agents vs humans
"""
from __future__ import annotations

import numpy as np
import pandas as pd

FEATURES = [
    "days_since_verified",
    "days_since_activity",
    "email_bounce_rate",
    "field_completeness",
    "title_changed_signal",
    "domain_mx_valid",
    "edit_source_agent_pct",
]


def generate(n: int = 5000, decay_fraction: float = 0.3, seed: int = 42) -> pd.DataFrame:
    """Generate n records; decay_fraction of them have decay injected.

    Deliberately hard, mirroring real CRM decay:
      - Distributions overlap heavily (a busy healthy record can look quiet).
      - 35% of decayed records are "silent decay": a recent job change that
        hasn't produced bounces yet — the contact left, but emails still land.
      - 5% label noise: real-world decay labels are themselves imperfect.
    """
    rng = np.random.default_rng(seed)
    n_decayed = int(n * decay_fraction)
    n_healthy = n - n_decayed

    healthy = pd.DataFrame({
        "days_since_verified": rng.gamma(3.0, 45, n_healthy),          # broad: 0-400+ days
        "days_since_activity": rng.gamma(2.5, 35, n_healthy),
        "email_bounce_rate": rng.beta(1.2, 25, n_healthy),             # low but nonzero
        "field_completeness": rng.beta(5, 2.5, n_healthy),
        "title_changed_signal": rng.binomial(1, 0.08, n_healthy),      # false signals exist
        "domain_mx_valid": rng.binomial(1, 0.97, n_healthy),
        "edit_source_agent_pct": rng.beta(2.5, 5, n_healthy),
        "is_decayed": 0,
    })
    healthy["decay_type"] = "none"

    # Silent decay: job changed recently; bounces haven't started yet
    n_silent = int(n_decayed * 0.35)
    silent = pd.DataFrame({
        "days_since_verified": rng.gamma(3.5, 50, n_silent),           # looks ~normal
        "days_since_activity": rng.gamma(3.0, 40, n_silent),
        "email_bounce_rate": rng.beta(1.5, 22, n_silent),              # still low!
        "field_completeness": rng.beta(4.5, 2.8, n_silent),
        "title_changed_signal": rng.binomial(1, 0.55, n_silent),       # main tell
        "domain_mx_valid": rng.binomial(1, 0.95, n_silent),
        "edit_source_agent_pct": rng.beta(3, 4.5, n_silent),
        "is_decayed": 1,
    })
    silent["decay_type"] = "silent"

    # Classic decay: long-stale, bouncing, patchy
    n_classic = n_decayed - n_silent
    classic = pd.DataFrame({
        "days_since_verified": rng.gamma(5.0, 55, n_classic),
        "days_since_activity": rng.gamma(4.5, 45, n_classic),
        "email_bounce_rate": rng.beta(2.2, 11, n_classic),             # overlaps healthy tail
        "field_completeness": rng.beta(3.2, 3.2, n_classic),
        "title_changed_signal": rng.binomial(1, 0.35, n_classic),
        "domain_mx_valid": rng.binomial(1, 0.86, n_classic),
        "edit_source_agent_pct": rng.beta(4, 3.5, n_classic),
        "is_decayed": 1,
    })
    classic["decay_type"] = "classic"

    df = pd.concat([healthy, silent, classic], ignore_index=True)

    # 2% label noise: even in a seeded org, a few injected patterns are
    # ambiguous (e.g. a contact who changed roles within the same company).
    noise_idx = rng.choice(len(df), size=int(0.02 * len(df)), replace=False)
    df.loc[noise_idx, "is_decayed"] = 1 - df.loc[noise_idx, "is_decayed"]

    return df.sample(frac=1.0, random_state=seed).reset_index(drop=True)


if __name__ == "__main__":
    df = generate()
    df.to_csv("synthetic_records.csv", index=False)
    print(f"Generated {len(df)} records ({df.is_decayed.mean():.0%} decayed)")
