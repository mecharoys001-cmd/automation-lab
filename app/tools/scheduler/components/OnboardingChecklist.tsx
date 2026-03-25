'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle2, ChevronRight, Zap, Users, MapPin, FileText, Calendar, Minimize2, ListChecks, Tags } from 'lucide-react';
import { Tooltip } from './ui/Tooltip';
import { useProgram } from '../admin/ProgramContext';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  link: string;
  completed: boolean;
  optional?: boolean;
}

interface OnboardingChecklistProps {
  onClose: () => void;
}

export function OnboardingChecklist({ onClose }: OnboardingChecklistProps) {
  const { selectedProgramId, selectedProgram, updateWizardState } = useProgram();

  const [minimized, setMinimized] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('onboarding_minimized') === 'true';
    }
    return false;
  });
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [loading, setLoading] = useState(true);

  const checkProgress = useCallback(async () => {
    if (!selectedProgramId) return;
    setLoading(true);
    try {
      // Check programs (always true since we have a selected program)
      const hasPrograms = true;

      // Fetch sessions for THIS program to check per-program resource usage
      const sessionsRes = await fetch(`/api/sessions?program_id=${selectedProgramId}`);
      const sessionsData = await sessionsRes.json();
      const sessions = sessionsData.sessions ?? [];
      const hasSessions = sessions.length > 0;

      // Check if this program has sessions with assigned instructors
      const hasInstructors = sessions.some((s: { instructor_id?: string | null }) => s.instructor_id != null);

      // Check if this program has sessions with assigned venues
      const hasVenues = sessions.some((s: { venue_id?: string | null }) => s.venue_id != null);

      // Check if this program has sessions using event type tags
      const hasSubjects = sessions.some((s: { tags?: string[] | null }) => (s.tags ?? []).length > 0);

      // Check templates for THIS program
      const templatesRes = await fetch(`/api/templates?program_id=${selectedProgramId}`);
      const templatesData = await templatesRes.json();
      const hasTemplates = templatesData.templates?.length > 0;

      const newSteps: OnboardingStep[] = [
        {
          id: 'program',
          title: 'Create a program',
          description: 'Set up a program with start and end dates',
          icon: Calendar,
          link: '/tools/scheduler/admin/settings',
          completed: hasPrograms,
        },
        {
          id: 'event_types',
          title: 'Set up event types',
          description: 'Create event type tags (e.g. Piano, Dance) for the intake form',
          icon: Tags,
          link: '/tools/scheduler/admin/tags',
          completed: hasSubjects,
        },
        {
          id: 'instructors',
          title: 'Add staff',
          description: 'Add staff or send the intake form for self-registration',
          icon: Users,
          link: '/tools/scheduler/admin/people',
          completed: hasInstructors,
        },
        {
          id: 'venues',
          title: 'Set up venues',
          description: 'Define classrooms, stages, and teaching spaces',
          icon: MapPin,
          link: '/tools/scheduler/admin/people',
          completed: hasVenues,
        },
        {
          id: 'templates',
          title: 'Create event templates',
          description: 'Save reusable presets to speed up event creation',
          icon: FileText,
          link: '/tools/scheduler/admin/event-templates',
          completed: hasTemplates,
          optional: true,
        },
        {
          id: 'first-event',
          title: 'Create your first event',
          description: 'Click any time slot on the calendar to add an event',
          icon: Zap,
          link: '/tools/scheduler/admin',
          completed: hasSessions,
        },
      ];

      setSteps(newSteps);
    } catch (err) {
      console.error('Failed to check onboarding progress:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedProgramId]);

  // Re-check progress when program changes
  useEffect(() => {
    checkProgress();
  }, [checkProgress]);

  const handleMinimize = () => {
    setMinimized(true);
    localStorage.setItem('onboarding_minimized', 'true');
  };

  const handleRestore = () => {
    setMinimized(false);
    localStorage.removeItem('onboarding_minimized');
  };

  // Listen for reopen event to also restore if minimized
  useEffect(() => {
    const handleReopen = () => {
      setMinimized(false);
      localStorage.removeItem('onboarding_minimized');
    };
    window.addEventListener('reopen-onboarding', handleReopen);
    return () => window.removeEventListener('reopen-onboarding', handleReopen);
  }, []);

  const handleStepClick = async (stepIndex: number) => {
    // Update wizard_step to track current progress
    if (selectedProgram && stepIndex > selectedProgram.wizard_step) {
      await updateWizardState(selectedProgram.wizard_completed, stepIndex);
    }
  };

  const requiredSteps = steps.filter((s) => !s.optional);
  const completedCount = requiredSteps.filter((s) => s.completed).length;
  const totalCount = requiredSteps.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isComplete = completedCount === totalCount;

  if (loading) {
    // Respect minimized state during loading to avoid flashing the full panel
    if (minimized) {
      return (
        <div className="fixed bottom-6 left-6 z-50">
          <button
            disabled
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-violet-500 text-white rounded-full px-4 py-2.5 shadow-lg opacity-75"
          >
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          </button>
        </div>
      );
    }
    return (
      <div className="fixed bottom-6 left-6 right-6 sm:right-auto z-50 bg-white rounded-xl shadow-2xl border border-slate-200 p-6 w-full max-w-[380px]">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  // Minimized view — small floating pill
  if (minimized) {
    return (
      <div className="fixed bottom-6 left-6 z-50">
        <Tooltip text="Expand Getting Started checklist">
          <button
            onClick={handleRestore}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-violet-500 text-white rounded-full px-4 py-2.5 shadow-lg hover:shadow-xl transition-all hover:scale-105"
          >
            <ListChecks className="w-4 h-4" />
            <span className="text-sm font-medium">{completedCount}/{totalCount}</span>
          </button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 right-6 sm:right-auto z-50 bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-[380px] overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-white">Getting Started</h3>
            <p className="text-xs text-blue-100 mt-0.5">
              {isComplete ? 'All set up! 🎉' : 'Start scheduling right from the calendar'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip text="Minimize checklist">
              <button
                onClick={handleMinimize}
                className="p-1 rounded-lg hover:bg-white/20 text-white transition-colors"
                aria-label="Minimize checklist"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </Tooltip>
            <Tooltip text="Close checklist (reopen in Settings)">
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-white/20 text-white transition-colors"
                aria-label="Close checklist"
              >
                <X className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-white">
            <span className="font-medium">Progress</span>
            <span className="font-semibold">{completedCount}/{totalCount}</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
        {steps.map((step, index) => (
          <a
            key={step.id}
            href={step.link}
            onClick={() => handleStepClick(index)}
            className={`block rounded-lg border transition-all ${
              step.completed
                ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <div className="p-3.5">
              <div className="flex items-start gap-3">
                {/* Step Icon/Check */}
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${
                    step.completed
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {step.completed ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-4 h-4" />
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4
                      className={`text-sm font-semibold ${
                        step.completed ? 'text-emerald-900' : 'text-slate-900'
                      }`}
                    >
                      {step.title}
                    </h4>
                    {step.optional && (
                      <span className="text-[10px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                        Optional
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">
                    {step.description}
                  </p>
                </div>

                {/* Arrow or Check */}
                {step.completed ? (
                  <span className="text-xs font-medium text-emerald-800 flex-shrink-0 mt-1">Done</span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-700 flex-shrink-0 mt-2" />
                )}
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Footer */}
      {isComplete && (
        <div className="px-5 py-4 bg-emerald-50 border-t border-emerald-200">
          <p className="text-xs text-emerald-700 font-medium text-center">
            ✨ You're all set! Your scheduler is ready to use.
          </p>
        </div>
      )}
    </div>
  );
}
