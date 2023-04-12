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
    justify-items: center;
    align-content: center;
  }
  `;