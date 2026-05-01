export function verifyCcAuth(req: Request): boolean {
  const auth = req.headers.get('authorization');
  const secret = process.env.CC_API_KEY;
  if (!secret) return false;
  return auth === `Bearer ${secret}`;
}
