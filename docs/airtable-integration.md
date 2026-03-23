# Airtable Integration

Bug tracking and feedback management for Symphonix Scheduler.

## Configuration

Credentials stored in `/home/ethan/.openclaw/agents/automation-lab/agent.yml`:
- **Token:** Personal Access Token with read/write permissions
- **Base ID:** `appdyCFvZRVuCr4tb`
- **Table:** `App Feedback`

## Usage

### List Unresolved Issues

```typescript
import { getUnresolvedIssues } from '@/lib/airtable';

const issues = await getUnresolvedIssues();
console.log(`Found ${issues.length} unresolved issues`);
```

### Get High Priority Issues Only

```typescript
import { getHighPriorityIssues } from '@/lib/airtable';

const criticalBugs = await getHighPriorityIssues();
```

### Mark Issue as Fixed

```typescript
import { markAsFixed } from '@/lib/airtable';

await markAsFixed('recXSr3efMd3xivVV');
```

### Get Specific Issue

```typescript
import { getIssue } from '@/lib/airtable';

const issue = await getIssue('recXSr3efMd3xivVV');
if (issue) {
  console.log(issue.feedback);
  console.log(issue.screenshot); // Array of attachment URLs
}
```

## Testing

```bash
npx tsx scripts/test-airtable.ts
```

## Workflow

1. **Bug Reporter** (Ethan/Other Agent) adds issues to Airtable
2. **AUTO** reads unresolved issues
3. **AUTO** fixes the bug in codebase
4. **AUTO** deploys the fix
5. **AUTO** marks issue as "Fixed by AUTO" (checkbox)
6. **Verification Agent** tests the fix
7. **Verification Agent** marks as "Completed" (final checkbox)

## Record Structure

```typescript
interface FeedbackRecord {
  id: string;                    // Airtable record ID
  completed: boolean;            // Final verification checkbox
  priority?: 'High' | 'Medium' | 'Low';
  page?: string;                 // e.g., "Calendar", "Settings"
  modalName?: string;            // e.g., "New Event Template"
  feedback: string;              // Bug description
  screenshot?: string[];         // Attachment URLs
  fixedByAuto?: boolean;         // AUTO's fix checkpoint
}
```

## Current Status

As of 2026-03-18:
- ✅ Connection established
- ✅ Helper functions implemented
- 📊 **43 unresolved issues** (6 High, 16 Medium, 21 Low)
