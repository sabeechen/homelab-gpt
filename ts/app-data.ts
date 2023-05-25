import {WebsocketBuilder, Websocket} from 'websocket-ts';
import { v4 as uuidv4 } from 'uuid';
import {plainToInstance, instanceToPlain, Type, Exclude} from 'class-transformer'
import {utils, generateAPair, processChallenge, verifySession} from 'bsrp'

export class Message {
  id: string;
  role: string;
  message?: string;
  cost_tokens_completion?:number;
  cost_tokens_prompt?: number;
  cost_usd?: number;
  finish_reason?: string;
  error?: string;
  start_edited?: boolean;
}
export class Model {
  label = "Default Model"
  value = "Default"
  maxTokens: number = 1024 * 32 - 1
}

export class  Settings {
  determinism = 50;
  max_tokens = 1000;
  model = "gpt-4";
  api_key = "";
  prompt = "";
}

export class User {
  name: string
  id: string
  api_key?: string = null;
}

export class Session {
  session_id: string
  user_id: string
}

export class Chat {
  id: string;
  user_id: string;
  name = "";
  messages: Message[] = [];
  settings = new Settings();

  @Exclude()
  loaded? = false;

  temporary_name?: string = ""
  total_spending? = 0

  @Exclude()
  temporary_cost = 0

  public label() {
    if (this.name) {
      return this.name;
    }

    if (this.settings?.prompt) {
      return this._clamp(this.settings.prompt);
    }

    for (const message of this.messages) {
      if (message.message) {
        return this._clamp(message.message) + "...";
      }
    }

    if (this.temporary_name) {
      return this.temporary_name;
    }

    return "New Chat";
  }

  private _clamp(value: string) {
    if (value.length > 50) {
      return value.substring(0, 50);
    } else {
      return value;
    }
  }

  public static createEmptyChat() {
    const chat = new Chat();
    chat.loaded = true;
    return chat;
  }

  public runningCost() {
    return (this.total_spending || 0) + this.temporary_cost;
  }

  public closeCosts() {
    this.total_spending = this.runningCost();
    this.temporary_cost = 0;
  }
}

export class LocalSaveInfo {
  @Type(() => User)
  user?: User;

  @Type(() => Chat)
  chat?: Chat;

  @Type(() => Session)
  session?: Session;

  version?: number;
}

export class AppData {
  chats: Chat[] = [];
  user: User = null;
  session: Session = null;

  // Internal state, which should not be serialized
  currentChat?: Chat = null;
  unsavedChat?: Chat = null;
  models: Model[] = [];
  busy = false;
  _dirtySave:NodeJS.Timeout = null;
  abortController: AbortController|undefined = undefined;
  streamWebSocket: Websocket|undefined = undefined;
  publishCallback: () => void|undefined = undefined;
  initialized = false;

  constructor() {
  }

  private async changeUser(user: User, session: Session) {
    if (user === null) {
      this.chats = [];
      this.user = null;
      this.session = null;
      this.publish();
      return;
    }
    this.user = user;
    this.session = session;

    const user_id = this.user.id;
    this.publish()
    let resp = await fetch("/api/chats", {
      body: JSON.stringify({user_id: user_id}),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Session-Id": this.session.session_id,
      },
    });
    if (resp.status == 401) {
      // Session is invalid, so logout
      await this.logout();
      return;
    }
    if (resp.status != 200) {
      console.log("Failed to load chats");
      this.chats = [];
    } else {
      const data = await resp.json();
      this.chats = data.chats.map((c: any) => plainToInstance(Chat, c));
    }

