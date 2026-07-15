/**
 * Complimentary all-access without a paid (or $1) Clerk plan.
 *
 * In Clerk Dashboard → Users → [user] → Metadata → Public metadata:
 *   { "complimentary": true }
 *
 * Or set role to "admin" for the same effect.
 */
export function hasComplimentaryAccess(
  metadata: Record<string, unknown> | null | undefined
): boolean {
  if (!metadata) return false;
  if (metadata.complimentary === true) return true;
  if (metadata.role === "admin") return true;
  return false;
}
