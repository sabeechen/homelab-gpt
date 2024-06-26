import {LitElement, html, css} from 'lit';
import {customElement, property, state, query} from 'lit/decorators.js';
import {consume} from '@lit-labs/context';
import {type AppData, appContext} from '../app-context';
import { Message } from '../app-data';
import { mdiAlertOutline, mdiChatQuestion, mdiContentCopy, mdiHuman, mdiPencil, mdiPlayOutline, mdiReplay, mdiRobotExcitedOutline, mdiTrashCan, mdiContentSaveEdit, mdiClose, mdiDiceMultiple, mdiCodeTags } from '@mdi/js';
import { ChatIcon } from './chat-icon';
import { marked } from 'marked';
import hljs from 'highlight.js';
import  {defaultCSS} from "../global-styles"
import { ChatTextArea } from './chat-text-area';
import {hljs as hljsCss } from "../css"
import { ChatBar } from './chat-bar';
import { Util } from '../util'
import katex from 'katex';
import {v4 as uuidv4} from 'uuid';

/**
 * A chat message shown in the chat log.
 *
 * @fires replay
 * @fires delete
 * @fires continue
 * @fires insert
 * @fires edited
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

  @state({})
  format = true;

  @query("#edit-text-area")
  _editTextArea: ChatTextArea;

  @query("#message-rendered")
  _messageRendered: HTMLDivElement;

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
        margin: 10px 2px 0px 0px;
      }
    }
    .message {
      flex-grow: 1;
      white-space: pre-wrap;
      overflow: auto;
    }

    chat-icon {
      width: 32px;
      height: 32px;
    }

    pre code:not(.hljs) {
      /* styles for code without the hljs class, which means the language wasn't specified */
      background: #23241f;
      color: #f8f8f2;
      white-space: pre;
      font-size: 13px;
      display: block;
      overflow-x: scroll;
      padding: 1em;
    }

    .message-editing {
      white-space: revert;
      padding: 10px;
    }

    .actor-icon {
      width: 40px;
      height: 40px;
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
      width: 30px;
      height: 30px;
      padding: 5px;
      border-radius: 5px;
      margin: 0px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .action-icon:hover {
      background-color: var(--blue-hover);;
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
    .action-container {
      display: grid;
      grid-template-columns: repeat(2, 30px);
      grid-auto-rows: 30px;
      gap: 5px;
      margin-top: 10px;
      float: right;
      border-width: 0px 0px 1px 1px;
      border-style: solid;
      border-color: var(--grey);
      margin-left: 4px;
      margin-bottom: 5px;
      padding: 2px;
    }
    .copy-badge {
      position: absolute;
      right: 0px;
      top: 0px;
      background: none;
      border: none;
      cursor: pointer;
    }
    .code-badge-pre {
      position: relative; 
    }

    .message * ul, .message * ol {
      white-space: normal;
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
    let messageHTML = null;
    if (this.format) {

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

      let messageText = this.message.message.trim();

      // First, identify any markdown ```latex code blocks and handle them first.  we're going to "inject" the rendered latex into the message text
      // after the reaminider of it is parsed as markdown, so first we want to replace each latex block with a sentinal guid that will later be replaced
      // with the rendered latex.
      const latexMappingsBlocks: {[guid: string]: string} = {};
      const latexBlocks = messageText.match(/```latex\n([\s\S]*?)\n```/g);
      if (latexBlocks) {
        for (const block of latexBlocks) {
          const latex = block.substring(8, block.length - 3);
          const guid = uuidv4();
          messageText = messageText.replace(block, "`" + guid + "`");
          latexMappingsBlocks[guid] = latex;
        }
      }

      // latext blocks can also start with "/[" and end with "/]".  Replace those with seintinals too.
      const latexBlocks2 = messageText.match(/\\\[(.*?)\\\]/g);
      if (latexBlocks2) {
        for (const block of latexBlocks2) {
          const latex = block.substring(3, block.length - 3);
          const guid = uuidv4();
          messageText = messageText.replace(block, "`" + guid + "`");
          latexMappingsBlocks[guid] = latex;
        }
      }

      // The text will also contain inline latex expressions that start with a "\(" and end with a "\)".  Replace those with seintinals too.
      const latexMappingsInline: {[guid: string]: string} = {};
      const inlineLatex = messageText.match(/\\\((.*?)\\\)/g);
      if (inlineLatex) {
        for (const latex of inlineLatex) {
          const guid = uuidv4();
          messageText = messageText.replace(latex, "`" + guid + "`");
          latexMappingsInline[guid] = latex.substring(2, latex.length - 2);
        }
      }

      // Lit makes us return a single element, but adding nodes to a different part of the DOM removes them from the current parent.
      // So first copy the child list then add them to a new div.
      const children = Array.from(new DOMParser().parseFromString(marked.parse(messageText), "text/html").body.children);
      messageHTML = document.createElement("div") as HTMLDivElement;
      for (const child of children) {
        messageHTML.appendChild(child);

        // Search through the child nodes for any text nodes that contain the sentinal guids for inline latex and replace them with the rendered latex. Markdown shold have rendered the guids inside "code" elements.
        for (const node of child.querySelectorAll("code")) {
          const text = node.textContent;
          if (latexMappingsInline[text])
          {
            const latex = latexMappingsInline[text];
            const newNode = document.createElement("span");
            katex.render(latex, newNode, {throwOnError: false, output: "mathml", displayMode: false});
            node.parentElement.replaceChild(newNode, node);
          }
          else if(latexMappingsBlocks[text])
          {
            katex.render(latexMappingsBlocks[text], node, {throwOnError: false, output: "mathml", displayMode: true});
          }
        }
      }

      // For each "code" element with 'hljs' class, add a small "copy" button to the top right of the code block.
      for (const code of messageHTML.querySelectorAll("code")) {
        if (!(code.parentElement instanceof HTMLPreElement)) {
          continue;
        }
        const copyButton = document.createElement("button");
        copyButton.title = "Copy to clipboard";
        copyButton.classList.add("action-icon");
        copyButton.classList.add("copy-badge");
        copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FFFFFF"><path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z" /></svg>`;
        copyButton.onclick = () => {
          navigator.clipboard.writeText(code.textContent || (code as HTMLElement).innerText);
        }
        // Add copy button as the first element of the code block.
        code.insertBefore(copyButton, code.firstChild);
        code.parentElement?.classList.add("code-badge-pre");
      }
    } else {
      messageHTML = document.createElement("pre") as HTMLPreElement;
      messageHTML.textContent = this.message.message;
    }
    return html`
      <div class="log flex-vertical">
        <div class="flex-horizontal">
          <div class="user">
            <chat-icon class="actor-icon" .path=${this._getUserIcon()} @click=${this._toggleRole}></chat-icon>
            ${this.message.cost_usd ? html`<div class="cost">${Util.formatCostUSD(this.message.cost_usd)}</div>` : html``}
            ${this.message.cost_tokens_prompt ? html`<div class="cost-tokens" title="Prompt tokens: ${this.message.cost_tokens_prompt || 0}  Completions Tokens: ${this.message.cost_tokens_completion || 0}">${(this.message.cost_tokens_completion || 0) + (this.message.cost_tokens_prompt || 0)} tokens</div>` : html``}
          </div>
          ${this.editing ? html`  
          <div class=${this.editing ? "message message-editing": "message"}><chat-text-area id="edit-text-area" class="wide" rows=6 @submit=${this._saveEdit}></chat-text-area></div>
          <div class="flex-vertical">
            <chat-icon class="action-icon" .path=${mdiContentSaveEdit} @click=${this._saveEdit}></chat-icon>
            <chat-icon class="action-icon" .path=${mdiClose} @click=${this._cancelEdit}></chat-icon>
          </div>
          ` : html`
          <div id="message-rendered" class="${this._isHuman() ? "message human" : "message"}"><div class="action-container">
              <chat-icon title="Copy message text" class="action-icon action-half" .path=${mdiContentCopy} @click=${this._copy}></chat-icon>
              ${this._isHuman() ? html`
              <chat-icon title="Delete history up to here" class="action-icon action-half" .path=${mdiReplay} @click=${this._replay}></chat-icon>
              ` : html`
              <chat-icon title="Re-roll this message" class="action-icon action-half" .path=${mdiDiceMultiple} @click=${this._reroll}></chat-icon>
              `}
              <chat-icon title="Edit this message" class="action-icon action-half" .path=${mdiPencil} @click=${this._edit}></chat-icon>
              <chat-icon title="Delete" class="action-icon action-half" .path=${mdiTrashCan} @click=${this._delete}></chat-icon>
              <chat-icon title="Toggle formatting" class="action-icon action-half" .path=${mdiCodeTags} @click=${this.toggleFormatting}></chat-icon>
              ${this.message.finish_reason == "length" ?
              html`<chat-icon title="Continue this message" class="action-icon" .path=${mdiPlayOutline} @click=${this._continue}></chat-icon>` : html``}
            </div>${messageHTML}</div>`}</div>
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
    const height = this._messageRendered.offsetHeight;
    const style = window.getComputedStyle(this._messageRendered);
    const fontSize = parseFloat(style.fontSize);
    this.editing = true;
    await this.updateComplete;
    this._editTextArea.value = this.message.message;
    this._editTextArea.doFocus();
    this._editTextArea.rows = Math.ceil(height / (fontSize * 1.25));
  }

  private toggleFormatting() {
    this.format = !this.format;
  }

  private _saveEdit() {
    this.message.message = this._editTextArea.value;
    this.editing = false;
    this._dispatchEvent("edited");
  }

  private _cancelEdit() {
    this.editing = false;
    this._dispatchEvent("edited");
  }

  private _delete() {
    this._dispatchEvent("delete");
  }

  private _reroll() {
    this._dispatchEvent("reroll");
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
