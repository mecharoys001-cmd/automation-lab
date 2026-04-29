'use client';

import { useState, useEffect } from 'react';
import ImpactDashboard from './ImpactDashboard';
import ActivityFeed from './ActivityFeed';
import AdminAccounts from './AdminAccounts';
import ToolAccess from './ToolAccess';
import SuiteManagement from './SuiteManagement';
import OperatorOverview from './OperatorOverview';

type Tab = 'overview' | 'stats' | 'feed' | 'accounts' | 'access' | 'suites';

const VALID_TABS: Tab[] = ['overview', 'stats', 'feed', 'accounts', 'access', 'suites'];
const TAB_STORAGE_KEY = 'impact-dashboard-tab';
const DEFAULT_TAB: Tab = 'overview';

function getStoredTab(): Tab {
  if (typeof window === 'undefined') return DEFAULT_TAB;
  const stored = localStorage.getItem(TAB_STORAGE_KEY);
  return stored && VALID_TABS.includes(stored as Tab) ? (stored as Tab) : DEFAULT_TAB;
}

export default function ImpactPage() {
  const [activeTab, setActiveTab] = useState<Tab>(DEFAULT_TAB);

  useEffect(() => {
    setActiveTab(getStoredTab());
  }, []);

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Operator Overview' },
    { key: 'stats', label: 'Impact Stats' },
    { key: 'feed', label: 'Activity Feed' },
    { key: 'accounts', label: 'Admin Accounts' },
    { key: 'access', label: 'Tool Access' },
    { key: 'suites', label: 'Suites' },
  ];

  // Wider container only for the Overview, which uses a two-column layout.
  const contentMaxWidth = activeTab === 'overview' ? '1180px' : '1000px';

  return (
    <div className="al-report" style={{ paddingTop: '80px', minHeight: '100vh' }}>
      {/* Page runner — print-style top-of-page indicator */}
      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 1.5rem' }}>
        <div className="al-runner">
          <span>artsnwct.org / automation-lab</span>
          <span>Internal Platform · Phase 2 Pilot</span>
        </div>
      </div>

      {/* Gold phase banner */}
      <div style={{ maxWidth: '1180px', margin: '24px auto 0', padding: '0 1.5rem' }}>
        <div className="al-banner">Phase 2: Pilot Projects · Impact Measurement</div>
      </div>

      <div style={{ maxWidth: contentMaxWidth, margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>
        {/* Hero — eyebrow + title with gold rule + lead */}
        <div className="al-title-rule" style={{ marginBottom: '1.25rem' }}>
          <div className="al-eyebrow" style={{ marginBottom: '8px' }}>
            Automation Lab · Internal Dashboard
          </div>
          <h1 className="al-display">Impact Dashboard</h1>
        </div>

        <p className="al-lead" style={{ marginBottom: '2rem' }}>
          The Automation Lab is a research- and service-driven pilot of the
          Northwest Connecticut Arts Council. This dashboard records the
          administrative time returned to participating cultural nonprofits as
          each automation moves from prototype to deployment, so the Phase&nbsp;2
          pilot can be evaluated against the burden documented in our Phase&nbsp;1
          research.
        </p>

        {/* Tabs — pill-button container */}
        <div className="al-tabs" role="tablist" aria-label="Impact dashboard sections">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`al-tab${activeTab === tab.key ? ' is-active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && <OperatorOverview />}
        {activeTab === 'stats' && <ImpactDashboard />}
        {activeTab === 'feed' && <ActivityFeed />}
        {activeTab === 'accounts' && <AdminAccounts />}
        {activeTab === 'access' && <ToolAccess />}
        {activeTab === 'suites' && <SuiteManagement />}
      </div>
    </div>
  );
}
