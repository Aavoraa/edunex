import type { Request } from 'express';
import { many, one } from '../config/db.js';
import type { AuthUser } from '../types.js';
import { audit } from './audit.service.js';
import { notifyRoles } from './notification.service.js';

/**
 * School Knowledge AI — retrieval only. Answers are extracted verbatim from approved
 * knowledge_documents the asker's role may read (audience array), ranked by keyword,
 * title and body matches. Nothing is generated; when nothing relevant is found the
 * service says so. One live-data intent (admissions by source this month) is computed
 * from the enquiries table for users who may read admissions.
 */

const STOP = new Set(('a an and are as at be by can do does for from has have how i in is it me my of on or our please show '
  + 'tell that the their there this to us was we what when where which who why will with you your should would could about '
  + 'any get give need there these those than then into over under per list school edunex next know find out').split(' '));

export function terms(question: string) {
  const words = question.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
  const stems = words.map((w) => (w.length > 5 ? w.replace(/(ing|ed|es|s)$/, '') : w.replace(/s$/, '')));
  return [...new Set(stems)].filter((w) => /^[a-z0-9]{3,30}$/.test(w)).slice(0, 12);
}

function paragraphScore(p: string, ts: string[]) {
  const low = p.toLowerCase();
  return ts.filter((t) => low.includes(t));
}

const LIVE_ADMISSIONS = (q: string) => /(admission|enquir|lead)/i.test(q) && /(source|channel|where .*from|by source|mix)/i.test(q);

async function liveAdmissions(user: AuthUser, campusId?: string) {
  if (!user.permissions.has('admissions.read')) {
    return {
      found: false, kind: 'live', restricted: true,
      answer: 'Admissions figures come from the live Admissions CRM, which your role is not permitted to read. Please ask the admissions office.',
      confidence: 'High', sources: [], excerpts: [],
    };
  }
  const params = campusId ? [campusId] : [];
  const campus = campusId ? 'AND e.campus_id = $1' : '';
  const [bySource, enrolled, month] = await Promise.all([
    many(`SELECT e.source AS label, count(*)::int AS value FROM enquiries e
           WHERE e.deleted_at IS NULL AND e.created_at >= date_trunc('month', now()) ${campus}
           GROUP BY e.source ORDER BY 2 DESC, 1`, params),
    many(`SELECT e.source AS label, count(DISTINCT e.id)::int AS value
            FROM enquiry_stage_history h JOIN enquiries e ON e.id = h.enquiry_id
           WHERE h.to_stage = 'Enrolled' AND h.changed_at >= date_trunc('month', now()) AND e.deleted_at IS NULL ${campus}
           GROUP BY e.source ORDER BY 2 DESC`, params),
    one(`SELECT to_char(now(), 'FMMonth YYYY') AS label, now() AS at`),
  ]);
  const total = bySource.reduce((a, r) => a + r.value, 0);
  const admitted = enrolled.reduce((a, r) => a + r.value, 0);
  const answer = total
    ? `${month!.label} to date: ${total} enquir${total === 1 ? 'y' : 'ies'}. ${bySource.map((r) => `${r.label} ${r.value}`).join(', ')}. `
      + (admitted
        ? `${admitted} admission${admitted === 1 ? '' : 's'} confirmed so far this month${enrolled[0] ? `, ${enrolled[0].value} of them from ${enrolled[0].label}` : ''}.`
        : 'No admissions have been confirmed yet this month.')
    : `No enquiries have been recorded in ${month!.label} so far.`;
  return {
    found: true, kind: 'live', answer, confidence: 'High',
    chart: bySource,
    sources: [{ id: null, doc: 'Admissions CRM', section: 'Live record — enquiries and stage history', updated: month!.at, live: true }],
    excerpts: [],
  };
}

