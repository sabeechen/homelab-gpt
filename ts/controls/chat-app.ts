import {LitElement, html, css} from 'lit';
import {customElement, property, query, state} from 'lit/decorators.js';
import {repeat} from 'lit/directives/repeat.js';
import { AppData, Chat, Message, Model } from '../app-data.js';
import {appContext} from '../app-context.js'
import {provide} from '@lit-labs/context';
import { ChatContainer } from './chat-container.js';
import { ChatButton } from './chat-button.js';
import { ChatTextArea } from './chat-text-area.js';
import { ChatToggle } from './chat-toggle.js';
import { ChatSlider } from './chat-slider.js';
import { ChatMessage } from './chat-message.js';
import { ChatRadio } from './chat-radio.js';
import { v4 as uuidv4 } from 'uuid';
import { defaultCSS } from "../global-styles"
import { ChatIcon } from './chat-icon.js';
import { mdiChatOutline, mdiCog, mdiCogOff, mdiDatabaseExportOutline, mdiNuke, mdiDatabaseImportOutline, mdiPlus, mdiTrashCanOutline, mdiContentSave } from '@mdi/js';
import { ChatBar } from './chat-bar.js';
import { ChatDropDown } from './chat-drop-down.js';

@customElement('chat-app')
export class ChatApp extends LitElement {

  @provide({context: appContext})
  @property({type: Object})
  app = AppData.tryLoad();

  static override styles = [defaultCSS, css`
      :host {
        width: 100%;
      }

      /* vertically oriented flex box with a max width of 500px */
      .chat-log {
        display: flex;
        flex-direction: column;
        width: 100%;
      }

      /* an animated spinning progress indicator*/
      .loader {
        border: 4px solid #f3f3f3; /* Light grey */
        border-top: 4px solid #3498db; /* Blue */
        border-radius: 50%;
        width: 24px;
        height: 24px;
        animation: 0.75s linear 0s infinite normal none running spin;
        margin-right: 10px;
      }

      @keyframes spin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }

      h1 {
        font-weight: 300;
        margin-top: 0;
        margin-bottom: 5px;
      }

      header {
        background-color: #222222;
        box-shadow: 0 2px 5px 0 rgba(0, 0, 0, 0.5);
        width: 100%;
        position: relative;
        height: 59px;
      }

      .logo {
        color: #ffffff;
        width: 42px;
        height: 42px;
        margin-right: 10px;
      }

      nav {
        display: flex;
      }

      nav a {
        color: #ffffff;
        text-decoration: none;
        margin-left: 15px;
      }

      nav a:hover {
        color: #f1c40f;
      }

      .buttons {
        justify-content: center;
        display: flex;
      }

      .api-key {
        width: 100%;
        margin: 20px;
      }

      chat-button {
        min-width: 160px;
      }

      chat-button * chat-icon, chat-button * .loader, chat-button.little-button .loader {
        margin-right: 5px;
      }

      chat-button.little-button {
        min-width: initial;
      }

      chat-button.little-button * chat-icon, chat-button.little-button chat-icon, chat-button.little-button * .loader, chat-button.little-button .loader {
        margin-right: 0px;
      }

      chat-drop-down {
        margin: 5px;
      }
      .compact-container {
        padding: 10px 20px;
      }
      .header-floater {
        position: absolute;
        float: left;
        margin: 0px 10px;
      }
      @media only screen and (max-width: 767px) {
        .header-floater {
          position: relative;
          float: none;
        }

        header {
          display: flex;
        }
      }

      .button-content {
        display: flex;
        padding: 10px 20px;
      }

      .loader.button-content {
        padding: 0px;
      }

      chat-button {
        margin: 0px 5px;
      }
  `];

  @query('#chat-input')
  _chatInput: ChatTextArea;

  @query('#system-input')
  _systemInput: ChatTextArea;

  @query("#export-upload")
  _exportUpload: HTMLInputElement;

  @query("#user-select")
  _userSelect: ChatDropDown;

  @query("#chat-select")
  _chatSelect: ChatDropDown;

  @state({})
  showOptions: boolean

  @state({})
  maxTokens: number;

  @state({})
  determinism: number;

  @state({})
  model: Model;

  @state({})
  apiKey: string;

  public helper() {
    ChatMessage.properties;
    ChatSlider.properties;
    ChatTextArea.properties;
    ChatToggle.properties;
    ChatContainer.properties;
    ChatButton.properties;
    ChatRadio.properties;
    ChatIcon.properties;
    ChatBar.properties;
    ChatDropDown.properties;
  }

