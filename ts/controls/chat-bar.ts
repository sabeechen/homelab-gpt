import { mdiPlus } from '@mdi/js';
import {LitElement, html, css} from 'lit';
import {customElement} from 'lit/decorators.js';
import { defaultCSS } from "../global-styles"
import { ChatIcon } from './chat-icon';

/**
 * Displays an svg path
 * @attr color
 * @attr path
 */
@customElement('chat-bar')
export class ChatBar extends LitElement {
  static override styles = [defaultCSS, css`
    .top-insert {
      height: 5px;
      background: var(--bg);
      border-top: 2px solid #303030;
      cursor: pointer;
      transition: height 0.2s ease, border-radius 0.2s ease;
    }

    chat-icon {
      margin-right: 5px;
    }

    .top-insert:hover {
      height: 20px;
      background: #303030;
      border-radius: 10px;
    }

    .hidden {
      display: none;
    }

    .top-insert:hover .hidden {
      display: block;
    }
    span {
      vertical-align: top;
    }
  `];

  helper() {
    ChatIcon.properties;
  }

  override render() {
    return html`
      <div class="top-insert flex-horizontal flex-center">
        <div class="hidden">
          <chat-icon .path=${mdiPlus}></chat-icon>
          <span>Insert Message</span>
        </div>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-bar': ChatBar;
  }
}
