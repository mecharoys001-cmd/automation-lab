import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase-service';
import { redirect } from 'next/navigation';
import SuiteManagerPanel from './SuiteManagerPanel';

export default async function SuiteManagerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect('/login?next=/tools/admin/suite-manager');
  }

  // Check if user is a manager of any suite
  const svc = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: managedSuites } = await (svc.from('tool_suite_members') as any)
    .select('suite_id, tool_suites(id, name, slug, description)')
    .ilike('user_email', user.email)
    .eq('role', 'manager');

  if (!managedSuites || managedSuites.length === 0) {
    return (
      <div
        style={{
          paddingTop: '80px',
          minHeight: '100vh',
          background: '#f8fafc',
          fontFamily: "'Montserrat', sans-serif",
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '2.5rem',
            maxWidth: '420px',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔒</div>
          <h1
            style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: '#1a1a2e',
              marginBottom: '0.75rem',
              fontFamily: "'Montserrat', sans-serif",
            }}
          >
            You don&apos;t have manager access
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6, margin: 0 }}>
            This page is for suite managers. If you believe you should have access,
            contact your site administrator.
          </p>
        </div>
      </div>
    );
  }

  // Extract the suite info from the joined data
  const suites = managedSuites
    .map((row: { suite_id: string; tool_suites: { id: string; name: string; slug: string; description: string | null } | null }) => row.tool_suites)
    .filter(Boolean);

  return (
    <div
      style={{
        paddingTop: '80px',
        minHeight: '100vh',
        background: '#f8fafc',
        color: '#1a1a2e',
        fontFamily: "'Montserrat', sans-serif",
      }}
    >
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1
          style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            marginBottom: '0.5rem',
            fontFamily: "'Montserrat', sans-serif",
            color: '#1a1a2e',
          }}
        >
          Suite Manager
        </h1>
        <p style={{ color: '#64748b', marginBottom: '2rem', fontSize: '14px' }}>
          Manage members for your tool suites.
        </p>
        <SuiteManagerPanel suites={suites} />
      </div>
    </div>
  );
}
