import { describe, expect, it } from "vitest";
import { loadLegacyGhanaContacts } from "./legacy-contacts";

type Row = Record<string, unknown>;

/** Minimal PostgREST stand-in: records the paths asked for, returns canned pages. */
function fetcherOf(pages: Row[][]) {
  const paths: string[] = [];
  let call = 0;
  const fetcher = async <T>(path: string): Promise<T[]> => {
    paths.push(path);
    return (pages[call++] ?? []) as T[];
  };
  return { fetcher, paths };
}

describe("loadLegacyGhanaContacts", () => {
  it("reads the legacy table, never the partners table", async () => {
    const { fetcher, paths } = fetcherOf([
      [
        {
          id: "a",
          full_name: "Ama Mensah",
          whatsapp_number: "+233201234567",
          church: "Aburi Main",
          country: "Ghana",
          status: null,
        },
      ],
    ]);
    await loadLegacyGhanaContacts(fetcher);
    expect(paths[0]).toContain("legacy_ghana_contacts");
    expect(paths.join()).not.toMatch(/\bpartners\?/);
  });

  it("maps rows to messageable contacts with no giving history", async () => {
    const { fetcher } = fetcherOf([
      [
        {
          id: "a",
          full_name: "Ama Mensah",
          whatsapp_number: "+233201234567",
          church: "Aburi Main",
          country: "Ghana",
          status: null,
        },
      ],
    ]);
    const [contact] = await loadLegacyGhanaContacts(fetcher);
    expect(contact.name).toBe("Ama Mensah");
    expect(contact.phone).toBe("+233201234567");
    expect(contact.messageable).toBe(true);
    // These contacts predate the live ledger — amounts must not be invented.
    expect(contact.givenMinor).toBe(0);
  });

  it("pages past the PostgREST 1,000-row truncation", async () => {
    const page = (n: number, from: number): Row[] =>
      Array.from({ length: n }, (_, i) => ({
        id: `id-${from + i}`,
        full_name: `Partner ${from + i}`,
        whatsapp_number: `+2332000000${String(from + i).padStart(2, "0")}`,
        church: null,
        country: "Ghana",
        status: null,
      }));
    const { fetcher, paths } = fetcherOf([page(1000, 0), page(133, 1000)]);
    const contacts = await loadLegacyGhanaContacts(fetcher);
    expect(contacts).toHaveLength(1133);
    expect(paths[1]).toContain("offset=1000");
  });

  it("marks a row without a usable phone as not messageable", async () => {
    const { fetcher } = fetcherOf([
      [
        {
          id: "a",
          full_name: "No Name",
          whatsapp_number: null,
          church: null,
          country: "Ghana",
          status: null,
        },
      ],
    ]);
    const [contact] = await loadLegacyGhanaContacts(fetcher);
    expect(contact.phone).toBeNull();
    expect(contact.messageable).toBe(false);
    expect(contact.name).toBe("Unknown");
  });
});
