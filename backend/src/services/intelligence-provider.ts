/**
 * Intelligence provider — the single seam between Edunex and any text-generation engine.
 *
 * No language model is configured. The default provider is a transparent, deterministic
 * TEMPLATE DRAFT GENERATOR: it assembles drafts only from facts the service has already
 * read from the database (learning objectives, the approved question bank, class marks,
 * attendance, coverage) using fixed, reviewable templates. The same facts always produce
 * the same draft, and every draft lists the records it was built from.
 *
 * To plug in a model later, implement `IntelligenceProvider` and select it with the
 * environment variable `AI_PROVIDER` (e.g. `AI_PROVIDER=template` — the only value
 * recognised today). A model provider would read its own credentials (for example
 * `AI_PROVIDER_API_KEY`, `AI_PROVIDER_MODEL`) inside its module. Whatever the provider,
 * callers still store the result in `ai_drafts` and enforce Review → Edit → Approve.
 */
import type { DraftType } from '../validators/intelligence.validators.js';

// ---------------------------------------------------------------------------
// Facts (inputs) — gathered by intelligence-copilot.service.ts
// ---------------------------------------------------------------------------
export interface QuestionFact { id: string; question: string; type: string; difficulty: string; marks: number; topic: string }
export interface ObjectiveFact { id: string; code: string; description: string; coverage: number; mastery: number }
export interface ClassStatsFact { label: string; term: string | null; average: number | null; below60: number; students: number }

interface BaseFacts { grade: number; subject: string; topic: string; classLabel: string | null }

export interface LessonFacts extends BaseFacts { minutes: number; objective: ObjectiveFact | null; questions: QuestionFact[]; stats: ClassStatsFact | null }
export interface WorksheetFacts extends BaseFacts { objective: ObjectiveFact | null; questions: QuestionFact[] }
export interface QuizFacts extends BaseFacts { questions: QuestionFact[] }
export interface CommentFacts extends BaseFacts {
  term: string | null;
  students: { id: string; name: string; firstName: string; admissionNo: string; subjectScore: number | null; subjectTrend: number | null; average: number | null; attendance: number | null; strength: string | null; positives: number }[];
}
export interface MessageFacts extends BaseFacts {
  purpose: 'attendance' | 'homework' | 'progress' | 'general';
  teacherName: string;
  student: { id: string; name: string; firstName: string; admissionNo: string; parentName: string | null; channel: string | null };
  attendance: { absent30: number; late30: number; pct: number | null; lastAbsences: string[] };
  subjectScore: number | null; subjectTrend: number | null;
  homework: { title: string; dueOn: string; submitted: boolean | null }[];
}
export interface BriefFacts extends BaseFacts {
  weekFrom: string; weekTo: string;
  objectives: ObjectiveFact[];
  attendance: { pct: number | null; absences: number; lates: number; marked: number };
  watch: { id: string; name: string; reason: string }[];
  termAverage: number | null; termTrend: number | null;
  lessonPlans: { title: string; plannedFor: string | null; status: string }[];
}

export type FactsFor = {
  lesson: LessonFacts; worksheet: WorksheetFacts; quiz: QuizFacts; comment: CommentFacts; message: MessageFacts; brief: BriefFacts;
};

export interface DraftOutput {
  title: string;
  generator: { provider: string; kind: 'template' | 'model'; version: string };
  sources: { label: string; detail: string }[];
  warnings: string[];
  [key: string]: unknown;
}

export interface IntelligenceProvider {
  readonly name: string;
  readonly kind: 'template' | 'model';
  readonly description: string;
  generate<T extends DraftType>(type: T, facts: FactsFor[T]): Promise<DraftOutput>;
}

