export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(`The server returned an empty response (${response.status}). Please try again.`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`The server returned an invalid response (${response.status}). Please try again.`);
  }
}
