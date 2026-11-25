// Shared password gate: any username, one team password (APP_PASSWORD, default "admate").
export const appPassword = () => process.env.APP_PASSWORD || 'admate';
export async function authToken() {
  const data = new TextEncoder().encode('slick-city:' + appPassword() + ':' + (process.env.AUTH_SALT || 'admate-rank'));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
