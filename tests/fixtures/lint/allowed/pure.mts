const truncate = (value: bigint, divisor: bigint): bigint => value / divisor;
export const compute = (a: bigint, b: bigint): bigint => truncate(a * b, 10000n);
