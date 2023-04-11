import {WebsocketBuilder, Websocket} from 'websocket-ts';
import { v4 as uuidv4 } from 'uuid';

export class Message {
  id: string;
  role: string;
  message: string;
  cost_tokens?:number;
  cost_usd?: number;
  finish_reason?: string;
}
export class Model {
  label: string
  value: string
}


export class AppData {
  messages: Message[] = [];
  models: Model[] = [
      {
        label: "GPT3 ($)",
        value: "gpt-3.5-turbo"
      },
      {
        label: "GPT4 ($$$)",
        value: "gpt-4"
      }
    ];
  busy = false;
  abortController: AbortController|undefined = undefined;
  streamWebSocket: Websocket|undefined = undefined;
  publishCallback: () => void|undefined = undefined

  constructor() {
  }

  public async chatSynchronous(prompt: string, model: string, determinism: number) {
    this.busy = true;
    try {
      this.abortController = new AbortController();
      const signal = this.abortController.signal
      const request = {
        messages: this.messages,
        model: model,
        temperature: ((100 - determinism) / 100) * 2,
        prompt: prompt
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

  public delete(msg: Message) {
    const index = this.messages.indexOf(msg);
    if (index >= 0) {
      this.messages.splice(index, 1);
    }
  }

  public truncate(msg: Message) {
    const index = this.messages.indexOf(msg);
    if (index >= 0) {
      this.messages.splice(index, this.messages.length - index);
    }
  }

  public async chatStream(prompt: string, model: string, determinism: number) {
    await this.cancel();
    this.busy = true;
    const app = this;
    const message: Message = {
      role: "assistant",
      message: "...",
      id: uuidv4()
    };
    const request = {
      messages: this.messages,
      model: model,
      temperature: ((100 - determinism) / 100) * 2,
      prompt: prompt,
      id: message.id
    };
    this.messages.push(message);
    const index = this.messages.length - 1;

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
      .onError((_, _ev) => {
        console.log('Connect Error');
        app.busy = false;
        app.publish();
      })
      .onMessage((_i, ev) => {
        const data = JSON.parse(ev.data);

        // TODO: this shoould look up the message based on its id.
        this.messages[index] = data;
        message.message = data.message;
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
}