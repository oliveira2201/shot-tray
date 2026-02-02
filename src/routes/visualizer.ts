import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { generateFlowDiagram } from "../utils/visualizer.js";

export const visualizerRouter = Router();

// List Flows
visualizerRouter.get("/visualize/:tenantId", async (req, res) => {
  const { tenantId } = req.params;
  const flowsDir = path.join(process.cwd(), "src", "tenants", tenantId, "flows");
  try {
    const files = await fs.readdir(flowsDir);
    const flows = files.filter(f => f.endsWith(".json")).map(f => f.replace(".json", ""));
    const html = `
      <html>
        <body style="font-family: sans-serif; padding: 20px;">
          <h1>Fluxos: ${tenantId}</h1>
          <ul>
            ${flows.map(f => `<li><a href="/visualize/${tenantId}/${f}/view">${f}</a></li>`).join('')}
          </ul>
        </body>
      </html>
    `;
    res.send(html);
  } catch (e) {
    res.status(404).send("Tenant not found");
  }
});

// View Flow
visualizerRouter.get("/visualize/:tenantId/:flowId/view", async (req, res) => {
  const { tenantId, flowId } = req.params;
  const diagram = await generateFlowDiagram(tenantId, flowId);
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Visualizador: ${flowId}</title>
    </head>
    <body>
      <div style="margin-bottom: 20px;">
        <a href="/visualize/${tenantId}">← Voltar</a> | 
        <strong>${flowId}</strong>
      </div>
      <div class="mermaid">
        ${diagram}
      </div>
      <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
        mermaid.initialize({ startOnLoad: true });
      </script>
    </body>
    </html>
  `;
  res.send(html);
});
