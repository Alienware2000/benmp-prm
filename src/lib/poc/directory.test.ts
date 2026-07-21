import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildDirectoryPath,
  clampPage,
  clampPageSize,
  NO_BRANCH,
  branchLabel,
  displayName,
  fetchAllRows,
  isSensibleName,
  isValidBranch,
  groupBranches,
  normalizeBranchKey,
  resolveBranchKey,
  givingByPhone,
  hasRealName,
  mapPartners,
  parseTotalCount,
  rangeHeader,
  sanitizeSearch,
  type DbPartner,
} from "./directory";

describe("displayName", () => {
  it("keeps a real name", () => {
    expect(displayName("Charles Djabatey")).toBe("Charles Djabatey");
  });

  it("treats the import's 'No Name' placeholder as unknown", () => {
    expect(displayName("No Name")).toBe("Unknown");
    expect(displayName("no name")).toBe("Unknown");
  });

  it("treats blank and null as unknown", () => {
    expect(displayName("   ")).toBe("Unknown");
    expect(displayName(null)).toBe("Unknown");
  });

  it("hasRealName gates the personalised greeting", () => {
    expect(hasRealName("Ama")).toBe(true);
    expect(hasRealName("No Name")).toBe(false);
  });
});

describe("sanitizeSearch", () => {
  it("strips PostgREST filter syntax so a search cannot alter the query", () => {
    expect(sanitizeSearch("Kwame,church.eq.Atonsu")).toBe("Kwame church eq Atonsu");
    expect(sanitizeSearch("a(b)c")).toBe("a b c");
  });

  it("trims and bounds length", () => {
    expect(sanitizeSearch("  Ama  ")).toBe("Ama");
    expect(sanitizeSearch("x".repeat(200))).toHaveLength(80);
  });

  it("handles empty input", () => {
    expect(sanitizeSearch(undefined)).toBe("");
  });
});

describe("paging", () => {
  it("defaults and clamps the page size", () => {
    expect(clampPageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampPageSize(0)).toBe(DEFAULT_PAGE_SIZE);
    expect(clampPageSize(1000)).toBe(MAX_PAGE_SIZE);
    expect(clampPageSize(10)).toBe(10);
  });

  it("clamps the page number to 1-based", () => {
    expect(clampPage(undefined)).toBe(1);
    expect(clampPage(-3)).toBe(1);
    expect(clampPage(4)).toBe(4);
  });

  it("converts a page into an inclusive range header", () => {
    expect(rangeHeader({ page: 1, pageSize: 25 })).toEqual({ from: 0, to: 24 });
    expect(rangeHeader({ page: 3, pageSize: 10 })).toEqual({ from: 20, to: 29 });
  });
});

describe("buildDirectoryPath", () => {
  it("orders by name and selects the directory columns", () => {
    const p = buildDirectoryPath({});
    expect(p).toContain("partners?select=");
    expect(p).toContain("order=full_name.asc");
  });

  it("adds a case-insensitive contains search", () => {
    expect(buildDirectoryPath({ q: "ama" })).toContain("full_name=ilike.*ama*");
  });

  it("filters by branch across all its spellings", () => {
    const p = buildDirectoryPath({ branchVariants: ["Abeka Main", "ABEKA MAIN"] });
    expect(decodeURIComponent(p)).toContain('church=in.("Abeka Main","ABEKA MAIN")');
  });

  it("omits empty filters", () => {
    const p = buildDirectoryPath({ q: "  ", branchVariants: [] });
    expect(p).not.toContain("ilike");
    expect(p).not.toContain("church=in");
  });
});

describe("givingByPhone", () => {
  it("sums multiple payments per phone", () => {
    const totals = givingByPhone([
      { payer_phone_e164: "+233240000001", amount_minor: 1_000 },
      { payer_phone_e164: "+233240000001", amount_minor: "2_500".replace("_", "") },
      { payer_phone_e164: "+233240000002", amount_minor: 400 },
    ]);
    expect(totals.get("+233240000001")).toBe(3_500);
    expect(totals.get("+233240000002")).toBe(400);
  });

  it("ignores rows with no usable phone", () => {
    expect(givingByPhone([{ payer_phone_e164: null, amount_minor: 999 }]).size).toBe(0);
  });
});

