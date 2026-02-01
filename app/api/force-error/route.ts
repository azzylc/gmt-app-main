import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export async function GET() {
  // Manuel Sentry test
  Sentry.captureException(new Error("Sentry Production Test " + new Date().toISOString()));
  
  // Ayrıca exception throw et
  throw new Error("Force Error Test " + new Date().toISOString());
}
