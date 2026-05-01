'use server';

import { redirect } from 'next/navigation';
import {
  verifyPassword,
  createSession,
  setSessionCookie,
} from '@/lib/auth/session';

export async function loginAction(formData: FormData): Promise<void> {
  const password = formData.get('password')?.toString() ?? '';
  const nextRaw = formData.get('next')?.toString() ?? '/calendar';
  const next = nextRaw.startsWith('/') ? nextRaw : '/calendar';

  if (!password) {
    redirect('/login?error=invalid');
  }

  const ok = await verifyPassword(password);
  if (!ok) {
    redirect('/login?error=invalid');
  }

  const token = await createSession();
  await setSessionCookie(token);

  redirect(next);
}
