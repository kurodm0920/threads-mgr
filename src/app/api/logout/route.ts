import { NextResponse } from 'next/server';
import { deleteSession } from '@/lib/auth/session';

export async function POST(req: Request) {
  await deleteSession();
  const url = new URL('/login', req.url);
  return NextResponse.redirect(url, { status: 303 });
}
