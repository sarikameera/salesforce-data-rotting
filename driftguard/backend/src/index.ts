/**
 * DriftGuard API entry point.
 * Middleware order matters: rate limit first (cheapest rejection),
 * then auth, then routes, then the centralized error handler last.
 */
import express from "express";
import pino from "pino";
import { rateLimiter } from "./middleware/rateLimiter";
import { requireAuth } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";
import { recordsRouter } from "./routes/records";
import { authRouter } from "./routes/auth";

const logger = pino();
const app = express();
app.use(express.json());

// Public: sign-in + health probe
app.use("/api/auth", authRouter());
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// Everything below is org-scoped, rate-limited, authenticated
const secret = process.env.JWT_SECRET ?? "dev-only-secret";
app.use("/api", requireAuth(secret));
app.use("/api", rateLimiter({ capacity: 30, refillPerSec: 5 }));
app.use("/api/records", recordsRouter());

app.use(errorHandler(logger));

const port = Number(process.env.PORT ?? 4000);
if (require.main === module) {
  app.listen(port, () => logger.info({ port }, "driftguard-api up"));
}
export default app;
