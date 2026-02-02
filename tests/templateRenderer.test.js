import { describe, it, expect } from "vitest";
import { renderTemplate } from "../src/flow-engine/templateRenderer.js";

describe("renderTemplate", () => {
  it("renderiza placeholders com chaves diferentes", () => {
    const template = {
      title: "Olá {{name}}",
      body: "Rastreio: %extra1%",
      footer: "Cliente {nome}"
    };

    const context = { name: "Ana", extra1: "ABC" };
    const rendered = renderTemplate(template, context);

    expect(rendered.title).toBe("Olá Ana");
    expect(rendered.body).toBe("Rastreio: ABC");
    expect(rendered.footer).toBe("Cliente Ana");
  });
});
