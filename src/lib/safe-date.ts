/**
 * Date → ISO string that NEVER throws. `Date.prototype.toISOString()` throws
 * RangeError "Invalid time value" for invalid / out-of-range dates (postgres
 * 'infinity', year > 275760, NaN). Returns null instead so a single bad value
 * can't 500 a whole page.
 */
export function safeIso(d: Date | string | number | null | undefined): string | null {
  if (d == null) return null;
  const t = new Date(d);
  return isNaN(t.getTime()) ? null : t.toISOString();
}
