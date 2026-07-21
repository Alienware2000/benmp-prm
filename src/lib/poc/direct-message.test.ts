import { describe, expect, it } from "vitest";
import {
  MAX_BODY_LENGTH,
  NAME_FALLBACK,
  buildDirectMessages,
  greetingFor,
  renderTemplate,
  validateTemplate,
} from "./direct-message";
import type { DirectoryPartner } from "./directory";

function partner(over: Partial<DirectoryPartner> = {}): DirectoryPartner {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Ama Serwaa",
    phone: "+233240000001",
    branch: "Qodesh",
    country: "Ghana",
    givenMinor: 0,
    messageable: true,
    ...over,
  };
}

describe("greetingFor", () => {
  it("uses the first name", () => {
    expect(greetingFor({ name: "Ama Serwaa" })).toBe("Ama");
  });

  it("strips titles the way the planned queues do", () => {
    expect(greetingFor({ name: "Rev. Kofi Boateng" })).toBe("Kofi");
  });

  it("falls back to a neutral greeting for unknown names", () => {
    expect(greetingFor({ name: "Unknown" })).toBe(NAME_FALLBACK);
  });
});

describe("renderTemplate", () => {
  it("substitutes every {name} occurrence", () => {
    expect(renderTemplate("Hi {name}, thanks {name}!", "Ama")).toBe(
      "Hi Ama, thanks Ama!",
    );
  });

  it("is case-insensitive on the token", () => {
    expect(renderTemplate("Hi {Name}", "Ama")).toBe("Hi Ama");
  });

  it("leaves a template without the token alone", () => {
    expect(renderTemplate("Service resumes Sunday.", "Ama")).toBe(
      "Service resumes Sunday.",
    );
  });
});

describe("validateTemplate", () => {
  it("rejects an empty or whitespace-only message", () => {
    expect(validateTemplate("")).toBe("empty");
    expect(validateTemplate("   ")).toBe("empty");
  });

  it("rejects an over-long message", () => {
    expect(validateTemplate("x".repeat(MAX_BODY_LENGTH + 1))).toBe("too_long");
  });

  it("accepts a normal message", () => {
    expect(validateTemplate("Hi {name}, God bless you.")).toBeNull();
  });
});

describe("buildDirectMessages", () => {
  it("renders one message per selected partner", () => {
    const msgs = buildDirectMessages(
      [
        partner(),
        partner({ id: "2", name: "Kofi Mensah", phone: "+233240000002" }),
      ],
      "Hi {name}, God bless you.",
    );
    expect(msgs).toHaveLength(2);
    expect(msgs[0].body).toBe("Hi Ama, God bless you.");
    expect(msgs[1].body).toBe("Hi Kofi, God bless you.");
  });

  it("marks the message as direct, not as a planned queue", () => {
    expect(buildDirectMessages([partner()], "hi")[0].kind).toBe("direct");
  });

  it("carries the partner id so the audit row points at a person", () => {
    expect(buildDirectMessages([partner()], "hi")[0].partnerRef).toBe(
      partner().id,
    );
  });

  it("carries trusted attachment metadata to the provider boundary", () => {
    const [m] = buildDirectMessages([partner()], "hi", {
      url: "https://cdn.example.org/crusade.jpg",
      mimeType: "image/jpeg",
      filename: "Crusade update.jpg",
    });
    expect(m).toMatchObject({
      mediaUrl: "https://cdn.example.org/crusade.jpg",
      mediaType: "image/jpeg",
      mediaFilename: "Crusade update.jpg",
    });
  });

  it("keeps phoneless partners visible but not sendable", () => {
    const [m] = buildDirectMessages(
      [partner({ phone: null, name: "Unknown" })],
      "Hi {name}",
    );
    expect(m.sendable).toBe(false);
    expect(m.to).toBeNull();
    expect(m.body).toBe(`Hi ${NAME_FALLBACK}`);
  });

  it("returns nothing for an empty selection", () => {
    expect(buildDirectMessages([], "hi")).toEqual([]);
  });
});
