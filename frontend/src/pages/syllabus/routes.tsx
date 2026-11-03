import { page } from '@/lib/page';
import type { AppRoute } from '../registry';

/**
 * Cambridge IGCSE syllabus (Grades 9–10) and the grading schemes — Cambridge
 * IGCSE (A* to G, U below G), Tamil Nadu Matriculation (A1 to E2) and CBSE (A1 to E), one per
 * board. Paths and permissions match layouts/nav.ts.
 */
const SyllabusPage = page(() => import('./SyllabusPage'));
const SyllabusDetailPage = page(() => import('./SyllabusDetailPage'));
const IgcseGradingPage = page(() => import('./IgcseGradingPage'));
const MatricSyllabusPage = page(() => import('./MatricSyllabusPage'));
const MatricOutcomesPage = page(() => import('../academics/BoardObjectivesPage').then((m) => ({ default: m.MatricOutcomesPage })));
const MatriculationPage = page(() => import('./MatriculationPage'));
const IgcseAssessmentsPage = page(() => import('../academics/BoardAssessmentsPage').then((m) => ({ default: m.IgcseAssessmentsPage })));
const MatriculationAssessmentsPage = page(() => import('../academics/BoardAssessmentsPage').then((m) => ({ default: m.MatriculationAssessmentsPage })));
const CbseAssessmentsPage = page(() => import('../academics/BoardAssessmentsPage').then((m) => ({ default: m.CbseAssessmentsPage })));
const CbseOutcomesPage = page(() => import('../academics/BoardObjectivesPage').then((m) => ({ default: m.CbseOutcomesPage })));
const CbseSyllabusPage = page(() => import('./MatricSyllabusPage').then((m) => ({ default: m.CbseSyllabusPage })));
const CbseGradingPage = page(() => import('./MatriculationPage').then((m) => ({ default: m.CbseGradingPage })));

export const routes: AppRoute[] = [
  { path: '/syllabus', perm: ['academics.read'], element: <SyllabusPage /> },
  { path: '/syllabus/:id', perm: ['academics.read'], element: <SyllabusDetailPage /> },
  { path: '/grading', perm: ['academics.read'], element: <IgcseGradingPage /> },
  { path: '/igcse-assessments', perm: ['academics.read'], element: <IgcseAssessmentsPage /> },
  { path: '/matriculation-assessments', perm: ['academics.read'], element: <MatriculationAssessmentsPage /> },
  { path: '/matriculation', perm: ['academics.read'], element: <MatriculationPage /> },
  { path: '/matric-syllabus', perm: ['academics.read'], element: <MatricSyllabusPage /> },
  // A Matriculation syllabus opens in the same detail screen, under its own menu entry.
  { path: '/matric-syllabus/:id', perm: ['academics.read'], element: <SyllabusDetailPage /> },
  { path: '/matric-outcomes', perm: ['academics.read'], element: <MatricOutcomesPage /> },
  { path: '/cbse-outcomes', perm: ['academics.read'], element: <CbseOutcomesPage /> },
  { path: '/cbse-syllabus', perm: ['academics.read'], element: <CbseSyllabusPage /> },
  { path: '/cbse-syllabus/:id', perm: ['academics.read'], element: <SyllabusDetailPage /> },
  { path: '/cbse', perm: ['academics.read'], element: <CbseGradingPage /> },
  { path: '/cbse-assessments', perm: ['academics.read'], element: <CbseAssessmentsPage /> },
];
