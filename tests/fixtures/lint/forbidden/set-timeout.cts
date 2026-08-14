export function schedule(callback: () => void): void {
  setTimeout(callback, 0);
}
