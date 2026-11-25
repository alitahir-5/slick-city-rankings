// Daily: fetch finished weekly tasks and add them to the log.
import { NextResponse } from 'next/server';
import parks from '@/lib/parks.json';
import { taskGet, tasksReady, pool } from '@/lib/dfs';
import { rowFor } from '@/lib/rank';
import { appendRows, readPending, writePending } from '@/lib/store';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const authorized = (req) => !process.env.CRON_SECRET || req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;

export async function GET(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const pending = await readPending();
  if (!pending || !Object.keys(pending.tasks || {}).length) return NextResponse.json({ ok: true, note: 'nothing pending' });
  const ready = await tasksReady();
  const ids = (ready.tasks || []).flatMap((t) => (t.result || []).map((r) => r.id)).filter((id) => pending.tasks[id]);
  const started = Date.now();
  const rows = (await pool(ids.slice(0, 400), 20, async (id) => {
    if (Date.now() - started > 45000) return null;
    const [pid, kw] = pending.tasks[id].split(/\|(.*)/s);
    const park = parks.find((p) => p.id === Number(pid));
    try { const result = await taskGet(id); delete pending.tasks[id]; return rowFor(park, kw, result, 'scheduled', pending.week); }
    catch { return null; }
  })).filter(Boolean);
  if (rows.length) await appendRows(rows);
  // Give up on tasks older than 3 days so a lost task never blocks next week.
  if (Date.now() - new Date(pending.posted_at) > 3 * 86400000) pending.tasks = {};
  await writePending(pending);
  return NextResponse.json({ ok: true, added: rows.length, left: Object.keys(pending.tasks).length });
}
