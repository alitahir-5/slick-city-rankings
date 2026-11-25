// Data lives in Vercel Blob: data/log.json (every check) and data/pending.json (queued weekly tasks).
import { put, list, del } from '@vercel/blob';
import seed from './seed-log.json';

const hasBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

async function latest(prefix) {
  const { blobs } = await list({ prefix });
  if (!blobs.length) return null;
  blobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  return blobs;
}

async function readJson(prefix, fallback) {
  if (!hasBlob()) return fallback;
  const blobs = await latest(prefix);
  if (!blobs) return fallback;
  const r = await fetch(blobs[0].url, { cache: 'no-store' });
  return r.ok ? r.json() : fallback;
}

async function writeJson(prefix, value) {
  if (!hasBlob()) throw new Error('Blob storage is not connected (BLOB_READ_WRITE_TOKEN missing)');
  const old = await latest(prefix);
  await put(prefix + '.json', JSON.stringify(value), { access: 'public', addRandomSuffix: true, contentType: 'application/json' });
  if (old) await del(old.map((b) => b.url));      // keep only the newest copy
}

export const readLog = () => readJson('data/log', seed);
export const writeLog = (rows) => writeJson('data/log', rows);
export const readPending = () => readJson('data/pending', null);
export const writePending = (v) => writeJson('data/pending', v);

export async function appendRows(rows) {
  const log = await readLog();
  const next = log.concat(rows);
  await writeLog(next);
  return next;
}
