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

export function IcseAssessmentsPage() {
  return <AssessmentsPage board="icse" />;
}

export function NiosAssessmentsPage() {
  return <AssessmentsPage board="nios" />;
}

export function IbAssessmentsPage() {
  return <AssessmentsPage board="ib" />;
}
