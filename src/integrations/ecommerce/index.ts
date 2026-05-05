import { DefaultAdapter } from "./default-adapter.js";
import { NuvemshopAdapter } from "./nuvemshop-adapter.js";
import { TrayAdapter } from "./tray-adapter.js";
import { IIntegrationAdapter } from "../../types/integration.js";

const adapters: Record<string, IIntegrationAdapter> = {
  default: new DefaultAdapter(),
  tray: new TrayAdapter("[OJ]"),
  nuvemshop: new NuvemshopAdapter(),
};

export const getIntegrationAdapter = (providerName: string): IIntegrationAdapter => {
  return adapters[providerName] || adapters.default;
};
