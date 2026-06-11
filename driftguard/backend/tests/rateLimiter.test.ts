import { rateLimiter, MemoryBucketStore } from "../src/middleware/rateLimiter";

function mockReqRes(orgId = "org1") {
  const req: any = { orgId, ip: "127.0.0.1" };
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body: any = null;
  const res: any = {
    setHeader: (k: string, v: string) => (headers[k] = v),
    status: (s: number) => ((statusCode = s), res),
    json: (b: any) => ((body = b), res),
  };
  return { req, res, get: () => ({ statusCode, body, headers }) };
}

describe("rateLimiter (token bucket)", () => {
  it("allows requests while tokens remain", async () => {
    let t = 0;
    const limit = rateLimiter({ capacity: 3, refillPerSec: 1, store: new MemoryBucketStore(), now: () => t });
    const next = jest.fn();
    for (let i = 0; i < 3; i++) {
      const { req, res } = mockReqRes();
      await limit(req, res, next);
    }
    expect(next).toHaveBeenCalledTimes(3);
  });

  it("returns 429 with Retry-After once the bucket is empty", async () => {
    let t = 0;
    const store = new MemoryBucketStore();
    const limit = rateLimiter({ capacity: 1, refillPerSec: 0.5, store, now: () => t });
    const next = jest.fn();

    const first = mockReqRes();
    await limit(first.req, first.res, next);
    expect(next).toHaveBeenCalledTimes(1);

    const second = mockReqRes();
    await limit(second.req, second.res, next);
    const out = second.get();
    expect(out.statusCode).toBe(429);
    expect(out.body.error).toBe("rate_limited");
    expect(Number(out.headers["Retry-After"])).toBeGreaterThan(0);
    expect(next).toHaveBeenCalledTimes(1); // not called again
  });

  it("refills tokens over time", async () => {
    let t = 0;
    const store = new MemoryBucketStore();
    const limit = rateLimiter({ capacity: 1, refillPerSec: 1, store, now: () => t });
    const next = jest.fn();

    await limit(mockReqRes().req, mockReqRes().res, next); // drain
    t += 1500; // 1.5s later -> 1 token refilled (capped at capacity)
    const { req, res } = mockReqRes();
    await limit(req, res, next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("isolates buckets per org", async () => {
    let t = 0;
    const store = new MemoryBucketStore();
    const limit = rateLimiter({ capacity: 1, refillPerSec: 0.1, store, now: () => t });
    const next = jest.fn();

    await limit(mockReqRes("orgA").req, mockReqRes("orgA").res, next);
    await limit(mockReqRes("orgB").req, mockReqRes("orgB").res, next); // separate bucket
    expect(next).toHaveBeenCalledTimes(2);
  });
});
