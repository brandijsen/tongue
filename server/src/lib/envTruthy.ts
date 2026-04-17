/** True when env var is set to a common “truthy” string (aligned with USE_MOCK_NEWS parsing). */
export function envIsTruthy(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}
