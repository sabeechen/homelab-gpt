import {LitElement, html, css} from 'lit';
import {customElement, property} from 'lit/decorators.js';

/**
 * A styled slider.
 *
 * @fires count-changed - Indicates when the count changes
 * @attr min
 * @attr max
 * @attr step
 * @attr label
 * @attr value
 */
@customElement('chat-slider')
export class ChatSlider extends LitElement {
  static override styles = css`
    .slider-container {
      display: flex;
      align-items: center;
      width: 200px;
      margin: 0px 0;
    }

    .slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 5px;
      background: #444;
      outline: none;
      border-radius: 5px;
      box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.2);
      margin-top: 10px;
    }

    .slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 20px;
      height: 20px;
      background: var(--blue);
      border-radius: 50%;
      cursor: pointer;
      transition-property: background;
      transition-duration: 0.2s;
      transition-timing-function: ease;
    }

    .slider::-moz-range-thumb {
      width: 20px;
      height: 20px;
      background: var(--blue);
      border-radius: 50%;
      cursor: pointer;
      transition-property: background;
      transition-duration: 0.2s;
      transition-timing-function: ease;
    }

    .slider::-ms-thumb {
      width: 20px;
      height: 20px;
      background: var(--blue);
      border-radius: 50%;
      cursor: pointer;
      transition-property: background;
      transition-duration: 0.2s;
      transition-timing-function: ease;
    }

    .slider::-webkit-slider-thumb:hover {
      background: var(--blue-hover);
    }

    .slider::-moz-range-thumb:hover {
      background: var(--blue-hover);
    }

    .slider::-ms-thumb:hover {
      background: var(--blue-hover);
    }

    .slider-outter {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
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
  @property({type: Number, attribute: true})
  value = 0;

  @property({type: Number, attribute: true})
  min = 0;

  @property({type: Number, attribute: true})
  max = 100;

  @property({type: Number, attribute: true})
  step = 1;


  override render() {
    return html`
      <div class="slider-outter">
          <span>${this.label.replace("{}", this.value?.toString())}</span> </span>
          <div class="slider-container">
            <input
              type="range"
              class="slider"
              min=${this.min}
              max=${this.max}
              step=${this.step}
              value=${this.value}
              @input=${this._changeValue}
            />
          </div>
        </div>
    `;
  }

  private _changeValue(event: Event) {
    this.value = Number.parseFloat((event.target as HTMLInputElement).value);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'chat-slider': ChatSlider;
  }
}
