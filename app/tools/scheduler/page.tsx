import Link from 'next/link';
import Tooltip from './components/Tooltip';

export default function SymphonixSchedulerPage() {
  return (
    <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">Symphonix Scheduler</h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto">
          Automated scheduling platform for educational music programs.
        </p>
        <div className="flex gap-4 justify-center">
          <Tooltip text="Go to admin dashboard">
            <Link
              href="/tools/scheduler/admin"
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Admin Dashboard
            </Link>
          </Tooltip>
          <Tooltip text="View instructor portal">
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
