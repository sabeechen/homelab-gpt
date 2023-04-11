import {LitElement, html, css} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement('chat-icon')
export class ChatIcon extends LitElement {
  static override styles = css`

  `;

    @property({type: String, attribute: true})
    path: String;

  override render() {
    return html`
      <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" fill="#FFFFFF">
        <path d="${this.path}"/></svg>`;

  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-icon': ChatIcon;
  }
}
