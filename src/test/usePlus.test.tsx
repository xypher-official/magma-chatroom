import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  callback: undefined as undefined | (() => void),
  getSession: vi.fn(), rpc: vi.fn(), invoke: vi.fn(), unsubscribe: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: {
    getSession: mocks.getSession,
    onAuthStateChange: (callback: () => void) => { mocks.callback = callback; return { data: { sub: undefined, subscription: { unsubscribe: mocks.unsubscribe } } }; },
  },
  rpc: mocks.rpc,
  functions: { invoke: mocks.invoke },
} }));

import { usePlus } from "@/hooks/usePlus";

describe("Plus entitlement during assistant inference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "admin-user" } } } });
    mocks.rpc.mockResolvedValue({ data: true });
  });

  it("returns the current admin entitlement even if the first render was not subscribed", async () => {
    const { result, unmount } = renderHook(() => usePlus());
    let entitlement: boolean | undefined;
    await act(async () => { entitlement = await result.current.refresh(); });
    expect(entitlement).toBe(true);
    expect(result.current.subscribed).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("has_role", { _user_id: "admin-user", _role: "admin" });
    expect(mocks.invoke).not.toHaveBeenCalled();
    unmount();
  });

  it("defers session reads outside the auth callback lock", async () => {
    const { unmount } = renderHook(() => usePlus());
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalled());
    mocks.getSession.mockClear();
    act(() => { mocks.callback?.(); });
    expect(mocks.getSession).not.toHaveBeenCalled();
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalledTimes(1));
    unmount();
  });
});