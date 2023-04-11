import {LitElement, html, css} from 'lit';
import {customElement, property, query} from 'lit/decorators.js';
import  {defaultCSS} from "../global-styles"

/**
 * A styled textarea element
 *
 * @attr rows - The number of textarea rows
 * @attr placeholder - The textarea placeholder text
 */
@customElement('chat-text-area')
export class ChatTextArea extends LitElement {
  static override styles = [defaultCSS, css`
    textarea {
      width: 100%;
      box-sizing: border-box;
      resize: vertical;
      font-family: 'Arial', sans-serif;
    }

    /* Apply dark theme to the textarea */
    textarea {
      background-color: #1e1e1e;
      color: var(--white);
      border: 1px solid var(--grey);
      border-radius: 5px;
      padding: 10px;
      width: calc(100% - 40px);
      font-size: 14px;
      line-height: 1.5;
      transition-property: all, -height;
      transition-duration: 0.3s;
      transition-timing-function: ease;
    }

    /* Apply focus styles to the textarea */
    textarea:focus {
      outline: none;
      border: 1px solid var(--blue);
      box-shadow: 0 0 3px rgba(62, 126, 235, 0.5);
    }

    /* Apply placeholder styles */
    textarea::placeholder {
      color: #888;
    }`]

  /**
   * Text value of the textarea
   */
  @property({type: String})
  value = '';

   /**
   * How many vertical lines the textarea has (modifiable by the user)
   */
   @property({type: Number})
   rows = 2;

   /**
   * PLaceholder text for the textarea
   */
   @property({type: String})
   placeholder = '';

   @query("textarea")
   _textarea: HTMLTextAreaElement;

   constructor() {
    super();
  }

  override render() {
    return html`
      <textarea
          class="chat-input"
          rows=${this.rows}
          .value=${this.value}
          @input=${this.changeName}
          placeholder="${this.placeholder}"
        ></textarea>
    `;
  }

  changeName(event: Event) {
    const input = event.target as HTMLInputElement;
    this.value = input.value;
  }

  public doFocus() {
    this._textarea.focus();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-text-area': ChatTextArea;
  }
}
