/**
 * PS4: timeZone must be a valid IANA identifier when provided.
 * Uses Intl (throws RangeError on invalid zones in modern Node/V8).
 */
export function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}
