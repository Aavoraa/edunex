/* ==========================================================================
   NAVIGATION — sidebar model. `roles` controls what each role can reach;
   omitted means every role with module access sees it.
   ========================================================================== */
(function (HS) {
  'use strict';

  var ALL = ['management', 'teacher', 'parent', 'office', 'staff'];
  var MGMT = ['management'];
  var MGMT_OFFICE = ['management', 'office'];
  var MGMT_TEACH = ['management', 'teacher'];
  var MGMT_TEACH_OFFICE = ['management', 'teacher', 'office'];

  HS.nav = [
    {
      group: 'Overview', icon: 'grid', roles: ALL, items: [
        { label: 'Dashboard', icon: 'home', route: '#/command-center', roles: ALL, dynamicHome: true },
        { label: 'Command Center', icon: 'pulse', route: '#/command-center', roles: MGMT },
        { label: 'Teacher Dashboard', icon: 'bookOpen', route: '#/teacher', roles: MGMT_TEACH },
        { label: 'Parent 360', icon: 'heart', route: '#/parent-360', roles: ['management', 'parent'] },
        { label: 'Staff Self-Service', icon: 'idCard', route: '#/staff-self', roles: ['management', 'staff'] },
        { label: 'Notifications', icon: 'bell', route: '#/notifications', roles: ALL, count: 11, tone: 'alert' },
        { label: 'My Tasks', icon: 'checkSquare', route: '#/my-tasks', roles: ALL, count: 6 }
      ]
    },
    {
      group: 'Student Management', icon: 'users', roles: MGMT_TEACH_OFFICE, items: [
        { label: 'Students', icon: 'users', route: '#/students' },
        { label: 'Student 360', icon: 'user', route: '#/student-360' },
        { label: 'Attendance', icon: 'checkSquare', route: '#/attendance' },
        { label: 'Academic Performance', icon: 'trending', route: '#/academic-performance' },
        { label: 'Assessments', icon: 'clipboard', route: '#/assessments' },
        { label: 'Behaviour & Wellbeing', icon: 'heart', route: '#/wellbeing' },
        { label: 'Student Portfolio', icon: 'folder', route: '#/portfolio' },
        { label: 'Talent Discovery', icon: 'sparkle', route: '#/talent' },
        { label: 'Early Warning', icon: 'alert', route: '#/early-warning', count: 14, tone: 'alert' }
      ]
    },
    {
      group: 'Admissions & CRM', icon: 'target', roles: MGMT_OFFICE, items: [
        { label: 'Admissions Dashboard', icon: 'target', route: '#/admissions' },
        { label: 'Leads', icon: 'list', route: '#/leads', count: 12 },
        { label: 'Enquiries', icon: 'message', route: '#/enquiries' },
        { label: 'Counselling Pipeline', icon: 'layers', route: '#/pipeline' },
        { label: 'Applications', icon: 'fileText', route: '#/applications' },
        { label: 'Campus Visits', icon: 'mapPin', route: '#/visits' },
        { label: 'Conversion Analytics', icon: 'percent', route: '#/conversion' },
        { label: 'Parent Referrals', icon: 'link', route: '#/referrals' },
        { label: 'Alumni', icon: 'graduation', route: '#/alumni' },
        { label: 'Vendors & Partners', icon: 'briefcase', route: '#/vendors' }
      ]
    },
    {
      group: 'Academics', icon: 'book', roles: MGMT_TEACH_OFFICE, items: [
        { label: 'Curriculum', icon: 'bookOpen', route: '#/curriculum' },
        { label: 'Classes', icon: 'grid', route: '#/classes' },
        { label: 'Subjects', icon: 'book', route: '#/subjects' },
        { label: 'Timetable', icon: 'calendar', route: '#/timetable' },
        { label: 'Lesson Plans', icon: 'clipboard', route: '#/lesson-plans' },
        { label: 'Homework', icon: 'edit', route: '#/homework' },
        { label: 'Question Bank', icon: 'helpCircle', route: '#/question-bank' },
        { label: 'Assessments', icon: 'checkSquare', route: '#/assessments' },
        { label: 'Report Cards', icon: 'fileText', route: '#/report-cards' },
        { label: 'Cambridge Objectives', icon: 'target', route: '#/objectives' }
      ]
    },
    {
      group: 'Parent Experience', icon: 'heart', roles: MGMT_TEACH_OFFICE, items: [
        { label: 'Parent Directory', icon: 'users', route: '#/parent-directory' },
        { label: 'Parent Communication', icon: 'message', route: '#/parent-communication', count: 9 },
        { label: 'PTM', icon: 'calendar', route: '#/ptm' },
        { label: 'Circulars', icon: 'megaphone', route: '#/circulars' },
        { label: 'Events', icon: 'star', route: '#/events' },
        { label: 'Acknowledgements', icon: 'checkSquare', route: '#/acknowledgements' }
      ]
    },
    {
      group: 'Safety & Transport', icon: 'shield', roles: ['management', 'office', 'staff', 'teacher'], items: [
        { label: 'Smart Gate', icon: 'door', route: '#/smart-gate' },
        { label: 'Gate Entry/Exit', icon: 'scan', route: '#/gate-log' },
        { label: 'Pickup Authorisation', icon: 'key', route: '#/pickup' },
        { label: 'Visitor Management', icon: 'idCard', route: '#/visitors' },
        { label: 'Bus Tracking', icon: 'bus', route: '#/bus-tracking' },
        { label: 'Routes', icon: 'route', route: '#/routes' },
        { label: 'Boarding/De-boarding', icon: 'navigation', route: '#/boarding' },
        { label: 'Emergency Alerts', icon: 'megaphone', route: '#/emergency' },
        { label: 'Safeguarding', icon: 'shieldCheck', route: '#/safeguarding' },
        { label: 'Health & Infirmary', icon: 'stethoscope', route: '#/infirmary' },
        { label: 'Counselling', icon: 'heart', route: '#/counselling' }
      ]
    },
    {
      group: 'Finance', icon: 'wallet', roles: MGMT_OFFICE, items: [
        { label: 'Fee Structures', icon: 'layers', route: '#/fee-structures' },
        { label: 'Fee Collection', icon: 'wallet', route: '#/fees' },
        { label: 'Student Accounts', icon: 'user', route: '#/student-accounts' },
        { label: 'Payments', icon: 'creditCard', route: '#/payments' },
        { label: 'Receipts', icon: 'receipt', route: '#/receipts' },
        { label: 'Concessions', icon: 'percent', route: '#/concessions' },
        { label: 'Scholarships', icon: 'award', route: '#/scholarships' },
        { label: 'Expenses', icon: 'fileText', route: '#/expenses', count: 4 },
        { label: 'Reimbursements', icon: 'refresh', route: '#/reimbursements' },
        { label: 'Allowances', icon: 'plus', route: '#/allowances' },
        { label: 'Budgets', icon: 'pieChart', route: '#/budgets' },
        { label: 'Reconciliation', icon: 'check', route: '#/reconciliation' },
        { label: 'Financial Reports', icon: 'barChart', route: '#/financial-reports' }
      ]
    },
    {
      group: 'Workforce', icon: 'briefcase', roles: MGMT_OFFICE, items: [
        { label: 'Employee Directory', icon: 'users', route: '#/workforce' },
        { label: 'Teaching Staff', icon: 'graduation', route: '#/teaching-staff' },
        { label: 'Non-Teaching Staff', icon: 'tool', route: '#/non-teaching-staff' },
        { label: 'Attendance', icon: 'checkSquare', route: '#/staff-attendance' },
        { label: 'Shifts & Rosters', icon: 'clock', route: '#/shifts' },
        { label: 'Leave', icon: 'calendar', route: '#/leave', count: 4 },
        { label: 'Overtime', icon: 'clock', route: '#/overtime' },
        { label: 'Allowances', icon: 'plus', route: '#/staff-allowances' },
        { label: 'Workload', icon: 'barChart', route: '#/workload' },
        { label: 'CPD', icon: 'award', route: '#/cpd' },
        { label: 'Payroll', icon: 'wallet', route: '#/payroll', count: 12, tone: 'amber' },
        { label: 'Payslips', icon: 'receipt', route: '#/payslips' }
      ]
    },
    {
      group: 'Operations', icon: 'box', roles: MGMT_OFFICE, items: [
        { label: 'Assets', icon: 'box', route: '#/assets' },
        { label: 'Facilities', icon: 'building', route: '#/facilities' },
        { label: 'Maintenance', icon: 'wrench', route: '#/maintenance' },
        { label: 'Inventory', icon: 'layers', route: '#/inventory' },
        { label: 'Documents', icon: 'folder', route: '#/documents' },
        { label: 'Certificates', icon: 'award', route: '#/certificates' },
        { label: 'Circulars', icon: 'megaphone', route: '#/op-circulars' },
        { label: 'Compliance Calendar', icon: 'shield', route: '#/compliance', count: 1, tone: 'alert' },
        { label: 'Audit Trail', icon: 'list', route: '#/audit' }
      ]
    },
    {
      group: 'Innovation', icon: 'rocket', roles: MGMT_TEACH_OFFICE, items: [
        { label: 'Innovation Lab', icon: 'rocket', route: '#/innovation' },
        { label: 'Ideas', icon: 'lightbulb', route: '#/ideas' },
        { label: 'Projects', icon: 'puzzle', route: '#/projects' },
        { label: 'Mentors', icon: 'users', route: '#/mentors' },
        { label: 'Milestones', icon: 'flag', route: '#/milestones' },
        { label: 'Competitions', icon: 'award', route: '#/competitions' },
        { label: 'Achievements', icon: 'star', route: '#/achievements' }
      ]
    },
    {
      group: 'Intelligence', icon: 'brain', roles: MGMT_TEACH, items: [
        { label: 'AI Teacher Co-Pilot', icon: 'sparkle', route: '#/copilot' },
        { label: 'School Knowledge AI', icon: 'brain', route: '#/knowledge-ai' },
        { label: 'Talent Discovery', icon: 'star', route: '#/talent' },
        { label: 'Early Warning', icon: 'alert', route: '#/early-warning' },
        { label: 'Analytics', icon: 'chart', route: '#/analytics' },
        { label: 'Reports', icon: 'fileText', route: '#/reports' }
      ]
    },
    {
      group: 'Group Management', icon: 'building', roles: MGMT, items: [
        { label: 'Campuses', icon: 'building', route: '#/campuses' },
        { label: 'Group Dashboard', icon: 'globe', route: '#/group-dashboard' },
        { label: 'Campus Comparison', icon: 'barChart', route: '#/campus-comparison' },
        { label: 'Transfers', icon: 'refresh', route: '#/transfers' },
        { label: 'Group Policies', icon: 'shield', route: '#/group-policies' }
      ]
    },
    {
      /* Demo and handoff tools. They belong to whoever is presenting, not to the
         role being presented, and they render school-wide administrative content.
         Management only, so every other login looks like the shipped product. */
      group: 'Prototype', icon: 'play', roles: MGMT, items: [
        { label: 'Day in the Life', icon: 'clock', route: '#/day-in-life' },
        { label: 'Automation Flows', icon: 'zap', route: '#/automations' },
        { label: 'WhatsApp AI', icon: 'message', route: '#/whatsapp-ai' },
        { label: 'Design System', icon: 'layers', route: '#/design-system' }
      ]
    }
  ];

  /* Mobile bottom navigation, per role */
  HS.mobileNav = {
    management: [
      { label: 'Pulse', icon: 'pulse', route: '#/command-center' },
      { label: 'Students', icon: 'users', route: '#/students' },
      { label: 'Alerts', icon: 'bell', route: '#/notifications' },
      { label: 'Finance', icon: 'wallet', route: '#/fees' },
      { label: 'More', icon: 'menu', action: 'toggle-drawer' }
    ],
    teacher: [
      { label: 'Home', icon: 'home', route: '#/teacher' },
      { label: 'Attendance', icon: 'checkSquare', route: '#/attendance' },
      { label: 'Co-Pilot', icon: 'sparkle', route: '#/copilot' },
      { label: 'Students', icon: 'users', route: '#/students' },
      { label: 'More', icon: 'menu', action: 'toggle-drawer' }
    ],
    parent: [
      { label: 'Home', icon: 'home', route: '#/parent-360' },
      { label: 'Academics', icon: 'bookOpen', route: '#/parent-360?tab=academics' },
      { label: 'Safety', icon: 'shield', route: '#/parent-360?tab=safety' },
      { label: 'Fees', icon: 'wallet', route: '#/parent-360?tab=fees' },
      { label: 'More', icon: 'menu', action: 'toggle-drawer' }
    ],
    office: [
      { label: 'Admissions', icon: 'target', route: '#/admissions' },
      { label: 'Fees', icon: 'wallet', route: '#/fees' },
      { label: 'Students', icon: 'users', route: '#/students' },
      { label: 'Tasks', icon: 'checkSquare', route: '#/my-tasks' },
      { label: 'More', icon: 'menu', action: 'toggle-drawer' }
    ],
    staff: [
      { label: 'Home', icon: 'home', route: '#/staff-self' },
      { label: 'Transport', icon: 'bus', route: '#/bus-tracking' },
      { label: 'Gate', icon: 'scan', route: '#/gate-log' },
      { label: 'Alerts', icon: 'bell', route: '#/notifications' },
      { label: 'More', icon: 'menu', action: 'toggle-drawer' }
    ]
  };
})(window.HS = window.HS || {});
