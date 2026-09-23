import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Every colour token the components use as a Tailwind utility (bg-brand,
 * text-foreground, border-border, …) must be declared in the @theme inline
 * block of globals.css, or Tailwind emits no CSS for it and the element is
 * silently unstyled. This is exactly what shipped on 2026-09-23: a redesign
 * dropped the block and every primary button turned invisible in production.
 */
describe("globals.css theme block", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const theme = css.match(/@theme inline\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  it("declares a --color-* for every semantic token", () => {
    for (const token of [
      "background", "foreground", "surface", "muted", "muted-foreground",
      "border", "brand", "brand-strong", "accent", "primary", "success",
      "warning", "danger",
    ]) {
      expect(theme, `--color-${token} missing from @theme inline`).toMatch(
        new RegExp(`--color-${token}:\\s*var\\(--${token}\\)`),
      );
    }
  });

  it("maps the fonts", () => {
    expect(theme).toMatch(/--font-sans:/);
  });
});
