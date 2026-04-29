// Tiny in-memory fake of @supabase/supabase-js, just enough to drive
// claim-trade.ts (the only module under test that touches Supabase).
// Shared between claim-trade.test.ts and claim-route.test.ts.

import type { SupabaseClient } from "@supabase/supabase-js";

type FakeRow = Record<string, unknown>;

interface ExecOpts {
  count?: boolean;
  head?: boolean;
  expect?: "maybeSingle" | "single";
}

export class FakeSupabase {
  bounties = new Map<string, FakeRow>();
  claims: FakeRow[] = [];
  user_stats = new Map<string, FakeRow>();
  /** Keyed by tx_signature (which is UNIQUE per the migration). */
  recent_closes = new Map<string, FakeRow>();
  /** Hook fires once before the next bounties UPDATE — for race tests. */
  beforeBountyUpdate?: () => void | Promise<void>;
  /** Inject errors on specific table operations for failure-mode tests. */
  errorOn?: (table: string, op: string) => unknown | null;
  nextClaimId = 1;
  nextRecentCloseId = 1;

  from(table: string): FakeChain {
    return new FakeChain(this, table);
  }
}

class FakeChain implements PromiseLike<{ data: unknown; error: unknown }> {
  private op: "select" | "insert" | "update" | "upsert" = "select";
  private filters: { col: string; cmp: "=" | ">=" | ">"; val: unknown }[] = [];
  private payload: unknown = null;
  private wantCount = false;
  private headOnly = false;
  private orderCol: string | null = null;
  private orderAscending = true;

  constructor(
    private fake: FakeSupabase,
    private table: string,
  ) {}

