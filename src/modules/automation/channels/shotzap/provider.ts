import axios from "axios";
import { IChannelProvider } from "../../../../types/automation.js";

interface ShotzapConfig {
  baseUrl: string;
  token: string;
  timeout?: number;
  paths?: {
    sendButtons?: string;
    sendText?: string;
    addTag?: string;
    removeTag?: string;
  };
}

export class ShotzapProvider implements IChannelProvider {
  private client: any;
  private token: string;
  private paths: {
    sendButtons: string;
    sendText: string;
    addTag: string;
    removeTag: string;
  };

  constructor(config: ShotzapConfig) {
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 20000
    });
    this.token = config.token;
    this.paths = {
      sendButtons: config.paths?.sendButtons || "/messages/send-button-list",
      sendText: config.paths?.sendText || "/messages/send-text",
      addTag: config.paths?.addTag || "/tags/add",
      removeTag: config.paths?.removeTag || "/tags/remove"
    };
  }

  private async _postWithAuth(path: string, payload: any) {
    const response = await this.client.post(path, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`
      },
      maxBodyLength: Infinity
    });
    return response.data;
  }

  async sendButtons(payload: any) {
    return this._postWithAuth(this.paths.sendButtons, payload);
  }

  async sendText(payload: any) {
    return this._postWithAuth(this.paths.sendText, payload);
  }

  async addTag(payload: any) {
    return this._postWithAuth(this.paths.addTag, payload);
  }

  async removeTag(payload: any) {
    return this._postWithAuth(this.paths.removeTag, payload);
  }
}
