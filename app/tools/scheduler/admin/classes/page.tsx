'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Classes page is deprecated — functionality moved to Event Templates.
 */
export default function ClassesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/tools/scheduler/admin/event-templates');
  }, [router]);
  return null;
}
