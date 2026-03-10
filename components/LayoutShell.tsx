'use client';

import { usePathname } from 'next/navigation';

/** Routes where the site-wide Navigation and Footer should be hidden */
const HIDE_CHROME_PREFIXES = [
  '/tools/scheduler/admin',
  '/tools/scheduler/intake',
];

export function LayoutShell({
  navigation,
  footer,
  children,
}: {
  navigation: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hideChrome = HIDE_CHROME_PREFIXES.some((p) => pathname.startsWith(p));

  if (hideChrome) {
    return <>{children}</>;
  }

  return (
    <>
      {navigation}
      <main style={{ paddingTop: 'var(--nav-height)' }}>{children}</main>
      {footer}
    </>
  );
}
