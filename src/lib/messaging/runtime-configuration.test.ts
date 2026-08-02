import { describe, expect, it, vi } from "vitest";
import { messagingRuntimeConfiguration } from "./runtime-configuration";

const environment = {
  BENMP_MESSAGING_PROVIDER: "wali",
  WALI_API_KEY: "secret",
  WALI_DEVICE_ID: "device-123",
};

describe("messagingRuntimeConfiguration", () => {
  it("marks an operative configured Wali device ready", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify([{ id: "device-123", status: "operative" }]),
          { status: 200 },
        ),
      );

    await expect(
      messagingRuntimeConfiguration(environment, fetcher),
    ).resolves.toEqual({ provider: "wali", ready: true });
  });

  it("fails closed when the Wali account has no connected device", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));

    await expect(
      messagingRuntimeConfiguration(environment, fetcher),
    ).resolves.toMatchObject({
      provider: "wali",
      ready: false,
      note: expect.stringContaining("Reconnect the BENMP number"),
    });
  });

  it("does not call Wali when required configuration is missing", async () => {
    const fetcher = vi.fn();
    const result = await messagingRuntimeConfiguration(
      {
        BENMP_MESSAGING_PROVIDER: "wali",
        WALI_API_KEY: "secret",
      },
      fetcher,
    );

    expect(result.ready).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
