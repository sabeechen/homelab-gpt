export class Util {
  public static formatCostUSD(amount: number) {
    if (amount >= 1) {
      return `$${amount.toFixed(2)}`;
    } else {
      return `¢${this._roundToTwoSignificantDigits(amount * 100)}`;
    }
  }

  private static _roundToTwoSignificantDigits(num: number) {
    const magnitude = Math.floor(Math.log10(Math.abs(num)));
    const scale = Math.pow(10, magnitude - 1);
    return parseFloat((Math.round(num / scale) * scale).toPrecision(2));
  }
}