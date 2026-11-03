/**
 * SAMPLE DATA — in-app notifications and tasks for the demo accounts, taken
 * from the approved wireframe and scoped per role.
 */
import { bulkInsert, type Db, type SeedContext } from './context.js';

const ROLE_USERS: Record<string, string[]> = {
  management: ['principal', 'management', 'superadmin', 'schooladmin'],
  office: ['office'],
  teacher: ['teacher', 'teacher2'],
  parent: ['parent'],
  staff: ['staff'],
  hr: ['hr'],
  finance: ['finance'],
};

const DUE: Record<string, number> = { Today: 0, Overdue: -3, '18 Sep': 1, '19 Sep': 2, '20 Sep': 3, '22 Sep': 5, '24 Sep': 7, '25 Sep': 8, '10 Oct': 23, '15 Oct': 28 };

// [roles, tone, icon, topic, title, meta, time, route, category]
const N: [string[], string, string, string, string, string, string, string, string][] = [
  [['management'], 'critical', 'alert', 'compliance', 'Water quality test overdue by 8 days', 'Compliance · Owner: Murugan P.', '08:05', '/compliance', 'Critical'],
  [['management', 'teacher'], 'critical', 'userCheck', 'early_warning', 'Students absent 3+ consecutive days', 'Early Warning · Requires teacher review', '08:02', '/early-warning', 'Critical'],
  [['management', 'office', 'staff'], 'warning', 'bus', 'transport', 'Bus 4 running 9 minutes late', 'Transport · Route 4 parents notified automatically', '08:18', '/bus-tracking', 'Attention'],
  [['management', 'office', 'finance'], 'warning', 'wallet', 'fees', 'Fees overdue beyond 30 days', 'Finance · see Fee Collection for accounts', '07:40', '/fees', 'Attention'],
  [['management', 'office'], 'warning', 'users', 'admissions', '3 admissions follow-ups overdue', 'Admissions · Counsellor unassigned on LD-4380', '07:35', '/admissions', 'Attention'],
  [['management', 'hr'], 'caution', 'briefcase', 'workforce', 'Substitute needed — Grade 5A Social Studies, Thursday P2', 'Workforce · Ms. Anitha Devi on leave', '07:30', '/timetable', 'Attention'],
  [['management', 'hr', 'finance'], 'caution', 'clipboard', 'payroll', 'Payroll inputs await approval', 'Payroll · current month run', '07:15', '/payroll', 'Attention'],
  [['management', 'teacher'], 'info', 'message', 'communication', 'Parent queries unanswered over 24 h', 'Parent Communication', 'Yesterday', '/parent-communication', 'Information'],
  [['management', 'office', 'teacher'], 'info', 'calendar', 'events', 'PTM booking opens for Grade 5 parents', 'Parent Experience · this weekend', 'Yesterday', '/ptm', 'Information'],
  [['management'], 'success', 'check', 'attendance', 'Attendance marked for all sections except Grade 5A', 'Operations · 09:14', '09:14', '/attendance', 'Completed'],
  [['management', 'office', 'staff'], 'success', 'shieldCheck', 'safety', 'Fire drill completed — 3 min 42 s evacuation', 'Safety · Report filed', '05 Sep', '/safeguarding', 'Completed'],
  [['management'], 'info', 'mapPin', 'tracking', 'Student tracking: 4 devices need attention', 'Tracking · offline or paused tags', '08:40', '/student-tracking', 'Information'],

  [['teacher'], 'critical', 'checkSquare', 'attendance', 'Grade 5A attendance not yet marked', 'Period 1 started at 08:20', '08:25', '/attendance', 'Critical'],
  [['teacher'], 'warning', 'clipboard', 'assessments', 'Science marks pending entry', 'Term 3 States of Matter · closes soon', '08:10', '/assessments', 'Attention'],
  [['teacher'], 'warning', 'sparkle', 'report_cards', '3 AI-drafted report comments awaiting your review', 'Grade 5A · nothing publishes until you approve', '07:55', '/report-cards', 'Attention'],
  [['teacher'], 'caution', 'user', 'early_warning', 'Reshma Chandran — homework submission at 40%', 'Three weeks running · your watchlist', 'Yesterday', '/early-warning', 'Attention'],
  [['teacher'], 'info', 'calendar', 'timetable', 'Thursday Period 2 needs substitute cover', 'Timetable · suggestion ready', 'Yesterday', '/timetable', 'Information'],
  [['teacher'], 'success', 'check', 'lesson_plans', 'Grade 6B lesson plan approved and published', 'Fractions — equivalence · approved by you', 'Yesterday', '/lesson-plans', 'Completed'],

  [['parent'], 'warning', 'wallet', 'fees', 'Term 3 instalment of ₹22,000 is due', 'Due 10 Oct · pay from the app', '09:20', '/parent-360?tab=fees', 'Attention'],
  [['parent'], 'warning', 'edit', 'homework', 'English reading response due tomorrow', 'Aditya has not submitted yet', '08:40', '/parent-360?tab=academics', 'Attention'],
  [['parent'], 'caution', 'megaphone', 'circulars', 'Circular needs your acknowledgement', 'Term 3 examination schedule', 'Yesterday', '/parent-360?tab=more', 'Attention'],
  [['parent'], 'info', 'bus', 'transport', 'Bus 12 arriving at your stop in 12 minutes', 'Afternoon run · driver Selvaraj K.', 'Yesterday', '/parent-360?tab=safety', 'Information'],
  [['parent'], 'info', 'calendar', 'events', 'PTM booking is open for Grade 5', '4 slots left with Ms. Priya Raghavan', 'Yesterday', '/parent-360?tab=more', 'Information'],
  [['parent'], 'success', 'shieldCheck', 'tracking', 'Aditya arrived safely at 08:31', 'Main Gate · verified entry', '08:32', '/parent-360?tab=safety', 'Completed'],
  [['parent'], 'success', 'award', 'achievements', 'Achievement recorded — District Robotics, 2nd place', 'Verified by the school · added to the portfolio', '12 Aug', '/parent-360', 'Completed'],

  [['staff'], 'critical', 'truck', 'compliance', 'Vehicle fitness due — Bus 4 and Bus 15', 'RTO Chengalpattu · you are the owner', '07:45', '/staff-self', 'Critical'],
  [['staff'], 'warning', 'clock', 'overtime', 'Your overtime claim of 14 hours is under review', 'Current run · with the section head', '08:00', '/staff-self', 'Attention'],
  [['staff'], 'caution', 'shield', 'shifts', 'Rear gate cover needed on Thursday', 'Saravanan R. absent · roster gap', 'Yesterday', '/staff-self', 'Attention'],
  [['staff'], 'info', 'receipt', 'payroll', 'Your August payslip is available', 'Released 31 Aug', '31 Aug', '/staff-self', 'Information'],
  [['staff'], 'success', 'check', 'leave', 'Your leave request was approved', 'Cover arranged from the team rota', 'Yesterday', '/staff-self', 'Completed'],

  [['hr'], 'warning', 'calendar', 'leave', 'Leave requests awaiting approval', 'Workforce · Leave', '08:15', '/leave', 'Attention'],
  [['hr'], 'caution', 'shield', 'compliance', 'Background verification pending for new joiners', 'Due this month', 'Yesterday', '/workforce', 'Attention'],
  [['finance'], 'warning', 'fileText', 'expenses', 'Expense claims awaiting approval', 'Finance · Expenses', '08:30', '/expenses', 'Attention'],
  [['finance'], 'caution', 'check', 'reconciliation', 'Payment reconciliation exceptions to clear', 'Finance · Reconciliation', 'Yesterday', '/reconciliation', 'Attention'],
];

