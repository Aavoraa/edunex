import GradingPage from './GradingPage';

/** Academics → Tamil Nadu Matriculation → Matric Grading (A1–E2 scale and its classes). */
export default function MatriculationPage() {
  return <GradingPage only="matriculation" />;
}

/** Academics → CBSE → CBSE Grading (A1–E scale and its classes). */
export function CbseGradingPage() {
  return <GradingPage only="cbse" />;
}

/** Academics → ICSE → ICSE Grading (A+–E scale and its classes). */
export function IcseGradingPage() {
  return <GradingPage only="icse" />;
}

/** Academics → NIOS → NIOS Grading (A–E scale and its classes). */
export function NiosGradingPage() {
  return <GradingPage only="nios" />;
}

/** Academics → IB → IB Grading (7–1 scale and its classes). */
export function IbGradingPage() {
  return <GradingPage only="ib" />;
}
