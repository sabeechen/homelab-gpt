import {LitElement, html, css} from 'lit';
import {customElement, property, query } from 'lit/decorators.js';
/**
 * A styled button
 * @attr label
 * @attr options
 * @attr value_property
 * @attr label_property
 * @attr default
 */
@customElement('chat-drop-down')
export class ChatDropDown extends LitElement {
  static override styles = css`
      select {
        background-color: var(--bg);
        color: var(--white);
        border: 2px solid var(--grey);
        margin: 2px;
        border-radius: 9px;
        padding: 10px;
        display: flex;
        justify-items: center;
        align-items: center;
        width: 100%;
      }


      select option {
        background-color: var(--bg);
        color: var(--white);
        display: flex;
        justify-items: center;
        align-items: center;
      }

      select option:hover,
      select option:focus {
        background-color: var(--blue);
      }

      .default-option {
        color: var(--placeholder);
      }
  `;

  @property()
  label = ""

  @property()
  value_property = "value"

  @property()
  label_property: any = "label"

  @property()
  default: any = "..."

  @property({type: Array})
  options: any[] = [];

  @property()
  selected: any = null

  @query("#select")
  select: HTMLSelectElement

  override render() {
    return html`
      <label for="select">${this.label}</label>
      <select id="select" name="select" class='${this.selected === null ? "default-option truncate" : "truncate"}' @input=${this._input}>
        <option class="default-option truncate" .selected=${this.selected === null} value="placeholder">${this.default}</option>
        ${this.options.map(
          (item) => html`<option class="truncate" .selected=${this.selected != null && this.selected[this.value_property] == item[this.value_property]} .value=${item[this.value_property]}>${this._getLabel(item)}</option>`
        )}
      </select>
    `;
  }

  private _getLabel(source: any) {
    try{
      if (typeof this.label_property === 'string') {
        return source[this.label_property];
      } else {
        return this.label_property(source);
      }
    } catch(e) {
      console.log(e);
      console.log(this.label_property);
      console.log(source);
      return e;
    }
  }

  private _input() {
    const value = this.select.value;
    if (value === "placeholder") {
      this.selected = null;
    } else {
      for (const option of this.options) {
        if (option[this.value_property] == value) {
          this.selected = option;
          return;
        }
      }
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-drop-down': ChatDropDown;
  }
}
