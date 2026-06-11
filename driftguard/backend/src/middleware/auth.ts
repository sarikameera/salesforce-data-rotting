/**
 * JWT auth + role-based access control.
 *
 * Roles map 1:1 to the PRD Section 3 persona access matrix:
 *   admin     -> RevOps Manager / Salesforce Admin (full access)
 *   member    -> Sales Rep (record-level nudge actions only)
 *   readonly  -> Sales Leader (dashboards, forecast impact view)
 *
 * Tokens are short-lived (1h) and carry orgId so every downstream
 * query and rate-limit bucket is org-scoped by construction.
 */
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type Role = "admin" | "member" | "readonly";

export interface AuthClaims {
  sub: string;     // user id
  orgId: string;   // DriftGuard org (maps to one Salesforce org)
  role: Role;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthClaims;
    orgId?: string;
  }
}

const ROLE_RANK: Record<Role, number> = { readonly: 0, member: 1, admin: 2 };

export function signToken(claims: AuthClaims, secret: string, expiresIn = "1h"): string {
  return jwt.sign(claims, secret, { expiresIn });
}

export function requireAuth(secret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "unauthorized", message: "Sign in to continue." });
    }
    try {
      const claims = jwt.verify(header.slice(7), secret) as AuthClaims;
      req.user = claims;
      req.orgId = claims.orgId;
      return next();
    } catch {
      return res.status(401).json({ error: "unauthorized", message: "Session expired. Sign in again." });
    }
  };
}

export function requireRole(minRole: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "unauthorized", message: "Sign in to continue." });
    }
    if (ROLE_RANK[req.user.role] < ROLE_RANK[minRole]) {
      return res.status(403).json({
        error: "forbidden",
        message: "Your role doesn't have access to this. Ask an org admin.",
      });
    }
    return next();
  };
}
