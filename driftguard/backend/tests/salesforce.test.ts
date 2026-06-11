import { SalesforceClient, MemoryBudgetStore } from "../src/services/salesforce";
import { AppError } from "../src/middleware/errorHandler";

function fakeFetch(statuses: number[]): typeof fetch {
  let i = 0;
  return (async () => {
    const status = statuses[Math.min(i++, statuses.length - 1)];
    return new Response("{}", { status });
  }) as typeof fetch;
}

const noSleep = async () => {};

describe("SalesforceClient", () => {
  it("enforces the per-org daily API budget BEFORE calling Salesforce", async () => {
    const client = new SalesforceClient({
      orgId: "org1",
      dailyBudget: 2,
      budgetStore: new MemoryBudgetStore(),
      fetchFn: fakeFetch([200]),
      sleepFn: noSleep,
    });
    await client.call("https://sf/a");
    await client.call("https://sf/b");
    await expect(client.call("https://sf/c")).rejects.toMatchObject({
      code: "sf_api_budget_exceeded",
      status: 429,
    });
  });

  it("retries transient failures with backoff, then succeeds", async () => {
    const client = new SalesforceClient({
      orgId: "org1",
      dailyBudget: 100,
      budgetStore: new MemoryBudgetStore(),
      fetchFn: fakeFetch([503, 429, 200]),
      sleepFn: noSleep,
    });
    const res = await client.call("https://sf/records");
    expect(res.status).toBe(200);
  });

  it("gives up after max retries with an actionable error", async () => {
    const client = new SalesforceClient({
      orgId: "org1",
      dailyBudget: 100,
      budgetStore: new MemoryBudgetStore(),
      fetchFn: fakeFetch([503, 503, 503, 503, 503]),
      maxRetries: 3,
      sleepFn: noSleep,
    });
    try {
      await client.call("https://sf/records");
      fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("salesforce_unavailable");
      expect((e as AppError).action).toContain("status.salesforce.com");
    }
  });

  it("does NOT retry non-transient errors (e.g. 401)", async () => {
    let calls = 0;
    const countingFetch: typeof fetch = (async () => {
      calls++;
      return new Response("{}", { status: 401 });
    }) as typeof fetch;
    const client = new SalesforceClient({
      orgId: "org1",
      dailyBudget: 100,
      budgetStore: new MemoryBudgetStore(),
      fetchFn: countingFetch,
      sleepFn: noSleep,
    });
    const res = await client.call("https://sf/records");
    expect(res.status).toBe(401);
    expect(calls).toBe(1);
  });
});