describe("mapPartners", () => {
  const rows: DbPartner[] = [
    { id: "1", full_name: "Ama Serwaa", whatsapp_number: "+233240000001", church: "Qodesh", country: "Ghana", status: "new" },
    { id: "2", full_name: "No Name", whatsapp_number: null, church: null, country: null, status: "new" },
  ];
  const mapped = mapPartners(rows, new Map([["+233240000001", 5_000]]));

  it("attaches giving matched by phone", () => {
    expect(mapped[0].givenMinor).toBe(5_000);
    expect(mapped[0].messageable).toBe(true);
  });

  it("marks phoneless partners as not messageable rather than hiding them", () => {
    expect(mapped[1].messageable).toBe(false);
    expect(mapped[1].givenMinor).toBe(0);
    expect(mapped[1].name).toBe("Unknown");
  });

  it("labels a missing branch", () => {
    expect(mapped[1].branch).toBe("Unassigned");
  });

  it("keeps a non-Ghana number intact (the send-test number is +243)", () => {
    const [p] = mapPartners(
      [{ id: "3", full_name: "Charles Djabatey", whatsapp_number: "+243989426841", church: "Qodesh", country: "Ghana", status: "new" }],
      new Map(),
    );
    expect(p.phone).toBe("+243989426841");
    expect(p.messageable).toBe(true);
  });
});

describe("fetchAllRows", () => {
  /** Fake PostgREST: honours limit/offset and caps each response at 1000, like Supabase. */
  function fakeRest(totalRows: number) {
    const calls: string[] = [];
    const fetcher = async <T,>(path: string): Promise<T[]> => {
      calls.push(path);
      const limit = Number(/limit=(\d+)/.exec(path)?.[1] ?? 1000);
      const offset = Number(/offset=(\d+)/.exec(path)?.[1] ?? 0);
      const size = Math.max(0, Math.min(limit, 1000, totalRows - offset));
      return Array.from({ length: size }, (_, i) => ({ id: offset + i }) as T);
    };
    return { fetcher, calls };
  }

  it("pages past the 1000-row cap that silently truncates a plain limit", async () => {
    const { fetcher } = fakeRest(15_329);
    const rows = await fetchAllRows<{ id: number }>(fetcher, "partners?select=id");
    expect(rows).toHaveLength(15_329);
    expect(rows[15_328].id).toBe(15_328);
  });

  it("stops after one request when the table is small", async () => {
    const { fetcher, calls } = fakeRest(210);
    expect(await fetchAllRows(fetcher, "payments?select=id")).toHaveLength(210);
    expect(calls).toHaveLength(1);
  });

  it("imposes a stable sort so paging cannot repeat or skip rows", async () => {
    const { fetcher, calls } = fakeRest(10);
    await fetchAllRows(fetcher, "partners?select=id");
    expect(calls[0]).toContain("order=id.asc");
  });

  it("respects an order the caller already set", async () => {
    const { fetcher, calls } = fakeRest(10);
    await fetchAllRows(fetcher, "partners?select=id&order=full_name.asc");
    expect(calls[0]).toContain("order=full_name.asc");
    expect(calls[0]).not.toContain("order=id.asc");
  });

  it("handles an empty table", async () => {
    const { fetcher } = fakeRest(0);
    expect(await fetchAllRows(fetcher, "partners?select=id")).toEqual([]);
  });

  it("makes exactly the pages needed on an exact multiple of the cap", async () => {
    const { fetcher, calls } = fakeRest(2000);
    expect(await fetchAllRows(fetcher, "partners?select=id")).toHaveLength(2000);
    // 2 full pages, then a third that returns nothing and ends the loop.
    expect(calls).toHaveLength(3);
  });
});

describe("parseTotalCount", () => {
  it("reads the total out of a content-range header", () => {
    expect(parseTotalCount("0-24/15329")).toBe(15329);
    expect(parseTotalCount("*/0")).toBe(0);
  });

  it("is safe when the header is missing or odd", () => {
    expect(parseTotalCount(null)).toBe(0);
    expect(parseTotalCount("garbage")).toBe(0);
  });
});

describe("isValidBranch / branchLabel", () => {
  it("accepts real branch names", () => {
    expect(isValidBranch("Qodesh")).toBe(true);
    expect(isValidBranch("Tema Comm 22")).toBe(true);
    expect(isValidBranch("EFC - Tamale North")).toBe(true);
  });

  it("rejects the shifted-import phone numbers that landed in the branch column", () => {
    expect(isValidBranch("233242743986.0")).toBe(false);
    expect(isValidBranch("+233242743986")).toBe(false);
    expect(isValidBranch("233 242 743 986")).toBe(false);
  });

  it("rejects blank and missing", () => {
    expect(isValidBranch("  ")).toBe(false);
    expect(isValidBranch(null)).toBe(false);
  });

  it("labels an unusable branch rather than showing the junk value", () => {
    expect(branchLabel("233242743986.0")).toBe(NO_BRANCH);
    expect(branchLabel(null)).toBe(NO_BRANCH);
    expect(branchLabel("  Atonsu  ")).toBe("Atonsu");
  });
});

