import { describe, expect, it } from "vitest";
import { readJsonResponse } from "./read-json-response";

describe("readJsonResponse", () => {
  it("parses a JSON response", async () => {
    await expect(readJsonResponse<{ ok: boolean }>(Response.json({ ok: true }))).resolves.toEqual({ ok: true });
  });

  it("turns an empty response into a recoverable error", async () => {
    await expect(readJsonResponse(new Response(null, { status: 500 }))).rejects.toThrow("empty response (500)");
  });

  it("turns malformed JSON into a recoverable error", async () => {
    await expect(readJsonResponse(new Response("not json", { status: 502 }))).rejects.toThrow("invalid response (502)");
  });
});
