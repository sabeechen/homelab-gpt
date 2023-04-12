import { css } from "lit-element";

export const defaultCSS = css`
  .wide {
    width: 100%;
    display: block;
  }

  .flex-vertical {
    display: flex;
    flex-direction: column;
  }

  .flex-horizontal {
    display: flex;
    flex-direction: row;
  }

  .flex-center {
    align-items: center;
    align-content: center;
    justify-content: center;
  }
  .flex-fill {
    flex-grow: 1;
  }
  * {
    box-sizing: border-box;
  }
  `;