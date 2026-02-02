export interface Step {
  type: string;
  label: string;
  [key: string]: any;
}

export interface UseCase {
  id: string;
  title: string;
  aliases: string[];
  description: string;
  steps: Step[];
}

export interface AutomationContext {
  name?: string;
  number?: string;
  tags?: string[];
  [key: string]: any;
}

export interface IChannelProvider {
  sendText(payload: any): Promise<any>;
  sendButtons(payload: any): Promise<any>;
  addTag(payload: any): Promise<any>;
  removeTag(payload: any): Promise<any>;
}

export interface TenantConfig {
  id: string;
  name: string;
  inputAdapter: import("./integration.js").IIntegrationAdapter;
  provider: IChannelProvider;
  templates: Record<string, any>;
}
