# GigBooks — Pain Journal

> What went wrong and WHY. Process improvements.
> Update when time is wasted or mistakes are repeated.

---

## 2026-03-09: SOT docs drift between sessions

**Problem**: Only STATUS.md and todo.md get updated reliably (session protocol enforces it). Deeper docs (schema_map.md, gotchas.md, blueprint.md) go stale because nothing triggers their update. Over time the AI reads stale context and operates with an incomplete picture, requiring the user to re-explain things that should be documented.

**Example**: schema_map.md was missing 3 migrations (S31A beat_maps, S32A song_stems, S34 categories/prefs). blueprint.md still described the original React Native/SQLite architecture until manually rewritten. gotchas.md listed fixed issues (S34) as if they were still active.

**Root cause**: Session protocol says "update gotchas.md (if learned)" — the "if" makes it optional. Nobody reviews deeper docs unless something breaks.

**Fix**: Created IMPACT_MAP.md — a ripple/dependency map the AI reads AFTER STATUS.md. Documents which files are coupled so changes aren't made in isolation. Also added "Checklist for new column" and "Checklist for new table" sections.

**Process change**: When a sprint touches the schema, the AI must update schema_map.md migration list. When a sprint changes architecture (new table, new component coupling), the AI must check IMPACT_MAP.md.

---

## 2026-03-08: S30A — Patching before understanding root cause

**Problem**: Beat alignment was broken. Instead of diagnosing, jumped straight to implementing a "regrid" (uniform grid) solution that drifted on real music. Wasted a session. S30B then confirmed the catch-up burst was the actual problem — a much simpler fix.

**Root cause**: STATUS.md wasn't read at session start (confirmed in session log). AI operated without context, assumed the problem was more complex than it was.

**Lesson**: Research before coding. Confirm root cause. Read the docs first. Always.

---

## 2026-03-09: Audit assumptions vs user intent

**Problem**: Initial audit called the booking wizard "over-engineered" and recommended simplifying it. Nathan correctly pushed back — the wizard is an intentional training tool for the band to capture booking data.

**Root cause**: Audit assumed "simple = better" without understanding the user's management model. The band runs on a symbiotic system: the boys are customer-facing, Nathan manages from behind the kit. The wizard is the data-gathering interface.

**Lesson**: Don't assume features are bloat. Ask about intent before recommending removal. The user's domain expertise trumps generic UX heuristics.

---

## 2026-03-09: Repeated audit flags on intentional design (role guards, drawer filtering)

**Problem**: Second audit session flagged "no role-based drawer filtering" and "Band Settings errors for non-admin" as MEDIUM issues. Nathan had to explain again: all 4 members ARE admin. Everyone needs full access. There are no non-admin users. The audit wasted time on non-issues.

**Root cause**: The business model (how the band actually operates) wasn't documented in the SOT docs. The AI saw `is_admin` in the schema, assumed some users aren't admin, and flagged the lack of filtering as a bug. Same mistake as the booking wizard — applying generic software patterns without understanding the domain.

**What was missing from docs**:
- All 4 members are admin (is_admin = true for everyone)
- Nathan invoices ~90% (his bank, his name). James does some. Adam shares PDFs on Nathan's behalf.
- Everyone needs access to everything — no role distinction for business features
- Receipt split ÷4 creating 3 receipts is correct (Nathan pays himself)

**Fix**: Added "Business Model" section to gotchas.md, CLAUDE.md, and IMPACT_MAP.md. Added explicit "Audit rule" to CLAUDE.md. Updated decisions_log and MEMORY.md. Future audits must check these sections before flagging intentional designs.

**Lesson**: Every repeated user explanation = a missing doc. If Nathan has to explain something twice, it should be written into the SOT docs immediately so it never comes up again.
