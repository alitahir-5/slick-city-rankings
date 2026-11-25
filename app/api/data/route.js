import { NextResponse } from 'next/server';
import { readLog, readPending } from '@/lib/store';
import parks from '@/lib/parks.json';
import history from '@/lib/history-oct.json';
export const dynamic = 'force-dynamic';

export async function GET() {
  const [rows, pending] = await Promise.all([readLog(), readPending()]);
  return NextResponse.json({ rows, parks, history, pending: pending ? { week: pending.week, left: Object.keys(pending.tasks || {}).length } : null,
    storage: !!process.env.BLOB_READ_WRITE_TOKEN, apiKey: !!process.env.DATAFORSEO_AUTH });
}
