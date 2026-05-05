import { UseCase, Step } from "../../../types/automation.js";
import { TenantRepository } from "../../../lib/repositories/tenant-repository.js";

const repo = new TenantRepository({ fallbackToFiles: process.env.DISABLE_FILE_FALLBACK !== "1" });

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { flows: UseCase[]; expiresAt: number }>();

export async function listFlows(tenantId: string): Promise<UseCase[]> {
  const cached = cache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.flows;

  const rows = await repo.listFlows(tenantId);
  const flows: UseCase[] = rows
    .filter((r) => r.enabled)
    .map((r) => ({
      id: r.slug,
      title: r.title,
      aliases: r.aliases,
      description: r.description,
      steps: r.steps as Step[],
    }));

  cache.set(tenantId, { flows, expiresAt: Date.now() + CACHE_TTL_MS });
  return flows;
}

export async function findFlowByAlias(tenantId: string, alias: string): Promise<UseCase | undefined> {
  const flows = await listFlows(tenantId);
  const normalized = alias.toLowerCase();
  return flows.find((f) => f.aliases.some((a) => a.toLowerCase().includes(normalized)));
}

export function invalidate(tenantId: string) {
  cache.delete(tenantId);
}

export function invalidateAll() {
  cache.clear();
}

// Backwards compat — same behavior as invalidate, kept for case-runner / scheduler
export async function reloadFlows(tenantId: string): Promise<UseCase[]> {
  invalidate(tenantId);
  return listFlows(tenantId);
}
