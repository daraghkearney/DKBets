import { isPublishableKey } from "@clerk/shared/keys";

/**
 * Normalize a Clerk publishable key from env/secrets.
 * Strips whitespace and accidental surrounding quotes from dashboard copy-paste.
 */
export function normalizeClerkPublishableKey(
  raw?: string | null
): string | undefined {
  if (!raw) return undefined;
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  return key || undefined;
}

/** Returns a Clerk-valid publishable key, or undefined if missing/malformed. */
export function getClerkPublishableKey(): string | undefined {
  const key = normalizeClerkPublishableKey(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  );
  if (!key || !isPublishableKey(key)) return undefined;
  return key;
}

export function clerkPublishableKeyLooksPresent(): boolean {
  return Boolean(
    normalizeClerkPublishableKey(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
  );
}
