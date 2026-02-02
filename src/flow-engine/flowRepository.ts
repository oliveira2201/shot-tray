import path from "path";
import { env } from "../config/env.js";
import { extractTemplatesFromDir, ExtractedTemplate } from "./extractTemplates.js";

let cachedTemplates: ExtractedTemplate[] | null = null;

export const loadFlowTemplates = async (): Promise<ExtractedTemplate[]> => {
  if (cachedTemplates) return cachedTemplates;

  const flowsDir = path.isAbsolute(env.FLOWS_DIR)
    ? env.FLOWS_DIR
    : path.join(process.cwd(), env.FLOWS_DIR);

  cachedTemplates = await extractTemplatesFromDir(flowsDir);
  return cachedTemplates;
};
