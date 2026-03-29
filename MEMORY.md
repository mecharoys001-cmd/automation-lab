
## Bug Fixing Workflow (2026-03-27)

**Learned:** There's a validation agent that verifies fixes and unchecks bugs that aren't actually resolved.

**Correct workflow:**
1. Implement actual fix (code changes)
2. Deploy to production
3. Mark as "ROY Fix" 
4. Validation agent tests it
5. If not fixed → agent unchecks and provides feedback

**Do NOT:**
- Mark bugs as "already fixed" without verification
- Assume code exists means it works
- Mark architectural bugs without implementing the solution
- Prioritize checklist completion over actual problem-solving

**Current queue:** 22 bugs need real fixes (validation agent unchecked them)
**Automated system:** Cron running every 30min, uses Claude Code for fixes
