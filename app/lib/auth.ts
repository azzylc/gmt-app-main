import { NextRequest, NextResponse } from 'next/server';

/**
 * Verify admin/cron authentication
 * Checks Authorization header against CRON_SECRET
 */
export function verifyAdminAuth(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // If CRON_SECRET not set, allow (dev mode)
  if (!cronSecret) {
    console.warn('[AUTH] CRON_SECRET not set - allowing request (dev mode)');
    return null;
  }

  // Check authorization header
  const expectedAuth = `Bearer ${cronSecret}`;
  if (authHeader !== expectedAuth) {
    console.warn('[AUTH] Unauthorized request blocked');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Auth successful
  return null;
}