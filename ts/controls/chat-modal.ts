import {LitElement, html, css} from 'lit';
import {customElement, query, state} from 'lit/decorators.js';
import { defaultCSS } from "../global-styles"

interface SubmitObject {
  submit?: () => Promise<void>;
}

/**
 * Displays an svg path
 * @attr color
 * @attr path
 */
@customElement('chat-modal')
export class ChatModal extends LitElement {
  static override styles = [defaultCSS, css`
    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      z-index: 1;
    }

    .modal {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #262626;
      padding: 2rem;
      padding-top: 0rem;
      border-radius: 5px;
      box-shadow: 0px 2px 10px rgba(0, 0, 0, 0.1);
      width: 80%;
      max-width: 400px;
      z-index: 2;
    }

    .close-btn {
      border: none;
      background: none;
      font-size: 1rem;
      padding: 4px;
      cursor: pointer;
    }
  `];

  @state()
  currentModal: any = null;

  @query('#current-modal')
  currentModalEntity?: HTMLElement & SubmitObject;

  override render() {
    if (!this.currentModal) {
      return html``;
    } else {
      const modal = document.createElement(this.currentModal);
      modal.id = 'current-modal';
      return html`
      <div class="overlay"></div>
      <div class="modal">
        ${modal}
      </div>`;
    }
  }

  closeHandlerWorkaround = this._handleClose.bind(this);
  openHandlerWorkaround = this._handleOpen.bind(this);
  keyHandlerWorkaround = this._keysCheck.bind(this);
  public override connectedCallback() {
    this.style.display = 'none';
    super.connectedCallback();
    window.addEventListener('close-modal', this.closeHandlerWorkaround);
    window.addEventListener('open-modal', this.openHandlerWorkaround);
    window.addEventListener('keydown', this.keyHandlerWorkaround);
  }

  private _handleClose(e: Event) {
    // Hide the root element
    this.style.display = 'none';
    this.currentModal = null;
    e.stopPropagation();
  }

  private _handleOpen(e: CustomEvent) {
    this.style.display = 'block';
    this.currentModal = e.detail;
    this.requestUpdate();
    e.stopPropagation();
  }

  private async _keysCheck(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.currentModalEntity) {
      ChatModal.closeModal(this.currentModalEntity);
      event.stopPropagation();
    } else if(event.key == 'Enter' && this.currentModalEntity) {
      if (typeof this.currentModalEntity.submit === "function") {
        await this.currentModalEntity.submit();
      }
    }
  }

  /** Static method to publish a "close" event */
  static closeModal(e: Event|HTMLElement) {
    const event = new Event('close-modal', {bubbles: true, composed: true});
    if (e instanceof Event) {
      e.target.dispatchEvent(event);
    } else {
      e.dispatchEvent(event);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-modal': ChatModal;
  }
}
