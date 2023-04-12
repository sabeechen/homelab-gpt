import {LitElement, html, css} from 'lit';
import {customElement, property, state, query} from 'lit/decorators.js';
import {consume} from '@lit-labs/context';
import {type AppData, appContext} from '../app-context';
import { Message } from '../app-data';
import { mdiAlertOutline, mdiChatQuestion, mdiContentCopy, mdiHuman, mdiPencil, mdiPlayOutline, mdiReplay, mdiRobotExcitedOutline, mdiTrashCan, mdiContentSaveEdit, mdiClose } from '@mdi/js';
import { ChatIcon } from './chat-icon';
import { marked } from 'marked';
import hljs from 'highlight.js';
import  {defaultCSS} from "../global-styles"
import { ChatTextArea } from './chat-text-area';
import {hljs as hljsCss } from "../css"
import { ChatBar } from './chat-bar';
/**
 * A chat message shown in the chat log.
 *
 * @fires replay
 * @fires delete
 * @fires continue
 * @fires insert
 * @attr message
 */
@customElement('chat-message')
export class ChatMessage extends LitElement {

  @consume({context: appContext})
  @property({attribute: false})
  public app?: AppData;

  @property({attribute: true})
  public message: Message;

  @state({})
  editing: boolean;

  @query("#edit-text-area")
  _editTextArea: ChatTextArea;

  static override styles = [defaultCSS,  hljsCss, css`
    .user {
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 100px;
      min-width: 100px;
      margin: 10px;
    }

    @media (max-width: 768px) {
      .user {
        max-width: 60px;
        min-width: 60px;
      }
    }
    .message {
      flex-grow: 1;
    }

    .cost {
      font-style: italic;
      font-size: 12px;
      color: #ff9c9c;
    }
    .actor-icon {
      width: 30px;
      height: 30px;
      stroke: white;
      border: 2px solid #370178;
      border-radius: 5px;
      background: #00043a;
      padding: 5px;
      margin: 0px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
    }

    .cost-tokens {
      font-style: italic;
      font-size: 12px;
      color: #a9a9a9;
    }
    .action-icon {
      width: 20px;
      height: 20px;
      padding: 5px;
      border-radius: 5px;
      margin: 0px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .action-icon:hover {
      background-color: #00043a;
    }

    .human {
      font-style: italic;
    }

    .error-message {
      color: rgb(249, 180, 180);
      margin-left: 5px;
      font-style: italic;
      white-space: pre-wrap;
      font-family: monospace;
    }

    .error-container {
      margin-bottom: 10px;
    }
  `];

  helper() {
    ChatIcon.properties;
    ChatTextArea.properties;
    ChatBar.properties;
  }

  override async firstUpdated() {
    if (this.message) {
      if (this.message.start_edited) {
        this.editing = true;
        this.message.start_edited = false;
        await this.updateComplete;
        this._editTextArea.doFocus();
      }
    }
  }

  override render() {
    marked.setOptions({
      renderer: new marked.Renderer(),
      highlight: function (code) {
        return hljs.highlightAuto(code).value;
      },
      langPrefix: 'hljs ',
      pedantic: false,
      gfm: true,
      breaks: false,
      sanitize: true,
      smartLists: true,
      smartypants: false,
      xhtml: false,
    });

    // Lit makes us return a single element, but adding nodes to a different part of the DOM removes them from the current parent.
    // So first copy the child list then add them to a new div.
    const children = Array.from(new DOMParser().parseFromString(marked.parse(this.message.message), "text/html").body.children);
    const messageHTML = document.createElement("div") as HTMLDivElement;
    for (const child of children) {
      messageHTML.appendChild(child);
    }
    return html`
      <div class="log flex-vertical">
        <div class="flex-horizontal">
          <div class="user">
            <chat-icon class="actor-icon" .path=${this._getUserIcon()} @click=${this._toggleRole}></chat-icon>
            ${this.message.cost_usd ? html`<div class="cost">${this._format_cost(this.message.cost_usd)}</div>` : html``}
            ${this.message.cost_tokens ? html`<div class="cost-tokens">${this.message.cost_tokens} tokens</div>` : html``}
          </div>
          ${this.editing ? html`
          <div class="message"><chat-text-area id="edit-text-area" class="wide" rows=6 @submit=${this._saveEdit}></chat-text-area></div>
          <div class="flex-vertical">
            <chat-icon class="action-icon" .path=${mdiContentSaveEdit} @click=${this._saveEdit}></chat-icon>
            <chat-icon class="action-icon" .path=${mdiClose} @click=${this._cancelEdit}></chat-icon>
          </div>
          ` : html`
          <div class="${this._isHuman() ? "message human" : "message"}">${messageHTML}</div>
          <div class="flex-vertical">
            <chat-icon class="action-icon" .path=${mdiContentCopy} @click=${this._copy}></chat-icon>
            <chat-icon class="action-icon" .path=${mdiReplay} @click=${this._replay}></chat-icon>
            <chat-icon class="action-icon" .path=${mdiPencil} @click=${this._edit}></chat-icon>
            <chat-icon class="action-icon" .path=${mdiTrashCan} @click=${this._delete}></chat-icon>
            ${this.message.finish_reason == "length" ?
            html`<chat-icon class="action-icon" .path=${mdiPlayOutline} @click=${this._continue}></chat-icon>` : html``}
          </div>
          `}
        </div>
        ${this.message.error ? html`
          <div class="flex-horizontal flex-center error-container">
            <chat-icon class="warn-icon" .path=${mdiAlertOutline} .color=${css`#f93333`}></chat-icon><span class="error-message">${this.message.error}</span>
          </div>
        ` : html``}
        <chat-bar @click=${this._insert}></chat-bar>
      </div>`
  }

  private _getUserIcon() {
    if (this.message.role == "assistant") {
      return mdiRobotExcitedOutline;
    } else if (this.message.role == "user") {
      return mdiHuman;
    } else {
      return mdiChatQuestion;
    }
  }

  private _isHuman() {
    return this.message.role == "user";
  }

  private _toggleRole() {
    this.message.role = this.message.role == "user" ? "assistant" : "user";
    this.requestUpdate();
  }

  private _format_cost(amount: number) {
    if (amount >= 1) {
      return `$${amount.toFixed(2)}`;
    } else {
      return `¢${this._roundToTwoSignificantDigits(amount * 100)}`;
    }
  }

  private _roundToTwoSignificantDigits(num: number) {
    const magnitude = Math.floor(Math.log10(Math.abs(num)));
    const scale = Math.pow(10, magnitude - 1);
    return parseFloat((Math.round(num / scale) * scale).toPrecision(2));
  }

  private _dispatchEvent(name: string) {
    const myEvent = new CustomEvent(name, {
      detail: this.message,
      bubbles: true,
      composed: true });
    this.dispatchEvent(myEvent);
  }

  private _replay() {
    this._dispatchEvent("replay");
  }

  private async _edit() {
    this.editing = true;
    await this.updateComplete;
    this._editTextArea.value = this.message.message;
    this._editTextArea.doFocus();
  }

  private _saveEdit() {
    this.message.message = this._editTextArea.value;
    this.editing = false;
  }

  private _cancelEdit() {
    this.editing = false;
  }

  private _delete() {
    this._dispatchEvent("delete");
  }

  private _continue() {
    this._dispatchEvent("continue");
  }

  private _insert() {
    this._dispatchEvent("insert");
  }

  private async _copy() {
    navigator.clipboard.writeText(this.message.message);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-message': ChatMessage;
  }
}
