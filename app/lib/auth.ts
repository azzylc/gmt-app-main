import { NextRequest, NextResponse } from 'next/server';

/**
 * Verify admin/cron authentication
 * Checks Authorization header against CRON_SECRET
 */
export function verifyAdminAuth(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const vercelEnv = process.env.VERCEL_ENV; // 'production', 'preview', 'development'

  // CRITICAL: In production/preview, CRON_SECRET must exist (fail-closed)
  if (!cronSecret) {
    if (vercelEnv === 'production' || vercelEnv === 'preview') {
      console.error('[AUTH] CRON_SECRET not set in production/preview - blocking request');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    // Dev mode: allow without secret
    console.warn('[AUTH] CRON_SECRET not set - dev mode, allowing request');
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