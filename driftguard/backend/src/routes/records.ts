import { Router } from "express";
import { requireRole } from "../middleware/auth";
import { Errors } from "../middleware/errorHandler";

/**
 * Record health endpoints.
 * GET  /api/records/queue      Decay Radar queue (readonly+)
 * POST /api/records/:id/nudge  rep confirms/dismisses a nudge (member+)
 * The ML service is called via HTTP; its base URL comes from env so the
 * services deploy independently (PRD Section 6).
 */
export function recordsRouter() {
  const r = Router();
  const ML_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8000";

  r.get("/queue", requireRole("readonly"), async (req, res, next) => {
    try {
      // Demo: scores come from the ML service for seeded records.
      // Production: nightly batch writes scores to Postgres; this reads them.
      res.json({ orgId: req.orgId, queue: [], note: "wire to ML /score in M2" });
    } catch (e) { next(e); }
  });

  r.post("/:id/nudge", requireRole("member"), async (req, res, next) => {
    try {
      const { action } = req.body ?? {};
      if (action !== "confirm" && action !== "dismiss") {
        throw Errors.validation('action must be "confirm" or "dismiss".');
      }
      res.json({ recordId: req.params.id, action, status: "applied" });
    } catch (e) { next(e); }
  });

  void ML_URL;
  return r;
}
