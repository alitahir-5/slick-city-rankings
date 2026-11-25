import { NextResponse } from 'next/server';
import { readLog, readPending, hasBlob } from '@/lib/store';
import parks from '@/lib/parks.json';
import history from '@/lib/history-oct.json';
export const dynamic = 'force-dynamic';

export async function GET() {
  const [rows, pending] = await Promise.all([readLog(), readPending()]);
  return NextResponse.json({ rows, parks, history, pending: pending ? { week: pending.week, left: Object.keys(pending.tasks || {}).length } : null,
    storage: hasBlob(), apiKey: !!process.env.DATAFORSEO_AUTH });
}
