// Monday: queue every park x keyword in DataForSEO's standard queue (cheaper than live).
import { NextResponse } from 'next/server';
import parks from '@/lib/parks.json';
import { postTasks, taskBody } from '@/lib/dfs';
import { weekId } from '@/lib/rank';
import { readPending, writePending } from '@/lib/store';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const authorized = (req) => !process.env.CRON_SECRET || req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;

export async function GET(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const week = weekId();
  const prev = await readPending();
  if (prev && prev.week === week && Object.keys(prev.tasks || {}).length) return NextResponse.json({ ok: true, note: 'already queued' });
  const jobs = parks.flatMap((p) => p.keywords.map((kw) => taskBody(p, kw)));
  const tasks = {}; let cost = 0, failed = 0;
  for (let i = 0; i < jobs.length; i += 100) {
    const res = await postTasks(jobs.slice(i, i + 100));
    for (const t of res.tasks || []) {
      cost += t.cost || 0;
      if (t.status_code === 20100) tasks[t.id] = t.data.tag; else failed++;
    }
  }
  await writePending({ week, posted_at: new Date().toISOString(), cost, tasks });
  return NextResponse.json({ ok: true, week, queued: Object.keys(tasks).length, failed, cost });
}
