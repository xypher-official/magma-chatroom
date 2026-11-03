import { describe, expect, it } from "vitest";
import { buildSpaceData, consumeSpaceEvents, isOwnedMediaUrl, readSpaceCompletion, SPACE_ID } from "../../supabase/functions/_shared/minicpm-space";

describe("MiniCPM public Space protocol", () => {
  it("uses the requested Space and all 18 positional parameters without a key", () => {
    expect(SPACE_ID).toBe("openbmb/MiniCPM-V-4.7-Demo");
    const data = buildSpaceData([
      { role: "user", content: "first" }, { role: "assistant", content: "answer" }, { role: "user", content: "second" },
    ], "Be honest");
    expect(data).toHaveLength(18);
    expect(data[0]).toContain("Be honest");
    expect(data[0]).toContain("second");
    expect(data[1]).toEqual([["first", "answer"]]);
    expect(data[3]).toBe(false);
    expect(data[17]).toBe("MiniCPM-V-4.7-35B-A3B");
  });

  it("ignores Gradio incremental diffs and returns the terminal content", async () => {
    const events = [
      { msg: "process_generating", event_id: "job", output: { data: [["append", ["content"], "partial"]] } },
      { msg: "process_completed", event_id: "other", success: true, output: { data: [{ content: "wrong session" }] } },
      { msg: "process_completed", event_id: "job", success: true, output: { data: [{ content: "Respuesta real 🌋", reasoning: "private reasoning" }] } },
    ];
    const response = new Response(events.map((event) => `data: ${JSON.stringify(event)}\r\n\r\n`).join(""));
    await expect(consumeSpaceEvents(response, "job")).resolves.toBe("Respuesta real 🌋");
  });

  it("never exposes upstream error details or treats HTTP success as inference success", () => {
    expect(() => readSpaceCompletion({ msg: "process_completed", success: false, output: { error: "secret upstream token" } })).toThrow("no está disponible");
    expect(() => readSpaceCompletion({ msg: "process_completed", success: true, output: { data: [{ content: "" }] } })).toThrow("vacía");
  });

  it("accepts only the authenticated user's own stored media", () => {
    const base = "https://backend.example";
    const path = "/storage/v1/object/public/social-media/chat/user-a/photo.png";
    expect(isOwnedMediaUrl(base + path, base, "user-a")).toBe(true);
    expect(isOwnedMediaUrl(base + path, base, "user-b")).toBe(false);
    expect(isOwnedMediaUrl("https://untrusted.example" + path, base, "user-a")).toBe(false);
    expect(isOwnedMediaUrl(base + path + "?token=private", base, "user-a")).toBe(false);
  });
});