export async function grab(url: string): Promise<Response> {
  return await fetch(url);
}