export async function ask(req: Request, question: string, campusId?: string) {
  const user = req.user!;
  const ts = terms(question);
  let result: Record<string, unknown>;

  if (LIVE_ADMISSIONS(question)) {
    result = await liveAdmissions(user, campusId);
  } else if (!ts.length) {
    result = { found: false, kind: 'documents', answer: 'Please ask a more specific question — for example, "What is the procedure for student leave?"', confidence: 'Low', sources: [], excerpts: [] };
  } else {
    const docs = await many(
      `SELECT d.id, d.title, d.section, d.body, d.keywords, d.source_updated_on AS updated, d.audience,
              (SELECT count(*) FROM unnest($1::text[]) t WHERE EXISTS (SELECT 1 FROM unnest(d.keywords) k WHERE lower(k) LIKE '%' || t || '%'))::int AS kw,
              (SELECT count(*) FROM unnest($1::text[]) t WHERE lower(d.title || ' ' || COALESCE(d.section, '')) LIKE '%' || t || '%')::int AS ti,
              (SELECT count(*) FROM unnest($1::text[]) t WHERE lower(d.body) LIKE '%' || t || '%')::int AS bo
         FROM knowledge_documents d
        WHERE d.is_approved AND (cardinality(d.audience) = 0 OR $2 = ANY(d.audience))`,
      [ts, user.roleKey]);
    const ranked = docs
      .map((d) => ({ ...d, score: d.kw * 3 + d.ti * 2 + d.bo, matchedMeta: ts.filter((t) => d.keywords.some((k: string) => k.toLowerCase().includes(t)) || `${d.title} ${d.section ?? ''}`.toLowerCase().includes(t)) }))
      .filter((d) => d.score >= 2 && d.bo > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    // Keep only documents reasonably close to the best match.
    const cutoff = (ranked[0]?.score ?? 0) * 0.5;
    const close = ranked.filter((d) => d.score >= cutoff);

    const excerpts = close.map((d) => {
      const paras = String(d.body).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
      const scored = paras.map((p, i) => ({ p, i, hits: paragraphScore(p, ts) })).sort((a, b) => b.hits.length - a.hits.length || a.i - b.i);
      return { doc: d, best: scored[0], second: scored[1] };
    }).filter((e) => e.best && e.best.hits.length > 0);

    if (!excerpts.length) {
      result = {
        found: false, kind: 'documents', confidence: 'Low', sources: [], excerpts: [],
        answer: 'I could not find this in the approved school documents available to your role. Nothing has been guessed — please ask the front office or the document owner.',
      };
    } else {
      const top = excerpts[0];
      const parts = [top.best.p];
      // Terms matched by the answer text, or by the top document's curated keywords / title.
      const used = new Set([...top.best.hits, ...top.doc.matchedMeta]);
      if (top.second && top.second.hits.some((h) => !used.has(h)) && top.second.hits.length >= 2) {
        parts.push(top.second.p);
        top.second.hits.forEach((h) => used.add(h));
      }
      const secondDoc = excerpts[1];
      if (secondDoc && secondDoc.best.hits.some((h) => !used.has(h)) && secondDoc.best.hits.length >= 2) {
        parts.push(secondDoc.best.p);
        secondDoc.best.hits.forEach((h) => used.add(h));
      }
      const coverage = used.size / ts.length;
      const confidence = coverage >= 0.6 && top.doc.kw > 0 ? 'High' : coverage >= 0.34 ? 'Medium' : 'Low';
      result = {
        found: true, kind: 'documents',
        answer: parts.join('\n\n'),
        confidence,
        coverage: Math.round(coverage * 100),
        matchedTerms: [...used],
        sources: excerpts.map((e) => ({ id: e.doc.id, doc: e.doc.title, section: e.doc.section, updated: e.doc.updated, score: e.doc.score })),
        excerpts: excerpts.map((e) => ({ documentId: e.doc.id, doc: e.doc.title, section: e.doc.section, text: e.best.p, matched: e.best.hits })),
      };
    }
  }

  const sources = (result.sources as { doc: string }[]) ?? [];
  await audit(req, {
    action: 'ask', module: 'knowledge', entityType: 'knowledge_question',
    description: `Knowledge AI question${result.found ? ` answered from ${sources[0]?.doc ?? 'records'}` : ' — no answer found'}`,
    metadata: { question, terms: ts, found: result.found, confidence: result.confidence, topic: sources[0]?.doc ?? null, kind: result.kind },
  });
  return { question, terms: ts, ...result, method: 'Keyword retrieval over approved documents (no text generation)' };
}

export async function sources(user: AuthUser) {
  const docs = await many(
    `SELECT id, title, section, audience, keywords, source_updated_on AS updated, length(body)::int AS length,
            cardinality(audience) > 0 AND NOT ('parent' = ANY(audience)) AS restricted
       FROM knowledge_documents
      WHERE is_approved AND (cardinality(audience) = 0 OR $1 = ANY(audience))
      ORDER BY title`, [user.roleKey]);
  const live = [
    ...(user.permissions.has('admissions.read') ? [{ title: 'Admissions CRM', detail: 'Enquiries by source this month' }] : []),
  ];
  return { documents: docs, live };
}

export async function topQuestions() {
  return many(
    `SELECT COALESCE(metadata->>'topic', 'Not found') AS label, count(*)::int AS value
       FROM audit_logs
      WHERE module = 'knowledge' AND action = 'ask' AND created_at >= date_trunc('month', now())
      GROUP BY 1 ORDER BY 2 DESC LIMIT 6`);
}

export async function feedback(req: Request, input: { question: string; helpful: boolean; documentIds: string[]; routeToPerson: boolean }) {
  await audit(req, {
    action: 'feedback', module: 'knowledge', entityType: 'knowledge_question',
    description: input.routeToPerson ? 'Knowledge AI question routed to the front office' : `Knowledge AI answer marked ${input.helpful ? 'helpful' : 'not helpful'}`,
    metadata: input,
  });
  if (input.routeToPerson) {
    await notifyRoles(['office'], {
      category: 'Attention', topic: 'knowledge', icon: 'message',
      title: `Question from ${req.user!.fullName}`,
      body: input.question,
      route: '/knowledge-ai',
    });
  }
  return { recorded: true, routed: input.routeToPerson };
}