  select(_cols?: string, opts?: { count?: "exact"; head?: boolean }): this {
    if (opts?.count) this.wantCount = true;
    if (opts?.head) this.headOnly = true;
    return this;
  }
  insert(payload: unknown): this {
    this.op = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: unknown): this {
    this.op = "update";
    this.payload = payload;
    return this;
  }
  upsert(payload: unknown, _opts?: unknown): this {
    this.op = "upsert";
    this.payload = payload;
    return this;
  }
  eq(col: string, val: unknown): this {
    this.filters.push({ col, cmp: "=", val });
    return this;
  }
  gte(col: string, val: unknown): this {
    this.filters.push({ col, cmp: ">=", val });
    return this;
  }
  gt(col: string, val: unknown): this {
    this.filters.push({ col, cmp: ">", val });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }): this {
    this.orderCol = col;
    this.orderAscending = opts?.ascending ?? true;
    return this;
  }
  async maybeSingle(): Promise<{ data: unknown; error: unknown }> {
    return this.exec({ expect: "maybeSingle" });
  }
  async single(): Promise<{ data: unknown; error: unknown }> {
    return this.exec({ expect: "single" });
  }
  then<R1 = { data: unknown; error: unknown }, R2 = never>(
    onfulfilled?:
      | ((v: { data: unknown; error: unknown }) => R1 | PromiseLike<R1>)
      | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return this.exec({}).then(onfulfilled, onrejected);
  }

  private matches(row: FakeRow): boolean {
    return this.filters.every((f) => {
      const cell = row[f.col];
      if (f.cmp === "=") return cell === f.val;
      if (f.cmp === ">=") return String(cell) >= String(f.val);
      if (f.cmp === ">") return String(cell) > String(f.val);
      return false;
    });
  }

  private applyOrder<T extends FakeRow>(rows: T[]): T[] {
    if (!this.orderCol) return rows;
    const col = this.orderCol;
    const asc = this.orderAscending;
    return [...rows].sort((a, b) => {
      const av = a[col];
      const bv = b[col];
      if (av === bv) return 0;
      const cmp = (av as number | string) > (bv as number | string) ? 1 : -1;
      return asc ? cmp : -cmp;
    });
  }

  private injectedError(op: string): unknown | null {
    return this.fake.errorOn ? this.fake.errorOn(this.table, op) ?? null : null;
  }

  private async exec(
    opts: ExecOpts,
  ): Promise<{ data: unknown; error: unknown; count?: number }> {
    if (this.table === "claims") return this.execClaims(opts);
    if (this.table === "bounties") return this.execBounties(opts);
    if (this.table === "user_stats") return this.execUserStats(opts);
    if (this.table === "recent_closes") return this.execRecentCloses(opts);
    return { data: null, error: { message: `unknown table ${this.table}` } };
  }

  private async execClaims(opts: ExecOpts) {
    if (this.op === "select") {
      const matching = this.fake.claims.filter((r) => this.matches(r));
      if (this.wantCount && this.headOnly) {
        return { data: null, error: null, count: matching.length };
      }
      if (opts.expect === "maybeSingle") {
        return { data: matching.length > 0 ? matching[0] : null, error: null };
      }
      return { data: matching, error: null };
    }
    if (this.op === "insert") {
      const row = {
        ...(this.payload as object),
        id: `claim-${this.fake.nextClaimId++}`,
      } as FakeRow;
      this.fake.claims.push(row);
      return { data: row, error: null };
    }
    return {
      data: null,
      error: { message: `op ${this.op} not implemented for claims` },
    };
  }

  private async execBounties(opts: ExecOpts) {
    if (this.op === "select") {
      const injected = this.injectedError("select");
      if (injected) return { data: null, error: injected };
      const matches = this.applyOrder(
        [...this.fake.bounties.values()].filter((r) => this.matches(r)),
      );
      if (opts.expect === "maybeSingle") {
        return { data: matches.length > 0 ? matches[0] : null, error: null };
      }
      return { data: matches, error: null };
    }
    if (this.op === "update") {
      if (this.fake.beforeBountyUpdate) {
        const hook = this.fake.beforeBountyUpdate;
        this.fake.beforeBountyUpdate = undefined;
        await hook();
      }
      const matches = [...this.fake.bounties.values()].filter((r) =>
        this.matches(r),
      );
      for (const row of matches) {
        Object.assign(row, this.payload as object);
      }
      if (opts.expect === "maybeSingle") {
        return { data: matches.length > 0 ? matches[0] : null, error: null };
      }
      return { data: matches, error: null };
    }
    return {
      data: null,
      error: { message: `op ${this.op} not implemented for bounties` },
    };
  }

  private async execUserStats(opts: ExecOpts) {
    if (this.op === "select") {
      const w = this.filters.find((f) => f.col === "wallet")?.val;
      const row =
        w !== undefined ? this.fake.user_stats.get(String(w)) : undefined;
      if (opts.expect === "maybeSingle") {
        return { data: row ?? null, error: null };
      }
      return { data: row ? [row] : [], error: null };
    }
    if (this.op === "upsert") {
      const row = this.payload as FakeRow;
      this.fake.user_stats.set(String(row.wallet), row);
      return { data: row, error: null };
    }
    return {
      data: null,
      error: { message: `op ${this.op} not implemented for user_stats` },
    };
  }

  private async execRecentCloses(opts: ExecOpts) {
    if (this.op === "insert") {
      const injected = this.injectedError("insert");
      if (injected) return { data: null, error: injected };
      const row = this.payload as FakeRow;
      const sig = String(row.tx_signature);
      if (this.fake.recent_closes.has(sig)) {
        // Postgres unique violation
        return {
          data: null,
          error: {
            code: "23505",
            message: `duplicate key value violates unique constraint "recent_closes_tx_signature_key"`,
          },
        };
      }
      const inserted = {
        ...row,
        id: `rc-${this.fake.nextRecentCloseId++}`,
      } as FakeRow;
      this.fake.recent_closes.set(sig, inserted);
      return { data: inserted, error: null };
    }
    if (this.op === "update") {
      const injected = this.injectedError("update");
      if (injected) return { data: null, error: injected };
      const matches = [...this.fake.recent_closes.values()].filter((r) =>
        this.matches(r),
      );
      for (const row of matches) {
        Object.assign(row, this.payload as object);
      }
      if (opts.expect === "maybeSingle") {
        return { data: matches[0] ?? null, error: null };
      }
      return { data: matches, error: null };
    }
    if (this.op === "select") {
      const matches = [...this.fake.recent_closes.values()].filter((r) =>
        this.matches(r),
      );
      if (opts.expect === "maybeSingle") {
        return { data: matches[0] ?? null, error: null };
      }
      return { data: matches, error: null };
    }
    return {
      data: null,
      error: { message: `op ${this.op} not implemented for recent_closes` },
    };
  }
}

export function asSupabase(fake: FakeSupabase): SupabaseClient {
  return fake as unknown as SupabaseClient;
}
