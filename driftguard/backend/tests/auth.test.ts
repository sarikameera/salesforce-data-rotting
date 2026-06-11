import { signToken, requireAuth, requireRole, AuthClaims } from "../src/middleware/auth";

const SECRET = "test-secret";

function run(mw: any, req: any) {
  let statusCode = 200;
  let body: any = null;
  const res: any = {
    status: (s: number) => ((statusCode = s), res),
    json: (b: any) => ((body = b), res),
  };
  const next = jest.fn();
  mw(req, res, next);
  return { statusCode, body, next };
}

describe("auth middleware", () => {
  const claims: AuthClaims = { sub: "u1", orgId: "org1", role: "member" };

  it("rejects requests without a token", () => {
    const { statusCode, body, next } = run(requireAuth(SECRET), { headers: {} });
    expect(statusCode).toBe(401);
    expect(body.message).toContain("Sign in");
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts a valid token and attaches org-scoped claims", () => {
    const token = signToken(claims, SECRET);
    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const { next } = run(requireAuth(SECRET), req);
    expect(next).toHaveBeenCalled();
    expect(req.user.sub).toBe("u1");
    expect(req.orgId).toBe("org1"); // every downstream query is org-scoped
  });

  it("rejects tampered tokens", () => {
    const token = signToken(claims, "wrong-secret");
    const { statusCode } = run(requireAuth(SECRET), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(statusCode).toBe(401);
  });

  describe("persona access matrix (PRD Section 3)", () => {
    it.each([
      ["readonly", "admin", 403],   // Sales Leader cannot touch admin config
      ["member", "admin", 403],     // Sales Rep cannot touch admin config
      ["admin", "admin", 200],      // RevOps Manager / SF Admin can
      ["readonly", "member", 403],  // Sales Leader cannot confirm nudges
      ["member", "member", 200],    // Sales Rep can confirm nudges
      ["admin", "readonly", 200],   // admin can view dashboards
    ])("role=%s accessing minRole=%s -> %i", (role, minRole, expected) => {
      const req: any = { user: { ...claims, role } };
      const { statusCode, next } = run(requireRole(minRole as any), req);
      if (expected === 200) expect(next).toHaveBeenCalled();
      else expect(statusCode).toBe(expected);
    });
  });
});
