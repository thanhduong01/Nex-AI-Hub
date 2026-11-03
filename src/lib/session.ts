export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export function sessionExpired(expiresAt: string | null | undefined, now = Date.now()) {
  const time = expiresAt ? Date.parse(expiresAt) : NaN;
  return !Number.isFinite(time) || time <= now;
}
export function safeNextPath(value: string | null | undefined) {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /[\u0000-\u001f]/.test(value)
  )
    return '/overview';
  return value;
}
