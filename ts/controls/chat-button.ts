import {LitElement, html, css} from 'lit';
import {customElement, property} from 'lit/decorators.js';
/**
 * A styled button
 * @attr danger
 */
@customElement('chat-button')
export class ChatButton extends LitElement {
  static override styles = css`
    .button {
      background-color: var(--blue);
      display: flex;
      font-size: 16px;
      text-decoration: none;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      justify-content: center;
      flex-direction: row;
      height: 100%;
      transition-property: background;
      transition-duration: 0.2s;
      transition-timing-function: ease;
    }

    .button:hover {
      background-color: var(--blue-hover);
    }

    .button.danger {
      background-color: var(--red);
    }
    .button.danger:hover {
      background-color: var(--red-hover);
    }
  `;

    /**
   * Value of the checkbox, ie "checked" property
   */
    @property({type: Boolean})
    danger = false;

  override render() {
    return html`
      <a class="${this.danger ? 'button danger' : 'button'}">
        <slot></slot>
      </a>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-button': ChatButton;
  }
}
