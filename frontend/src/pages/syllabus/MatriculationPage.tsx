import GradingPage from './GradingPage';

/** Academics → Tamil Nadu Matriculation → Matric Grading (A1–E2 scale and its classes). */
export default function MatriculationPage() {
  return <GradingPage only="matriculation" />;
}

/** Academics → CBSE → CBSE Grading (A1–E scale and its classes). */
export function CbseGradingPage() {
  return <GradingPage only="cbse" />;
}
