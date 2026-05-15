import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "./supabase";
import {
  BOUNTY_TEMPLATES,
  type BountyTemplate,
} from "./bounty-templates";
import type { BountyRow, TradingAsset } from "@/types";

const TARGET_ACTIVE_MIN = 6;
const TARGET_ACTIVE_MAX = 12;

export interface EngineRunResult {
  timestamp: string;
  activeBefore: number;
  targetActive: number;
  created: BountyRow[];
  expired: number;
  errors: string[];
}

type InstantiatedBounty = Omit<BountyRow, "id">;

function renderTemplate(text: string, template: BountyTemplate): string {
  const direction =
    template.direction === null
      ? "either direction"
      : template.direction.toLowerCase();
  const replacements: Record<string, string> = {
    "{asset}": template.asset,
    "{direction}": direction,
    "{minPnl}": String(template.min_pnl_percent ?? "—"),
    "{maxPnl}": String(template.max_pnl_percent ?? "—"),
    "{minLeverage}": String(template.min_leverage ?? "—"),
    "{maxLeverage}": String(template.max_leverage ?? "—"),
    "{maxDuration}": String(template.max_duration_minutes ?? "—"),
  };
  return Object.entries(replacements).reduce(
    (acc, [token, value]) => acc.split(token).join(value),
    text,
  );
}

export function instantiateTemplate(
  template: BountyTemplate,
  now: Date = new Date(),
): InstantiatedBounty {
  const expiresAt = new Date(now.getTime() + template.ttl_minutes * 60_000);
  return {
    title: renderTemplate(template.titleTemplate, template),
    description: renderTemplate(template.descriptionTemplate, template),
    asset: template.asset,
    direction: template.direction,
    tier: template.tier,
    min_pnl_percent: template.min_pnl_percent,
    max_pnl_percent: template.max_pnl_percent,
    min_leverage: template.min_leverage,
    max_leverage: template.max_leverage,
    max_duration_minutes: template.max_duration_minutes,
    min_position_size_usd: template.min_position_size_usd,
    reward_points: template.reward_points,
    status: "active",
    claimed_by: null,
    claimed_at: null,
    claimed_trade_tx: null,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };
}

export function pickWeightedTemplate(
  templates: readonly BountyTemplate[],
  rng: () => number = Math.random,
): BountyTemplate {
  const totalWeight = templates.reduce((sum, t) => sum + t.weight, 0);
  let r = rng() * totalWeight;
  for (const t of templates) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return templates[templates.length - 1];
}

/**
 * Pick `count` distinct templates with weighted-random sampling and a soft
 * preference against over-representing any single asset in the resulting set.
 *
 * - Sampling is without replacement at the template-id level (no duplicates).
 * - Asset preference: each pick tries to avoid templates whose asset already
 *   has the most representation among (existingActiveAssets + alreadyPicked).
 *   If the filtered pool is empty (e.g. only one asset left), fall back to
 *   the full remaining pool.
 */
export function pickTemplates(
  count: number,
  existingActiveAssets: TradingAsset[] = [],
  rng: () => number = Math.random,
): BountyTemplate[] {
  const remaining = [...BOUNTY_TEMPLATES];
  const picked: BountyTemplate[] = [];
  const assetCounts = new Map<TradingAsset, number>();
  for (const a of existingActiveAssets) {
    assetCounts.set(a, (assetCounts.get(a) ?? 0) + 1);
  }

  for (let i = 0; i < count && remaining.length > 0; i++) {
    // Find the maximum asset count; templates of that asset are deprioritized.
    let maxCount = 0;
    for (const c of assetCounts.values()) {
      if (c > maxCount) maxCount = c;
    }
    const preferredPool =
      maxCount > 0
        ? remaining.filter((t) => (assetCounts.get(t.asset) ?? 0) < maxCount)
        : remaining;
    const pool = preferredPool.length > 0 ? preferredPool : remaining;

    const choice = pickWeightedTemplate(pool, rng);
    picked.push(choice);
    assetCounts.set(choice.asset, (assetCounts.get(choice.asset) ?? 0) + 1);

    const idx = remaining.indexOf(choice);
    if (idx >= 0) remaining.splice(idx, 1);
  }

  return picked;
}

interface RunOptions {
  supabase?: SupabaseClient;
  now?: Date;
  rng?: () => number;
}

export async function runBountyEngine(
  options: RunOptions = {},
): Promise<EngineRunResult> {
  const supabase = options.supabase ?? getServiceSupabase();
  const now = options.now ?? new Date();
  const rng = options.rng ?? Math.random;
  const nowIso = now.toISOString();

  const result: EngineRunResult = {
    timestamp: nowIso,
    activeBefore: 0,
    targetActive: TARGET_ACTIVE_MIN,
    created: [],
    expired: 0,
    errors: [],
  };

  // 1. Mark bounties whose expires_at has passed.
  try {
    const { data: expiredRows, error: expireError } = await supabase
      .from("bounties")
      .update({ status: "expired" })
      .eq("status", "active")
      .lt("expires_at", nowIso)
      .select("id");
    if (expireError) {
      result.errors.push(`expire: ${expireError.message}`);
    } else {
      result.expired = expiredRows?.length ?? 0;
    }
  } catch (e) {
    result.errors.push(`expire: ${e instanceof Error ? e.message : "unknown"}`);
  }

  // 2. Count current active bounties and capture their assets for diversity.
  let activeRows: { asset: TradingAsset }[] = [];
  try {
    const { data, error } = await supabase
      .from("bounties")
      .select("asset")
      .eq("status", "active");
    if (error) {
      result.errors.push(`count: ${error.message}`);
    } else {
      activeRows = (data ?? []) as { asset: TradingAsset }[];
    }
  } catch (e) {
    result.errors.push(`count: ${e instanceof Error ? e.message : "unknown"}`);
  }
  result.activeBefore = activeRows.length;

  // 3. If we're already at or over MAX, don't add anything; let it drain.
  if (result.activeBefore >= TARGET_ACTIVE_MAX) {
    return result;
  }

  // 4. Refill to TARGET_ACTIVE_MIN. Above MIN but below MAX → no action this run.
  const needed = Math.max(0, TARGET_ACTIVE_MIN - result.activeBefore);
  if (needed === 0) return result;

  const templates = pickTemplates(
    needed,
    activeRows.map((r) => r.asset),
    rng,
  );
  const newRows = templates.map((t) => instantiateTemplate(t, now));

  // 5. Insert. On error, capture and return what we have.
  try {
    const { data: inserted, error: insertError } = await supabase
      .from("bounties")
      .insert(newRows)
      .select("*");
    if (insertError) {
      result.errors.push(`insert: ${insertError.message}`);
    } else if (inserted) {
      result.created = inserted as BountyRow[];
    }
  } catch (e) {
    result.errors.push(`insert: ${e instanceof Error ? e.message : "unknown"}`);
  }

  return result;
}
