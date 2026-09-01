import { describe, expect, it } from "vitest";
import { buildDirectMessages } from "./direct-message";
import type { DirectoryPartner } from "./directory";

const partner = (over: Partial<DirectoryPartner> = {}): DirectoryPartner => ({
  id: "p1",
  name: "Ama Mensah",
  phone: "+233241234567",
  branch: "Aburi Main",
  country: "Ghana",
  givenMinor: 0,
  messageable: true,
  ...over,
});

describe("buildDirectMessages channel", () => {
  it("defaults to WhatsApp, so existing callers are unchanged", () => {
    const [m] = buildDirectMessages([partner()], "Hello {name}");
    expect(m.channel).toBe("whatsapp");
  });

  it("builds SMS messages when asked", () => {
    const [m] = buildDirectMessages(
      [partner()],
      "Hello {name}",
      undefined,
      "sms",
    );
    expect(m.channel).toBe("sms");
    expect(m.body).toBe("Hello Ama");
  });

  it("keeps un-sendable partners in the list for the preview", () => {
    // The preview must show "will not be sent" rather than quietly shrinking.
    const [m] = buildDirectMessages(
      [partner({ phone: null, messageable: false })],
      "Hello {name}",
      undefined,
      "sms",
    );
    expect(m.sendable).toBe(false);
    expect(m.channel).toBe("sms");
  });
});
