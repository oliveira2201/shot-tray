import fs from "fs/promises";
import path from "path";
import JSON5 from "json5";

const extractBlock = (text, marker) => {
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

const extractEndpoint = (text) => {
  const match = text.match(/let\s+endpoint\s*=\s*"([^"]+)"/);
  return match ? match[1] : null;
};

const extractPayload = (text) => {
  const payloadBlock = extractBlock(text, "let payload =");
  if (!payloadBlock) return null;

  try {
    return JSON5.parse(payloadBlock);
  } catch (error) {
    return null;
  }
};

export const extractTemplatesFromFlow = async (flowFilePath) => {
  const content = await fs.readFile(flowFilePath, "utf-8");
  const flow = JSON.parse(content);
  const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];

  const templates = nodes
    .filter((node) => node.type === "wbh" && node.data?.message)
    .map((node) => {
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
    .filter((template) => template.payload);

  return templates;
};

export const extractTemplatesFromDir = async (flowsDir) => {
  const entries = await fs.readdir(flowsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(flowsDir, entry.name));

  const allTemplates = [];
  for (const file of files) {
    const templates = await extractTemplatesFromFlow(file);
    allTemplates.push(...templates);
  }

  return allTemplates;
};
