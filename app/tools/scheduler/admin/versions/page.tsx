'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Check, AlertTriangle, Loader2, History, Save, Send, RotateCcw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Modal, ModalButton } from '../../components/ui/Modal';
import { Tooltip } from '../../components/ui/Tooltip';

// ── Toast ────────────────────────────────────────────────────

interface ToastState {
  message: string;
  type: 'success' | 'error';
  id: number;
}

function ToastNotification({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const isSuccess = toast.type === 'success';

  return (
    <div
      className={`fixed bottom-4 right-4 z-[9999] flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg text-[13px] font-medium text-white ${
        isSuccess ? 'bg-emerald-500' : 'bg-red-500'
      }`}
    >
      {isSuccess ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {toast.message}
    </div>
  );
}

// ── Types ────────────────────────────────────────────────────

interface VersionSummary {
  id: string;
  year: number;
  version_number: number;
  status: 'draft' | 'published';
  created_at: string;
}

// ── Page ─────────────────────────────────────────────────────

export default function VersionsPage() {
  const router = useRouter();
  const [year, setYear] = useState(new Date().getFullYear());
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [confirmRevert, setConfirmRevert] = useState<VersionSummary | null>(null);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/versions?year=${year}`);
      if (!res.ok) throw new Error('Failed to load versions');
      const { versions: data } = await res.json();
      setVersions(data ?? []);
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to load versions', type: 'error', id: Date.now() });
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  // ── Auto-save check (every 60s) ───────────────────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/versions/should-save?year=${year}`);
        if (!res.ok) return;
        const { shouldSave } = await res.json();
        if (shouldSave) {
          await fetch(`/api/versions/save?year=${year}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'draft' }),
          });
          fetchVersions();
        }
      } catch {
        // Silent — auto-save is non-blocking
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [year, fetchVersions]);

  // ── Save Draft ─────────────────────────────────────────────
  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/versions/save?year=${year}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save draft');
      }
      setToast({ message: 'Draft saved successfully', type: 'success', id: Date.now() });
      await fetchVersions();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Save failed',
        type: 'error',
        id: Date.now(),
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Publish ────────────────────────────────────────────────
  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/versions/save?year=${year}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to publish');
      }
      setToast({ message: 'Schedule published and saved', type: 'success', id: Date.now() });
      await fetchVersions();
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Publish failed',
        type: 'error',
        id: Date.now(),
      });
    } finally {
      setPublishing(false);
    }
  };

  // ── Revert ─────────────────────────────────────────────────
  const handleRevert = async (version: VersionSummary) => {
    setRevertingId(version.id);
    try {
      const res = await fetch(`/api/versions/${version.id}/revert`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Revert failed');
      }
      setToast({
        message: `Reverted to version ${version.version_number}`,
        type: 'success',
        id: Date.now(),
      });
      setConfirmRevert(null);
      // Redirect to calendar view after revert
      router.push('/tools/scheduler/admin');
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Revert failed',
        type: 'error',
        id: Date.now(),
      });
    } finally {
      setRevertingId(null);
    }
  };

  // ── Format helpers ─────────────────────────────────────────
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  // The most recently created version is the "current" one (latest snapshot of the schedule)
  const currentVersionId = versions.length > 0
    ? versions.reduce((latest, v) =>
        new Date(v.created_at).getTime() > new Date(latest.created_at).getTime() ? v : latest
      ).id
    : null;

  return (
    <div
      className="overflow-y-auto h-full"
      style={{ backgroundColor: '#F8FAFC', padding: 32 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, color: '#0F172A', margin: 0 }}>
              Versions
            </h1>
            <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
              Save, publish, and revert schedule versions (5 per year)
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Year selector */}
            <Tooltip text="Select year to view versions">
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                style={{
                  height: 40,
                  borderRadius: 8,
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  padding: '0 12px',
                  fontSize: 14,
                  color: '#0F172A',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </Tooltip>

            {/* Save Draft */}
            <Button
              variant="secondary"
              onClick={handleSaveDraft}
              disabled={saving}
              tooltip="Save current schedule as a draft version"
              icon={saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>

            {/* Publish */}
            <Button
              variant="primary"
              onClick={handlePublish}
              disabled={publishing}
              tooltip="Save and publish current schedule"
              icon={publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            >
              {publishing ? 'Publishing...' : 'Publish'}
            </Button>
          </div>
        </div>

        {/* Version List */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  height: 80,
                  borderRadius: 12,
                  backgroundColor: '#E2E8F0',
                  opacity: 0.4,
                }}
              />
            ))}
          </div>
        ) : versions.length === 0 ? (
          <div
            style={{
              borderRadius: 12,
              backgroundColor: '#FFFFFF',
              padding: 48,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <History size={40} color="#CBD5E1" />
            <span style={{ fontSize: 15, color: '#94A3B8' }}>
              No versions saved for {year}. Use &quot;Save Draft&quot; or &quot;Publish&quot; to create your first version.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {versions.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center gap-4 sm:flex-nowrap"
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 12,
                  padding: '16px 20px',
                  ...(v.id === currentVersionId
                    ? { borderLeft: '3px solid #3B82F6' }
                    : {}),
                }}
              >
                {/* Version number badge */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: v.status === 'published' ? '#EFF6FF' : '#F8FAFC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: v.status === 'published' ? '#3B82F6' : '#64748B',
                    }}
                  >
                    v{v.version_number}
                  </span>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>
                    Version {v.version_number}
                  </span>
                  <span style={{ fontSize: 13, color: '#64748B' }}>
                    {formatDate(v.created_at)}
                  </span>
                </div>

                {/* Status badges + Revert — wrap to second line on narrow screens */}
                <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        backgroundColor: v.status === 'published' ? '#DCFCE7' : '#F1F5F9',
                        color: v.status === 'published' ? '#16A34A' : '#64748B',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {v.status}
                    </span>
                    {v.id === currentVersionId && (
                      <span
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          backgroundColor: '#DBEAFE',
                          color: '#2563EB',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        Current
                      </span>
                    )}
                  </div>

                  {/* Revert button */}
                  <div className="ml-auto sm:ml-2">
                    <Tooltip text="Revert schedule to this version">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setConfirmRevert(v)}
                        disabled={revertingId === v.id}
                        icon={
                          revertingId === v.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )
                        }
                      >
                        Revert
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Slot usage indicator */}
        {!loading && (
          <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>
            {versions.length} of 5 version slots used for {year}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && <ToastNotification toast={toast} onDismiss={() => setToast(null)} />}

      {/* Revert Confirmation Modal */}
      <Modal
        open={!!confirmRevert}
        onClose={() => setConfirmRevert(null)}
        title={`Revert to Version ${confirmRevert?.version_number}?`}
        subtitle={confirmRevert ? `Saved ${formatDate(confirmRevert.created_at)} \u2022 ${confirmRevert.status}` : ''}
        width={480}
        footer={
          confirmRevert ? (
            <>
              <ModalButton variant="secondary" onClick={() => setConfirmRevert(null)}>
                Cancel
              </ModalButton>
              <ModalButton
                variant="danger"
                loading={revertingId === confirmRevert.id}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={() => handleRevert(confirmRevert)}
              >
                {revertingId === confirmRevert.id ? 'Reverting\u2026' : 'Revert Schedule'}
              </ModalButton>
            </>
          ) : undefined
        }
      >
        <div className="px-6 py-5 space-y-4">
          {/* What will happen */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-1.5">What will happen</h3>
            <ul className="text-sm text-slate-600 space-y-1 list-disc pl-4">
              <li>All current sessions, templates, and calendar exceptions will be <strong>deleted</strong></li>
              <li>They will be replaced with data from Version {confirmRevert?.version_number}</li>
              <li>Staff, venues, and tags are <strong>not affected</strong></li>
            </ul>
          </div>

          {/* Warning: not reversible */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <strong>This cannot be undone.</strong> The current schedule data will be permanently
              overwritten. No new version is created automatically &mdash; if you want to preserve
              your current schedule, save a draft first using the &ldquo;Save Draft&rdquo; button.
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
