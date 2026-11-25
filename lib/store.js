// Data lives in a private Vercel Blob store: data/log.json (every check) and data/pending.json (queued weekly tasks).
// Auth: Vercel's project OIDC token + BLOB_STORE_ID (set when the store is connected), or BLOB_READ_WRITE_TOKEN.
import { put, get } from '@vercel/blob';
import seed from './seed-log.json';

export const hasBlob = () => !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);

async function readJson(pathname, fallback) {
  if (!hasBlob()) return fallback;
  try {
    const res = await get(pathname, { access: 'private', useCache: false });
    if (!res || res.statusCode !== 200) return fallback;
    return await new Response(res.stream).json();
  } catch (e) {
    if (/not.?found|404/i.test(String(e && e.message))) return fallback;
    throw e;
  }
}

async function writeJson(pathname, value) {
  if (!hasBlob()) throw new Error('Blob storage is not connected');
  await put(pathname, JSON.stringify(value), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
}

// The bundled seed (baseline checks shipped with the app) is always merged with the stored log.
const rowKey = (r) => `${r.park}|${r.keyword}|${r.checked_at}`;
export async function readLog() {
  const stored = await readJson('data/log.json', []);
  const seen = new Set(stored.map(rowKey));
  return seed.filter((r) => !seen.has(rowKey(r))).concat(stored);
}
export const writeLog = (rows) => writeJson('data/log.json', rows);
export const readPending = () => readJson('data/pending.json', null);
export const writePending = (v) => writeJson('data/pending.json', v);

export async function appendRows(rows) {
  const stored = await readJson('data/log.json', []);
  const next = stored.concat(rows);
  await writeLog(next);
  return next;
}