// [roles, code, title, module, due, priority, status, route]
const T: [string[], string, string, string, string, string, string, string][] = [
  [['management'], 'T-551', 'Approve payroll inputs', 'Payroll', 'Today', 'High', 'Pending', '/payroll'],
  [['management', 'teacher'], 'T-549', 'Review Early Warning signals', 'Early Warning', 'Today', 'High', 'Pending', '/early-warning'],
  [['management'], 'T-546', 'Sign off Grade 6A report cards', 'Report Cards', '24 Sep', 'Medium', 'Pending', '/report-cards'],
  [['management'], 'T-544', 'Approve expense EXP-2211 (AC servicing)', 'Finance', '18 Sep', 'Medium', 'Under Review', '/expenses'],
  [['management'], 'T-540', 'Renew water quality test — overdue', 'Compliance', 'Overdue', 'High', 'Pending', '/compliance'],
  [['management'], 'T-538', 'Confirm Grade 5 PTM slot plan', 'Parent Experience', '19 Sep', 'Low', 'Pending', '/ptm'],
  [['management'], 'T-537', 'Review student tracking devices that are offline', 'Student Tracking', '19 Sep', 'Low', 'Pending', '/student-tracking'],
  [['teacher'], 'T-533', 'Mark attendance — Grade 5A', 'Attendance', 'Today', 'High', 'Pending', '/attendance'],
  [['teacher'], 'T-532', 'Enter Science marks — pending', 'Assessments', 'Today', 'High', 'Pending', '/assessments'],
  [['teacher'], 'T-531', 'Review 3 AI-drafted report comments', 'Report Cards', 'Today', 'Medium', 'Under Review', '/report-cards'],
  [['teacher'], 'T-530', 'Reply to 2 parent messages', 'Communication', 'Today', 'Medium', 'Pending', '/parent-communication'],
  [['teacher'], 'T-529', 'Confirm Thursday substitute cover', 'Timetable', '18 Sep', 'Low', 'Pending', '/timetable'],
  [['parent'], 'T-521', 'Pay Term 3 instalment — ₹22,000', 'Fees', '10 Oct', 'High', 'Pending', '/parent-360?tab=fees'],
  [['parent'], 'T-520', 'Acknowledge circular — Term 3 examination schedule', 'Circulars', '18 Sep', 'Medium', 'Pending', '/parent-360?tab=more'],
  [['parent'], 'T-519', 'Book your PTM slot for Grade 5', 'PTM', '19 Sep', 'Medium', 'Pending', '/parent-360?tab=more'],
  [['parent'], 'T-518', 'Confirm the new authorised pickup person', 'Safety', '20 Sep', 'High', 'Pending', '/parent-360?tab=safety'],
  [['parent'], 'T-517', 'Upload renewed address proof', 'Documents', '25 Sep', 'Low', 'Pending', '/parent-360?tab=more'],
  [['office'], 'T-511', 'Assign a counsellor to lead LD-4380', 'Admissions', 'Today', 'High', 'Pending', '/leads'],
  [['office'], 'T-510', 'Chase documents for application LD-4405', 'Applications', 'Today', 'Medium', 'Pending', '/applications'],
  [['office'], 'T-509', 'Issue transfer certificate — Rahul Venkatesh', 'Certificates', '18 Sep', 'Medium', 'Under Review', '/certificates'],
  [['finance'], 'T-508', 'Clear payment reconciliation exceptions', 'Finance', '18 Sep', 'Medium', 'Pending', '/reconciliation'],
  [['office', 'finance'], 'T-507', 'Send fee reminders to overdue accounts', 'Fees', '19 Sep', 'Low', 'Pending', '/fees'],
  [['staff'], 'T-501', 'Book vehicle fitness — Bus 4 and Bus 15', 'Compliance', '22 Sep', 'High', 'Pending', '/staff-self'],
  [['staff'], 'T-500', 'Submit your overtime claim', 'Overtime', '25 Sep', 'Medium', 'Pending', '/staff-self'],
  [['staff'], 'T-499', 'Arrange rear gate cover for Thursday', 'Shifts', '18 Sep', 'High', 'Pending', '/staff-self'],
  [['staff'], 'T-498', 'Complete child-protection refresher', 'Training', '15 Oct', 'Low', 'Pending', '/staff-self'],
  [['hr'], 'T-491', 'Approve pending leave requests', 'Leave', 'Today', 'High', 'Pending', '/leave'],
  [['hr'], 'T-490', 'Prepare payroll inputs', 'Payroll', '20 Sep', 'High', 'Pending', '/payroll'],
  [['finance'], 'T-481', 'Approve submitted expenses', 'Expenses', 'Today', 'High', 'Pending', '/expenses'],
];

