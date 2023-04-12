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


export class AppData {
  messages: Message[] = [];
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
  abortController: AbortController|undefined = undefined;
  streamWebSocket: Websocket|undefined = undefined;
  publishCallback: () => void|undefined = undefined;
  currentModel: Model = this.models[1];

  constructor() {
  }

  public async chatSynchronous(prompt: string, model: string, determinism: number, max_tokens: number) {
    this.busy = true;
    try {
      this.abortController = new AbortController();
      const signal = this.abortController.signal
      const request = {
        messages: this.messages,
        model: model,
        temperature: ((100 - determinism) / 100) * 2,
        prompt: prompt,
        max_tokens,
      };
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal
      });
      this.messages.push(await resp.json() as Message);
    } finally {
      this.busy = false;
    }
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
  }

  public async delete(msg: Message) {
    await this.cancel();
    const index = this.messages.indexOf(msg);
    if (index >= 0) {
      this.messages.splice(index, 1);
    }
  }

  public insertMessage(oldMessage: Message, newMessage: Message) {
    let index = 0;
    if (oldMessage) {
      index = this.messages.indexOf(oldMessage) + 1;
    }

    this.messages.splice(index, 0, newMessage);
  }

  public truncate(msg: Message) {
    const index = this.messages.indexOf(msg);
    if (index >= 0) {
      this.messages.splice(index, this.messages.length - index);
    }
  }

  public async continue(cont: Message, prompt: string, model: string, determinism: number, maxTokens: number) {
    const toSend: Message[] = [];
    for (const msg of this.messages) {
      toSend.push(msg);
      if(msg == cont) {
        break;
      }
    }
    await this.chatStream(prompt, model, determinism, maxTokens, toSend, cont);
  }

  public async chatStream(prompt: string, model: string, determinism: number, maxTokens: number, messages: Message[]=null, message: Message = null) {
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
      })
      .onError((_, ev) => {
        console.log('Connect Error');
        message = {...message};
        message.error = "Websocket error: " + ev;
        this.messages[index] = message;
        app.busy = false;
        app.publish();
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
    return this.currentModel;
  }
}