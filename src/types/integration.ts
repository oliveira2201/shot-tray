export interface CustomerData {
  name?: string;
  phone?: string;
  tags?: string[];
}

export interface NormalizedEvent {
  flowAlias: string;
  customer: CustomerData;
  data: Record<string, any>;
}

export interface IIntegrationAdapter {
  normalizeEvent(rawEvent: any): NormalizedEvent | null;
  isSignatureValid(req: any, secret: string): boolean;
}
