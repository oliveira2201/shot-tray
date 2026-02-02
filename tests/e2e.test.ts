import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";

// Mock Delay to make tests instant
vi.mock("../src/utils/delay.js", () => ({
  delay: vi.fn().mockResolvedValue(undefined)
}));

// Spies for Provider Methods
const sendTextSpy = vi.fn();
const sendButtonsSpy = vi.fn();
const addTagSpy = vi.fn();
const removeTagSpy = vi.fn();

// Mock the Output Provider
vi.mock("../src/modules/automation/channels/shotzap/provider.js", () => {
  return {
    ShotzapProvider: class {
      constructor() {}
      async sendText(p: any) { return sendTextSpy(p); }
      async sendButtons(p: any) { return sendButtonsSpy(p); }
      async addTag(p: any) { return addTagSpy(p); }
      async removeTag(p: any) { return removeTagSpy(p); }
    }
  };
});

describe("E2E Automation Flows (Ebenezer)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Carrinho Abandonado 1: Should add tag and send button", async () => {
    const payload = {
      type: "carrinho_abandonado",
      customer: { name: "Cliente Teste", phone: "5511999990000" },
      data: { extra3: "Livros" }
    };

    const res = await request(app).post("/webhooks/ebenezer").send(payload);

    expect(res.status).toBe(200);
    expect(res.body.flow).toBe("_[EBE] Carrinho Abandonado1");
    
    // Check Flow Execution
    // 1. Check Tags logic (stopIfHasAnyTag) - skipped if no tags
    // 2. Add Tag
    expect(addTagSpy).toHaveBeenCalledWith(expect.objectContaining({
      tag: "[EBE] Pedido Carrinho Abandonado2",
      phone: "5511999990000"
    }));
    // 3. Send Buttons
    expect(sendButtonsSpy).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.arrayContaining([
        expect.objectContaining({
            title: expect.stringContaining("Cliente Teste")
        })
      ])
    }));
  });

  it("Pedido Recebido: Should clear tags and send tracking/options", async () => {
    const payload = {
      status: "pedido_recebido",
      customer: { name: "Cliente Teste", phone: "5511999990000" },
      // default-adapter maps extra1 to trackingUrl if present
      order: { trackingUrl: "http://rastreio.com" } 
    };

    const res = await request(app).post("/webhooks/ebenezer").send(payload);

    expect(res.status).toBe(200);
    expect(res.body.flow).toBe("[EBE] Pedido Recebido");

    // 1. Add Tag Recebido1
    expect(addTagSpy).toHaveBeenCalledWith(expect.objectContaining({
        tag: "[EBE] Pedido Recebido1"
    }));

    // 2. Remove Multiple Tags (Should call removeTag multiple times)
    // Checking one of them
    expect(removeTagSpy).toHaveBeenCalledWith(expect.objectContaining({
        tag: "[EBE] Pedido Enviado"
    }));

    // 3. Send Buttons (Rastreio)
    expect(sendButtonsSpy).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.arrayContaining([
            expect.objectContaining({
                // Case insensitive match
                body: expect.stringMatching(/recebemos seu pedido/i)
            })
        ])
    }));
  });

  it("Pedido Enviado: Should clear old tags and send tracking", async () => {
    const payload = {
      status: "pedido_enviado",
      customer: { name: "Cliente Teste", phone: "5511999990000" },
      trackingUrl: "http://correios.com.br/123"
    };

    const res = await request(app).post("/webhooks/ebenezer").send(payload);

    expect(res.status).toBe(200);
    expect(res.body.flow).toBe("_[EBE] Pedido Enviado");

    // 1. Add Tag Cliente
    expect(addTagSpy).toHaveBeenCalledWith(expect.objectContaining({
        tag: "[EBE] Cliente"
    }));

    // 2. Remove Tags (Many)
    expect(removeTagSpy).toHaveBeenCalledWith(expect.objectContaining({
        tag: "[EBE] Pedido Pago"
    }));

    // 3. Send Buttons (Tracking)
    // The template probably uses {{extra1}} which maps to trackingUrl
    expect(sendButtonsSpy).toHaveBeenCalled();
    const calls = sendButtonsSpy.mock.calls;
    const trackingCall = calls.find((c: any) => JSON.stringify(c).includes("http://correios.com.br/123"));
    expect(trackingCall).toBeTruthy();
  });

  it("Pedido Pago: Should mark as paid and clear others", async () => {
     const payload = {
      status: "pedido_pago",
      customer: { name: "Cliente Teste", phone: "5511999990000" }
    };

    const res = await request(app).post("/webhooks/ebenezer").send(payload);
    
    expect(res.status).toBe(200);
    expect(res.body.flow).toBe("[EBE] Pedido Pago");

    expect(addTagSpy).toHaveBeenCalledWith(expect.objectContaining({
        tag: "[EBE] Pedido Pago"
    }));

    expect(removeTagSpy).toHaveBeenCalledWith(expect.objectContaining({
        tag: "[EBE] Pedido Recebido"
    }));
    
    expect(sendButtonsSpy).toHaveBeenCalled();
  });

  it("Should ignore unknown events", async () => {
    const payload = {
      status: "evento_desconhecido"
    };
    
    const res = await request(app).post("/webhooks/ebenezer").send(payload);
    
    expect(res.status).toBe(200); // 200 ignored
    expect(res.body.ignored).toBe(true);
    expect(sendTextSpy).not.toHaveBeenCalled();
  });
});
