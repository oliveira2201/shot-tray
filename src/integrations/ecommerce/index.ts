import { DefaultAdapter } from "./default-adapter.js";
import { NuvemshopAdapter } from "./nuvemshop-adapter.js";
import { IIntegrationAdapter } from "../../types/integration.js";

const adapters: Record<string, IIntegrationAdapter> = {
  default: new DefaultAdapter(),
  tray: new DefaultAdapter(),
  nuvemshop: new NuvemshopAdapter()
};

export const getIntegrationAdapter = (providerName: string): IIntegrationAdapter => {
  return adapters[providerName] || adapters.default;
};
