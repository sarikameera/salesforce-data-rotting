/**
 * Salesforce API client.
 *
 * Three production behaviors, per PRD Section 6:
 *  1. OAuth 2.0 web-server flow only — credentials are never stored.
 *  2. Exponential backoff with jitter on transient failures (429/5xx).
 *  3. A per-org daily API budget. Salesforce orgs have hard API caps shared
 *     across every integration; DriftGuard must be a polite guest. The budget
 *     is admin-configurable and enforced *before* each outbound call.
 */
import { Errors } from "../middleware/errorHandler";

export interface BudgetStore {
  incr(key: string): Promise<number>; // returns post-increment count
}

export class MemoryBudgetStore implements BudgetStore {
  private counts = new Map<string, number>();
  async incr(key: string) {
    const n = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, n);
    return n;
  }
}

export interface SfClientOptions {
  orgId: string;
  dailyBudget: number;          // max outbound Salesforce calls per day
  budgetStore: BudgetStore;
  fetchFn?: typeof fetch;        // injectable for tests
  maxRetries?: number;
  baseDelayMs?: number;
  sleepFn?: (ms: number) => Promise<void>;
}

const TRANSIENT = new Set([429, 500, 502, 503, 504]);

export class SalesforceClient {
  private fetchFn: typeof fetch;
  private maxRetries: number;
  private baseDelayMs: number;
  private sleepFn: (ms: number) => Promise<void>;

  constructor(private opts: SfClientOptions) {
    this.fetchFn = opts.fetchFn ?? fetch;
    this.maxRetries = opts.maxRetries ?? 4;
    this.baseDelayMs = opts.baseDelayMs ?? 500;
    this.sleepFn = opts.sleepFn ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  private budgetKey(): string {
    const day = new Date().toISOString().slice(0, 10);
    return `sfbudget:${this.opts.orgId}:${day}`;
  }

  /** Wraps every outbound call: budget check, then retry-with-backoff. */
  async call(url: string, init?: RequestInit): Promise<Response> {
    const used = await this.opts.budgetStore.incr(this.budgetKey());
    if (used > this.opts.dailyBudget) {
      throw Errors.apiBudgetExceeded(this.opts.dailyBudget);
    }

    let lastStatus = 0;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const res = await this.fetchFn(url, init);
      if (!TRANSIENT.has(res.status)) return res;
      lastStatus = res.status;
      if (attempt < this.maxRetries) {
        // Exponential backoff with full jitter: delay in [0, base * 2^attempt)
        const ceiling = this.baseDelayMs * 2 ** attempt;
        await this.sleepFn(Math.random() * ceiling);
      }
    }
    void lastStatus;
    throw Errors.salesforceUnavailable();
  }
}
