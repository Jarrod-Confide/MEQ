import { TERRITORIES, TERRITORY_LABEL, type Territory } from "./territory";
import type { Viewer } from "./viewer";

/** Regions a page shows: "ALL" or a list (a CM can own several, e.g. Sean). */
export type Scope = Territory[] | "ALL";

/**
 * From ?region= : "all", a region code, or "mine". With no parameter a CM
 * lands on their own region(s); everyone else sees all regions.
 */
export function resolveScope(param: string | undefined, viewer: Viewer | null): Scope {
  const mine = viewer?.staff?.regions ?? [];
  if (param === "all") return "ALL";
  if (param && (TERRITORIES as readonly string[]).includes(param)) return [param as Territory];
  if (mine.length) return mine;
  return "ALL";
}

export function scopeLabel(scope: Scope): string {
  return scope === "ALL" ? "All regions" : scope.map((t) => TERRITORY_LABEL[t]).join(" + ");
}

export function scopeParam(scope: Scope): string {
  return scope === "ALL" ? "all" : scope.length === 1 ? scope[0] : "mine";
}