describe("normalizeBranchKey", () => {
  it("collapses the case variants that split one branch into many", () => {
    const k = normalizeBranchKey("Kent City");
    for (const v of ["KENT CITY", "Kent CITY", "KEnt CITY", "kent City", "Kent city"]) {
      expect(normalizeBranchKey(v)).toBe(k);
    }
  });

  it("ignores punctuation and repeated spaces", () => {
    expect(normalizeBranchKey("Tema Comm. 22")).toBe(normalizeBranchKey("Tema Comm 22"));
    expect(normalizeBranchKey("Savelugu  south")).toBe(normalizeBranchKey("Savelugu South"));
    expect(normalizeBranchKey("NSAWAM .")).toBe(normalizeBranchKey("Nsawam"));
    expect(normalizeBranchKey("Akim-Oda")).toBe(normalizeBranchKey("AKIM ODA"));
  });

  it("keeps genuinely different branches apart", () => {
    expect(normalizeBranchKey("Atonsu")).not.toBe(normalizeBranchKey("Asokwa"));
    expect(normalizeBranchKey("Tema Comm 22")).not.toBe(normalizeBranchKey("Tema Comm 25"));
  });
});

describe("groupBranches", () => {
  const values = [
    "Mankessim", "Mankessim", "Mankessim", "MANKESSIM", "MANKESSIM",
    "Atonsu", "ATONSU",
    "233242743986.0",
    null,
    "  ",
  ];

  it("merges every spelling into one branch", () => {
    const groups = groupBranches(values);
    expect(groups.map((g) => g.label)).toEqual(["Atonsu", "Mankessim"]);
  });

  it("counts partners across all spellings", () => {
    const m = groupBranches(values).find((g) => g.label === "Mankessim")!;
    expect(m.count).toBe(5);
    expect([...m.variants].sort()).toEqual(["MANKESSIM", "Mankessim"]);
  });

  it("labels the group with the most-used spelling", () => {
    // "Mankessim" (3) beats "MANKESSIM" (2).
    expect(groupBranches(values).find((g) => g.key === "MANKESSIM")!.label).toBe("Mankessim");
  });

  it("drops mangled-phone and empty values", () => {
    expect(groupBranches(values).some((g) => g.label.includes("233242743986"))).toBe(false);
    expect(groupBranches([null, "", "  "])).toEqual([]);
  });

  it("is stable when spellings tie", () => {
    const a = groupBranches(["Ho", "HO"]);
    const b = groupBranches(["HO", "Ho"]);
    expect(a[0].label).toBe(b[0].label);
  });
});

describe("buildDirectoryPath with branch variants", () => {
  it("matches every spelling of the selected branch", () => {
    const p = buildDirectoryPath({ branchVariants: ["Mankessim", "MANKESSIM"] });
    expect(decodeURIComponent(p)).toContain('church=in.("Mankessim","MANKESSIM")');
  });

  it("quotes values so spaces and dots are not read as list syntax", () => {
    const p = buildDirectoryPath({ branchVariants: ["Tema Comm. 22"] });
    expect(decodeURIComponent(p)).toContain('"Tema Comm. 22"');
  });

  it("omits the filter when no branch is selected", () => {
    expect(buildDirectoryPath({ branchVariants: [] })).not.toContain("church=in");
    expect(buildDirectoryPath({})).not.toContain("church=in");
  });
});

