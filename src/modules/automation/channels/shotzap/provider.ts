import axios from "axios";
import fs from "fs-extra";
import path from "path";
import { IChannelProvider } from "../../../../types/automation.js";

interface ShotzapConfig {
  baseUrl: string;
  token: string;
  tagsToken?: string; // Token específico para operações de tags (criação/listagem)
  tagsCachePath?: string; // Caminho para arquivo de cache de tags
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
  private tagsToken: string;
  private tagsCachePath?: string;
  private paths: {
    sendButtons: string;
    sendText: string;
    addTag: string;
    removeTag: string;
  };
  private _tagsCache: Map<string, number> = new Map();
  private _tagsLoaded: boolean = false;
  private _loadingPromise: Promise<void> | null = null;
  
  private C = {
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    blue: "\x1b[36m",
    reset: "\x1b[0m"
  };

  constructor(config: ShotzapConfig) {
    console.log(">>> [ShotzapProvider] INICIALIZADO - VERSÃO FIXED_V3 <<<");
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 20000
    });
    this.token = config.token;
    this.tagsToken = config.tagsToken || config.token;
    this.tagsCachePath = config.tagsCachePath;

    this.paths = {
      sendButtons: config.paths?.sendButtons || "/messages/send-button-list",
      sendText: config.paths?.sendText || "/messages/send-text",
      addTag: config.paths?.addTag || "/tags/add",
      removeTag: config.paths?.removeTag || "/tags/remove"
    };
    
    // Inicia carregamento das tags em background na inicialização
    this._ensureTagsLoaded().catch(e => console.error(">>> [ShotzapProvider] Falha silenciosa no pré-carregamento de tags:", e.message));
  }

  // Helper para métodos privados de tickets e contatos
  private async _lookupContact(phone: string): Promise<number | null> {
      try {
          console.log(`${this.C.blue}>>> [ShotzapProvider] Buscando contato para ${phone}${this.C.reset}`);
          const token = this.token; // Legacy Token para contatos
          
          // 1. Tenta endpoint direto (single) com BODY (segundo testes da API)
          try {
               // Axios GET com body precisa da propriedade 'data'
               const res = await this.client.request({
                   method: 'GET',
                   url: '/api/contacts/single',
                   headers: { Authorization: `Bearer ${token}` },
                   data: { number: phone }
               });

               // Resposta vem como { "370484": { id: 370484, ... } }
               if (res.status === 200 && res.data) {
                   const keys = Object.keys(res.data);
                   if (keys.length > 0) {
                       const firstKey = keys[0];
                       const contactData = res.data[firstKey];
                       if (contactData?.id) {
                           console.log(`${this.C.green}>>> [ShotzapProvider] Contato encontrado via Single (ID: ${contactData.id})${this.C.reset}`);
                           return contactData.id;
                       }
                   }
               }
          } catch (e1) {
              // Ignore
          }
          
          // 2. Tenta busca em lista (fallback)
          // ALERTA: Endpoint de lista pode retornar 403 para token legacy.
          // Portanto, se ambos falharem, dependemos da CRIAÇÃO, que funciona.
          try {
              const res = await this.client.get(`/api/contacts`, {
                  params: { number: phone },
                  headers: { Authorization: `Bearer ${token}` }
              });
              
              const list = Array.isArray(res.data) ? res.data : (res.data?.contacts || []);
              const found = list.find((c: any) => c.number == phone || c.phone == phone);
              if (found?.id) return found.id;
          } catch (e2) {
              // Ignore
          }

      } catch (e) {
          console.warn(`${this.C.yellow}>>> [ShotzapProvider] Erro ao buscar contato ${phone}:${this.C.reset}`, e);
      }
      return null;
  }

  private async _ensureContact(phone: string): Promise<number | null> {
      // Tenta lookup primeiro
      const existing = await this._lookupContact(phone);
      if (existing) return existing;

      const userId = this._getUserId() || 854; 
      const payload = {
          name: phone,
          number: phone, 
          email: "",
          userId
      };

      try {
          console.log(`${this.C.blue}>>> [ShotzapProvider] Criando/Garantindo contato ${phone} usando Legacy Token...${this.C.reset}`);
          // Usa Legacy Token (false) para criar contato
          const res = await this._postWithAuth("/api/contacts", payload, false);
          
          // Sucesso direto (Created)
          if (res?.id) return res.id;
          if (res?.contact?.id) return res.contact.id;

          // Se responder 200/OK mas disser "alreadyExists" (estrutura aninhada)
          if (res?.alreadyExists && res?.existingContact?.id) {
              console.log(`${this.C.green}>>> [ShotzapProvider] Contato já existe (retornado na criação). ID: ${res.existingContact.id}${this.C.reset}`);
              return res.existingContact.id;
          }

          console.log(`${this.C.yellow}>>> [ShotzapProvider] DEBUG: Create Response (Legacy): ${JSON.stringify(res).substring(0, 200)}${this.C.reset}`);
          
      } catch (e: any) {
          // Erro 400 geralmente significa que já existe.
          if (e.response?.status === 400 || e.response?.status === 409) {
             console.log(`${this.C.yellow}>>> [ShotzapProvider] Contato já existe (erro 400/409), re-tentando lookup.${this.C.reset}`);
             return this._lookupContact(phone);
          }
          
          console.error(`${this.C.red}>>> [ShotzapProvider] Falha ao criar contato ${phone}:${this.C.reset}`, e.message);
      }
      
      // Última tentativa de lookup
      return this._lookupContact(phone);
  }

  private async _ensureTicket(phone: string): Promise<number | null> {
      const contactId = await this._ensureContact(phone);
      if (!contactId) {
          console.error(`${this.C.red}>>> [ShotzapProvider] Impossível criar ticket: Contato não encontrado/criado.${this.C.reset}`);
          return null;
      }

      console.log(`${this.C.blue}>>> [ShotzapProvider] Criando ticket para ContactID ${contactId}${this.C.reset}`);
      try {
          const payload = { contactId };
          
          // Tickets exigem Token Legacy conforme validação script test_ticket.ts
          const endpoint = "/api/tickets/createTicketAPI";
          console.log(`${this.C.blue}>>> [ShotzapProvider] Tentando criar ticket em ${endpoint} (Token Legacy)...${this.C.reset}`);
          const res = await this._postWithAuth(endpoint, payload, false); // false = Legacy Token
          
          if (res?.id) return res.id;
          if (res?.ticket?.id) return res.ticket.id;
          if (res?.ticketId) return res.ticketId; 
          
          // Debug se falhar parsing
          console.log(`${this.C.yellow}>>> [ShotzapProvider] Resposta sem ID explícito no _ensureTicket. Verificando estrutura...${this.C.reset}`);

      } catch (e: any) {
           console.error(`${this.C.red}>>> [ShotzapProvider] Falha ao criar ticket:${this.C.reset}`, e.message);
      }
      return null;
  }

  // Método auxiliar para escolher o token corretoInt
  private _getToken(isTagOperation: boolean = false): string {
      return isTagOperation ? this.tagsToken : this.token;
  }

  private async _postWithAuth(path: string, payload: any, isTagOperation: boolean = false) {
    const tokenToUse = this._getToken(isTagOperation);
    const response = await this.client.post(path, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenToUse}`
      },
      maxBodyLength: Infinity
    });
    return response.data;
  }

  private _getUserId(): number | undefined {
    // Tenta extrair do token de tags, que provavelmente é JWT
    try {
        const part = this.tagsToken.split('.')[1];
        if (!part) return undefined;
        const json = Buffer.from(part, 'base64').toString();
        const data = JSON.parse(json);
        return data.id;
    } catch (e) {
        return undefined;
    }
  }

  private async _ensureTagsLoaded() {
    // Se já carregou, retorna imediatamente
    if (this._tagsLoaded) return;
    
    // Se já tem uma requisição em andamento, retorna a promise dela (evita chamadas duplicadas)
    if (this._loadingPromise) return this._loadingPromise;
    
    this._loadingPromise = (async () => {
        try {
            // 1. Tentar carregar do arquivo local primeiro (se configurado)
            if (this.tagsCachePath) {
                const resolvedPath = path.resolve(process.cwd(), this.tagsCachePath);
                if (await fs.pathExists(resolvedPath)) {
                    console.log(`>>> [ShotzapProvider] Carregando tags do cache local: ${resolvedPath}`);
                    const cachedData = await fs.readJson(resolvedPath);
                    if (cachedData && typeof cachedData === 'object') {
                        let count = 0;
                        for (const [name, id] of Object.entries(cachedData)) {
                             // @ts-ignore
                             this._tagsCache.set(name, Number(id));
                             count++;
                        }
                        this._tagsLoaded = true;
                        console.log(`>>> [ShotzapProvider] Cache local carregado. ${count} tags restauradas.`);
                        return; // Retorna e evita chamada de API
                    }
                }
            }

            console.log(">>> [ShotzapProvider] Iniciando carga de tags da API (Cache não encontrado/configurado)...");
            // Listagem de tags usa o token de tags
            const response = await this.client.get("/tags", {
                headers: { Authorization: `Bearer ${this.tagsToken}` }
            });
            
            const tags = response.data?.tags || [];
            const cacheObj: Record<string, number> = {};

            tags.forEach((t: any) => {
                if (t.name && t.id) {
                    this._tagsCache.set(t.name, t.id);
                    cacheObj[t.name] = t.id;
                }
            });
            this._tagsLoaded = true;
            console.log(`>>> [ShotzapProvider] Criação de cache API concluída. ${this._tagsCache.size} tags em memória.`);

            // 2. Salvar no arquivo local (se configurado)
            if (this.tagsCachePath && this._tagsCache.size > 0) {
                 const resolvedPath = path.resolve(process.cwd(), this.tagsCachePath);
                 await fs.ensureFile(resolvedPath);
                 await fs.writeJson(resolvedPath, cacheObj, { spaces: 2 });
                 console.log(`>>> [ShotzapProvider] Cache de tags salvo em disco.`);
            }

        } catch (e: any) {
            console.warn(">>> [ShotzapProvider] Aviso: Falha ao listar tags (operação não-bloqueante):", e.message);
            // Não marcamos como loaded para tentar novamente na próxima vez se falhar
        } finally {
            this._loadingPromise = null;
        }
    })();

    return this._loadingPromise;
  }

  private async _createTag(name: string): Promise<number | null> {
    try {
        console.log(`>>> [ShotzapProvider] Criando nova tag: ${name}`);
        const userId = this._getUserId() || 854; // Fallback se falhar extração
        const payload = {
            name,
            color: "#5f6368",
            kanban: 1, // Kanban 1 conforme solicitado
            prioridade: 0,
            automation: 0,
            tagType: "Atendimento",
            weekends: 0,
            userId
        };
        
        // Criação usa token de tags
        // Nota: se _postWithAuth usa o padrão token, precisamos passar flag ou usar client direto.
        // Vou usar _postWithAuth com novo parâmetro isTagOperation
        const response = await this._postWithAuth("/tags", payload, true);

        if (response && (response.id || response.data?.id)) {
            const id = response.id || response.data?.id;
            this._tagsCache.set(name, id);
            console.log(`>>> [ShotzapProvider] Tag criada com sucesso: ${name} (ID: ${id})`);
            return id;
        }
    } catch(e: any) {
       console.warn(`>>> [ShotzapProvider] Aviso: Falha ao criar tag ${name}:`, e.message);
    }
    return null;
  }

  private async _resolveTagId(tagName: string): Promise<number | null> {
      // 1. Check cache immediately
      if (this._tagsCache.has(tagName)) {
          return this._tagsCache.get(tagName)!;
      }

      // 2. Refresh cache
      await this._ensureTagsLoaded();
      if (this._tagsCache.has(tagName)) {
          return this._tagsCache.get(tagName)!;
      }

      // 3. Create if not exists
      return this._createTag(tagName);
  }

  async sendButtons(payload: any) {
    console.log(">>> [ShotzapProvider] Interceptando sendButtons");
    // console.log(">>> [ShotzapProvider] Payload recebido:", JSON.stringify(payload, null, 2));

    // CONVERSÃO FORÇADA PARA TEXTO PARA GARANTIR ENTREGA
    // A API de botões apresenta instabilidade ou falhas silenciosas.
    // Convertemos o payload de botões em um formato textual legível.
    try {
      if (!payload.body || !Array.isArray(payload.body) || payload.body.length === 0) {
          // Se não for o array esperado, tenta enviar como está (fallback ruim) ou loga erro
          console.warn(">>> [ShotzapProvider] Payload de botões inválido para conversão. Tentando envio original...");
          return this._postWithAuth(this.paths.sendButtons, payload);
      }

      const item = payload.body[0];
      const targetNumber = item.phone || item.number;
      const title = item.title || "Mensagem";
      
      console.log(`>>> [ShotzapProvider] Convertendo Botão para Texto -> ${title} (${targetNumber})`);

      let textBody = "";
      if (item.title) textBody += `*${item.title}*`;
      textBody += `\n\n${item.body || ''}`;
      if (item.footer) textBody += `\n\n_${item.footer}_`;
      
      // ... Conversão de botões omitida para brevidade (mantida igual) ...


      if (item.buttons && Array.isArray(item.buttons)) {
         textBody += "\n\n👇 *Opções:*";
         item.buttons.forEach((btn: any) => {
            if (btn.type === 'url') {
              textBody += `\n🔗 ${btn.text}: ${btn.url}`;
            } else if (btn.type === 'quickreply') {
               textBody += `\n👉 ${btn.text}`;
            } else {
               textBody += `\n🔹 ${btn.text || 'Botão'}`;
            }
         });
      }

      const textPayload = {
        number: targetNumber,
        openTicket: "0",
        body: textBody.trim()
      };

      // console.log(">>> [ShotzapProvider] Payload convertido para TEXTO:", JSON.stringify(textPayload, null, 2));

      // Usa o endpoint de TEXTO que sabemos que funciona
      const response = await this._postWithAuth(this.paths.sendText, textPayload);
      // console.log(">>> [ShotzapProvider] Resposta da API de Texto:", JSON.stringify(response, null, 2));

      // Hook: Verificar se veio ticketId e processar tags pendentes
      this._checkAndFlushTags(response, targetNumber);

      return response;

    } catch (error) {
       console.error(">>> [ShotzapProvider] Erro na conversão de botões para texto:", error);
       throw error; 
    }
  }

  async sendText(payload: any) {
    const response = await this._postWithAuth(this.paths.sendText, payload);
    
    // Hook: Verificar se veio ticketId e processar tags pendentes
    // O payload.number sempre existe no sendText
    if (payload.number) {
        this._checkAndFlushTags(response, payload.number);
    }
    
    return response;
  }

  private _checkAndFlushTags(response: any, phone: string) {
      try {
        // Tenta extrair ticketId de várias formas possíveis na resposta
        let ticketId = response?.ticketId || response?.ticket?.id;
        
        // As vezes vem dentro de 'retorno' (vimos no log: response.retorno.ticketId)
        if (!ticketId && response?.retorno?.ticketId) {
            ticketId = response.retorno.ticketId;
        }

        if (ticketId) {
            // Chama o flush de tags assincronamente (sem await para não bloquear response)
            this._flushPendingTags(phone, ticketId).catch(err => console.error(">>> [ShotzapProvider] Erro no flush de tags background:", err));
        } else {
            console.log(">>> [ShotzapProvider] Aviso: Mensagem enviada mas ticketId não identificado na resposta.");
        }
      } catch (e) {
          console.warn(">>> [ShotzapProvider] Erro ao extrair ticketId da resposta:", e);
      }
  }

  private _pendingTags: Map<string, number[]> = new Map();

  async addTag(payload: any) {
    // Lógica principal: Resolver Tag -> Garantir Ticket -> Associar Ticket+Tag

    // 1. Resolver ID da Tag
    let tagId: number | null = null;
    if (payload.tag && typeof payload.tag === 'string') {
        tagId = await this._resolveTagId(payload.tag);
    } else if (payload.tagId) {
        tagId = payload.tagId;
    }

    if (!tagId) {
        console.warn(">>> [ShotzapProvider] Não foi possível resolver tag (permitindo tentativa via nome):", payload.tag);
        // Fallback: tenta enviar original se falhar resolução (pode ser que API aceite string)
        return this._postWithAuth(this.paths.addTag, payload);
    }

    // 2. Obter Telefone
    // O payload do addTag geralmente vem do flow engine contendo o number
    // pode vir como payload.number, payload.phone, ou contact.phone
    const phone = payload.phone || payload.number;

    if (!phone) {
        console.error(">>> [ShotzapProvider] addTag chamado sem telefone. Impossível criar ticket.");
        return null;
    }

    // 3. Garantir Ticket
    const ticketId = await this._ensureTicket(phone);
    if (!ticketId) {
         console.warn(`>>> [ShotzapProvider] Falha ao obter Ticket ID (provável erro 403). Enfileirando Tag ${tagId} para atribuição pós-mensagem.`);
         // Adiciona à fila de pendentes para este número
         if (!this._pendingTags.has(phone)) {
             this._pendingTags.set(phone, []);
         }
         this._pendingTags.get(phone)!.push(tagId);
         return { status: "pending_ticket", tagId }; 
    }

    // 4. Enviar Associação
    return this._sendTagToTicket(ticketId, tagId);
  }

  // Método privado para efetivar a atribuição
  private async _sendTagToTicket(ticketId: number, tagId: number) {
      console.log(`>>> [ShotzapProvider] Atribuindo Tag ID ${tagId} ao Ticket ID ${ticketId}`);
      try {
        const newPayload = {
            ticketId: ticketId,
            tags: [
                { id: tagId }
            ]
        };
        return await this._postWithAuth(this.paths.addTag, newPayload);
      } catch (e: any) {
          console.error(`>>> [ShotzapProvider] Erro ao atribuir tag ${tagId} ao ticket ${ticketId}:`, e.message);
          return null;
      }
  }

  // Processa tags pendentes após obter um ticket válido (ex: ao enviar mensagem)
  private async _flushPendingTags(phone: string, ticketId: number) {
      if (this._pendingTags.has(phone)) {
          const tags = this._pendingTags.get(phone)!;
          console.log(`>>> [ShotzapProvider] Processando ${tags.length} tags pendentes para ${phone} (Ticket ${ticketId})...`);
          
          for (const tagId of tags) {
              await this._sendTagToTicket(ticketId, tagId);
          }
          
          // Limpa fila
          this._pendingTags.delete(phone);
      }
  }

  async removeTag(payload: any) {
    // Lógica similar para remover tag
    if (payload.tag && typeof payload.tag === 'string') {
        const tagId = await this._resolveTagId(payload.tag);
        if (tagId) {
            const newPayload = { 
                ...payload,
                tagId: tagId,
                tagIds: [tagId]
            };
            delete newPayload.tag;
            return this._postWithAuth(this.paths.removeTag, newPayload);
        }
    }
    return this._postWithAuth(this.paths.removeTag, payload);
  }

  /**
   * Garante que uma lista de tags exista na API da Shotzap.
   * Útil para pré-validar fluxos.
   */
  async syncTags(tags: string[]) {
    console.log(`>>> [ShotzapProvider] Sincronizando ${tags.length} tags...`);
    // Garante que a lista inicial esteja carregada antes de começar a criar
    await this._ensureTagsLoaded();
    
    for (const tag of tags) {
        // _resolveTagId já verifica cache e cria se não existir
        await this._resolveTagId(tag);
    }
    console.log(`>>> [ShotzapProvider] Sincronização concluída. Total em cache: ${this._tagsCache.size}`);
  }

  /**
   * Varre todas as tags da conta e garante que tenham kanban = 1.
   * Método de manutenção.
   */
  async fixKanbanForTags(prefixFilter: string = "[EBE]") {
      console.log(">>> [ShotzapProvider] Iniciando auditoria de Kanban das tags...");
      
      // 1. Listar todas as tags (usando fetch direto para ter os objetos completos)
      // O _ensureTagsLoaded popula apenas o cache ID/Nome. Precisamos de dados completos.
      // Reutiliza logica de auth de tags
      if (!this.tagsToken) throw new Error("tagsToken não configurado");

      try {
          // Usa um client axios temporário
          const { default: axios } = await import('axios');
          const baseUrl = this.client.defaults.baseURL;
          
          const response = await axios.get(`${baseUrl}/tags`, {
              headers: { 
                  'Authorization': `Bearer ${this.tagsToken}`,
                  'Content-Type': 'application/json'
              }
          });
          
          const allTags = response.data; // Assumindo ser array direto ou .data
          const tagsList = Array.isArray(allTags) ? allTags : (allTags.data || []);
          
          console.log(`>>> [ShotzapProvider] ${tagsList.length} tags recuperadas.`);

          let updatedCount = 0;
          
          for (const tag of tagsList) {
              if (tag.name && tag.name.startsWith(prefixFilter)) {
                  // A tag pode vir como "1" string ou 1 number, melhor verificar ==
                  if (tag.kanban != 1) { // != compara type loose (1 != '1' é false, o que queremos se API mandar string)
                      console.log(`>>> [ShotzapProvider] Corrigindo tag '${tag.name}' (ID: ${tag.id})...`);
                      
                      // Payload de update
                      const updatePayload = {
                          ...tag,
                          kanban: 1,
                      };

                      // Request PUT
                      await axios.put(`${baseUrl}/tags/${tag.id}`, updatePayload, {
                          headers: { 
                              'Authorization': `Bearer ${this.tagsToken}`,
                              'Content-Type': 'application/json'
                          }
                      });
                      updatedCount++;
                  }
              }
          }
          console.log(`>>> [ShotzapProvider] Auditoria finalizada. ${updatedCount} tags atualizadas.`);

      } catch (e: any) {
          console.error(">>> [ShotzapProvider] Erro na auditoria de tags:", e.message);
      }
  }
}
