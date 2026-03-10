'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Standalone venues page is deprecated.
 * Redirect to Staff & Venues (people page) where venues are managed.
 */
export default function VenuesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/tools/scheduler/admin/people');
  }, [router]);
  return null;
}
