import type { Metadata } from 'next';
import ImpactDashboard from './ImpactDashboard';

export const metadata: Metadata = {
  title: 'Impact Dashboard | Automation Lab Admin',
  description: 'Track time savings across all automation tools.',
};

export default function ImpactPage() {
  return <ImpactDashboard />;
}
