/**
 * Business Timezone & Date Utilities for Choir App
 * Standardized to Asia/Manila (UTC+8) for all task expiration, attendance, and scheduling.
 */

export const BUSINESS_TIMEZONE = 'Asia/Manila';

/**
 * Returns current timestamp formatted or parsed in Asia/Manila.
 */
export function getManilaNow(): Date {
  return new Date();
}

/**
 * Returns the calendar date string `YYYY-MM-DD` for a given timestamp in Asia/Manila.
 */
export function getManilaDateString(date: Date | string | number = new Date()): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  
  // Use Intl.DateTimeFormat with Asia/Manila timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d); // Produces 'YYYY-MM-DD'
}

/**
 * Returns the Date representing the end of the given business day (23:59:59.999) in Asia/Manila.
 * e.g. for "2026-08-22", returns the epoch time corresponding to 2026-08-22T23:59:59.999+08:00
 */
export function getEndOfDayManila(dueDateInput: string | Date): Date {
  const dateStr = typeof dueDateInput === 'string' && dueDateInput.length === 10
    ? dueDateInput
    : getManilaDateString(dueDateInput);

  if (!dateStr) return new Date();

  // 23:59:59.999 in UTC+8 is 15:59:59.999Z on the same day
  // Construct ISO string with explicit +08:00 offset
  return new Date(`${dateStr}T23:59:59.999+08:00`);
}

/**
 * Returns the Date representing the start of the given business day (00:00:00.000) in Asia/Manila.
 */
export function getStartOfDayManila(dueDateInput: string | Date): Date {
  const dateStr = typeof dueDateInput === 'string' && dueDateInput.length === 10
    ? dueDateInput
    : getManilaDateString(dueDateInput);

  if (!dateStr) return new Date();

  return new Date(`${dateStr}T00:00:00.000+08:00`);
}

/**
 * Determines whether a task due date is scheduled for today in Asia/Manila.
 */
export function isTaskDueToday(dueDate: string | Date | null | undefined): boolean {
  if (!dueDate) return false;
  const taskDateStr = getManilaDateString(dueDate);
  const todayStr = getManilaDateString(new Date());
  return taskDateStr === todayStr;
}

/**
 * Determines whether a task is overdue based on Asia/Manila business day boundary.
 * A task is overdue ONLY if current time has passed the end of its due date (23:59:59.999+08:00).
 */
export function isTaskOverdue(
  dueDate: string | Date | null | undefined,
  status?: string
): boolean {
  if (!dueDate) return false;
  if (status === 'completed' || status === 'reassigned' || status === 'cannot_complete') {
    return false;
  }

  const endOfDueDate = getEndOfDayManila(dueDate);
  const now = new Date();
  return now.getTime() > endOfDueDate.getTime();
}

/**
 * Generates user-friendly due date badges and calculation in Asia/Manila.
 */
export function getTaskDueLabel(
  dueDate: string | Date | null | undefined,
  status?: string
): {
  label: string;
  isOverdue: boolean;
  isDueSoon: boolean;
  isToday: boolean;
  formattedDate: string;
} {
  if (!dueDate) {
    return {
      label: 'No Due Date',
      isOverdue: false,
      isDueSoon: false,
      isToday: false,
      formattedDate: '',
    };
  }

  const d = new Date(dueDate);
  if (isNaN(d.getTime())) {
    return {
      label: 'Invalid Date',
      isOverdue: false,
      isDueSoon: false,
      isToday: false,
      formattedDate: '',
    };
  }

  const todayStr = getManilaDateString(new Date());
  const taskDateStr = getManilaDateString(dueDate);

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    month: 'short',
    day: 'numeric',
  }).format(d);

  // Compare calendar days in Manila
  const todayStart = getStartOfDayManila(todayStr).getTime();
  const taskStart = getStartOfDayManila(taskDateStr).getTime();
  const diffDays = Math.round((taskStart - todayStart) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const isCompleted = status === 'completed' || status === 'cannot_complete' || status === 'reassigned';
    return {
      label: isCompleted ? `Completed (${formattedDate})` : `Overdue by ${Math.abs(diffDays)}d (${formattedDate})`,
      isOverdue: !isCompleted,
      isDueSoon: false,
      isToday: false,
      formattedDate,
    };
  }

  if (diffDays === 0) {
    return {
      label: 'Due Today',
      isOverdue: false,
      isDueSoon: true,
      isToday: true,
      formattedDate,
    };
  }

  if (diffDays === 1) {
    return {
      label: 'Due Tomorrow',
      isOverdue: false,
      isDueSoon: true,
      isToday: false,
      formattedDate,
    };
  }

  return {
    label: `Due in ${diffDays}d (${formattedDate})`,
    isOverdue: false,
    isDueSoon: false,
    isToday: false,
    formattedDate,
  };
}
