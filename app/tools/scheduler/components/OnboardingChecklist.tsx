'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle2, Circle, ChevronRight, Zap, Users, MapPin, FileText, Calendar } from 'lucide-react';
import { Tooltip } from './ui/Tooltip';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  link: string;
  completed: boolean;
}

interface OnboardingChecklistProps {
  onClose: () => void;
}

export function OnboardingChecklist({ onClose }: OnboardingChecklistProps) {
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkProgress();
  }, []);

  async function checkProgress() {
    try {
      // Check programs
      const programsRes = await fetch('/api/programs');
      const programsData = await programsRes.json();
      const hasPrograms = programsData.programs?.length > 0;

      // Check instructors
      const instructorsRes = await fetch('/api/instructors');
      const instructorsData = await instructorsRes.json();
      const hasInstructors = instructorsData.instructors?.length > 0;

      // Check venues
      const venuesRes = await fetch('/api/venues');
      const venuesData = await venuesRes.json();
      const hasVenues = venuesData.venues?.length > 0;

      // Check templates
      const templatesRes = await fetch('/api/templates');
      const templatesData = await templatesRes.json();
      const hasTemplates = templatesData.templates?.length > 0;

      // Check sessions
      const sessionsRes = await fetch('/api/sessions');
      const sessionsData = await sessionsRes.json();
      const hasSessions = sessionsData.sessions?.length > 0;

      setSteps([
        {
          id: 'program',
          title: 'Create your first program',
          description: 'Set up a school year or session with start and end dates',
          icon: Calendar,
          link: '/tools/scheduler/admin/settings',
          completed: hasPrograms,
        },
        {
          id: 'instructors',
          title: 'Add instructors',
          description: 'Add staff or load sample data to get started',
          icon: Users,
          link: '/tools/scheduler/admin/people',
          completed: hasInstructors,
        },
        {
          id: 'venues',
          title: 'Set up venues',
          description: 'Define classrooms, stages, and teaching spaces',
          icon: MapPin,
          link: '/tools/scheduler/admin/venues',
          completed: hasVenues,
        },
        {
          id: 'templates',
          title: 'Create class templates',
          description: 'Define recurring classes (grade levels, subjects, times)',
          icon: FileText,
          link: '/tools/scheduler/admin/templates',
          completed: hasTemplates,
        },
        {
          id: 'schedule',
          title: 'Generate your first schedule',
          description: 'Auto-generate sessions from your templates',
          icon: Zap,
          link: '/tools/scheduler/admin/calendar',
          completed: hasSessions,
        },
      ]);
    } catch (err) {
      console.error('Failed to check onboarding progress:', err);
    } finally {
      setLoading(false);
    }
  }

  const completedCount = steps.filter((s) => s.completed).length;
  const totalCount = steps.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isComplete = completedCount === totalCount;

  if (loading) {
    return (
      <div className="fixed bottom-6 right-6 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 p-6 w-[380px]">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 w-[380px] overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-base font-semibold text-white">Getting Started</h3>
            <p className="text-xs text-blue-100 mt-0.5">
              {isComplete ? 'All set up! 🎉' : 'Complete these steps to set up your scheduler'}
            </p>
          </div>
          <Tooltip text="Close checklist (reopen in Settings)">
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </Tooltip>
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
                      : 'bg-slate-100 text-slate-400'
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
                    <span className="text-xs font-semibold text-slate-400">
                      Step {index + 1}
                    </span>
                    {step.completed && (
                      <span className="text-xs font-medium text-emerald-600">
                        Complete
                      </span>
                    )}
                  </div>
                  <h4
                    className={`text-sm font-semibold mt-0.5 ${
                      step.completed ? 'text-emerald-900' : 'text-slate-900'
                    }`}
                  >
                    {step.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                    {step.description}
                  </p>
                </div>

                {/* Arrow */}
                {!step.completed && (
                  <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 mt-2" />
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