// ---------------------------------------------------------------------------
// Template provider
// ---------------------------------------------------------------------------
const VERSION = 'template-1.0';
const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Topic phrasing library. Unknown topics fall back to neutral wording that names the topic. */
const TOPIC_LIBRARY: Record<string, { starter: string; model: string; manipulative: string; misconception: string; realLife: string }> = {
  fractions: {
    starter: 'Quick fire: name three fractions equivalent to one half. Collect them on the board.',
    model: 'Model comparing 3/5 and 5/8 using a common denominator, then model the benchmark-of-one-half method.',
    manipulative: 'Ordering cards (physical fraction strips)',
    misconception: 'a larger denominator always means a larger fraction',
    realLife: 'comparing fractions (recipes, sharing, distances)',
  },
  decimals: {
    starter: 'Quick fire: place 0.5, 0.25 and 0.75 on a number line from 0 to 1.',
    model: 'Model comparing 0.45 and 0.5 using place-value columns, then by converting to hundredths.',
    manipulative: 'Place-value counters and decimal grids',
    misconception: 'a decimal with more digits is always larger',
    realLife: 'reading prices and measurements',
  },
  'area and perimeter': {
    starter: 'Quick fire: sketch two different rectangles with a perimeter of 12 cm.',
    model: 'Model finding area by counting squares, then by multiplying length by width; contrast with perimeter.',
    manipulative: 'Squared paper and 1 cm tiles',
    misconception: 'shapes with the same perimeter have the same area',
    realLife: 'measuring a room or garden plot',
  },
  'data handling': {
    starter: 'Quick fire: tally the class\'s favourite sport from a show of hands.',
    model: 'Model turning a tally chart into a bar chart, then reading the mode and range from it.',
    manipulative: 'Class survey data on sticky notes',
    misconception: 'the tallest bar is always the mean',
    realLife: 'reading a chart from the news or a school report',
  },
};

function topicPack(topic: string) {
  const t = TOPIC_LIBRARY[topic.trim().toLowerCase()];
  return t ?? {
    starter: `Quick fire: three recall questions on the prerequisite knowledge for ${topic}.`,
    model: `Model two worked examples on ${topic}, thinking aloud at each step.`,
    manipulative: `Concrete materials or visual models for ${topic}`,
    misconception: `the most common error seen in earlier ${topic} work`,
    realLife: `${topic} in everyday life`,
  };
}

function planSteps(minutes: number, topic: string) {
  const p = topicPack(topic);
  const cuts: Record<number, number[]> = { 40: [0, 5, 15, 30, 38, 40], 60: [0, 5, 20, 38, 54, 60], 80: [0, 8, 25, 45, 70, 80] };
  const c = cuts[minutes] ?? cuts[40];
  const range = (i: number) => `${c[i]}–${c[i + 1]} min`;
  return [
    { time: range(0), step: 'Recall starter', detail: p.starter },
    { time: range(1), step: 'Guided instruction', detail: p.model },
    { time: range(2), step: 'Paired practice', detail: `${p.manipulative}. Pairs justify each answer to each other before recording it.` },
    { time: range(3), step: 'Differentiated task', detail: 'Foundation, core and extension sets issued from the worksheet (see below).' },
    { time: range(4), step: 'Exit ticket', detail: 'Two short questions with a one-line explanation each; collect to plan the next lesson.' },
  ];
}

const pickQuestions = (qs: QuestionFact[], n: number, difficulty?: string) =>
  qs.filter((q) => !difficulty || q.difficulty === difficulty).slice(0, n);

class TemplateProvider implements IntelligenceProvider {
  readonly name = 'template';
  readonly kind = 'template' as const;
  readonly description = 'Deterministic template draft generator. Builds drafts only from school records using fixed templates; no language model is called.';

  private meta() {
    return { provider: this.name, kind: this.kind, version: VERSION };
  }

  async generate<T extends DraftType>(type: T, facts: FactsFor[T]): Promise<DraftOutput> {
    switch (type) {
      case 'lesson': return this.lesson(facts as LessonFacts);
      case 'worksheet': return this.worksheet(facts as WorksheetFacts);
      case 'quiz': return this.quiz(facts as QuizFacts);
      case 'comment': return this.comments(facts as CommentFacts);
      case 'message': return this.message(facts as MessageFacts);
      default: return this.brief(facts as BriefFacts);
    }
  }

