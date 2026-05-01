import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { getServiceClient } from '@/lib/supabase/server';

const SESSION_COOKIE_NAME = 'threads_mgr_session';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function verifyPassword(password: string): Promise<boolean> {
  const hash = process.env.DASHBOARD_PASSWORD_HASH;
  if (!hash) {
    throw new Error('DASHBOARD_PASSWORD_HASH env var is not set');
  }
  return bcrypt.compare(password, hash);
}

export async function createSession(): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  const supabase = getServiceClient();
  const { error } = await supabase.from('sessions').insert({
    token,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return token;
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
  });
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getSessionToken();
  if (!token) return false;

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('sessions')
    .select('expires_at')
    .eq('token', token)
    .maybeSingle();

  if (error || !data) return false;
  if (new Date(data.expires_at) < new Date()) return false;

  return true;
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const supabase = getServiceClient();
    await supabase.from('sessions').delete().eq('token', token);
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export const SESSION_COOKIE = SESSION_COOKIE_NAME;
