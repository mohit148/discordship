export const LOGIN_REDIRECT_COOKIE = "ship_login_redirect";

/** Only same-site paths — never "//evil.com", "/\evil.com" or absolute URLs. */
export function safeRedirectPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\r\n]/.test(value)) return "/";
  return value.slice(0, 300);
}
