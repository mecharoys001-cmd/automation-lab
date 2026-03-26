# Automated Bug Fixing System

## Overview

Comprehensive automated system for fixing bugs from Airtable feedback tracker.

## Architecture

### Components

1. **Bug Taxonomy** (`scripts/bug-taxonomy.ts`)
   - Categorizes bugs: ALREADY_FIXED, ARCHITECTURAL, AUTO_FIXABLE, etc.
   - Determines which bugs can be automated

2. **Fix Strategies** (`scripts/fix-strategies.ts`)
   - Simple pattern-based fixes (maxLength, lazy loading)
   - Claude Code delegation for complex fixes

3. **Deploy Pipeline** (`scripts/deploy-fix.ts`)
   - Build validation
   - Git commits with bug references
   - Vercel production deployment
   - Airtable status updates

4. **State Management** (`scripts/state-manager.ts`)
   - Tracks current work
   - Prevents infinite loops
   - Detects stuck states

5. **Dashboard** (`scripts/bug-dashboard.ts`)
   - Real-time progress tracking
   - Category/priority breakdown
   - Recent activity log

6. **Main Fixer** (`scripts/auto-bug-fixer-v2.ts`)
   - Orchestrates everything
   - Handles errors gracefully
   - Generates reports

## Workflow

```
1. Fetch unfixed bugs from Airtable
2. Skip architectural/non-existent features
3. Mark already-fixed bugs
4. Apply fix strategy:
   - Simple: Direct code changes
   - Complex: Delegate to Claude Code
5. Validate build
6. Commit changes
7. Deploy to production
8. Mark as fixed in Airtable
9. Update dashboard
10. Generate report
```

## Bug Categories

### ALREADY_FIXED
Bugs that were fixed in previous work but not marked.
**Action:** Mark as fixed, no code changes.

### ARCHITECTURAL
Major backend changes requiring planning.
**Examples:** 4-tier role system, server-side middleware
**Action:** Skip, needs manual planning.

### NON_EXISTENT_FEATURE
Bug reports for features that don't exist.
**Action:** Skip or clarify requirements.

### WONT_FIX
Low-value optimizations or cosmetic issues.
**Action:** Skip.

### AUTO_FIXABLE
Simple fixes with clear patterns.
**Examples:** maxLength attributes, lazy loading
**Action:** Automated code changes.

### NEEDS_CLAUDE_CODE
Complex fixes requiring semantic understanding.
**Examples:** ARIA labels, validation logic
**Action:** Delegate to Claude Code.

## Running Manually

```bash
cd /home/ethan/.openclaw/workspace/automation-lab

# Set Airtable token
export AIRTABLE_TOKEN="your-token-here"

# Run fixer
npx tsx scripts/auto-bug-fixer-v2.ts

# View dashboard
cat reports/bug-fixes/DASHBOARD.md

# View logs
tail -f reports/bug-fixes/cron.log
```

## Cron Schedule

**Frequency:** Every 30 minutes
**Script:** `/home/ethan/.openclaw/workspace/automation-lab/scripts/cron-bug-fix.sh`
**Log:** `/home/ethan/.openclaw/workspace/automation-lab/reports/bug-fixes/cron.log`

## Reports

All reports saved to: `reports/bug-fixes/`

- `DASHBOARD.md` - Live status
- `deployments.jsonl` - Deployment history
- `cron.log` - Execution log
- `YYYY-MM-DDTHH-MM-SS_<bugId>.md` - Individual bug reports
- `.state.json` - Current work state

## Error Handling

1. **Build Failures:** Rollback git commit, skip bug
2. **Deploy Failures:** Rollback git commit, retry next run
3. **Stuck States:** Auto-clear after 30 minutes
4. **Max Attempts:** Skip after 3 failed attempts

## Monitoring

Check dashboard: `cat reports/bug-fixes/DASHBOARD.md`

Key metrics:
- Total bugs
- Fixed count
- Remaining by priority
- Recent successes/failures

## Adding New Fix Strategies

Edit `scripts/fix-strategies.ts`:

```typescript
// Add to applyFixStrategy function
if (feedback.includes('your-pattern')) {
  return yourCustomFix(bug);
}
```

## Troubleshooting

### "No changes detected" during validation
- Bug was already fixed
- Pattern matching failed
- Check if manually fixed already

### Claude Code authentication errors
- Verify OAuth credentials in `~/.claude/.credentials.json`
- Don't override with env token

### Airtable "NOT_AUTHORIZED"
- Token expired or wrong permissions
- Refresh token in `agent.yml`

## Future Enhancements

1. **Discord notifications** for each fix
2. **Slack integration** for team updates
3. **A/B testing** before production deploy
4. **Rollback mechanism** for production issues
5. **Machine learning** for pattern detection
