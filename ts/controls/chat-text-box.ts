import {LitElement, html, css} from 'lit';
import {customElement, property, query, state} from 'lit/decorators.js';
import  {defaultCSS} from "../global-styles"
import { mdiEyeOffOutline, mdiEyeOutline } from '@mdi/js';
import { ChatIcon } from './chat-icon';

/**
 * A styled textarea element
 *
 * @attr placeholder - The textbox's placeholder text
 * @attr label - The textbox's label
 * @fires submit
 */
@customElement('chat-text-box')
export class ChatTextBox extends LitElement {
  static override styles = [defaultCSS, css`
    /* Apply dark theme to the textarea */
    .input-container {
      background-color: #1e1e1e;
      color: var(--white);
      border: 1px solid var(--grey);
      border-radius: 5px;
      padding: 10px;
      line-height: 1.25;
      transition-property: all, -height;
      transition-duration: 0.3s;
      transition-timing-function: ease;
      box-sizing: border-box;
      resize: vertical;
      width: 100%;
    }

    /* Apply focus styles to the textarea */
    .input-container.focused {
      outline: none;
      border: 1px solid var(--blue);
      box-shadow: 0 0 3px rgba(62, 126, 235, 0.5);
    }

    input {
      background: transparent;
      border: none;
      outline: none;
      color: var(--white);
    }

    label {
      margin-bottom: 3px;
    }

    chat-icon {
      width: 24px;
      height: 24px;
      display: inline-block;
      cursor: pointer;
    }

    /* Apply placeholder styles */
    input::placeholder {
      color: var(--placeholder);
    }`]

  /**
   * Text value of the textarea
   */
  @property({type: String})
  value = '';

   /**
   * Placeholder text for the textarea
   */
   @property({type: String})
   placeholder = '';

  /**
   * Label for the textarea
   */
  @property({type: String})
  label = '';

  @property({type: String})
  name = 'unused';

  @property({type: String})
  autocomplete = '';

  @property({type: Boolean})
  password = false;

  @property({type: Boolean})
  disabled = false;

  @property({type: Boolean})
  showPassword = false;

  @query("input")
  _input: HTMLInputElement;

  @state()
  input_id = this.randomString(30);

  @property ({type: Boolean})
  _focused = false;

   constructor() {
    super();
  }

  public helper() {
    ChatIcon.properties;
  }

  override render() {
    return html`
        <label for="${this.input_id}">${this.label}</label>
        <div class="${this._focused ? "input-container focused" : "input-container blurred"}">
        <div class="flex-horizontal">
          <input
              id="${this.input_id}"
              type="${this.password && !this.showPassword ? "password" : "text"}"
              name="${this.name}"
              autocomplete="${this.autocomplete}"
              class="flex-fill"
              .value=${this.value}
              @input=${this.changeName}
              @focus=${this._childFocused}
              @blur=${this._childBlured}
              @changed=${this.changeName}
              placeholder="${this.placeholder}"
              ?disabled="${this.disabled}"
              @keydown=${this._submitCheck}
            />
          ${this.password ? this.showPassword ?
          html`<chat-icon path=${mdiEyeOffOutline} @click=${this.toggleShowPassword}></chat-icon>` :
          html`<chat-icon path=${mdiEyeOutline} @click=${this.toggleShowPassword}></chat-icon>`
          : html``}
        </div>`;
  }

  private toggleShowPassword(_event: Event) {
    this.showPassword = !this.showPassword;
    this.doFocus();
  }

  private _childFocused(_event: Event) {
    this._focused = true;
  }

  private _childBlured(_event: Event) {
    this._focused = false;
  }

  changeName(event: Event) {
    const input = event.target as HTMLInputElement;
    this.value = input.value;
  }

  private async _submitCheck(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      const myEvent = new Event("submit", {
        bubbles: true,
        composed: true });
      this.dispatchEvent(myEvent);
    }
  }

  public doFocus() {
    this._input.focus();
    this._input.selectionStart = this._input.selectionEnd = this._input.value.length;
  }

  private randomString(length: number): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length }).map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join("");
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-text-box': ChatTextBox;
  }
}
