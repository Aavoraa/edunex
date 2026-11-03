import { Navigate, useSearchParams } from 'react-router-dom';
import { boardInfo, isBoard } from '@/lib/grades';
import GradingPage from './GradingPage';

/** Academics → Cambridge IGCSE → IGCSE Grading (older /grading?board=… links open that board's grading page). */
export default function IgcseGradingPage() {
  const [sp] = useSearchParams();
  const b = sp.get('board');
  if (isBoard(b) && b !== 'igcse') return <Navigate to={boardInfo(b).routes.grading} replace />;
  return <GradingPage only="igcse" />;
}
