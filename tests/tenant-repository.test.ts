import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs/promises";

const findUnique = vi.fn();
const tenantFindMany = vi.fn();
const templateFindMany = vi.fn();
const flowFindMany = vi.fn();

vi.mock("../src/lib/prisma.js", () => ({
  getPrisma: async () => ({
    tenant: { findUnique, findMany: tenantFindMany },
    template: { findMany: templateFindMany },
    flow: { findMany: flowFindMany },
  }),
}));

import { TenantRepository } from "../src/lib/repositories/tenant-repository.js";

describe("TenantRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUnique.mockResolvedValue(null);
    tenantFindMany.mockResolvedValue([]);
    templateFindMany.mockResolvedValue([]);
    flowFindMany.mockResolvedValue([]);
  });

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

  it("DB com dados retorna do DB sem cair no fallback", async () => {
    const dbRow = {
      id: "from-db",
      name: "From DB",
      status: "active",
      adapterType: "db-adapter",
      providerType: "db-provider",
      adapterConfig: { fromDb: true },
      providerConfig: { fromDb: true },
    };
    findUnique.mockResolvedValueOnce(dbRow);
    const readFileSpy = vi.spyOn(fs, "readFile");

    const repo = new TenantRepository({ fallbackToFiles: true });
    const result = await repo.findById("from-db");

    expect(result).toEqual(dbRow);
    expect(result?.adapterConfig).toEqual({ fromDb: true });
    expect(readFileSpy).not.toHaveBeenCalled();

    readFileSpy.mockRestore();
  });
});
