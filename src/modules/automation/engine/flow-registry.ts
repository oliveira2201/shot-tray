import fs from "fs/promises";
import path from "path";
import { UseCase } from "../../../types/automation.js";
import { logger } from "../../../utils/logger.js";

// Cache flows per tenant to avoid reading disk on every webhook
const flowCache: Record<string, UseCase[]> = {};

const loadFlows = async (tenantId: string): Promise<UseCase[]> => {
  if (flowCache[tenantId]) {
    return flowCache[tenantId];
  }

  const flowsDir = path.join(process.cwd(), "src", "tenants", tenantId, "flows");
  
  try {
    // Check if directory exists
    await fs.access(flowsDir);
  } catch (e) {
    logger.warn({ tenantId, path: flowsDir }, "Flows directory not found for tenant");
    return [];
  }

  try {
    const files = await fs.readdir(flowsDir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    
    const flows: UseCase[] = [];
    
    for (const file of jsonFiles) {
      const filePath = path.join(flowsDir, file);
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const flow = JSON.parse(content) as UseCase;
        
        // Basic validation could happen here
        if (flow.id && flow.steps) {
            flows.push(flow);
        } else {
             logger.warn({ file }, "Skipping invalid flow file (missing id or steps)");
        }
      } catch (err) {
        logger.error({ err, file }, "Failed to parse flow file");
      }
    }

    flowCache[tenantId] = flows;
    return flows;
  } catch (err) {
    logger.error({ err, tenantId }, "Failed to load flows");
    return [];
  }
};

export const findFlowByAlias = async (tenantId: string, alias: string): Promise<UseCase | undefined> => {
  const flows = await loadFlows(tenantId);
  const normalized = alias.toLowerCase();
  
  return flows.find((flow) =>
    flow.aliases.some((a) => a.toLowerCase().includes(normalized))
  );
};

// Method to force reload (useful for "visualizer" or updates)
export const reloadFlows = (tenantId: string) => {
    delete flowCache[tenantId];
};
