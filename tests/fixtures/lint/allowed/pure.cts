export type SafeInteger = number & { readonly __brand: 'SafeInteger' };
export const isSafe = (value: number): value is SafeInteger =>
  Number.isInteger(value) && Math.abs(value) < 9007199254740992;
