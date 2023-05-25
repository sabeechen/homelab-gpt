import {LitElement, html, css} from 'lit';
import {customElement} from 'lit/decorators.js';
import  {defaultCSS} from "../global-styles"

/**
 * Password managers have trouble inspecting the shadow DOM to find the username and password fields.
 * This creates a control outside of any shadow DOM that it can use to input usernames and passwords.
 * @fires autofill
 */

export class AutofillData {
  field: "username"| "password" | "new-password";
  data: string;
}

@customElement('chat-autofill-polyfill')
export class ChatAutofillPolyfill extends LitElement {
  static override styles = [defaultCSS, css`
    .input-polyfill {
      position: absolute;

      /* ensure the form isn't visible */
      opacity: 0;
      z-index: -1;
    }`]

  protected override createRenderRoot() {
    // No shadow DOM, so the password manager can find the fields.
    return this;
  }

  override render() {
    return html`
    <form class="input-polyfill" id="autofill-polyfill">
           <input tabindex="-1" id="username-polyfill" name="username" type="text" autocomplete="username" @input=${this.usenameChanged}>
           <input tabindex="-1" id="password-polyfill" name="password" type="password"  autocomplete="current-password" @input=${this.passwordChanged}>
           <input tabindex="-1" id="new-password-polyfill" name="new-password" type="password" autocomplete="new-password" @input=${this.newPasswordChanged}>
    </form>`;
  }

  public async reset() {
    this.requestUpdate();
    await this.updateComplete;
    (document.getElementById("username-polyfill") as HTMLInputElement).value = "";
    (document.getElementById("password-polyfill") as HTMLInputElement).value = "";
    (document.getElementById("new-password-polyfill") as HTMLInputElement).value = "";
  }

  private usenameChanged(e: Event) {
    this.dataChanged(e.target as HTMLInputElement);
    (e.target as HTMLInputElement).value = "";
  }

  private passwordChanged(e: Event) {
    this.dataChanged(e.target as HTMLInputElement);
    (e.target as HTMLInputElement).value = "";
  }

  private newPasswordChanged(e: Event) {
    this.dataChanged(e.target as HTMLInputElement);
    (e.target as HTMLInputElement).value = "";
  }

  private dataChanged(input: HTMLInputElement) {
    if (input.value == "") {
      return;
    }
    const data = new AutofillData();
    if (input.id == "username-polyfill") {
      data.field = "username";
    } else if (input.id == "password-polyfill") {
      data.field = "password";
    } else if (input.id == "new-password-polyfill") {
      data.field = "new-password";
    } else {
      return;
    }
    data.data = input.value;
    const event = new CustomEvent("autofill", {detail: data, bubbles: true, composed: true});
    this.dispatchEvent(event);
    setTimeout(() => {
      // Setting the input value in the changed handler seems to fail.
      // What an awful hack this is.  But it works.
      this.reset();
      }, 500);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-autofill-polyfill': ChatAutofillPolyfill;
  }
}
