import {WebsocketBuilder, Websocket} from 'websocket-ts';
import { v4 as uuidv4 } from 'uuid';

export class Message {
  id: string;
  role: string;
  message?: string;
  cost_tokens?:number;
  cost_usd?: number;
  finish_reason?: string;
  error?: string;
  start_edited?: boolean;
}
export class Model {
  label: string
  value: string
  maxTokens: number
}

export class  Settings {
  determinism = 50;
  max_tokens = 1000;
  model = "gpt-4";
  api_key = "";
  prompt = "";
}


export class AppData {
  messages: Message[] = [];
  settings: Settings = new Settings();

  // Internal state, which should not be serialized
  models: Model[] = [
      {
        label: "GPT3 ($)",
        value: "gpt-3.5-turbo",
        maxTokens: 4096
      },
      {
        label: "GPT4 ($$$)",
        value: "gpt-4",
        maxTokens: 8192,
      }
    ];
  busy = false;
  _dirtySave:NodeJS.Timeout = null;
  abortController: AbortController|undefined = undefined;
  streamWebSocket: Websocket|undefined = undefined;
  publishCallback: () => void|undefined = undefined;

  constructor() {
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
    await this.cancel();
    const index = this.messages.indexOf(msg);
    if (index >= 0) {
      this.messages.splice(index, 1);
    }
    this.dirty();
  }

  public insertMessage(oldMessage: Message, newMessage: Message) {
    let index = 0;
    if (oldMessage) {
      index = this.messages.indexOf(oldMessage) + 1;
    }

    this.messages.splice(index, 0, newMessage);
    this.dirty();
  }

  public truncate(msg: Message) {
    const index = this.messages.indexOf(msg);
    if (index >= 0) {
      this.messages.splice(index, this.messages.length - index);
    }
  }

  public async continue(cont: Message, prompt: string, model: string, determinism: number, maxTokens: number, apiKey: string) {
    const toSend: Message[] = [];
    for (const msg of this.messages) {
      toSend.push(msg);
      if(msg == cont) {
        break;
      }
    }
    await this.chat(prompt, model, determinism, maxTokens, apiKey, toSend, cont);
  }

  public async chat(prompt: string, model: string, determinism: number, maxTokens: number, api_key: string, messages: Message[]=null, message: Message = null) {
    await this.cancel();
    this.busy = true;
    const app = this;
    if (messages == null) {
      messages = [...this.messages];
    }
    let continuation = "";
    if (message == null) {
      message = {
        role: "assistant",
        message: "...",
        id: uuidv4()
      };
      this.messages.push(message);
    } else {
      continuation = message.message;
    }
    const request = {
      messages: messages,
      model: model,
      temperature: ((100 - determinism) / 100) * 2,
      prompt: prompt,
      id: message.id,
      max_tokens: maxTokens,
      continuation: continuation,
      api_key: api_key,
    };
    const index = this.messages.indexOf(message);

    const wsProtocol = window.location.protocol == 'https:' ? 'wss' : 'ws';
    this.streamWebSocket = new WebsocketBuilder(wsProtocol + '://' + window.location.host + '/api/ws/chat')
      .onOpen((i, _ev) => {
        console.log('Connection opened');
        i.send(JSON.stringify(request));
      })
      .onClose((_i, _ev) => {
        console.log('Connection Closed');
        app.busy = false;
        app.publish();
        app.dirty();
      })
      .onError((_, ev) => {
        console.log('Connect Error');
        message = {...message};
        message.error = "Websocket error: " + ev;
        this.messages[index] = message;
        app.busy = false;
        app.publish();
        app.dirty();
      })
      .onMessage((_i, ev) => {
        const data = JSON.parse(ev.data);

        // TODO: this should look up the message based on its id.
        this.messages[index] = data;
        message = data;
        app.publish();
      })
      .onRetry((_i, _ev) => {
        console.log("retry");
      })
      .build();
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
    for (const model of this.models) {
      if (model.label == this.settings.model) {
        return model;
      }
    }
    return this.models[1];
  }

  public toJSON() {
    const finalObj: any = {};
    finalObj["messages"] = this.messages;
    finalObj["settings"] = this.settings;
    finalObj['serializationVersion'] = 1;
    return finalObj;
  }

  public static load(source: any = null) {
    const data = new AppData();

    if (source == null) {
      const fromStorage = localStorage.getItem("appData");
      if (fromStorage) {
        source = JSON.parse(fromStorage);
      } else {
        source = data.toJSON();
      }
    }
    data.messages = source["messages"] as Message[] || [];
    data.settings = source["settings"] as Settings || new Settings;
    return data;
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


  public dirty() {
    if (this._dirtySave) {
      clearTimeout(this._dirtySave);
      this._dirtySave = null;
    }
    this._dirtySave = setTimeout(() => {
      this._doSave();
    }, 3000)
  }

  private _doSave() {
    console.log("Saving to local storage");
    localStorage.setItem("appData", JSON.stringify(this));
  }
}