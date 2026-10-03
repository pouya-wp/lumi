/**
 * Allowed browser origins from CORS_ORIGINS (comma separated). Unset means any origin, which suits
 * local development; production sets it to the web app's domains.
 */
export function corsOrigin(): string[] | boolean {
  const list = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return list.length ? list : true;
}
