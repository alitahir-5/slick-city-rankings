// DataForSEO Google Local Finder. DATAFORSEO_AUTH = base64 "login:password" from the API Access page.
const API = 'https://api.dataforseo.com/v3/serp/google/local_finder';
const headers = () => ({ Authorization: 'Basic ' + (process.env.DATAFORSEO_AUTH || ''), 'Content-Type': 'application/json' });

export const taskBody = (park, keyword) => ({
  keyword, location_coordinate: `${park.lat.toFixed(7)},${park.lng.toFixed(7)},13z`, language_code: 'en', device: 'desktop', depth: 20, tag: `${park.id}|${keyword}`,
});

async function call(path, body, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(API + path, { method: body ? 'POST' : 'GET', headers: headers(), body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    if (r.ok) return r.json();
    if (![429, 500, 502, 503].includes(r.status) || i === tries - 1) throw new Error(`DataForSEO HTTP ${r.status}`);
    await new Promise((s) => setTimeout(s, 2000 * (i + 1)));
  }
}

export async function live(park, keyword) {
  const res = await call('/live/advanced', [taskBody(park, keyword)]);
  const t = res.tasks[0];
  return { result: t.status_code === 20000 ? (t.result || [null])[0] : null, cost: t.cost || 0, error: t.status_code === 20000 ? null : t.status_message };
}
export const postTasks = (bodies) => call('/task_post', bodies);
export const tasksReady = () => call('/tasks_ready');
export async function taskGet(id) {
  const t = (await call('/task_get/advanced/' + id)).tasks[0];
  return t.status_code === 20000 ? (t.result || [null])[0] : null;
}

export async function pool(items, size, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}
