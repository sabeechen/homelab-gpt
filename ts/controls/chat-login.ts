import { mdiClose, mdiLogin } from '@mdi/js';
import {LitElement, html, css} from 'lit';
import {customElement, property, query, state} from 'lit/decorators.js';
import { defaultCSS } from "../global-styles"
import { ChatIcon } from './chat-icon';
import { ChatTextBox } from './chat-text-box';
import {type AppData, appContext} from '../app-context';
import {consume} from '@lit-labs/context';
import { ChatModal } from './chat-modal';
import { AutofillData } from './chat-autofill-polyfill';

/**
 * Presents a login prompt modal
 * @fires close-modal
 */
@customElement('chat-login')
export class ChatLogin extends LitElement {
  
  @consume({context: appContext})
  @property({attribute: false})
  public app?: AppData;

  static override styles = [defaultCSS, css`
    chat-button {
      margin: 0px 5px;
      min-width: 160px;
    }

    @media only screen and (max-width: 767px) {
      chat-button {
        min-width: 0px;
      }
    }
    .button-content {
      display: flex;
      padding: 10px 20px;
    }
    .error {
      color: #ffb8b8;
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

    chat-icon {
      width: 24px;
      height: 24px;
    }

    a {
      color: var(--white);
    }

    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }
  `];

  helper() {
    ChatIcon.properties;
    ChatTextBox.properties;
  }

  @property({type: String})
  error = '';

  @state()
  working = false;

  @query("#name")
  _name: ChatTextBox;

  @query("#password")
  _password: ChatTextBox;

  override render() {
    return html`
    <h2>Login</h2>
    <form>
    <p>
      <chat-text-box id="name" label="Name:" .disabled=${this.working} name="username" autocomplete="username"></chat-text-box>
    </p>
    <p>
      <chat-text-box id="password" label="Password:" .password=${true} .disabled=${this.working} name="password" autocomplete="current-password"></chat-text-box>
    </p>
  </form>
    <p>
      <a @click=${this._register} href="#">Create New User</a>
    </p>

    ${this.error.length > 0 ? html`
    <p class="error">
      ${this.error}
    </p>` : html``}
    <div class="flex-horizontal flex-center">
      ${this.working ? html`
      <div class="loader"></div>
      ` : html`
      <chat-button @click=${this.login}>
        <div class="button-content flex-horizontal flex-center">
          <chat-icon class="button-icon" .path=${mdiLogin}></chat-icon>
          <span>Login</span>
        </div>
      </chat-button>
      <chat-button .danger=${true} @click=${ChatModal.closeModal}>
        <div class="button-content flex-horizontal flex-center">
          <chat-icon class="button-icon" .path=${mdiClose}></chat-icon>
          <span>Cancel</span>
        </div>
      </chat-button>`}
    </div>`;
  }

  public override connectedCallback() {
    super.connectedCallback();
    window.addEventListener('autofill', this._boundAutofillHandler);
  }

  public override disconnectedCallback() {
    window.removeEventListener('autofill', this._boundAutofillHandler);
    super.disconnectedCallback();
  }

  _boundAutofillHandler = this._handleAutofill.bind(this);
  private _handleAutofill(e: CustomEvent) {
    const data = e.detail as AutofillData;
    switch (data.field) {
      case "username":
        this._name.value = data.data;
        this._name.doFocus();
        break;
      case "password":
        this._password.value = data.data;
        this._password.doFocus();
        break;
    }
  }

  public async submit() {
    await this.login();
  }

  private async login() {
    if (this._name.value.length == 0) {
      this.error = "Name cannot be blank";
      return;
    }

    // Create the new user
    this.working = true;
    this.error = "Logging in...";
    try {
      await this.app.login(this._name.value, this._password.value);
      ChatModal.closeModal(this);
    } catch (e) {
      this.error = e.message;
      this.working = false;
    }
  }

  override async firstUpdated() {
    this.requestUpdate();
    await this.updateComplete;
    this._name.doFocus();
  }

  private async _register() {
    ChatModal.closeModal(this);

    const myEvent = new CustomEvent("open-modal", {
      detail: "chat-add-user",
      bubbles: true,
      composed: true });
    this.dispatchEvent(myEvent);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-login': ChatLogin;
  }
}