describe("confirmed branch merges", () => {
  const key = (s: string) => resolveBranchKey(normalizeBranchKey(s));
  const same = (a: string, b: string) => key(a) === key(b);

  it("merges the spellings staff confirmed", () => {
    expect(same("KORLE GONNO", "korlegonno")).toBe(true);
    expect(same("Sowutuom", "Sowutiom")).toBe(true);
    expect(same("HOHOE MISSION", "HOHOE")).toBe(true);
    expect(same("Tamale Aparche", "Tamala Aparche")).toBe(true);
    expect(same("Swedru Aparche", "Swedru Apache")).toBe(true);
    expect(same("Susuankyi", "SUSANKYI")).toBe(true);
    expect(same("BEREKUM", "BEREKU")).toBe(true);
    expect(same("BEREKUM", "BBEREKUM")).toBe(true);
    expect(same("ABLEKUMA MAIN", "ABLEKUMAN MAIN")).toBe(true);
    expect(same("ASSIN FOSU", "ASSIN FOSO")).toBe(true);
    expect(same("Bunkpurugu Mission", "Bunkpurugu")).toBe(true);
    expect(same("MIGHTY GOD CATHEDRAL", "MIGTHY GOD CATHEDRAL")).toBe(true);
  });

  it("merges all four Sarbeng Akrofuom misspellings", () => {
    for (const v of ["SARBENG AKFROFUOM", "SARBEBG AKROFUOM", "SARBENG AKROFOUM"]) {
      expect(same("SARBENG AKROFUOM", v)).toBe(true);
    }
  });

  /**
   * The guard rail. These pairs are similar enough that a fuzzy matcher would merge them,
   * and staff confirmed they are separate branches. If one of these ever goes true, real
   * branches have been silently combined and the giving subtotals are wrong.
   */
  it("keeps confirmed-separate branches apart", () => {
    expect(same("NEW TAFO", "OLD TAFO")).toBe(false);
    expect(same("NEW TAFO", "TAFO")).toBe(false);
    expect(same("Abeka Main", "Abeka")).toBe(false);
    expect(same("Savelugu north", "Savelugu south")).toBe(false);
    expect(same("BEREKUM", "Berekuso")).toBe(false);
    expect(same("ENCHI", "Wenchi")).toBe(false);
    expect(same("Benso", "BUNSO")).toBe(false);
    expect(same("BEGORO", "Beposo")).toBe(false);
    expect(same("Kaase", "MAASE")).toBe(false);
    expect(same("Bongo", "BONYO")).toBe(false);
    expect(same("TESHIE", "TESHIE NORTH")).toBe(false);
    expect(same("TESHIE APARCHE", "TESHIE CENTRAL")).toBe(false);
    // Two characters apart, 1,309 partners — confirmed separate branches, never merge.
    expect(same("Qodesh", "QADISH")).toBe(false);
    expect(same("NAYOKO NO 1", "NAYOKO NO 2")).toBe(false);
  });

  it("groups merged spellings under the most-used label", () => {
    const groups = groupBranches([
      ...Array(65).fill("MIGHTY GOD CATHEDRAL"),
      ...Array(45).fill("MIGTHY GOD CATHEDRAL"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("MIGHTY GOD CATHEDRAL");
    expect(groups[0].count).toBe(110);
    expect(groups[0].variants).toHaveLength(2);
  });

  it("leaves an unlisted branch untouched", () => {
    expect(resolveBranchKey("ATONSU")).toBe("ATONSU");
  });
});

describe("isSensibleName — a name is not a number or a code", () => {
  it("rejects a bare number", () => {
    expect(isSensibleName("1.0")).toBe(false);
    expect(isSensibleName("233242743986.0")).toBe(false);
    expect(displayName("1.0")).toBe("Unknown");
  });

  it("rejects sheet reference codes", () => {
    for (const c of ["FL73", "FL1061", "FL854", "AB-12", "X 9"]) {
      expect(isSensibleName(c)).toBe(false);
    }
    expect(displayName("FL73")).toBe("Unknown");
  });

  it("rejects the placeholder, blanks and punctuation", () => {
    expect(isSensibleName("No Name")).toBe(false);
    expect(isSensibleName("   ")).toBe(false);
    expect(isSensibleName("-")).toBe(false);
    expect(isSensibleName(null)).toBe(false);
  });

  it("accepts real names, including ones with punctuation or titles", () => {
    for (const n of [
      "Charles Djabatey",
      "Rev. Kofi Boateng",
      "AAKOSUA ASANTEWAA AFARI",
      "O'Brien Mensah",
      "Nii Ayite Aryeh",
      "Ama",
    ]) {
      expect(isSensibleName(n)).toBe(true);
      expect(displayName(n)).toBe(n);
    }
  });

  it("does not reject a real name that merely contains a digit", () => {
    // Guard against over-reach: the code rule is anchored, so this must survive.
    expect(isSensibleName("Kwame Mensah 2")).toBe(true);
  });

  it("stops a nonsense name reaching a greeting", () => {
    expect(hasRealName("1.0")).toBe(false);
    expect(hasRealName("FL73")).toBe(false);
  });
});
