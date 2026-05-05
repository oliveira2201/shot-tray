import { Router } from "express";

export const adminAdaptersRouter = Router();

const adapters = [
  {
    type: "tray",
    label: "Tray Commerce",
    fields: [
      { name: "apiAddress", label: "API Address da Loja", type: "url", required: true, help: "URL retornada na ativação do app na Tray" },
      { name: "vars.link_loja", label: "URL pública da loja", type: "url", required: true },
    ],
    requiresOAuth: true,
  },
  {
    type: "nuvemshop",
    label: "Nuvemshop (via n8n)",
    fields: [
      { name: "vars.link_loja", label: "URL pública da loja", type: "url", required: true },
    ],
    requiresOAuth: false,
  },
  {
    type: "default",
    label: "Default (genérico)",
    fields: [
      { name: "vars.link_loja", label: "URL pública da loja", type: "url", required: false },
    ],
    requiresOAuth: false,
  },
];

const providers = [
  {
    type: "shotzap",
    label: "Shotzap",
    fields: [
      { name: "baseUrl", label: "Base URL Shotzap", type: "url", required: true, default: "https://api2.shotzap.com.br" },
      { name: "token", label: "Token Shotzap", type: "password", required: true },
      { name: "tagsCachePath", label: "Tags cache path", type: "text", required: false },
      { name: "paths.sendText", label: "Path sendText", type: "text", default: "/api/messages/send" },
      { name: "paths.addTag", label: "Path addTag", type: "text", default: "/api/tags/add" },
    ],
  },
];

adminAdaptersRouter.get("/api/admin/adapters", (_req, res) => res.json(adapters));
adminAdaptersRouter.get("/api/admin/providers", (_req, res) => res.json(providers));