function timeFor(ctx: SeedContext, t: string) {
  if (/^\d{2}:\d{2}$/.test(t)) {
    const at = ctx.at(ctx.today, t);
    return at > ctx.now ? ctx.at(ctx.day(-1), t) : at;
  }
  if (t === 'Yesterday') return ctx.at(ctx.day(-1), '17:10');
  if (t === '05 Sep') return ctx.at(ctx.day(-12), '11:00');
  if (t === '31 Aug') return ctx.at(ctx.day(-17), '18:00');
  if (t === '12 Aug') return ctx.at(ctx.day(-36), '16:00');
  return ctx.now;
}

export async function seedInbox(db: Db, ctx: SeedContext) {
  const rows: unknown[][] = [];
  for (const [roles, tone, icon, topic, title, meta, time, route, category] of N) {
    const at = timeFor(ctx, time);
    const handles = new Set(roles.flatMap((r) => ROLE_USERS[r] ?? []));
    for (const h of handles) {
      const read = category === 'Completed' || time === 'Yesterday' ? at : null;
      rows.push([ctx.users[h], category, tone, icon, topic, title, meta, route, read, at]);
    }
  }
  // Parent 2 (Sudha Raman) — about her own child only
  const sanjana = ctx.studentByNo['HS-2026-1042'];
  rows.push([ctx.users.parent2, 'Critical', 'critical', 'userCheck', 'attendance', `${sanjana.firstName} was marked absent today`, 'Please reply to the class teacher with the reason', '/parent-360?tab=academics', null, timeFor(ctx, '09:20')]);
  rows.push([ctx.users.parent2, 'Attention', 'warning', 'wallet', 'fees', 'Term 2 fee is overdue', 'Pay from the app to avoid a late fee', '/parent-360?tab=fees', null, timeFor(ctx, '07:40')]);
  rows.push([ctx.users.student, 'Information', 'info', 'edit', 'homework', 'English reading response due tomorrow', 'Chapter 6', '/my-profile', null, timeFor(ctx, '08:40')]);
  await bulkInsert(db, 'notifications', ['user_id', 'category', 'tone', 'icon', 'topic', 'title', 'body', 'route', 'read_at', 'created_at'], rows);

  const tasks: unknown[][] = [];
  const seen = new Set<string>();
  for (const [roles, code, title, module, due, priority, status, route] of T) {
    for (const role of roles) {
      for (const h of ROLE_USERS[role] ?? []) {
        const c = seen.has(code) ? `${code}-${h}` : code;
        seen.add(c);
        tasks.push([c, title, module, ctx.users[h], ctx.day(DUE[due] ?? 0), priority, status, route]);
      }
    }
  }
  await bulkInsert(db, 'tasks', ['code', 'title', 'module', 'assignee_user_id', 'due_on', 'priority', 'status', 'route'], tasks);
}
