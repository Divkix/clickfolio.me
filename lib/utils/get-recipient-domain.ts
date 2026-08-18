/**
 * Extracts the recipient domain for logging.
 *
 * The full email address is PII and must never appear in logs (matches the
 * SHA-256 IP-hashing posture); the domain is kept as a non-PII identifier so
 * per-provider send failures remain diagnosable.
 */
export function getRecipientDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1) : "unknown";
}
