/**
 * Cambridge IGCSE catalogue: the syllabus document each grade is examined on,
 * linking school syllabuses by code, grade mapping, and adding from the catalogue.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { as } from './helpers.js';
import { one, pool, query } from '../src/config/db.js';

afterAll(() => pool.end());

describe('Cambridge IGCSE catalogue', () => {
  it('lists every Cambridge syllabus with the document for each grade’s exam year', async () => {
    const api = await as('principal');
    const r = await api.get('/api/syllabus-catalogue');
    expect(r.status).toBe(200);
    expect(r.body.data.rows).toHaveLength(104);
    const end = await one<{ y: number }>('SELECT extract(year FROM ends_on)::int AS y FROM academic_years WHERE is_current');
    expect(r.body.data.examYears).toEqual({ 10: end!.y, 9: end!.y + 1 });

    // Each grade gets the newest document that covers its exam year
    const maths = r.body.data.rows.find((x: any) => x.code === '0580');
    for (const g of maths.byGrade) {
      expect(g.examYear).toBe(end!.y + (10 - g.grade));
      if (g.document) expect(g.document.from <= g.examYear && g.examYear <= g.document.to).toBe(true);
    }
    expect(maths.school).not.toBeNull(); // seeded school syllabus with the same code

    const nineOne = await api.get('/api/syllabus-catalogue?grading=9-1');
    expect(nineOne.body.data.rows.length).toBeGreaterThan(0);
    expect(nineOne.body.data.rows.every((x: any) => x.grading === '9-1')).toBe(true);
    expect((await api.get('/api/syllabus-catalogue?q=0625')).body.data.rows.map((x: any) => x.code)).toEqual(['0625']);
  });

  it('links school syllabuses to Cambridge by code, only for the grades that take them', async () => {
    const api = await as('principal');
    const list = (await api.get('/api/syllabuses')).body.data;
    const physics = list.find((s: any) => s.syllabusCode === '0625');
    expect(physics.gradeLevels).toEqual([10]);
    expect(physics.cambridge.byGrade.map((g: any) => g.grade)).toEqual([10]);
    expect(physics.cambridge.subjectPage).toMatch(/^https:\/\/www\.cambridgeinternational\.org\//);
    const school = list.find((s: any) => !s.syllabusCode);
    if (school) expect(school.cambridge).toBeNull();
    // Coverage counts only sections in the syllabus's grades
    const g10 = await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM sections sec JOIN classes c ON c.id = sec.class_id
        WHERE sec.academic_year_id = (SELECT id FROM academic_years WHERE is_current) AND c.grade_level = 10`);
    expect(physics.sections).toBe(g10!.n);
  });

  it('adds an A*–G syllabus from the catalogue and refuses 9–1, duplicates and non-managers', async () => {
    const admin = await as('superadmin');
    await query(`DELETE FROM syllabuses WHERE syllabus_code = '0610'`); // runnable again without a reset
    const sub = await one<{ id: string }>(`SELECT id FROM subjects WHERE code = 'SCI'`);
    const r = await admin.post('/api/syllabus-catalogue/add', { code: '0610', subjectId: sub!.id, gradeLevels: [10, 9], tiered: true });
    expect(r.status).toBe(201);
    const s = (await admin.get(`/api/syllabuses/${r.body.data.id}`)).body.data;
    expect(s).toMatchObject({ syllabusCode: '0610', title: 'Cambridge IGCSE Biology', gradeLevels: [9, 10], tiered: true, grading: 'A*-G' });
    expect(s.cambridge.byGrade).toHaveLength(2);

    const again = await admin.post('/api/syllabus-catalogue/add', { code: '0610', subjectId: sub!.id, gradeLevels: [9] });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('SYLLABUS_CODE_TAKEN');

    const nineOne = await admin.post('/api/syllabus-catalogue/add', { code: '0970', subjectId: sub!.id, gradeLevels: [9, 10] });
    expect(nineOne.status).toBe(409);
    expect(nineOne.body.error).toBe('GRADING_NOT_SUPPORTED');

    expect((await admin.post('/api/syllabus-catalogue/add', { code: '9999', subjectId: sub!.id, gradeLevels: [9] })).status).toBe(404);
    expect((await admin.post('/api/syllabus-catalogue/add', { code: '0620', subjectId: sub!.id, gradeLevels: [11] })).status).toBe(400);
    expect((await (await as('teacher')).post('/api/syllabus-catalogue/add', { code: '0620', subjectId: sub!.id, gradeLevels: [9] })).status).toBe(403);

    // Grades can be changed afterwards
    const upd = await admin.put(`/api/syllabuses/${r.body.data.id}`, { gradeLevels: [10] });
    expect(upd.status).toBe(200);
    expect((await admin.get(`/api/syllabuses/${r.body.data.id}`)).body.data.gradeLevels).toEqual([10]);
  });
});

describe('Matriculation and CBSE catalogues', () => {
  it('lists the Tamil Nadu State Board textbooks by standard, from the official SCERT list', async () => {
    const api = await as('principal');
    const r = await api.get('/api/syllabus-catalogue?board=matriculation');
    expect(r.status).toBe(200);
    const d = r.body.data;
    expect(d.source.url).toBe('https://tnschools.gov.in/scert-textbook');
    expect(d.categories).toEqual(expect.arrayContaining(['Languages', 'Academic', 'Vocational']));
    const maths = d.rows.find((x: any) => x.subject === 'Mathematics');
    expect(maths.gradeLevels).toEqual([6, 7, 8, 9, 10, 11, 12]);
    const std9 = maths.byGrade.find((g: any) => g.grade === 9);
    expect(std9.documents.map((x: any) => x.label).sort()).toEqual(['English medium', 'Tamil medium']);
    expect(std9.documents.every((x: any) => x.url.startsWith('https://d21mc000xink7q.cloudfront.net/scert/textbook/syllabuspdf/'))).toBe(true);
    // The seeded Std IX Mathematics syllabus is linked to it.
    expect(maths.school.map((s: any) => s.title)).toContain('Matriculation Mathematics — Std IX');

    const only9 = (await api.get('/api/syllabus-catalogue?board=matriculation&grade=9')).body.data.rows;
    expect(only9.every((x: any) => x.gradeLevels.includes(9) && x.byGrade.every((g: any) => g.grade === 9))).toBe(true);
    expect(only9.some((x: any) => x.subject === 'Physics')).toBe(false);
  });

  it('lists the CBSE 2026-27 curriculum for Classes IX–XII', async () => {
    const api = await as('teacher');
    const d = (await api.get('/api/syllabus-catalogue?board=cbse&q=mathematics')).body.data;
    expect(d.source.url).toBe('https://cbseacademic.nic.in/curriculum_2027.html');
    const main = d.rows.find((x: any) => x.subject === 'Mathematics' && x.category === 'Main subjects');
    expect(main.gradeLevels).toEqual([9, 10]);
    expect(main.byGrade.map((g: any) => g.documents[0].url)).toEqual([
      'https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Maths_SecP1IX_2026-27.pdf',
      'https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart1/Maths_SecP1X_2026-27.pdf',
    ]);
    expect(d.rows.find((x: any) => x.subject === 'Applied Mathematics').gradeLevels).toEqual([11, 12]);
  });

  it('adds a CBSE subject for chosen classes, linked to its documents', async () => {
    const admin = await as('superadmin');
    const cat = (await admin.get('/api/syllabus-catalogue?board=cbse&q=physics')).body.data.rows.find((x: any) => x.subject === 'Physics');
    const sub = await one<{ id: string }>(`SELECT id FROM subjects WHERE code = 'PHY'`);
    await query(`DELETE FROM syllabuses WHERE board_catalogue_id = $1`, [cat.id]); // runnable again without a reset

    expect((await (await as('teacher')).post('/api/syllabus-catalogue/add', { board: 'cbse', catalogueId: cat.id, category: 'Science', subjectId: sub!.id, gradeLevels: [11, 12] })).status).toBe(403);
    expect((await admin.post('/api/syllabus-catalogue/add', { board: 'cbse', catalogueId: cat.id, category: 'Science', subjectId: sub!.id, gradeLevels: [9] })).status).toBe(400);
    expect((await admin.post('/api/syllabus-catalogue/add', { board: 'matriculation', catalogueId: cat.id, category: 'Science', subjectId: sub!.id, gradeLevels: [11] })).status).toBe(404);

    const r = await admin.post('/api/syllabus-catalogue/add', { board: 'cbse', catalogueId: cat.id, category: 'Science', subjectId: sub!.id, gradeLevels: [12, 11] });
    expect(r.status).toBe(201);
    const s = (await admin.get(`/api/syllabuses/${r.body.data.id}`)).body.data;
    expect(s).toMatchObject({ board: 'cbse', title: 'CBSE Physics — Classes XI–XII', gradeLevels: [11, 12], grading: 'A1-E', tiered: false });
    expect(s.catalogue.byGrade.map((g: any) => g.grade)).toEqual([11, 12]);
    expect(s.catalogue.byGrade[0].documents[0].url).toMatch(/^https:\/\/cbseacademic\.nic\.in\/.*Physics_SecP2_2026-27\.pdf$/);

    const again = await admin.post('/api/syllabus-catalogue/add', { board: 'cbse', catalogueId: cat.id, category: 'Science', subjectId: sub!.id, gradeLevels: [12] });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('SYLLABUS_EXISTS');
    const listed = (await admin.get('/api/syllabus-catalogue?board=cbse&q=physics')).body.data.rows.find((x: any) => x.id === cat.id);
    expect(listed.school.map((x: any) => x.id)).toEqual([r.body.data.id]);
  });

  it('suggests a general subject category and reuses or creates the school subject', async () => {
    const admin = await as('superadmin');
    const rows = (await admin.get('/api/syllabus-catalogue?board=matriculation')).body.data.rows;
    const byName = (n: string) => rows.find((x: any) => x.subject === n);
    expect(byName('Tamil & English').suggestedCategory).toBe('Languages');
    expect(byName('Maths & EVS').suggestedCategory).toBe('Environmental & Integrated Studies');
    expect(byName('Bio-Botany').suggestedCategory).toBe('Science');
    expect(byName('Accountancy').suggestedCategory).toBe('Commerce & Accounts');
    expect(byName('Basic Civil Engineering').suggestedCategory).toBe('Vocational');
    // Mathematics matches the existing school subject.
    expect(byName('Mathematics').schoolSubject).toMatchObject({ name: 'Mathematics', category: 'Mathematics' });

    const te = byName('Tamil & English');
    await query(`DELETE FROM syllabuses WHERE board_catalogue_id = $1`, [te.id]);
    await query(`DELETE FROM subjects WHERE name = 'Tamil & English' AND NOT EXISTS (SELECT 1 FROM syllabuses s WHERE s.subject_id = subjects.id)`);
    expect((await admin.post('/api/syllabus-catalogue/add', { board: 'matriculation', catalogueId: te.id, gradeLevels: [6] })).status).toBe(400); // category required

    const first = await admin.post('/api/syllabus-catalogue/add', { board: 'matriculation', catalogueId: te.id, category: 'Languages', gradeLevels: [6] });
    expect(first.status).toBe(201);
    const subject = await one<{ id: string; code: string; category: string; is_core: boolean }>(`SELECT id, code, category, is_core FROM subjects WHERE name = 'Tamil & English'`);
    expect(subject).toMatchObject({ code: 'TE', category: 'Languages', is_core: true });
    const s1 = (await admin.get(`/api/syllabuses/${first.body.data.id}`)).body.data;
    expect(s1).toMatchObject({ title: 'Matriculation Tamil & English — Std VI', subjectId: subject!.id, gradeLevels: [6] });

    // A second standard reuses the same school subject.
    const second = await admin.post('/api/syllabus-catalogue/add', { board: 'matriculation', catalogueId: te.id, category: 'Languages', gradeLevels: [7] });
    expect(second.status).toBe(201);
    expect((await admin.get(`/api/syllabuses/${second.body.data.id}`)).body.data.subjectId).toBe(subject!.id);
    expect((await one<{ n: number }>(`SELECT count(*)::int AS n FROM subjects WHERE name = 'Tamil & English'`))!.n).toBe(1);
    // The new subject shows up in the lookups with its category.
    const lookups = (await admin.get('/api/lookups')).body.data;
    expect(lookups.subjects.find((x: any) => x.id === subject!.id).category).toBe('Languages');
  });

  it('shows the official textbooks on a linked Matriculation syllabus', async () => {
    const api = await as('principal');
    const list = (await api.get('/api/syllabuses?board=matriculation')).body.data;
    const sci9 = list.find((x: any) => x.title === 'Matriculation Science — Std IX');
    expect(sci9.catalogue).toMatchObject({ subject: 'Science', sourcePage: 'https://tnschools.gov.in/scert-textbook' });
    expect(sci9.catalogue.byGrade).toHaveLength(1);
    expect(sci9.catalogue.byGrade[0].grade).toBe(9);
  });
});
