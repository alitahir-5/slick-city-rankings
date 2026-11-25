// Live check of every keyword for one park ("Check now" button). About 12 searches, ~$0.025.
import { NextResponse } from 'next/server';
import parks from '@/lib/parks.json';
import { live, pool } from '@/lib/dfs';
import { rowFor } from '@/lib/rank';
import { appendRows } from '@/lib/store';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { parkId } = await req.json().catch(() => ({}));
  const park = parks.find((p) => p.id === Number(parkId));
  if (!park) return NextResponse.json({ error: 'unknown park' }, { status: 400 });
  if (!process.env.DATAFORSEO_AUTH) return NextResponse.json({ error: 'DATAFORSEO_AUTH is not set in Vercel' }, { status: 500 });
  let cost = 0;
  const rows = await pool(park.keywords, 12, async (kw) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try { const r = await live(park, kw); cost += r.cost; if (r.result) return rowFor(park, kw, r.result, 'manual'); }
      catch {}
    }
    return rowFor(park, kw, null, 'manual');
  });
  let saved = true;
  try { await appendRows(rows); } catch { saved = false; }
  return NextResponse.json({ rows, saved, cost: Math.round(cost * 10000) / 10000 });
}
