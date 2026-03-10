import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getOrgMembership } from '@/lib/rbac';
import { Tooltip } from './components/ui/Tooltip';

export default async function SymphonixSchedulerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Unauthenticated users only see the intake form link
  if (!user) {
    return (
      <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold tracking-tight">Symphonix Scheduler</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Automated scheduling platform for educational programs.
          </p>
          <div className="flex gap-4 justify-center">
            <Tooltip text="Submit your availability">
              <Link
                href="/tools/scheduler/intake"
                className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Instructor Intake
              </Link>
            </Tooltip>
          </div>
        </div>
      </div>
    );
  }

  // Check org membership for authenticated users
  const membership = await getOrgMembership(user.email);

  // Non-org members → redirect to tools list
  if (!membership.role) {
    redirect('/tools');
  }

  // Admins → show both admin + portal links
  // Instructors → show portal link only
  const isAdmin = membership.role === 'admin';

  return (
    <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">Symphonix Scheduler</h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Automated scheduling platform for educational programs.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          {isAdmin && (
            <Tooltip text="Go to admin dashboard">
              <Link
                href="/tools/scheduler/admin"
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Admin Dashboard
              </Link>
            </Tooltip>
          )}
          <Tooltip text="View your teaching schedule">
            <Link
              href="/tools/scheduler/portal"
              className={`px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity ${
                isAdmin
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-primary text-primary-foreground'
              }`}
            >
              Instructor Portal
            </Link>
          </Tooltip>
          <Tooltip text="Submit your availability">
            <Link
              href="/tools/scheduler/intake"
              className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Instructor Intake
            </Link>
          </Tooltip>
        </div>
        <p className="text-xs text-muted-foreground">
          Signed in as {user.email}
          {isAdmin ? ' (Admin)' : ' (Instructor)'}
        </p>
      </div>
    </div>
  );
}
