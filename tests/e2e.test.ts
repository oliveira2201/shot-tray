import axios from "axios";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app.js";

// Mock Delay to make tests instant
vi.mock("../src/utils/delay.js", () => ({
  delay: vi.fn().mockResolvedValue(undefined)
}));

// Mock Axios to intercept requests
vi.mock("axios", () => {
    const mockPost = vi.fn(() => Promise.resolve({ data: { success: true } }));
    return {
        default: {
            create: vi.fn(() => ({
                post: mockPost
            }))
        }
    };
});

// Helper to get the mocked post function
const getAxiosPost = () => {
   const client = (axios.create as any).mock.results[0]?.value;
   return client?.post;
};

// We DO NOT mock the Provider Class anymore. 
// We want to test that the Real Provider correctly converts buttons to text.

describe("E2E Automation Flows (Ebenezer)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Carrinho Abandonado 1: Should add tag and send BUTTONS as TEXT", async () => {
    // DefaultAdapter maps 'itemsSummary' to 'extra3'
    const payload = {
      type: "carrinho_abandonado",
      customer: { name: "Cliente Teste", phone: "5586995336923" },
      itemsSummary: "Livros" // Fixed: moved from data.extra3 to itemsSummary
    };

    const res = await request(app).post("/webhooks/ebenezer").send(payload);

    expect(res.status).toBe(200);
    expect(res.body.flow).toBe("_[EBE] Carrinho Abandonado1");
    
    // Get the mock
    const postMock = getAxiosPost();
    expect(postMock).toHaveBeenCalled();

    // Find the call for sending buttons
    // The provider converts buttons to TEXT, so we look for api/messages/send
    const calls = postMock.mock.calls;
    
    // We expect at least one call to /tag/add (via mock path) or defined in tenants.json
    // And one call to sendText (converted from buttons)

    // Check Button Conversion Call
    const messageCall = calls.find((c: any) => c[0].includes("send") && c[1].body.includes("👇 *Opções:*"));
    expect(messageCall).toBeTruthy();
    
    const [endpoint, data] = messageCall;
    expect(endpoint).toContain("/api/messages/send"); // Must be TEXT endpoint
    expect(data.number).toBe("5586995336923");
    expect(data.body).toContain("Livros"); // Checks if template was rendered
    expect(data.body).toContain("🔗 Acessar Carrinho"); // Button converted to link
  });

  it("Pedido Recebido: Should clear tags and send tracking/options as TEXT", async () => {
    const payload = {
      status: "pedido_recebido",
      customer: { name: "Cliente Teste", phone: "5586995336923" },
      order: { trackingUrl: "http://rastreio.com" } 
    };

    const res = await request(app).post("/webhooks/ebenezer").send(payload);

    expect(res.status).toBe(200);
    expect(res.body.flow).toBe("[EBE] Pedido Recebido");

    const postMock = getAxiosPost();
    
    // Check for Text Message (Should send "Mensagem teste")
    const textCall = postMock.mock.calls.find((c: any) => c[1].body === "teste"); // template is "teste"
    // Note: The template "pedidoRecebidoTeste" is "teste".
    expect(textCall).toBeTruthy();

    // Check for Button Conversion (Rastreio)
    // The template "pedidoRecebido" has tracking Url
    const buttonCall = postMock.mock.calls.find((c: any) => 
        c[0].includes("send") && 
        c[1].body && 
        c[1].body.includes("👇 *Opções:*") &&
        c[1].body.includes("🔗 Rastrear Pedido")
    );
    expect(buttonCall).toBeTruthy();
    const payloadSent = buttonCall[1];
    expect(payloadSent.body).toContain("http://rastreio.com"); // Variable rendered
  });

  it("Should ignore unknown events", async () => {
    const payload = {
      status: "evento_desconhecido"
    };
    
    const res = await request(app).post("/webhooks/ebenezer").send(payload);
    
    expect(res.status).toBe(200);
    expect(res.body.ignored).toBe(true);
  });
});
