import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { requireAuth } from "../src/middleware/require-auth.js";

describe("requireAuth", () => {
  it("retorna 401 sem header Authorization", async () => {
    const app = express();
    app.get("/", requireAuth, (_req, res) => res.json({ ok: true }));
    const res = await request(app).get("/");
    expect(res.status).toBe(401);
  });

  it("retorna 401 com Bearer token invalido", async () => {
    const app = express();
    app.get("/", requireAuth, (_req, res) => res.json({ ok: true }));
    const res = await request(app).get("/").set("Authorization", "Bearer invalid");
    expect(res.status).toBe(401);
  });

  it("permite quando DISABLE_AUTH=1", async () => {
    process.env.DISABLE_AUTH = "1";
    const app = express();
    app.get("/", requireAuth, (_req, res) => res.json({ ok: true }));
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    delete process.env.DISABLE_AUTH;
  });
});
