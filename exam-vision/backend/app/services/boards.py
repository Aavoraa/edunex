# backend/app/services/boards.py
"""The examination boards Edunex classes follow, and how each one's examiners mark.

An exam takes its class's board. The board's conventions go into the rubric-drafting and
marking prompts, so the AI marks the way that board's mark schemes do. The teacher's rubric
still decides: the conventions only say how to apply it.
"""

from __future__ import annotations

BOARDS: dict[str, dict[str, str]] = {
    "igcse": {
        "label": "Cambridge IGCSE",
        "marking": (
            "Mark as a Cambridge IGCSE examiner applies a mark scheme: positive marking (credit what is "
            "right, never deduct for what is wrong or missing); in calculations distinguish method marks (M), "
            "accuracy marks that depend on the method (A) and independent marks (B); allow error carried "
            "forward so a wrong earlier value is not penalised twice; accept any correct alternative method "
            "or equivalent wording; for extended answers judge the level of response as a whole; ignore "
            "spelling and grammar except in language papers."),
    },
    "ib": {
        "label": "IB Diploma Programme",
        "marking": (
            "Mark as an IB Diploma examiner applies a markscheme: method marks (M), answer marks (A) and "
            "reasoning marks (R); follow-through (FT) marks after an earlier error; positive marking; accept "
            "correct alternative approaches; for extended responses apply the markband level descriptors on "
            "a best-fit basis rather than counting points."),
    },
    "cbse": {
        "label": "CBSE",
        "marking": (
            "Mark as a CBSE examiner applies the official marking scheme: step marking (each correct step "
            "or value point earns its marks even if the final answer is wrong); full marks for a correct "
            "alternative method or answer not in the scheme; check the expected value points in long "
            "answers; units and the final answer carry their own marks where the scheme says so; no "
            "deduction for spelling except in language papers."),
    },
    "icse": {
        "label": "ICSE",
        "marking": (
            "Mark as a CISCE (ICSE) examiner: step marking with marks for method, working and accuracy; "
            "correct units and labelled diagrams earn their marks where the scheme says so; accept correct "
            "alternative methods; credit each relevant point in descriptive answers; no deduction for "
            "spelling except in language papers."),
    },
    "nios": {
        "label": "NIOS",
        "marking": (
            "Mark as an NIOS evaluator applies the marking scheme: value points (each expected point earns "
            "its marks), step marks in numerical answers, and credit for correct answers in the learner's "
            "own words; accept correct alternative methods; no deduction for spelling except in language "
            "papers."),
    },
    "matriculation": {
        "label": "Tamil Nadu Matriculation",
        "marking": (
            "Mark as a Tamil Nadu State Board (Samacheer Kalvi) examiner: value points per the answer key "
            "(each key point earns its marks), step marks in mathematics and numerical science answers, "
            "marks for neat labelled diagrams where asked, and full credit for a correct alternative method; "
            "no deduction for spelling except in language papers."),
    },
}


def syllabus_brief(exam) -> str:
    """The exam's syllabus, paper and tier in a few lines for the AI ("" when not linked).
    ``exam``: an Exam or the dict processing.exam_dict makes."""
    get = (lambda k: exam.get(k) or "") if isinstance(exam, dict) else (lambda k: getattr(exam, k, "") or "")
    if not get("syllabus_title"):
        return ""
    lines = [f"Syllabus: {get('syllabus_title')}"
             + (f"; paper: {get('component_name')}" if get("component_name") else "")
             + (f"; tier: {get('tier')}" if get("tier") and get("tier") != "All" else "")]
    if get("syllabus_context"):
        lines.append(get("syllabus_context"))
    lines.append("Pitch expectations at this syllabus and paper: credit what its content and level call for; "
                 "do not demand content outside it.")
    return "\n".join(lines)


def label(board: str | None) -> str:
    return BOARDS.get(board or "", {}).get("label", "")


def marking_guidance(board: str | None) -> str:
    return BOARDS.get(board or "", {}).get("marking", "")