  override render() {
    if (!this.app.currentChat) {
      return html``
    }

    return html`
      <header>
        <div class="flex-horizontal header-floater flex-center">
          User:
          <chat-drop-down id="user-select" .options=${this.app.users} .selected=${this.app.user} label_property="name" value_property="id" default="(Logged Out)" @input=${this._userChanged}></chat-drop-down>
        </div>
        <div class="flex-horizontal flex-center wide">
          <svg class="logo" fill="white" viewBox="0 0 24 24" role="img" xmlns="http://www.w3.org/2000/svg"><title>OpenAI icon</title><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/></svg>
          <h1>AI Chat</h1>
        </div>
      </header>
      ${this.app.user !== null ? html`
      <chat-container class="compact-container">
        <div class="flex-horizontal wide" style="align-items: last baseline;">
          <chat-drop-down id="chat-select" label="Chat" class="flex-fill wide" .options=${this.app.chats} .selected=${this.app.isSaved() ? this.app.currentChat : null} .label_property=${(c: Chat) => c.label()} value_property="id" @input=${this._chatChanged} default="(Unsaved Chat)"></chat-drop-down>
          ${!this.app.isSaved() ? html`
          <chat-button @click=${this._saveDraft} style="height: 2.5em;">
            <div class="button-content flex-horizontal flex-center">
              <chat-icon class="button-icon" .path=${mdiContentSave}></chat-icon>
              <span>Save</span>
            </div>
          </chat-button>
          ` : html``}
          <chat-button @click=${this._newChat} style="height: 2.5em;">
            <div class="button-content flex-horizontal flex-center">
              <chat-icon class="button-icon" .path=${mdiPlus}></chat-icon>
              <span>New Chat</span>
            </div>
          </chat-button>
        </div>
      </chat-container>
      ` : html``}
      <chat-container class="${!this.showOptions ? 'compact-container' : 'compact-container hidden'}">
        <div class="flex-horizontal wide flex-center">
          <chat-button class="little-button" @click=${this._toggleOptions}>
            <div class="button-content flex-horizontal flex-center">
              <chat-icon class="button-icon" .path=${this.showOptions ? mdiCogOff : mdiCog}></chat-icon>
            </div>
          </chat-button>
          <div class="truncate">
            ${this._settingSummary()}
          </div>
        </div>
      </chat-container>
      <chat-container class="${this.showOptions ? '' : 'hidden'}">
        <div class="flex-vertical flex-center">
        <div class="flex-horizontal flex-center flex-wrap">
            <chat-radio id="model-select" .options=${this.app.models} .value=${this.model} @input=${this._updateSelectedModel}></chat-radio>
            <chat-slider
              label="Determinism {}%"
              id="determinism"
              min="0"
              max="100"
              step="1"
              .value=${this.determinism}
              @input=${this._updateDeterminism}
            ></chat-slider>
            <chat-slider
              label="Max Tokens {}"
              id="max-tokens"
              min="25"
              max=${this.app.getCurrentModel()?.maxTokens}
              step="25"
              .value=${this.maxTokens}
              @input=${this._updateMaxTokens}
            ></chat-slider>
          </div>
          <chat-text-area class="api-key" placeholder="OpenAI API Key.  Leave blank to use this server's key." .value=${this.apiKey} @input=${this._updateApiKey}></chat-text-area>
          <div class="wide">
          <h3>Prompt</h3>
          <div class="flex-horizontal">
            <chat-text-area
              placeholder="You can enter anything here, its instructions about what the AI should be.  The default is to be a helpfuland concise assistant."
              id="system-input"
              class="flex-fill"
              rows="2"
              @input=${this._syncSettings}
            ></chat-text-area>
          </div>
        </div>
          <div class="flex-horizontal flex-center wide" style="margin-top: 10px">
            <chat-button @click=${this._downloadState}>
              <div class="button-content flex-horizontal flex-center">
                <chat-icon class="button-icon" .path=${mdiDatabaseExportOutline}></chat-icon>
                  <span>Export</span>
              </div>
            </chat-button>
            <chat-button @click=${() => this._exportUpload.click()}>
              <div class="button-content flex-horizontal flex-center">
                <input style="display: none;" type="file" id="export-upload" accept=".json" @change=${this._handleExportSelect}>
                <chat-icon class="button-icon" .path=${mdiDatabaseImportOutline}></chat-icon>
                <span>Import</span>
              </div>
            </chat-button>
            <chat-button @click=${this._toggleOptions}>
              <div class="button-content flex-horizontal flex-center">
                <chat-icon class="button-icon" .path=${this.showOptions ? mdiCogOff : mdiCog}></chat-icon>
              </div>
            </chat-button>
          </div>
        </div>
      </chat-container>
      <chat-container>
        <div class="flex-veritcal wide flex-center">
          ${this.app.currentChat?.loaded ? html`
          <chat-bar @click=${this._insertTop}></chat-bar>
          ${repeat(this.app.currentChat.messages, (msg) => msg.id, (msg, _index) => html`
            <chat-message class="wide" .message=${msg} @delete=${this._messageDelete} @replay=${this._messageReplay} @continue=${this._messageContinue} @insert=${this._insertAfter} @edited=${this._triggerNeedsSave}></chat-message>
          `)}` : html`
          <div class="loader"></div>
          `}
        </div>
      </chat-container>
      <chat-container>
        <div class="flex-horizontal wide">
          <chat-text-area
            class="chat-input flex-fill"
            rows="4"
            placeholder="Start the conversation here.  CTRL + Enter to submit or press the blue button."
            id="chat-input"
            @submit=${this._chat}
          ></chat-text-area>
          ${this.app.busy ?
          html`
          <chat-button id="cancel" class="mobile-only little-button" @click=${this._cancel}>
            <div class="button-content flex-horizontal flex-center">
              <div class="button-content loader"></div>
            </div>
          </chat-button>` :
          html`
          <chat-button class="mobile-only little-button" id="submit" @click=${this._chat}>
            <div class="button-content flex-horizontal flex-center">
              <chat-icon .path=${mdiChatOutline}></chat-icon>
            </div>
          </chat-button>`}
        </div>
      </chat-container>
      <chat-container class="compact-container">
        <div class="flex-horizontal flex-center wide">
          ${this.app.busy ?
          html`
          <chat-button id="cancel" class="desktop-only" @click=${this._cancel}>
            <div class="button-content flex-horizontal flex-center">
              <div class="loader"></div>
              <span>Cancel</span>
            </div>
          </chat-button>` :
          html`
          <chat-button id="submit" @click=${this._chat} class="desktop-only">
            <div class="button-content flex-horizontal flex-center">
              <chat-icon class="flip" class="button-icon" .path=${mdiChatOutline}></chat-icon>
              <span>Submit</span>
            </div>
          </chat-button>`}
          <chat-button id="clear_chat" ?danger=${true} @click=${this._clear}>
            <div class="button-content flex-horizontal flex-center">
              <chat-icon class="button-icon" .path=${mdiNuke}></chat-icon>
              <span>Clear Chat</span>
            </div>
          </chat-button>
          ${this.app.isSaved() ? html`
          <chat-button ?danger=${true} @click=${this._deleteChat}>
            <div class="button-content flex-horizontal flex-center">
              <chat-icon class="button-icon" .path=${mdiTrashCanOutline}></chat-icon>
              <span>Delete Chat</span>
            </div>
          </chat-button>
          ` : html``}
        </div>
      </chat-container>
    `;
  }

