import { NormalizedEvent, IIntegrationAdapter } from "../../types/integration.js";

export abstract class EcommerceAdapter implements IIntegrationAdapter {
  abstract normalizeEvent(rawEvent: any): NormalizedEvent | null;
  abstract isSignatureValid(req: any, secret: string): boolean;
}
