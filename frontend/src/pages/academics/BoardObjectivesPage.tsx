import ObjectivesPage from './ObjectivesPage';

/** Academics → Tamil Nadu Matriculation → Matric Learning Outcomes (Cambridge Objectives is /objectives). */
export function MatricOutcomesPage() {
  return <ObjectivesPage board="matriculation" />;
}

/** Academics → CBSE → CBSE Learning Outcomes. */
export function CbseOutcomesPage() {
  return <ObjectivesPage board="cbse" />;
}

/** Academics → ICSE → ICSE Learning Outcomes. */
export function IcseOutcomesPage() {
  return <ObjectivesPage board="icse" />;
}

/** Academics → NIOS → NIOS Learning Outcomes. */
export function NiosOutcomesPage() {
  return <ObjectivesPage board="nios" />;
}

/** Academics → IB → IB Learning Outcomes. */
export function IbOutcomesPage() {
  return <ObjectivesPage board="ib" />;
}
