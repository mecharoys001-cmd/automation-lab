/**
 * Symphonix Scheduler — Public API
 *
 * Barrel export for the auto-scheduler module.
 */

// Core engine
export { runScheduler } from './engine';

// Types
export type {
  SchedulerInput,
  SchedulerResult,
  SchedulerData,
  DraftSession,
  TemplateStats,
  SkippedDate,
  SkipReason,
  InstructorCandidate,
  TimeWindow,
  TemplateType,
  RotationMode,
} from './types';

// Auto-assignment
export {
  findInstructorForTaggedSlot,
  findInstructorForAutoAssign,
  findInstructorForTimeBlock,
  skillsMatchPartial,
  createRotationMap,
} from './auto-assign';

export type {
  AutoAssignContext,
  AutoAssignResult,
  RotationState,
} from './auto-assign';

// Utilities (exposed for testing and edge function reuse)
export {
  timeToMinutes,
  minutesToTime,
  toTimeWindow,
  timeWindowsOverlap,
  timeWindowContains,
  availabilityCoversWindow,
  formatDate,
  parseDate,
  datesForDayOfWeek,
  buildCalendarMap,
  buildBlackoutDaysSet,
  skillsMatch,
  dayIndexToName,
} from './utils';
