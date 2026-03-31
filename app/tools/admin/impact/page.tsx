'use client';

import { useState } from 'react';
import ImpactDashboard from './ImpactDashboard';
import ActivityFeed from './ActivityFeed';
import AdminAccounts from './AdminAccounts';
import ToolAccess from './ToolAccess';
import SuiteManagement from './SuiteManagement';

type Tab = 'stats' | 'feed' | 'accounts' | 'access' | 'suites';

export default function ImpactPage() {
  const [activeTab, setActiveTab] = useState<Tab>('stats');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'stats', label: 'Impact Stats' },
    { key: 'feed', label: 'Activity Feed' },
    { key: 'accounts', label: 'Admin Accounts' },
    { key: 'access', label: 'Tool Access' },
    { key: 'suites', label: 'Suites' },
  ];

  return (
    <div style={{ paddingTop: '80px', minHeight: '100vh', background: '#f8fafc', color: '#1a1a2e', fontFamily: "'Montserrat', sans-serif" }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Header */}
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem', fontFamily: "'Montserrat', sans-serif", color: '#1a1a2e' }}>
          Impact Dashboard
        </h1>
        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
          Track time savings across all automation tools.
        </p>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '0px', borderBottom: '2px solid #e2e8f0', marginBottom: '2rem' }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 20px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 700,
                fontFamily: "'Montserrat', sans-serif",
                color: activeTab === tab.key ? '#0F7490' : '#94a3b8',
                borderBottom: activeTab === tab.key ? '2px solid #0F7490' : '2px solid transparent',
                marginBottom: '-2px',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'stats' && <ImpactDashboard />}
        {activeTab === 'feed' && <ActivityFeed />}
        {activeTab === 'accounts' && <AdminAccounts />}
        {activeTab === 'access' && <ToolAccess />}
        {activeTab === 'suites' && <SuiteManagement />}
      </div>
    </div>
  );
}