  private lesson(f: LessonFacts): DraftOutput {
    const p = topicPack(f.topic);
    const warnings: string[] = [];
    const sources: DraftOutput['sources'] = [];
    let objective: string;
    if (f.objective) {
      objective = `${f.objective.description} (Cambridge ${f.objective.code})`;
      sources.push({ label: `Learning objective ${f.objective.code}`, detail: `Coverage ${f.objective.coverage}% · mastery ${f.objective.mastery}%` });
    } else {
      objective = `Students develop and explain their understanding of ${f.topic.toLowerCase()} in Grade ${f.grade} ${f.subject}.`;
      warnings.push(`No approved learning objective matches "${f.topic}" for Grade ${f.grade} ${f.subject}. Link an objective code before approving.`);
    }
    const quiz = pickQuestions(f.questions, 4).map((q) => ({ q: q.question, marks: q.marks, questionId: q.id }));
    if (quiz.length) sources.push({ label: 'Approved question bank', detail: `${quiz.length} of ${f.questions.length} items on ${f.topic}` });
    else warnings.push('The approved question bank has no items for this topic, so the exit quiz is empty. Add questions before publishing.');
    if (f.stats?.average != null) {
      sources.push({ label: `${f.stats.label} results`, detail: `${f.stats.term ?? 'Latest term'} average ${f.stats.average}, ${f.stats.below60} of ${f.stats.students} students below 60` });
    }
    const support = f.stats && f.stats.below60 > 0
      ? `${f.stats.below60} student${f.stats.below60 === 1 ? '' : 's'} scored below 60 last term — seat them for the foundation set and check in during paired practice.`
      : null;
    return {
      title: `Grade ${f.grade} · ${f.subject} · ${f.topic}`,
      generator: this.meta(),
      objective,
      objectiveCode: f.objective?.code ?? null,
      lessonMinutes: f.minutes,
      plan: planSteps(f.minutes, f.topic),
      activities: [p.manipulative, 'Number line or visual placement on the board', 'Think-pair-share justification'],
      differentiated: [
        { level: 'Foundation', detail: `6 short items on ${f.topic.toLowerCase()} with a worked example at the top.${support ? ' ' + support : ''}` },
        { level: 'Core', detail: `8 items including 2 that ask students to explain their method.` },
        { level: 'Extension', detail: `4 problems set in context (${p.realLife}) plus one "explain the error" task on the misconception that ${p.misconception}.` },
      ],
      quiz,
      homework: `Worksheet on ${f.topic.toLowerCase()}, core items 1–8. Extension students attempt the context problems and bring one real-life example of ${p.realLife}.`,
      sources,
      warnings,
    };
  }

  private worksheet(f: WorksheetFacts): DraftOutput {
    const warnings: string[] = [];
    const levels = [
      { level: 'Foundation', difficulty: 'Foundation', n: 6, instructions: 'Work through each item. A worked example is given for the first one.' },
      { level: 'Core', difficulty: 'Core', n: 8, instructions: 'Show your working. Explain your method for the last two items.' },
      { level: 'Extension', difficulty: 'Higher', n: 4, instructions: 'Solve each problem and write one sentence explaining your reasoning.' },
    ];
    const sections = levels.map((l) => {
      const items = pickQuestions(f.questions, l.n, l.difficulty).map((q) => ({ q: q.question, marks: q.marks, questionId: q.id }));
      if (!items.length) warnings.push(`No approved ${l.difficulty} items for ${f.topic}; the ${l.level} section needs questions before approval.`);
      return { level: l.level, instructions: l.instructions, items };
    });
    const used = sections.reduce((a, s) => a + s.items.length, 0);
    return {
      title: `Worksheet — ${f.topic} (Grade ${f.grade} ${f.subject})`,
      generator: this.meta(),
      objective: f.objective ? `${f.objective.description} (${f.objective.code})` : null,
      sections,
      sources: [
        ...(f.objective ? [{ label: `Learning objective ${f.objective.code}`, detail: f.objective.description }] : []),
        { label: 'Approved question bank', detail: `${used} items used from ${f.questions.length} available on ${f.topic}` },
      ],
      warnings,
    };
  }

