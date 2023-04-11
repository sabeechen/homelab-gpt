import {LitElement, html, css} from 'lit';
import {customElement, property, queryAll} from 'lit/decorators.js';
import { Model } from '../app-data';

@customElement('chat-radio')
export class ChatRadio extends LitElement {
  static override styles = css`
    .radio-container {
        display: flex;
        justify-content: center;
        width: auto;
        flex-wrap: wrap;
    }

    .radio-label {
      display: flex;
      align-items: center;
      cursor: pointer;
      margin: 10px 10px;
    }

    .radio-label input {
      width: 16px;
      height: 16px;
      background-color: #23272a;
      border: 1px solid var(--grey);
      border-radius: 50%;
      appearance: none;
      cursor: pointer;
      margin-right: 5px;
    }

    .radio-label input:checked {
      border-color: #00114d;
      background-color: var(--blue);
    }

    .radio-label span {
      color: #99aab5;
    }

    .radio-label input:checked + span {
      color: var(--white);
    }
  `;

  /**
   * Label for the checkbox
   */
  @property({type: String})
  label = '';

  /**
   * Value of the checkbox, ie "checked" property
   */
  @property({type: Boolean})
  value = false;

   /**
   * Value of the radio, ie "checked" property
   */
   @property({type: Boolean})
   checked = false;

   @queryAll('input')
   _inputs: NodeListOf<HTMLInputElement>;

   @property({type: Object})
   options: Model[]

   public getSelected() {
    let last = undefined;
    for (const input of this._inputs) {
      if (input.checked) {
        return input.value
      }
      last = input;
    }
    return last.value;
  }


  override render() {
    return html`
        <div class="radio-container">
          ${this.options.map((option) => html`
          <label class="radio-label">
            <input
              type="radio"
              name="option"
              value="${option.value}"
            />
            <span>${option.label}</span>
          </label>`)}
        </div>`;
  }

}

declare global {
  interface HTMLElementTagNameMap {
    'chat-radio': ChatRadio;
  }
}
