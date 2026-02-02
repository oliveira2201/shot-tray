import fs from "fs/promises";
import path from "path";
import JSON5 from "json5";

const extractBlock = (text: string, marker: string): string | null => {
  const index = text.indexOf(marker);
  if (index === -1) return null;

  const startIndex = index + marker.length;
  const slice = text.slice(startIndex);
  const firstBrace = slice.indexOf("{");
  if (firstBrace === -1) return null;

  let depth = 0;
  let endIndex = -1;
  for (let i = firstBrace; i < slice.length; i += 1) {
    const char = slice[i];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) return null;
  return slice.slice(firstBrace, endIndex + 1);
};

const extractEndpoint = (text: string): string | null => {
  const match = text.match(/let\s+endpoint\s*=\s*"([^"]+)"/);
  return match ? match[1] : null;
};

const extractPayload = (text: string): any => {
  const payloadBlock = extractBlock(text, "let payload =");
  if (!payloadBlock) return null;

  try {
    return JSON5.parse(payloadBlock);
  } catch (error) {
    return null;
  }
};

export interface ExtractedTemplate {
  flowFile: string;
  nodeId: string;
  endpoint: string | null;
  payload: any;
}

export const extractTemplatesFromFlow = async (flowFilePath: string): Promise<ExtractedTemplate[]> => {
  const content = await fs.readFile(flowFilePath, "utf-8");
  const flow = JSON.parse(content);
  const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];

  const templates: ExtractedTemplate[] = nodes
    .filter((node: any) => node.type === "wbh" && node.data?.message)
    .map((node: any) => {
      const message = node.data.message;
      const endpoint = extractEndpoint(message);
      const payload = extractPayload(message);

      return {
        flowFile: path.basename(flowFilePath),
        nodeId: node.id,
        endpoint,
        payload
      };
    })
    .filter((template: any) => template.payload);

  return templates;
};

export const extractTemplatesFromDir = async (flowsDir: string): Promise<ExtractedTemplate[]> => {
  const entries = await fs.readdir(flowsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(flowsDir, entry.name));

  const allTemplates: ExtractedTemplate[] = [];
  for (const file of files) {
    const templates = await extractTemplatesFromFlow(file);
    allTemplates.push(...templates);
  }

  return allTemplates;
};
