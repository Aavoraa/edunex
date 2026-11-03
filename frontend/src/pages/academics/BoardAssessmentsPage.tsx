import AssessmentsPage from './AssessmentsPage';

/** Academics → Cambridge IGCSE / Tamil Nadu Matriculation / CBSE → Assessments: one board's assessments. */
export function IgcseAssessmentsPage() {
  return <AssessmentsPage board="igcse" />;
}

export function MatriculationAssessmentsPage() {
  return <AssessmentsPage board="matriculation" />;
}

export function CbseAssessmentsPage() {
  return <AssessmentsPage board="cbse" />;
}
