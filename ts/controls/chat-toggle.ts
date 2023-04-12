import {LitElement, html, css} from 'lit';
import {customElement, property} from 'lit/decorators.js';

/**
 * A styled toggle element.
 *
 * @attr label
 * @attr value
 */
@customElement('chat-toggle')
export class ChatToggle extends LitElement {
  static override styles = css`
    .dark-checkbox {
      display: inline-block;
      position: relative;
      margin: 10px 20px;
    }

    .dark-checkbox input[type='checkbox'] {
      display: none;
    }

    .dark-checkbox label {
      font-size: 16px;
      padding-left: 30px;
    }

    .dark-checkbox label:before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      width: 20px;
      height: 20px;
      border: 2px solid var(--grey);
      background-color: var(--grey);
      box-sizing: border-box;
      transition: background-color 0.3s ease;
    }

    .dark-checkbox input[type='checkbox']:checked + label:before {
      background-color: var(--blue);
      border: 2px solid var(--white);
    }
  `;

  /**
   * Label for the checkbox
   */
  @property({type: String, attribute: true})
  label = '';

  /**
   * Value of the checkbox, ie "checked" property
   */
  @property({type: Boolean, attribute: true})
  value = false;


  override render() {
    return html`
      <div class="dark-checkbox" @click="${() => this.value = !this.value}">
        <input type="checkbox" ?checked=${this.value} />
        <label for="myCheckbox">${this.label}</label>
      </div>
    `;
  }

}

declare global {
  interface HTMLElementTagNameMap {
    'chat-toggle': ChatToggle;
  }
}
