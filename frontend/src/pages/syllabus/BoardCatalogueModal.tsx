import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useApiMutation, useApiQuery } from '@/hooks/useApi';
import { Button, Checkbox, Chips, DataTable, ErrorState, FilterSelect, Icon, InlineError, Modal, SearchInput, SelectField, Toolbar } from '@/components/ui';
import { boardInfo, levelLabel, type Board } from '@/lib/grades';
import { BoardDocs, fieldErrors, syllabusBase, type BoardDocGroup } from './shared';

interface BoardCatalogueRow {
  id: string; category: string; subject: string; gradeLevels: number[]; sourcePage: string | null; byGrade: BoardDocGroup[];
  school: { id: string; title: string; gradeLevels: number[]; isActive: boolean }[];
  /** The school subject with the same name, if there is one. */
  schoolSubject: { id: string; name: string; category: string | null } | null;
  /** General category to offer when adding it (Languages, Mathematics …). */
  suggestedCategory: string;
}
interface BoardCatalogue { board: Board; categories: string[]; source: { name: string; url: string }; rows: BoardCatalogueRow[] }

/**
 * The Matriculation (Tamil Nadu State Board textbooks, Std 1–12) or CBSE (curriculum
 * 2026-27, Classes IX–XII) catalogue — database/data/*.csv, migration 128 — with each
 * subject's official documents by standard / class, and adding a subject to the school.
 */
export function BoardCatalogueModal({ board, onClose }: { board: Exclude<Board, 'igcse'>; onClose: () => void }) {
  const { can } = useAuth();
  const info = boardInfo(board);
  const [q, setQ] = useState('');
  const [grade, setGrade] = useState('');
  const [category, setCategory] = useState('');
  const [adding, setAdding] = useState<BoardCatalogueRow | null>(null);
  const cat = useApiQuery<BoardCatalogue>('/syllabus-catalogue', { board, q: q || undefined, grade: grade || undefined, category: category || undefined });
  const grades = info.catalogue?.grades ?? [];
  const word = info.level === 'Std' ? 'standard' : 'class';

  return (
    <Modal open onClose={onClose} size="wide"
      title={info.catalogue?.title ?? `${info.short} catalogue`}
      sub={cat.data
        ? <>From the {cat.data.source.name} — <a href={cat.data.source.url} target="_blank" rel="noopener noreferrer">official page <Icon name="external" size={11} /></a>. Each {word} is linked to its own {board === 'matriculation' ? 'textbooks' : 'syllabus'}.</>
        : `Every ${info.label} subject with its official documents by ${word}.`}
      foot={<Button onClick={onClose}>Close</Button>}>
      <Toolbar>
        <SearchInput value={q} onSearch={setQ} placeholder="Search by subject" />
        <FilterSelect label={info.level === 'Std' ? 'Standard' : 'Class'} value={grade} onChange={setGrade}
          options={grades.map((g) => ({ value: String(g), label: levelLabel(board, g) }))} />
      </Toolbar>
      {cat.data && cat.data.categories.length > 1 && (
        <div className="mb-3">
          <Chips items={[{ id: '', label: 'All' }, ...cat.data.categories.map((c) => ({ id: c, label: c }))]} active={category} onChange={setCategory} />
        </div>
      )}
      {cat.error ? <ErrorState error={cat.error} onRetry={() => cat.refetch()} /> : (
        <DataTable<BoardCatalogueRow>
          rows={cat.data?.rows}
          loading={cat.isLoading}
          rowKey={(r) => r.id}
          emptyText={`No ${info.short} subject matches.`}
          columns={[
            {
              key: 'subject', label: 'Subject', sortable: false, render: (r) => (
                <><span className="t-bold">{r.subject}</span><div className="t-micro t-muted">{r.category}</div></>
              ),
            },
            { key: 'docs', label: `Documents by ${word}`, sortable: false, render: (r) => <BoardDocs compact board={board} byGrade={r.byGrade} /> },
            {
              key: 'a', label: '', sortable: false, className: 'num', render: (r) => {
                const taken = new Set(r.school.flatMap((s) => s.gradeLevels));
                const free = r.gradeLevels.some((g) => !taken.has(g));
                return (
                  <span className="col g-1" style={{ alignItems: 'flex-end' }}>
                    {r.school.map((s) => (
                      <Button key={s.id} size="sm" variant="ghost" iconRight="chevronRight" to={`${syllabusBase(board)}/${s.id}`} title={s.title}>
                        In school · {s.gradeLevels.map((g) => levelLabel(board, g).replace(/^(Std|Class) /, '')).join(', ')}
                      </Button>
                    ))}
                    {free && can('grading.manage') && <Button size="sm" icon="plus" onClick={() => setAdding(r)}>Add</Button>}
                  </span>
                );
              },
            },
          ]}
        />
      )}
      {adding && <AddFromBoardCatalogue board={board} row={adding} onClose={() => setAdding(null)} />}
    </Modal>
  );
}