  private quiz(f: QuizFacts): DraftOutput {
    const order = ['Foundation', 'Core', 'Higher'];
    const qs = [...f.questions].sort((a, b) => order.indexOf(a.difficulty) - order.indexOf(b.difficulty)).slice(0, 10);
    const total = qs.reduce((a, q) => a + q.marks, 0);
    return {
      title: `Quiz — ${f.topic} (Grade ${f.grade} ${f.subject})`,
      generator: this.meta(),
      questions: qs.map((q, i) => ({ n: i + 1, q: q.question, marks: q.marks, difficulty: q.difficulty, type: q.type, questionId: q.id })),
      totalMarks: total,
      durationMinutes: Math.max(10, Math.round(total * 1.5)),
      sources: [{ label: 'Approved question bank', detail: `${qs.length} items, easiest first, ${total} marks` }],
      warnings: qs.length < 5 ? ['Fewer than five approved items exist for this topic; consider adding more before using this quiz.'] : [],
    };
  }

  private comments(f: CommentFacts): DraftOutput {
    const comments = f.students.map((s) => {
      const parts: string[] = [];
      if (s.subjectScore != null) {
        const band = s.subjectScore >= 80 ? 'is working securely above the expected standard' : s.subjectScore >= 65 ? 'is working at the expected standard' : 'is still building confidence';
        parts.push(`${s.firstName} ${band} in ${f.subject} (${s.subjectScore}${s.subjectTrend != null && s.subjectTrend !== 0 ? `, ${sign(s.subjectTrend)} on last term` : ''}).`);
      } else {
        parts.push(`${s.firstName} has no ${f.subject} result recorded for this term yet.`);
      }
      if (s.subjectTrend != null && s.subjectTrend >= 3) parts.push('The steady improvement this term reflects consistent effort.');
      if (s.subjectTrend != null && s.subjectTrend <= -3) parts.push(`A short period of focused practice on ${f.topic.toLowerCase()} would help recover recent ground.`);
      if (s.strength) parts.push(`${s.firstName} shows particular strength in ${s.strength.toLowerCase()}.`);
      if (s.positives > 0) parts.push(`${s.positives} positive note${s.positives > 1 ? 's' : ''} this term recognise ${s.firstName}'s contribution to class.`);
      if (s.attendance != null && s.attendance < 85) parts.push(`Improving attendance (currently ${s.attendance}%) will help ${s.firstName} keep pace.`);
      parts.push(`Next step: ${s.subjectScore != null && s.subjectScore >= 80 ? 'take on extension problems that ask for explanation and proof' : 'practise the core skills regularly and ask for help early'}.`);
      return { studentId: s.id, studentName: s.name, admissionNo: s.admissionNo, subjectScore: s.subjectScore, trend: s.subjectTrend, attendance: s.attendance, comment: parts.join(' ') };
    });
    return {
      title: `Report comments — ${f.subject}, ${f.classLabel ?? `Grade ${f.grade}`} (${comments.length} students)`,
      generator: this.meta(),
      term: f.term,
      comments,
      sources: [
        { label: `${f.subject} term records`, detail: `${f.term ?? 'Latest term'} score and change on the previous term` },
        { label: 'Attendance register', detail: 'Current academic year' },
        { label: 'Behaviour notes and skills', detail: 'Positive notes this term; highest-rated skill' },
      ],
      warnings: comments.length ? [] : ['No students were found in this section.'],
    };
  }

