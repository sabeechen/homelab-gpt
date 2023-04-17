import {LitElement, html, css} from 'lit';
import {customElement, property, queryAll} from 'lit/decorators.js';

class SelectOption {
  label: string
  value: any
}

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

   @queryAll('input')
   _inputs: NodeListOf<HTMLInputElement>;

   @property({type: Object})
   options: SelectOption[]

   @property({type: Object})
   value: SelectOption

  override render() {
    return html`
        <div class="radio-container">
          ${this.options.map((option) => html`
          <label class="radio-label">
            <input
              type="radio"
              name="option"
              id="${option.value}"
              ?checked="${option.value == this.value?.value}"
              @input=${this._inputChanged}
            />
            <span>${option.label}</span>
          </label>`)}
        </div>`;
  }

  private _inputChanged(e: Event) {
    for (const option of this.options){
      if ( (e.target as HTMLInputElement).id == option.value) {
        this.value = option;
        return;
      }
    }
  }

}

declare global {
  interface HTMLElementTagNameMap {
    'chat-radio': ChatRadio;
  }
}
