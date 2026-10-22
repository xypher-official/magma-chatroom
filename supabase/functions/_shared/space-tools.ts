export interface ToolDefinition {
  function: {
    name: string;
    description: string;
    parameters: {
      properties: Record<string, { type: string; items?: { type: string } }>;
      required?: string[];
    };
  };
}

export interface SpaceToolCall { name: string; args: Record<string, unknown> }

/** The Space proposes calls; only the trusted server validates and executes them. */
export function parseSpaceToolCalls(text: string, tools: ToolDefinition[]): SpaceToolCall[] {
  const calls: SpaceToolCall[] = [];
  for (const match of text.matchAll(/```magma-tool\s*([\s\S]*?)```/g)) {
    if (calls.length >= 4) throw new Error("Too many actions in one response");
    const value = JSON.parse(match[1]);
    const tool = tools.find((item) => item.function.name === value?.name);
    if (!tool || !value.args || typeof value.args !== "object" || Array.isArray(value.args)) {
      throw new Error("Invalid assistant action");
    }
    const schema = tool.function.parameters;
    for (const key of schema.required ?? []) {
      if (value.args[key] === undefined) throw new Error(`Missing action parameter: ${key}`);
    }
    for (const [key, arg] of Object.entries(value.args)) {
      const property = schema.properties[key];
      if (!property) throw new Error(`Unknown action parameter: ${key}`);
      if (property.type === "array") {
        if (!Array.isArray(arg) || arg.length > 100 || arg.some((item) => typeof item !== property.items?.type)) {
          throw new Error(`Invalid action parameter: ${key}`);
        }
      } else if (typeof arg !== property.type || (typeof arg === "number" && !Number.isFinite(arg))) {
        throw new Error(`Invalid action parameter: ${key}`);
      }
      if (typeof arg === "string" && arg.length > 24000) throw new Error(`Action parameter too long: ${key}`);
    }
    calls.push({ name: value.name, args: value.args });
  }
  return calls;
}

export function redactToolResult(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactToolResult);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    /password|token|secret|api.?key|email/i.test(key) ? "[redacted]" : redactToolResult(item),
  ]));
}

export function stripSpaceToolCalls(text: string): string {
  return text.replace(/```magma-tool\s*[\s\S]*?```/g, "").trim();
}