  private message(f: MessageFacts): DraftOutput {
    const s = f.student;
    const greet = `Dear ${s.parentName ?? 'Parent'},`;
    let subject: string;
    let body: string[];
    const facts: string[] = [];
    if (f.purpose === 'attendance') {
      subject = `${s.firstName}'s attendance`;
      facts.push(`${f.attendance.absent30} absence(s) and ${f.attendance.late30} late arrival(s) in the last 30 days`);
      if (f.attendance.pct != null) facts.push(`${f.attendance.pct}% attendance this academic year`);
      body = [
        greet,
        `I am writing about ${s.firstName}'s attendance. In the last 30 days ${s.firstName} has been absent ${f.attendance.absent30} time(s)` +
          (f.attendance.lastAbsences.length ? ` (most recently on ${f.attendance.lastAbsences.join(', ')})` : '') +
          ` and late ${f.attendance.late30} time(s).`,
        f.attendance.pct != null ? `Attendance for the year so far is ${f.attendance.pct}%.` : '',
        `Regular attendance makes a real difference to learning. If there is anything we should know, or anything we can help with, please reply to this message or book a time to speak with me.`,
      ];
    } else if (f.purpose === 'homework') {
      subject = `${s.firstName}'s ${f.subject} homework`;
      const missing = f.homework.filter((h) => h.submitted === false);
      facts.push(`${missing.length} of ${f.homework.length} recent ${f.subject} homework task(s) not submitted`);
      body = [
        greet,
        missing.length
          ? `A quick note that ${s.firstName} has not yet submitted ${missing.length} recent ${f.subject} homework task(s): ${missing.map((h) => `${h.title} (due ${h.dueOn})`).join('; ')}.`
          : `A reminder that ${s.firstName} has ${f.subject} homework on ${f.topic.toLowerCase()} this week.`,
        `A few minutes of practice at home each day on ${f.topic.toLowerCase()} will help. Please encourage ${s.firstName} to ask me if anything is unclear.`,
      ];
    } else if (f.purpose === 'progress') {
      subject = `${s.firstName}'s progress in ${f.subject}`;
      if (f.subjectScore != null) facts.push(`${f.subject} score ${f.subjectScore}${f.subjectTrend != null ? ` (${sign(f.subjectTrend)} on last term)` : ''}`);
      body = [
        greet,
        f.subjectScore != null
          ? `${s.firstName}'s latest ${f.subject} result is ${f.subjectScore}${f.subjectTrend != null && f.subjectTrend !== 0 ? `, ${f.subjectTrend > 0 ? 'up' : 'down'} ${Math.abs(f.subjectTrend)} points on last term` : ''}.`
          : `I would like to share an update on ${s.firstName}'s work in ${f.subject}.`,
        f.subjectTrend != null && f.subjectTrend < 0
          ? `We are currently working on ${f.topic.toLowerCase()}, and some extra practice at home would help ${s.firstName} regain confidence.`
          : `We are currently working on ${f.topic.toLowerCase()}, and ${s.firstName} is making good progress.`,
        `I am happy to discuss this at the next parent–teacher meeting or before then if you prefer.`,
      ];
    } else {
      subject = `An update from ${f.subject}`;
      body = [greet, `This week in ${f.subject} we are working on ${f.topic.toLowerCase()}. Please ask ${s.firstName} to tell you one thing they learned.`];
    }
    body.push(`Warm regards,\n${f.teacherName}\nEdunex International School`);
    return {
      title: `Parent message — ${subject}`,
      generator: this.meta(),
      recipient: { parentName: s.parentName, channel: s.channel ?? 'whatsapp', studentName: s.name, admissionNo: s.admissionNo },
      purpose: f.purpose,
      subject,
      body: body.filter(Boolean).join('\n\n'),
      facts,
      toneCheck: { result: 'Neutral and supportive', rules: ['No labels or risk bands', 'No comparison with other children', 'Offers a way to respond'] },
      translation: { available: false, note: 'Tamil and Hindi versions need a language provider (not configured). Translate manually before sending if required.' },
      sources: [
        { label: 'Attendance register', detail: 'Last 30 days and academic year to date' },
        ...(f.subjectScore != null ? [{ label: `${f.subject} term records`, detail: 'Latest term and change' }] : []),
        ...(f.homework.length ? [{ label: 'Homework records', detail: `${f.homework.length} recent task(s)` }] : []),
      ],
      warnings: s.parentName ? [] : ['No guardian is linked to this student; add one before sending.'],
    };
  }

