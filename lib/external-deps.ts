// Centralized configuration for external dependencies the platform talks to.
// Anything that lives outside our database / our Vercel deployment belongs here
// so /api/health/external can probe a single source of truth.

/**
 * Google Apps Script web-app URL for the Camp Scheduler tool. The deployment
 * id is part of the URL and changes when the script is redeployed — when the
 * scheduler embed breaks, this is almost always the first thing to update.
 */
export const CAMP_SCHEDULER_URL =
  'https://script.google.com/macros/s/AKfycbztdub4IHfDhbD2y7Zp3w5wS3oexxhLh54mOeoC8HtVd6PjG9OiU0iGqv9oswbDbXZaMg/exec';

/**
 * Google Fonts CSS endpoints we import in app/globals.css. If this stops
 * loading, the site renders with the fallback sans-serif stack.
 */
export const GOOGLE_FONTS_CSS_URLS = [
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;700&display=swap',
];

/**
 * Media CDN host used by the marketing video on the homepage.
 * (Mirrors the CSP `media-src` allow-list in middleware.ts.)
 */
export const MEDIA_CDN_URL =
  'https://vid.cdn-website.com/04efc271/videos/9zQDpktUQO2X1wIzOdeU_2025+Calendar+Automation+%281%29-v.mp4';

/** A subset of public routes that should always render without auth. */
export const PUBLIC_ROUTES = ['/', '/login', '/tools/scheduler/intake'];

/**
 * Resolve the public base URL for self-fetches. Falls back to the request
 * origin in dev where VERCEL_URL is absent.
 */
export function resolveBaseUrl(requestUrl?: string): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (requestUrl) {
    try {
      const u = new URL(requestUrl);
      return `${u.protocol}//${u.host}`;
    } catch {
      // ignore
    }
  }
  return 'http://localhost:3002';
}

/**
 * Fetch with a hard timeout and explicit no-cache so health probes never
 * stall on a slow upstream. Returns the response on success, throws otherwise.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 5000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...rest,
      signal: controller.signal,
      cache: 'no-store',
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timer);
  }
}
