import ObjectivesPage from './ObjectivesPage';

/** Academics → Tamil Nadu Matriculation → Matric Learning Outcomes (Cambridge Objectives is /objectives). */
export function MatricOutcomesPage() {
  return <ObjectivesPage board="matriculation" />;
}

/** Academics → CBSE → CBSE Learning Outcomes. */
export function CbseOutcomesPage() {
  return <ObjectivesPage board="cbse" />;
}
