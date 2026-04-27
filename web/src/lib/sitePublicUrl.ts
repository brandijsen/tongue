/**
 * Public URL of the frontend (no trailing slash).
 * Set `NEXT_PUBLIC_SITE_URL` for social previews and `metadataBase` in production.
 */
export function sitePublicUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    return raw.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}
