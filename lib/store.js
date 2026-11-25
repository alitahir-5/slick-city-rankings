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

export const readLog = () => readJson('data/log.json', seed);
export const writeLog = (rows) => writeJson('data/log.json', rows);
export const readPending = () => readJson('data/pending.json', null);
export const writePending = (v) => writeJson('data/pending.json', v);

export async function appendRows(rows) {
  const log = await readLog();
  const next = log.concat(rows);
  await writeLog(next);
  return next;
}
