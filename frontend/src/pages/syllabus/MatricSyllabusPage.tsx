import SyllabusPage from './SyllabusPage';

/** Academics → Tamil Nadu Matriculation → Matric Syllabus. */
export default function MatricSyllabusPage() {
  return <SyllabusPage board="matriculation" />;
}

/** Academics → CBSE → CBSE Syllabus. */
export function CbseSyllabusPage() {
  return <SyllabusPage board="cbse" />;
}