  private brief(f: BriefFacts): DraftOutput {
    const withData = f.objectives.filter((o) => o.coverage > 0 || o.mastery > 0);
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
    const coverage = avg(withData.map((o) => o.coverage));
    const mastery = avg(withData.map((o) => o.mastery));
    const gaps = f.objectives.filter((o) => o.coverage >= 50 && o.mastery < 60).sort((a, b) => a.mastery - b.mastery).slice(0, 5);
    const highlights: string[] = [];
    if (f.attendance.pct != null) highlights.push(`Attendance this week: ${f.attendance.pct}% (${f.attendance.absences} absences, ${f.attendance.lates} late arrivals).`);
    if (f.termAverage != null) highlights.push(`${f.subject} term average: ${f.termAverage}${f.termTrend != null ? ` (${sign(f.termTrend)} on last term)` : ''}.`);
    if (coverage != null) highlights.push(`Curriculum coverage ${coverage}% against mastery ${mastery}% across ${withData.length} objectives.`);
    const approved = f.lessonPlans.filter((l) => l.status === 'Approved').length;
    if (f.lessonPlans.length) highlights.push(`${approved} of ${f.lessonPlans.length} lesson plans for this class are approved.`);
    const nextSteps = [
      ...gaps.slice(0, 2).map((g) => `Re-teach ${g.code} (${g.description.toLowerCase()}) — mastery ${g.mastery}%.`),
      ...(f.watch.length ? [`Check in with ${f.watch.slice(0, 3).map((w) => w.name.split(' ')[0]).join(', ')} this week.`] : []),
      ...(f.attendance.absences > 3 ? ['Follow up on this week\'s absences with families.'] : []),
    ];
    return {
      title: `Weekly class brief — ${f.classLabel ?? `Grade ${f.grade}`} ${f.subject} (${f.weekFrom} to ${f.weekTo})`,
      generator: this.meta(),
      period: { from: f.weekFrom, to: f.weekTo },
      highlights,
      coverage: { objectives: f.objectives.length, averageCoverage: coverage, averageMastery: mastery },
      gaps: gaps.map((g) => ({ code: g.code, description: g.description, coverage: g.coverage, mastery: g.mastery })),
      watch: f.watch,
      nextSteps: nextSteps.length ? nextSteps : ['No gaps or concerns detected this week — continue the planned sequence.'],
      sources: [
        { label: 'Attendance register', detail: `${f.attendance.marked} marks, ${f.weekFrom} to ${f.weekTo}` },
        { label: 'Learning objectives', detail: `${f.objectives.length} objectives for Grade ${f.grade} ${f.subject}` },
        { label: 'Early Warning and term records', detail: `${f.watch.length} students flagged` },
      ],
      warnings: f.objectives.length ? [] : [`No learning objectives are recorded for Grade ${f.grade} ${f.subject}, so coverage and gaps are unavailable.`],
    };
  }
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------
const PROVIDERS: Record<string, () => IntelligenceProvider> = {
  template: () => new TemplateProvider(),
};

let cached: IntelligenceProvider | null = null;

/** The configured provider (`AI_PROVIDER`, default `template`). Unknown values fall back to the template provider. */
export function getProvider(): IntelligenceProvider {
  if (cached) return cached;
  const key = (process.env.AI_PROVIDER ?? 'template').trim().toLowerCase();
  cached = (PROVIDERS[key] ?? PROVIDERS.template)();
  return cached;
}

export function providerInfo() {
  const p = getProvider();
  const requested = (process.env.AI_PROVIDER ?? 'template').trim().toLowerCase();
  return {
    name: p.name,
    kind: p.kind,
    description: p.description,
    envVar: 'AI_PROVIDER',
    requested,
    fallback: requested !== p.name,
    modelConfigured: p.kind === 'model',
  };
}