  override async firstUpdated() {
    await this.app.initialize();
    this.requestUpdate();
    await this.updateComplete;
    this._chatInput.doFocus();
    this.app.bindToUpdates(() => this.updateFromApp());
    this.determinism = this.app.currentChat.settings.determinism;
    this.maxTokens = this.app.currentChat.settings.max_tokens;
    this.model = this.app.getCurrentModel();
    this.apiKey = this.app.currentChat.settings.api_key;
    this._systemInput.value = this.app.currentChat.settings.prompt;
  }

  private async _userChanged() {
    await this.app.changeUser(this._userSelect.selected);
  }

  private _settingSummary() {
    if (!this.app.currentChat) {
      return "";
    }
    const chat = this.app.currentChat;
    let model = chat.settings.model;
    for (const model_data of this.app.models) {
      if (model_data.value == model) {
        model = model_data.label;
      }
    }

    let prompt = "You are a helpful and concise assistant";
    if (chat.settings.prompt) {
      prompt = chat.settings.prompt;
    }

    return model + ": " + prompt;
  }

  private async _newChat() {
    this.app.newChat();
  }

  private async _saveDraft() {
    await this.app.saveCurrentDraft();
  }

  private async _deleteChat() {
    const result: boolean = window.confirm("Are you sure you want to delete this chat?  It can't be recovered.");
    if (result) {
      await this.app.deleteCurrentChat();
    }
  }

