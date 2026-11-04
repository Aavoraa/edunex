import SyllabusPage from './SyllabusPage';

/** Academics → Tamil Nadu Matriculation → Matric Syllabus. */
export default function MatricSyllabusPage() {
  return <SyllabusPage board="matriculation" />;
}

/** Academics → CBSE → CBSE Syllabus. */
export function CbseSyllabusPage() {
  return <SyllabusPage board="cbse" />;
}

/** Academics → ICSE → ICSE Syllabus. */
export function IcseSyllabusPage() {
  return <SyllabusPage board="icse" />;
}

/** Academics → NIOS → NIOS Syllabus. */
export function NiosSyllabusPage() {
  return <SyllabusPage board="nios" />;
}

/** Academics → IB → IB Syllabus. */
export function IbSyllabusPage() {
  return <SyllabusPage board="ib" />;
}
