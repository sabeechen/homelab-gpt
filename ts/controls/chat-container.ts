import {LitElement, html, css} from 'lit';
import {customElement} from 'lit/decorators.js';

/**
 * A container with a mobile-friendly width
 */
@customElement('chat-container')
export class ChatContainer extends LitElement {
  static override styles = css`
    :host {
        display: block;
        max-width: 1200px;
        margin: 10px 5px;
        width: calc(100% - 10px);
        justify-content: center;
        display: flex;
      }

      @media (min-width: 769px) { :host { max-width: 1200px; margin: 0 auto;  padding: 20px;} }

      @media (max-width: 768px) {
        :host {
          width: calc(100% - 10px);
          padding: 5px 5px;
          margin: 0px;
        }
      }
  `;

  override render() {
    return html`
      <slot></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-container': ChatContainer;
  }
}
