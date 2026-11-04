import type { Board } from '@/lib/grades';
import ExamsPage from './ExamsPage';

/** Academics → a board → Paper Correction: that board's examinations only. */
export default function BoardExamsPage({ board }: { board: Board }) {
  return <ExamsPage key={board} board={board} />;
}