  private async updateFromApp() {
    this.requestUpdate();
    if (this._chatSelect){
      this._chatSelect.requestUpdate();
    }
  }

  private async _chatChanged() {
    await this.app.openChat(this._chatSelect.selected as Chat);
  }

  private async _chat() {
    this._addChatRequest();
    try {
      this.requestUpdate();
      const modelName = (this.model as Model).value
      await this.app.chat(this._systemInput.value, modelName, this.determinism, this.maxTokens, this.apiKey);
    } finally {
      this.requestUpdate();
    }
  }

  private async _insertTop() {
    const message: Message = {
      id: uuidv4(),
      role: "user",
      message: "",
      start_edited: true
    }
    this.app.insertMessage(null, message);
    this.requestUpdate();
  }

  private async _insertAfter(e: CustomEvent) {
    const message = e.detail as Message;
    const newMessage: Message = {
      id: uuidv4(),
      role: message.role == "user"? "assistant" : "user",
      message: "",
      start_edited: true
    }
    this.app.insertMessage(message, newMessage);
    this.requestUpdate();
  }

  private _updateSelectedModel(e: Event) {
    const model = (e.target as ChatRadio).value as Model
    this.model = model;
    this._syncSettings();
    if (this.maxTokens > this.app.getCurrentModel().maxTokens) {
      this.maxTokens = this.app.getCurrentModel().maxTokens;
    }
    this.requestUpdate();
  }

  private _updateDeterminism(e: Event) {
    this.determinism = (e.target as ChatSlider).value;
    this._syncSettings();
  }

  private _updateMaxTokens(e: Event) {
    this.maxTokens = (e.target as ChatSlider).value;
    this._syncSettings();
  }

  private _updateApiKey(e: Event) {
    this.apiKey = (e.target as ChatTextArea).value;
    this._syncSettings();
  }

  private _syncSettings() {
    this.app.currentChat.settings.api_key = this.apiKey;
    this.app.currentChat.settings.determinism = this.determinism;
    this.app.currentChat.settings.max_tokens = this.maxTokens;
    this.app.currentChat.settings.model = this.model.value;
    this.app.currentChat.settings.prompt = this._systemInput.value;
    this.app.dirty();
  }

  private _triggerNeedsSave() {
    this.app.dirty();
  }

  private async _cancel() {
    await this.app.cancel();
    this.requestUpdate();
  }

  private async _clear() {
    this.app.currentChat.messages.length = 0;
    this.app.dirty();
    this.requestUpdate();
    this._chatInput.doFocus();
  }

  private _addChatRequest() {
    if (this._chatInput.value.length > 0) {
      const message: Message = {
        role: 'user',
        id: uuidv4(),
        message: this._chatInput.value
      }
      this.app.currentChat.messages.push(message);
      this._chatInput.value = '';
      this._chatInput.doFocus();
    }
  }

  private async _messageDelete(e: CustomEvent) {
    const message = e.detail as Message;
    await this.app.delete(message);
    this.requestUpdate();
  }

  private async _messageReplay(e: CustomEvent) {
    const message = e.detail as Message;
    this._chatInput.value = message.message;
    this.app.truncate(message);
    this.requestUpdate();
  }

  private async _messageContinue(e: CustomEvent) {
    const message = e.detail as Message;
    await this.app.continue(message, this._systemInput.value, this.model.value, this.determinism, this.maxTokens, this.apiKey);
    this.requestUpdate();
  }

  private _toggleOptions() {
    this.showOptions = !this.showOptions;
  }

  private _downloadState() {
    const dataBlob = new Blob([JSON.stringify(this.app.currentChat, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const anchorElement = document.createElement('a');

    anchorElement.href = url;
    anchorElement.download = `GPT Chat ${this._formatDate(new Date())} .json`;
    anchorElement.style.display = 'none';

    document.body.appendChild(anchorElement);
    anchorElement.click();
    document.body.removeChild(anchorElement);

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 100);
  }

  private async _handleExportSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];
      try {
        this.app.import(await this._readFileAsJSON(file));
        this.requestUpdate();
      } catch (error) {
        console.error("Error reading file:", error);
      }
    }
  }

  private _readFileAsJSON(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const json = JSON.parse(reader.result as string);
          resolve(json);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => {
        reject(reader.error);
      };
      reader.readAsText(file);
    });
  }

  private _formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day} ${hours}-${minutes}-${seconds}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-app': ChatApp;
  }
}
