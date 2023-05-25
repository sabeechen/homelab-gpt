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
    :root {
      display: flex;
      justify-content: center;
    }
    .top-insert {
      height: 5px;
      background: var(--bg);
      border-top: 2px solid rgb(48, 48, 48);
      cursor: pointer;
      transition: height 0.2s ease 0s, border-radius 0.2s ease 0s;
      width: 95%;
    }

    chat-icon {
      margin-right: 5px;
      width: 24px;
      height: 24px;
      display: inline-block;
    }

    .top-insert:hover {
      height: 20px;
      background: rgb(48, 48, 48);
      padding: 2px;
      border: 2px solid rgb(115, 115, 115);
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
    <div class="wide flex-horizontal flex-center">
      <div class="top-insert flex-horizontal flex-center">
        <div class="hidden">
          <chat-icon .path=${mdiPlus}></chat-icon>
          <span>Insert Message</span>
        </div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-bar': ChatBar;
  }
}
