import { describe, it, expect, beforeEach } from "vitest";
import { TenantService } from "../src/services/tenantService.js";

describe("TenantService", () => {
  beforeEach(() => TenantService.invalidateAll());

  it("retorna null para tenant inexistente", async () => {
    const cfg = await TenantService.getTenantConfig("naoexiste");
    expect(cfg).toBeNull();
  });

  it("retorna config de lumi via fallback de arquivo", async () => {
    const cfg = await TenantService.getTenantConfig("lumi");
    expect(cfg?.id).toBe("lumi");
    expect(cfg?.provider).toBeDefined();
    expect(cfg?.templates).toBeDefined();
    expect(typeof cfg?.templates).toBe("object");
  });

  it("invalida cache do tenant especifico", async () => {
    await TenantService.getTenantConfig("lumi");
    TenantService.invalidate("lumi");
    const cfg = await TenantService.getTenantConfig("lumi");
    expect(cfg).not.toBeNull();
  });
});
