import Link from 'next/link';
import { ReactNode } from 'react';

interface GasToolLayoutProps {
  title: string;
  description: string;
  icon: string;
  accent: string;
  children: ReactNode;
}

export default function GasToolLayout({ title, description, icon, accent, children }: GasToolLayoutProps) {
  return (
    <div style={{ paddingTop: '64px', minHeight: '100vh', backgroundColor: '#0f172a' }}>
      {/* Breadcrumb */}
      <div style={{
        padding: '1rem 1.5rem', borderBottom: '1px solid #1e293b',
        display: 'flex', gap: '8px', fontSize: '13px', color: '#64748b',
      }}>
        <Link href="/" style={{ color: '#64748b', textDecoration: 'none' }}>Automation Lab</Link>
        <span>/</span>
        <Link href="/tools" style={{ color: '#64748b', textDecoration: 'none' }}>Tools</Link>
        <span>/</span>
        <span style={{ color: accent }}>{title}</span>
      </div>

      {/* Hero */}
      <div style={{ padding: '2.5rem 1.5rem 1.5rem', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          backgroundColor: `${accent}18`, border: `1px solid ${accent}40`,
          borderRadius: '100px', padding: '4px 12px', marginBottom: '1rem',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: accent, display: 'inline-block' }} />
          <span style={{ fontSize: '12px', color: accent, fontWeight: 600 }}>Live · Free to Use</span>
        </div>
        <h1 style={{
          fontSize: 'clamp(1.6rem, 4vw, 2.5rem)', fontWeight: 800,
          letterSpacing: '-0.02em', marginBottom: '0.75rem',
        }}>
          {icon} {title}
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '15px', lineHeight: 1.7, maxWidth: '600px', marginBottom: '2rem' }}>
          {description}
        </p>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 1.5rem 5rem' }}>
        {children}
      </div>
    </div>
  );
}
