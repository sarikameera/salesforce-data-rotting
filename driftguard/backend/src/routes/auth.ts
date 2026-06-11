import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { signToken } from "../middleware/auth";
import { Errors } from "../middleware/errorHandler";

// Demo user store. Production swaps in Postgres via the same shape.
const DEMO_USERS = [
  { id: "u_revops", email: "maya@demo.driftguard.app", hash: bcrypt.hashSync("demo-revops", 10), orgId: "org_demo", role: "admin" as const },
  { id: "u_rep", email: "dev@demo.driftguard.app", hash: bcrypt.hashSync("demo-rep", 10), orgId: "org_demo", role: "member" as const },
  { id: "u_vp", email: "lena@demo.driftguard.app", hash: bcrypt.hashSync("demo-vp", 10), orgId: "org_demo", role: "readonly" as const },
];

const LoginBody = z.object({ email: z.string().email(), password: z.string().min(8) });

export function authRouter() {
  const r = Router();
  r.post("/login", async (req, res, next) => {
    try {
      const parsed = LoginBody.safeParse(req.body);
      if (!parsed.success) throw Errors.validation("Email and a password of 8+ characters are required.");
      const user = DEMO_USERS.find((u) => u.email === parsed.data.email);
      const ok = user && (await bcrypt.compare(parsed.data.password, user.hash));
      if (!ok) {
        // Same message for unknown email vs wrong password: no user enumeration.
        return res.status(401).json({ error: "invalid_credentials", message: "Email or password is incorrect." });
      }
      const token = signToken({ sub: user.id, orgId: user.orgId, role: user.role }, process.env.JWT_SECRET ?? "dev-only-secret");
      return res.json({ token, role: user.role });
    } catch (e) { next(e); }
  });
  return r;
}
