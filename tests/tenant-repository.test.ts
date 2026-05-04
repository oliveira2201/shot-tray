import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../src/lib/prisma.js", () => ({
  getPrisma: async () => ({
    tenant: { findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
    template: { findMany: vi.fn().mockResolvedValue([]) },
    flow: { findMany: vi.fn().mockResolvedValue([]) },
  }),
}));

import { TenantRepository } from "../src/lib/repositories/tenant-repository.js";

describe("TenantRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna null quando tenant nao existe no DB e fallback desabilitado", async () => {
    const repo = new TenantRepository({ fallbackToFiles: false });
    const result = await repo.findById("inexistente");
    expect(result).toBeNull();
  });

  it("retorna tenant do arquivo quando DB vazio e fallback habilitado", async () => {
    const repo = new TenantRepository({ fallbackToFiles: true });
    const result = await repo.findById("lumi");
    expect(result?.id).toBe("lumi");
    expect(result?.adapterType).toBe("nuvemshop");
  });
});
