/**
 * Centralized error handling.
 *
 * PRD Section 6: "errors don't apologize, and they're never vague."
 * Every AppError carries an http status, a machine-readable code, and a
 * human message that says what happened and what to do next.
 * Unknown errors are logged with full detail but returned generically —
 * internals never leak to clients.
 */
import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public action?: string
  ) {
    super(message);
  }
}

export const Errors = {
  salesforceUnavailable: () =>
    new AppError(
      503,
      "salesforce_unavailable",
      "Salesforce didn't respond after several retries.",
      "Check the org's status at status.salesforce.com, then retry."
    ),
  apiBudgetExceeded: (budget: number) =>
    new AppError(
      429,
      "sf_api_budget_exceeded",
      `DriftGuard reached the daily Salesforce API budget (${budget} calls) configured for this org.`,
      "Raise the budget in Integration Hub settings or wait for the daily reset."
    ),
  recordNotFound: (id: string) =>
    new AppError(404, "record_not_found", `No record with id ${id} in this org.`, "Confirm the record exists in Salesforce and is in a monitored object."),
  validation: (detail: string) =>
    new AppError(400, "validation_error", detail, "Fix the highlighted fields and resend."),
};

interface Logger {
  error: (obj: unknown, msg?: string) => void;
}

export function errorHandler(logger: Logger) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({
        error: err.code,
        message: err.message,
        ...(err.action ? { action: err.action } : {}),
      });
    }
    // Unknown error: log everything, expose nothing.
    logger.error({ err, path: req.path, orgId: req.orgId }, "unhandled_error");
    return res.status(500).json({
      error: "internal_error",
      message: "Something broke on our side. The team has the details.",
    });
  };
}
