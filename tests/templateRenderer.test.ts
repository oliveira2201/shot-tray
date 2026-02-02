import { describe, expect, it } from "vitest";
import { renderTemplate } from "../src/flow-engine/templateRenderer";

describe("renderTemplate", () => {
  it("renderiza placeholders com chaves diferentes", () => {
    const template = {
      title: "Olá {{name}}",
      body: "Rastreio: {{extra1}}",
      footer: "Cliente {{nome}}"
    };

    const context = { name: "Ana", extra1: "ABC" };
    // @ts-ignore
    const rendered = renderTemplate(template, context);

    expect(rendered.title).toBe("Olá Ana");
    expect(rendered.body).toBe("Rastreio: ABC");
    expect(rendered.footer).toBe("Cliente Ana");
  });

  it("renderiza recursivamente arrays e objetos", () => {
      const template = {
          buttons: [
              { type: "url", url: "{{url}}" }
          ]
      };
      const context = { url: "http://test.com" };
      const rendered = renderTemplate(template, context);
      expect(rendered.buttons[0].url).toBe("http://test.com");
  });
});
