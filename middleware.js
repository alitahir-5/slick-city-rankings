import { NextResponse } from 'next/server';
import { authToken } from './lib/auth';

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/login') || pathname.startsWith('/api/login') || pathname.startsWith('/api/cron')) return NextResponse.next();
  const ok = req.cookies.get('sc_auth')?.value === (await authToken());
  if (ok) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = req.nextUrl.clone(); url.pathname = '/login'; return NextResponse.redirect(url);
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
