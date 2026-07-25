import { describe, expect, it } from "vitest";
import { messagingConfiguration } from "./configuration";

describe("messagingConfiguration", () => {
  it("fails closed when no live provider is selected", () => {
    expect(messagingConfiguration({})).toMatchObject({
      provider: "mock",
      ready: false,
    });
  });

  it("explains which Wali setting is missing without exposing values", () => {
    expect(
      messagingConfiguration({
        BENMP_MESSAGING_PROVIDER: "wali",
        WALI_API_KEY: "secret",
      }),
    ).toEqual({
      provider: "wali",
      ready: false,
      note: "wali is selected, but WALI_DEVICE_ID is missing from this deployment.",
    });
  });

  it("marks Wali ready when both server credentials are present", () => {
    expect(
      messagingConfiguration({
        BENMP_MESSAGING_PROVIDER: "wali",
        WALI_API_KEY: "secret",
        WALI_DEVICE_ID: "device",
      }),
    ).toEqual({ provider: "wali", ready: true });
  });

  it("accepts the Meta adapter's legacy token environment name", () => {
    expect(
      messagingConfiguration({
        BENMP_MESSAGING_PROVIDER: "meta-cloud-api",
        META_WHATSAPP_TOKEN: "secret",
        META_WHATSAPP_PHONE_NUMBER_ID: "number",
      }),
    ).toEqual({ provider: "meta-cloud-api", ready: true });
  });
});