/** General subject categories — same list as SUBJECT_CATEGORIES in backend/src/services/grading-shared.ts. */
const SUBJECT_CATEGORIES = [
  'Languages', 'Mathematics', 'Science', 'Social Science', 'Environmental & Integrated Studies',
  'Commerce & Accounts', 'Computer Science', 'Arts & Music', 'Physical Education & Health', 'Vocational', 'Other',
];
function AddFromBoardCatalogue({ board, row, onClose }: { board: Exclude<Board, 'igcse'>; row: BoardCatalogueRow; onClose: () => void }) {
  const navigate = useNavigate();
  const info = boardInfo(board);
  const taken = useMemo(() => new Set(row.school.flatMap((s) => s.gradeLevels)), [row]);
  const open = row.gradeLevels.filter((g) => !taken.has(g));
  const [category, setCategory] = useState(row.suggestedCategory);
  const [gradeLevels, setGradeLevels] = useState<number[]>(open.length === 1 ? open : []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const add = useApiMutation<Record<string, unknown>, { id: string }>('post', '/syllabus-catalogue/add', {
    invalidate: ['/syllabuses', '/syllabus-catalogue', '/lookups', '/academics/subjects'], success: `${row.subject} added to the school`, error: false,
    onSuccess: (r) => navigate(`${syllabusBase(board)}/${r.data.id}`),
  });
  useEffect(() => { if (add.error) setErrors(fieldErrors(add.error)); }, [add.error]);
  const toggle = (g: number, on: boolean) => setGradeLevels((x) => (on ? [...x, g].sort((a, b) => a - b) : x.filter((y) => y !== g)));
  const submit = () => {
    const e: Record<string, string> = {};
    if (!category) e.category = 'Choose a subject category';
    if (!gradeLevels.length) e.gradeLevels = `Choose at least one ${info.level === 'Std' ? 'standard' : 'class'}`;
    setErrors(e);
    // The school subject is matched by name: reused when the school has it, otherwise created in this category.
    if (!Object.keys(e).length) add.mutate({ board, catalogueId: row.id, category, gradeLevels });
  };
  return (
    <Modal open onClose={onClose} title={`Add ${row.subject}`} busy={add.isPending}
      sub={`${info.label} · ${row.category}. Units and papers are added afterwards, from the official documents.`}
      foot={<><Button onClick={onClose} disabled={add.isPending}>Cancel</Button><Button variant="primary" onClick={submit} loading={add.isPending}>Add syllabus</Button></>}>
      {add.error && !Object.keys(fieldErrors(add.error)).length && <div className="mb-4"><InlineError error={add.error} /></div>}
      <div className="col g-3">
        <SelectField label="Subject category" required value={category} onChange={setCategory} error={errors.category}
          options={SUBJECT_CATEGORIES.map((c) => ({ value: c, label: c }))}
          hint={row.schoolSubject
            ? `The general category, common to every board. Uses the school subject “${row.schoolSubject.name}”.`
            : `The general category, common to every board. “${row.subject}” is added to the school’s subjects under ${category}.`} />
        <div className="field">
          <span className="label">Taught in <span className="t-critical">*</span></span>
          <div className="row g-4 wrap">
            {row.gradeLevels.map((g) => (
              <Checkbox key={g} checked={gradeLevels.includes(g)} disabled={taken.has(g)} onChange={(on) => toggle(g, on)}
                label={`${levelLabel(board, g)}${taken.has(g) ? ' (in school)' : ''}`} />
            ))}
          </div>
          <span className="t-micro t-muted">
            {info.catalogue?.addHint}
          </span>
          {errors.gradeLevels && <span className="field__error" role="alert">{errors.gradeLevels}</span>}
        </div>
      </div>
    </Modal>
  );
}
