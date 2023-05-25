import {LitElement, html, css} from 'lit';
import {customElement, query} from 'lit/decorators.js';
import { defaultCSS } from "../global-styles"
import { ChatAddUser } from './chat-add-user';

/**
 * Displays an svg path
 * @attr color
 * @attr path
 * @fires close-modal
 */
@customElement('chat-edit-user')
export class ChatEditUser extends LitElement {


  static override styles = [defaultCSS, css``];

  @query('#add-user')
  addUser?: ChatAddUser;

  override render() {
    return html`<chat-add-user .edit=${true} id="add-user"></chat-add-user>`;
  }

  public async submit() {
    await this.addUser?.submit();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-edit-user': ChatEditUser;
  }
}
