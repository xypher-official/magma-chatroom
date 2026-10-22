import { describe, expect, it } from "vitest";
import { parseSpaceToolCalls, redactToolResult } from "../../supabase/functions/_shared/space-tools";

const tools = [{ function: {
  name: "set_banner", description: "Change banner", parameters: {
    properties: { enabled: { type: "boolean" }, message: { type: "string" } }, required: ["enabled"],
  },
} }];

describe("Public Space action boundary", () => {
  it("accepts only declared tools with correctly typed parameters", () => {
    expect(parseSpaceToolCalls('```magma-tool\n{"name":"set_banner","args":{"enabled":true,"message":"Hello"}}\n```', tools))
      .toEqual([{ name: "set_banner", args: { enabled: true, message: "Hello" } }]);
    expect(() => parseSpaceToolCalls('```magma-tool\n{"name":"execute_sql","args":{}}\n```', tools)).toThrow();
    expect(() => parseSpaceToolCalls('```magma-tool\n{"name":"set_banner","args":{"enabled":"false"}}\n```', tools)).toThrow();
    expect(() => parseSpaceToolCalls('```magma-tool\n{"name":"set_banner","args":{"enabled":true,"api_key":"x"}}\n```', tools)).toThrow();
  });

  it("does not send temporary passwords or private credentials back to the Space", () => {
    expect(redactToolResult({ ok: true, temp_password: "private", nested: { access_token: "private", api_key: "private" } }))
      .toEqual({ ok: true, temp_password: "[redacted]", nested: { access_token: "[redacted]", api_key: "[redacted]" } });
  });
});