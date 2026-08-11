export const automationPolicy = { returnReminderDays: 4, returnEscalationDays: 6, unidentifiedEscalationDays: 2, staleClaimDays: 3 } as const;

export function olderThan(date: Date, days: number, now = new Date()): boolean {
  return now.getTime() - date.getTime() >= days * 24 * 60 * 60 * 1000;
}