    resp = await fetch("/api/user/" + user_id, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Session-Id": this.session.session_id,
      },
    });
    if (resp.status == 200) {
      this.user = plainToInstance(User, await resp.json())
    }

    if (!this.currentChat) {
      this.currentChat = Chat.createEmptyChat();
    } else {
      for (let i = 0; i < this.chats.length; i++) {
        if (this.chats[i].id == this.currentChat.id) {
          this.chats[i] = this.currentChat;
        }
      }
    }

    this.publish();
  }

  public newChat() {
    const chat = new Chat();
    chat.id = uuidv4();
    chat.loaded = true;
    chat.user_id = this.user.id;
    this.chats.push(chat);
    this.openChat(chat);
  }

  public async deleteCurrentChat() {
    if (!this.isSaved()) {
      return;
    }

    await fetch("/api/chat/" + this.currentChat.id, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Session-Id": this.session.session_id,
      },
    });

    const index = this.chats.indexOf(this.currentChat);
    if (index >= 0) {
      this.chats.splice(index, 1);
    }
    if (this.currentChat == this.unsavedChat) {
      this.unsavedChat = null;
    }
    this.openChat(null);
    this.dirty(true);
  }

  public async saveCurrentDraft() {
    if (this.isSaved()) {
      console.log("chat was saved");
      return;
    }

    if (!this.user) {
      console.log("user was null");
      return;
    }

    this.currentChat.id = uuidv4();
    this.currentChat.user_id = this.user.id;
    if (!this.chats.includes(this.currentChat)) {
      this.chats.push(this.currentChat);
    }

    this.unsavedChat = null;
    this.openChat(this.currentChat);
    this.dirty();
  }

  public async openChat(chat: Chat) {
    console.log("Opening chat");
    console.log(chat);

    if (!chat) {
      if (this.isSaved()) {
        if (this.unsavedChat) {
          this.currentChat = this.unsavedChat;
        } else {
          const newChat = new Chat();
          newChat.id = uuidv4();
          newChat.loaded = true;
          this.currentChat = newChat;
        }
        this.unsavedChat = null;
      }
      this.publish();
      return;
    }

    if (this.currentChat != chat && !this.isSaved()) {
      // switching away from an unsaved chat, so stash it for later use.
      this.unsavedChat = this.currentChat;
    }

    if (chat.loaded) {
      console.log("Already loaded");
      this.currentChat = chat;
      this.publish();
      return;
    }

    this.currentChat = chat;
    this.publish();
    const resp = await fetch("/api/chat/" + chat.id,{
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Session-Id": this.session.session_id,
      },
    });
    const data = plainToInstance(Chat, await resp.json());
    data.loaded = true;
    let found = false;
    for(let i = 0; i < this.chats.length; i++) {
      if (this.chats[i].id == data.id) {
        this.chats[i] = data;
        found = true;
        break;
      }
    }
    if (!found) {
      this.chats.push(data);
    }
    this.currentChat = data;
    this.publish();
  }

  public async cancel() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = undefined;
    }

    if (this.streamWebSocket) {
      this.streamWebSocket.close();
      this.streamWebSocket = undefined;
    }
    this.busy = false;
    this.dirty();
  }

  public async delete(msg: Message) {
    if (!this.currentChat) {
      return
    }
    await this.cancel();
    const index = this.currentChat.messages.indexOf(msg);
    if (index >= 0) {
      this.currentChat.messages.splice(index, 1);
    }
    this.dirty();
  }

  public insertMessage(oldMessage: Message, newMessage: Message) {
    if (!this.currentChat) {
      return
    }
    let index = 0;
    if (oldMessage) {
      index = this.currentChat.messages.indexOf(oldMessage) + 1;
    }

    this.currentChat.messages.splice(index, 0, newMessage);
    this.dirty();
  }

  public truncate(msg: Message) {
    if (!this.currentChat) {
      return
    }
    const index = this.currentChat.messages.indexOf(msg);
    if (index >= 0) {
      this.currentChat.messages.splice(index, this.currentChat.messages.length - index);
    }
  }

  public async continue(cont: Message) {
    if (!this.currentChat) {
      return
    }
    const toSend: Message[] = [];
    for (const msg of this.currentChat.messages) {
      toSend.push(msg);
      if(msg == cont) {
        break;
      }
    }
    await this.chat(cont, toSend);
  }

  public async reroll(cont: Message) {
    if (!this.currentChat) {
      return
    }
    const toSend: Message[] = [];
    for (const msg of this.currentChat.messages) {
      if(msg == cont) {
        break;
      }
      toSend.push(msg);
    }
    await this.chat(cont, toSend, true);
  }

  public async chat(message: Message = null, messages: Message[]=null, reroll=false) {
    await this.cancel();
    this.busy = true;
    const app = this;
    const chat = this.currentChat;
    if (!chat) {
      return;
    }
    if (messages == null) {
      messages = [...chat.messages];
    }
    let continuation = "";
    if (message == null) {
      message = {
        role: "assistant",
        message: "...",
        id: uuidv4()
      };
      chat.messages.push(message);
    } else if(!reroll) {
      continuation = message.message;
    }
    const request = {
      messages: messages,
      model: this.currentChat.settings.model,
      temperature: ((100 - this.currentChat.settings.determinism) / 100) * 2,
      prompt: this.currentChat.settings.prompt,
      id: message.id,
      max_tokens: this.currentChat.settings.max_tokens,
      continuation: continuation,
      api_key: this.currentChat.settings.api_key,
    };
    if (!request.api_key || request.api_key.length == 0) {
      if (this.user && this.user.api_key && this.user.api_key.length > 0) {
        request.api_key = this.user.api_key;
      }
    }
    const index = chat.messages.indexOf(message);

    const wsProtocol = window.location.protocol == 'https:' ? 'wss' : 'ws';
    this.streamWebSocket = new WebsocketBuilder(wsProtocol + '://' + window.location.host + '/api/ws/chat')
      .onOpen((i, _ev) => {
        console.log('Connection opened');
        i.send(JSON.stringify(request));
      })
      .onClose((_i, _ev) => {
        console.log('Connection Closed');
        app.busy = false;
        chat.closeCosts();
        app.publish();
        app.dirty();
      })
      .onError((_, ev) => {
        console.log('Connect Error');
        message = {...message};
        message.error = "Websocket error: " + ev;
        chat.messages[index] = message;
        app.busy = false;
        chat.closeCosts();
        app.publish();
        app.dirty();
      })
      .onMessage((_i, ev) => {
        const data = JSON.parse(ev.data);

        // TODO: this should look up the message based on its id.
        chat.messages[index] = data;
        message = data;
        chat.temporary_cost = message.cost_usd;
        app.publish();
      })
      .onRetry((_i, _ev) => {
        console.log("retry");
      })
      .build();
  }

  public async createUser(name: string, password: string, api_key: string) {
    const response = await fetch('/api/user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: name,
        password: password,
        api_key: api_key,
      })
    });
    if (response.status == 200) {
      const data = await response.json();
      const user = plainToInstance(User, data.user);
      const session = plainToInstance(Session, data.session);
      this.changeUser(user, session);
      this.dirty();
    } else {
      throw new Error("Failed to create user");
    }
  }

  public async editUser(password: string, api_key: string) {
    const response = await fetch('/api/user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Session-Id': this.session.session_id,
      },
      body: JSON.stringify({
        user_id: this.user.id,
        password: password,
        api_key: api_key,
      })
    });
    if (response.status == 200) {
      const data = await response.json();
      const user = plainToInstance(User, data.user);
      const session = plainToInstance(Session, data.session);
      this.changeUser(user, session);
      this.dirty();
    } else {
      throw new Error("Failed to edit user");
    }
  }

  // A method to convert a hex encoded string to a Uint8Array
  private hexToUint8Array(hex: string): Uint8Array {
    const uint8Array = new Uint8Array(hex.length / 2);
    for (let i = 0; i < uint8Array.length; i++) {
      const hexByte = hex.substr(i * 2, 2);
      const parsedByte = parseInt(hexByte, 16);
      if (isNaN(parsedByte)) {
        throw new Error("Failed to parse hex byte: " + hexByte);
      }
      uint8Array[i] = parsedByte;
    }
    return uint8Array;
  }

  // a method to convert a Uint8Array to a hex encoded string
  private uint8ArrayToHex(uint8Array: Uint8Array): string {
    let hex = "";
    for (let i = 0; i < uint8Array.length; i++) {
      const byte = uint8Array[i];
      hex += byte.toString(16).padStart(2, "0");
    }
    return hex;
  }

  public async login(name: string, password: string) {
    // Start the SRP challenge
    let response = await fetch('/api/login/step1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: name
      })
    });
    if (response.status != 200) {
      throw new Error("Failed to login");
    }
    let data = await response.json();
    const a_pair = generateAPair();
    // Convert data.salt, which is a hexserialized string, into a Uint8Array, then a bigint
    const salt = utils.toBigInteger(this.hexToUint8Array(data.s));
    const B = utils.toBigInteger(this.hexToUint8Array(data.B));

    const processed = await processChallenge(data.username, password, salt, a_pair.ephemeralA, a_pair.publicA, B);
    const M1 = this.uint8ArrayToHex(utils.toBytes(processed.message));
    const A = this.uint8ArrayToHex(utils.toBytes(a_pair.publicA));
    response = await fetch('/api/login/step2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: data.username,
        B: data.B,
        A: A,
        M1: M1
      })
    });
    if (response.status != 200) {
      throw new Error("Failed to login");
    }
    data = await response.json();
    console.log(data);
    const M2 = utils.toBigInteger(this.hexToUint8Array(data.M2))
    const verify = await verifySession(a_pair.publicA, processed.message, processed.sessionKey, M2)
    if (!verify) {
      throw new Error("Failed to login");
    }
    this.changeUser(plainToInstance(User, data.user), plainToInstance(Session, data.session));
    this.dirty();
  }

  public async logout() {
    this.changeUser(null, null);
    this.dirty();
  }

  private publish() {
    if (this.publishCallback) {
      this.publishCallback();
    }
  }

  public bindToUpdates(callback: () => void) {
    this.publishCallback = callback;
  }

  public getCurrentModel() {
    if (this.currentChat) {
      for (const model of this.models) {
        if (model.value == this.currentChat.settings.model) {
          return model;
        }
      }
    }
    if (this.models.length > 1){
      return this.models[1];
    } else {
      return new Model();
    }
  }

  public toJSON() {
    const finalObj: any = {};
    finalObj["user"] = instanceToPlain(this.user);
    finalObj["currentChat"] = instanceToPlain(this.currentChat);
    finalObj['serializationVersion'] = 3;
    return finalObj;
  }

  public static load(source: any = null) {
    if (source == null) {
      const fromStorage = localStorage.getItem("appData");
      if (fromStorage) {
        source = plainToInstance(LocalSaveInfo, this.upgradeStoredData(JSON.parse(fromStorage)));
      } else {
        source = new LocalSaveInfo();
      }
    }

    const data = new AppData();
    if (source.user) {
      data.user = source.user;
    }
    if (source.chat) {
      data.currentChat = source.chat;
      data.currentChat.loaded = true;
    } else {
      data.currentChat = Chat.createEmptyChat();
    }
    if (source.session != null) {
      data.session = source.session;
    }
    return data;
  }

  public static upgradeStoredData(source: any) {
    if (source.serializationVersion == 1) {
      for (const message of source.messages) {
        if (message.cost_tokens) {
            message.cost_tokens_completion = message.cost_tokens;
            message.cost_tokens = undefined;
        }
        source.serializationVersion = 2;
      }
    }

    if (source.serializationVersion == 2) {
      const chat = source;
      source = {
        chat: chat,
        user: null,
        serializationVersion: 3,
      }
    }
    return source;
  }

  public static tryLoad() {
    try {
      return this.load();
    } catch (e) {
      console.error(e);
      console.error("Error loading application data from local storage.  Using defaults.");
      return new AppData();
    }
  }

  public async initialize() {
    const resp = await fetch("/api/initialize");
    const data = await resp.json();
    this.models = data.models.map((d: any) => plainToInstance(Model, d));

    // get user form local storage
    this.chats = [];
    if (this.user == null || this.session == null) {
      this.logout();
    } else {
      await this.changeUser(this.user, this.session);
    }

    this.initialized = true;
    this.publish();
  }

  public async import(data: any) {
    const chat = plainToInstance(Chat, data);
    chat.id = uuidv4()
    chat.user_id = null;
    this.openChat(chat);
    this.unsavedChat = null;
    this.dirty();
  }


  public dirty(saveNow = false) {
    if (this._dirtySave) {
      clearTimeout(this._dirtySave);
      this._dirtySave = null;
    }
    this._dirtySave = setTimeout(() => {
      this._doSave();
    }, saveNow ? 1 : 1500);
  }

  public isSaved() {
    if (!this.currentChat) {
      return false;
    }
    if (!this.user) {
      return false;
    }
    if (!this.currentChat.id) {
      return false;
    }
    if (this.currentChat.user_id != this.user.id) {
      return false;
    }
    if (!this.currentChat.loaded) {
      return false;
    }
    return true;
  }

  private async _doSave() {
    console.log("Saving to local storage");
    let chatToSave = this.currentChat;
    if (this.isSaved() && this.unsavedChat) {
      chatToSave = this.unsavedChat;
    }
    const serialize = new LocalSaveInfo();
    serialize.chat = chatToSave;
    serialize.user = this.user;
    serialize.session = this.session;
    serialize.version = 3;
    localStorage.setItem("appData", JSON.stringify(instanceToPlain(serialize)));

    if (this.isSaved()) {
        console.log("Sending chat update to server");
        this.currentChat.temporary_name = this.currentChat.label();
        await fetch("/api/chat", {
          body: JSON.stringify(instanceToPlain(this.currentChat)),
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Session-Id": this.session.session_id,
          },
        });
    }
  }
}