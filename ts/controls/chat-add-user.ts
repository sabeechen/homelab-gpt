import { mdiClose, mdiContentSave } from '@mdi/js';
import {LitElement, html, css} from 'lit';
import {customElement, property, query, state} from 'lit/decorators.js';
import { defaultCSS } from "../global-styles"
import { ChatIcon } from './chat-icon';
import { ChatTextBox } from './chat-text-box';
import {type AppData, appContext} from '../app-context';
import {consume} from '@lit-labs/context';
import { AutofillData } from './chat-autofill-polyfill';

/**
 * Displays an svg path
 * @attr color
 * @attr path
 * @fires close-modal
 */
@customElement('chat-add-user')
export class ChatAddUser extends LitElement {
  
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

  @property({type: Boolean})
  edit = false;

  @state()
  working = false;

  @query("#name")
  _name: ChatTextBox;

  @query("#password")
  _password: ChatTextBox;

  @query("#api-key")
  _apiKey: ChatTextBox;

  @query("#password_confirm")
  _passwordConfirm: ChatTextBox;

  @query("#password_old")
  _passwordOld?: ChatTextBox;


  override render() {
    return html`
    <h2>${this.edit ? "Edit" : "Add"} User</h2>
    <p>
      <chat-text-box id="name" label="Name:" .disabled=${this.working || this.edit} value=${this.edit ? this.app.user.name : ""}  name="username" autocomplete="username"></chat-text-box>
    </p>
    <p>
      ${this.edit ? html`
      <chat-text-box id="password_old" label="Old Password" .password=${true} .disabled=${this.working} name="password" autocomplete="current-password"></chat-text-box>
      ` : html``}
      <chat-text-box id="password" label=${this.edit ? "New Password" : "Password:"} placeholder="make it a good one" .password=${true} .disabled=${this.working} name="new-password" autocomplete="new-password"></chat-text-box>
      <chat-text-box id="password_confirm" label=${this.edit ? "Confirm New Password" : "Confirm Password:"} placeholder="type it again" .password=${true} .disabled=${this.working} name="new-password-confirm" autocomplete="new-password"></chat-text-box>
    </p>
    <p>
      <chat-text-box id="api-key" label="Default API Key:" placeholder="Leave blank to use the server's key by default." .disabled=${this.working} value=${this.edit ? this.app.user.api_key : ""}></chat-text-box>
    </p>
    ${this.error.length > 0 ? html`
    <p class="error">
      ${this.error}
    </p>` : html``}
    <div class="flex-horizontal flex-center">
      ${this.working ? html`
      <div class="loader"></div>
      ` : html`
      <chat-button @click=${this.submit}>
        <div class="button-content flex-horizontal flex-center">
          <chat-icon class="button-icon" .path=${mdiContentSave}></chat-icon>
          <span>Save</span>
        </div>
      </chat-button>
      <chat-button .danger=${true} @click=${this.closeModal}>
        <div class="button-content flex-horizontal flex-center">
          <chat-icon class="button-icon" .path=${mdiClose}></chat-icon>
          <span>Cancel</span>
        </div>
      </chat-button>
      `}
    </div>`;
  }

  private closeModal() {
    const event = new Event('close-modal', { bubbles: true, composed: true });
    document.dispatchEvent(event);
  }

  override async firstUpdated() {
    this.requestUpdate();
    await this.updateComplete;
    this._name.doFocus();
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
        this._passwordConfirm.value = data.data;
        if (this._passwordOld) {
          this._passwordOld.value = data.data;
        }
        break;
    }
  }


  public async submit() {
    this.working = true;
    this.error = "Saving..."
    try {
      if (this.edit) {
        await this.editUser();
      } else {
        await this.newUser();
      }
      this.closeModal();
    } catch (e) {
      this.error = e.message;
    }
    this.working = false;
  }

  private async editUser() {
    if (this._password.value.length > 0) {
      if (this._password.value != this._passwordConfirm.value) {
        throw new Error("Passwords do not match");
      }

      if (this._password.value.length == 0) {
        throw new Error("Password cannot be blank");
      }

      // do a fresh login so we have a new session
      await this.app.login(this.app.user.name, this._passwordOld.value);
    }
    // Save the new user's info
    await this.app.editUser(this._password.value, this._apiKey.value);
  }



  private async newUser() {
    if (this._password.value.length == 0) {
      throw new Error("Password cannot be blank");
    }
    if (this._password.value != this._passwordConfirm.value) {
      throw new Error("Passwords do not match");
    }

    if (this._name.value.length == 0) {
      throw new Error("Name cannot be blank");
    }

    // Create the new user
    await this.app.createUser(this._name.value, this._password.value, this._apiKey.value);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-add-user': ChatAddUser;
  }
}
