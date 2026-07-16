/**
 * Wildcard permission matcher — client-safe port of
 * `@adonis-agora/authz`'s `permission_matcher.ts`. Segment-based on `.`,
 * spatie/Laravel-style. Kept as a standalone copy (no server import) so the
 * `<Can>`/`useCan` client bundle never pulls in `@adonis-agora/authz`.
 *
 * Only the GRANTED (left) side may contain wildcards. The REQUIRED ability is
 * always treated literally — a check is never itself a pattern.
 *
 * Rules:
 * - `granted === required` → exact match.
 * - bare `granted === '*'` → matches anything.
 * - Split both on `.` and walk the granted segments:
 *   - A trailing `*` matches ONE-OR-MORE remaining required segments. So
 *     `posts.*` matches `posts.edit` and `posts.edit.draft`, but NOT the bare
 *     `posts` (zero remaining segments fails).
 *   - An interior `*` consumes exactly one required segment (fails if missing).
 *   - A literal segment must equal the required segment exactly.
 * - After consuming all granted segments with no trailing-wildcard early-return,
 *   the match holds only if both sides have the same number of segments.
 */
export function permissionMatches(granted: string, required: string): boolean {
  if (granted === required) return true;
  if (granted === '*') return true;

  const grantedParts = granted.split('.');
  const requiredParts = required.split('.');

  for (let i = 0; i < grantedParts.length; i++) {
    const g = grantedParts[i];
    if (g === '*') {
      if (i === grantedParts.length - 1) {
        // Trailing wildcard: one-or-more remaining required segments.
        return requiredParts.length > i;
      }
      // Interior wildcard: consume exactly one required segment.
      if (requiredParts[i] === undefined) return false;
      continue;
    }
    if (g !== requiredParts[i]) return false;
  }

  return grantedParts.length === requiredParts.length;
}

/** True when any granted pattern in the set matches the required ability. */
export function permissionSatisfied(granted: Iterable<string>, required: string): boolean {
  for (const g of granted) {
    if (permissionMatches(g, required)) return true;
  }
  return false;
}
