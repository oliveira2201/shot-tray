import axios from "axios";
import { describe, expect, it, vi } from "vitest";
import { ShotzapProvider } from "../src/modules/automation/channels/shotzap/provider.js";

// Mock axios completely
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

describe("ShotzapProvider Logic", () => {
    it("Should convert sendButtons call to sendText API call", async () => {
        // Setup Provider
        const provider = new ShotzapProvider({
            baseUrl: "https://api.test",
            token: "test-token",
            paths: {
                sendText: "/api/messages/send"
            }
        });

        // Button Payload (Simulating what engine sends)
        const buttonPayload = {
            openTicket: 0,
            body: [
                {
                    phone: "558699999999",
                    title: "Olá Cliente",
                    body: "Seu pedido chegou",
                    footer: "Equipe Ebenezer",
                    buttons: [
                        { type: "url", text: "Rastrear", url: "https://rastreio.com" },
                        { type: "quickreply", text: "Ajuda", value: "Ajuda" }
                    ]
                }
            ]
        };

        // Execute
        await provider.sendButtons(buttonPayload);

        // Get the mocked client from axios.create
        const client = (axios.create as any).mock.results[0].value;
        const mockPost = client.post;

        // Verify Call
        expect(mockPost).toHaveBeenCalledTimes(1);

        const [url, payload] = mockPost.mock.calls[0];

        // 1. Check URL (Must be TEXT endpoint)
        expect(url).toBe("/api/messages/send");

        // 2. Check Payload Structure (Must conform to SendText flat payload)
        expect(payload).toHaveProperty("number", "558699999999");
        expect(payload).toHaveProperty("openTicket", "0");
        expect(payload).toHaveProperty("body");

        // 3. Check Message Content Formatting
        const msg = payload.body;
        expect(msg).toContain("*Olá Cliente*"); // Title
        expect(msg).toContain("Seu pedido chegou"); // Body
        expect(msg).toContain("_Equipe Ebenezer_"); // Footer
        expect(msg).toContain("🔗 Rastrear: https://rastreio.com"); // URL Button converted
        expect(msg).toContain("👉 Ajuda"); // QuickReply converted

        console.log("Converted Message Body:\n" + msg);
    });
});
