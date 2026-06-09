/**
 * Tiny className combiner. Filters out falsy values and joins with a space.
 * Keeps component markup readable without pulling in an external dependency.
 */
export type ClassValue = string | false | null | undefined;

export function cx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
