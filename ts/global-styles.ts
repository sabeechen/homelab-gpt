import { css } from "lit-element";

export const defaultCSS = css`
  .hidden {
    display: none;
  }
  .truncate {
    white-space: nowrap; /* Prevents text from wrapping to the next line */
    overflow: hidden; /* Hides any overflowing text beyond the div boundaries */
    text-overflow: ellipsis; /* Adds an ellipsis (...) to indicate truncated text */
  }
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

  .flex-wrap {
    flex-wrap: wrap;
  }

  .flip {
    transform: scaleX(-1);
  }

  * {
    box-sizing: border-box;
  }

  @media only screen and (max-width: 767px) {
    .mobile-only {
      display: block;
    }

    .mobile-only-flex {
      display: flex;
    }

    .desktop-only {
      display: none;
    }

    .desktop-only-flex {
      display: none;
    }
  }

  @media only screen and (min-width: 768px) {
    .mobile-only {
      display: none;
    }

    .mobile-only-flex {
      display: none;
    }

    .desktop-only {
      display: block;
    }

    .desktop-only-flex {
      display: flex;
    }
    
  }
  `;