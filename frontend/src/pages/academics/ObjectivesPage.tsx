import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { useApiQuery, usePagedQuery } from '@/hooks/useApi';
import { useListParams } from '@/hooks/useListParams';
import { useLookups } from '@/hooks/useLookups';
import { Button, Card, DataTable, ErrorState, FilterSelect, Meter, Page, PageHead, Pagination, SearchInput, Toolbar } from '@/components/ui';
import { ObjectiveModal, type ObjectiveRow } from './objectiveForms';
import { boardInfo, type Board } from '@/lib/grades';

/** Cambridge objectives (IGCSE board) or Matriculation / CBSE learning outcomes — tracked for coverage and mastery. */
export default function ObjectivesPage({ board = 'igcse' }: { board?: Board } = {}) {
  const { can } = useAuth();
  const { lookups } = useLookups();
  const info = boardInfo(board);
  const matric = board !== 'igcse'; // learning outcomes (Matriculation, CBSE)
  const list = useListParams({ sort: 'code', pageSize: 25 }, ['subjectId', 'stage']);
  const q = usePagedQuery<ObjectiveRow>('/academics/objectives', { ...list.query, board });
  const stages = useApiQuery<string[]>('/academics/objectives/stages', { board }, { staleTime: 300_000 });
  const [editing, setEditing] = useState<ObjectiveRow | 'new' | null>(null);
  const canEdit = can('academics.manage') && can('students.read');

  return (
    <Page>
      <PageHead
        title={matric ? `${info.menu} Learning Outcomes` : 'Cambridge Objectives'}
        sub={matric
          ? `Learning outcomes for each ${info.level === 'Std' ? 'standard' : 'class'} on the ${info.label} board, tracked for coverage and mastery so a gap is visible before the exam is.`
          : 'Each objective is tracked for coverage and for mastery, so a gap is visible before the exam is.'}
        actions={canEdit && <Button variant="primary" icon="plus" onClick={() => setEditing('new')}>{matric ? 'Add outcome' : 'Add objective'}</Button>}
      />
      <Card flush>
        <Toolbar>
          <SearchInput value={list.q} onSearch={list.setQ} placeholder={matric ? 'Search code or outcome' : 'Search code or objective'} />
          <FilterSelect label="Subject" value={list.filters.subjectId} onChange={(v) => list.setFilter('subjectId', v)} options={(lookups?.subjects ?? []).map((s) => ({ value: s.id, label: s.name }))} />
          <FilterSelect label={matric ? (info.level === 'Std' ? 'Standard' : 'Class') : 'Stage'} value={list.filters.stage} onChange={(v) => list.setFilter('stage', v)} options={stages.data ?? []} />
        </Toolbar>
        {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
          <DataTable
            rows={q.data?.rows}
            loading={q.isLoading}
            rowKey={(r) => r.id}
            sort={list.sort}
            onSort={list.setSort}
            emptyText={list.hasFilters ? `No ${matric ? 'outcomes' : 'objectives'} match these filters.` : matric ? (canEdit ? 'No learning outcomes yet. Use “Add outcome”.' : 'No learning outcomes yet.') : canEdit ? 'No objectives mapped yet. Use “Add objective”, or import them from the Curriculum page.' : 'No objectives mapped yet.'}
            columns={[
              { key: 'code', label: 'Code', render: (r) => <span className="t-bold t-num">{r.code}</span> },
              { key: 'text', label: matric ? 'Learning outcome' : 'Objective', render: (r) => <>{r.text}{r.lessonPlans > 0 && <div className="t-micro t-muted">{r.lessonPlans} lesson plan{r.lessonPlans === 1 ? '' : 's'}</div>}</> },
              { key: 'subject', label: 'Subject', render: (r) => r.subject },
              { key: 'stage', label: matric ? (info.level === 'Std' ? 'Standard' : 'Class') : 'Stage', render: (r) => r.stage },
              { key: 'coverage', label: 'Coverage', render: (r) => <Meter label="" value={r.coverage} right={`${r.coverage}%`} tone="info" /> },
              { key: 'mastery', label: 'Mastery', render: (r) => <Meter label="" value={r.mastery} right={`${r.mastery}%`} tone={r.mastery >= 75 ? 'teal' : 'amber'} /> },
              {
                key: 'a', label: '', sortable: false, className: 'num', render: (r) => (
                  <span className="ac-links">
                    {can('ai.use') && <Button size="sm" variant="amber" icon="sparkle" to="/copilot">Practice</Button>}
                    {canEdit && <Button size="sm" icon="edit" onClick={() => setEditing(r)} aria-label={`Edit ${r.code}`}>Edit</Button>}
                  </span>
                ),
              },
            ]}
          />
        )}
        <Pagination meta={q.data?.meta} onPage={list.setPage} onPageSize={list.setPageSize} />
      </Card>
      {editing && <ObjectiveModal board={board} objective={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </Page>
  );
}
