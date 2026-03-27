/**
 * Bug Fix Strategies - Automated fixes for simple bugs
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface Bug {
  id: string;
  priority: string;
  page: string;
  feedback: string;
  royFix?: boolean;
}

export interface FixResult {
  success: boolean;
  changes: string[];
  error?: string;
}

/**
 * Add maxLength attributes to text inputs
 */
export async function addMaxLengthAttributes(bug: Bug): Promise<FixResult> {
  const changes: string[] = [];
  
  try {
    // Target: Staff/Venues page based on bug feedback
    const filePath = '/home/ethan/.openclaw/workspace/automation-lab/app/tools/scheduler/admin/people/page.tsx';
    let content = await fs.readFile(filePath, 'utf8');
    
    // Pattern: <input type="text" ... /> without maxLength
    const inputPattern = /<input([^>]*type=["']text["'][^>]*)(?!.*maxLength)([^>]*)\/>/g;
    let modified = false;
    
    content = content.replace(inputPattern, (match, before, after) => {
      // Skip if already has maxLength
      if (match.includes('maxLength')) return match;
      
      // Add maxLength={255} before the closing />
      modified = true;
      changes.push(`Added maxLength to input: ${match.substring(0, 50)}...`);
      return `<input${before}${after} maxLength={255} />`;
    });
    
    if (modified) {
      await fs.writeFile(filePath, content);
      return { success: true, changes };
    }
    
    return { success: false, changes: [], error: 'No inputs found without maxLength' };
  } catch (error) {
    return { 
      success: false, 
      changes: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Add loading="lazy" to images
 */
export async function addLazyLoadingToImages(bug: Bug): Promise<FixResult> {
  const changes: string[] = [];
  
  try {
    // Find all component files that might have images
    const componentDirs = [
      '/home/ethan/.openclaw/workspace/automation-lab/app/tools/scheduler/admin/people',
      '/home/ethan/.openclaw/workspace/automation-lab/app/tools/scheduler/admin/venues',
      '/home/ethan/.openclaw/workspace/automation-lab/app/tools/scheduler/admin/calendar',
    ];
    
    for (const dir of componentDirs) {
      try {
        const files = await fs.readdir(dir);
        for (const file of files) {
          if (!file.endsWith('.tsx')) continue;
          
          const filePath = path.join(dir, file);
          let content = await fs.readFile(filePath, 'utf8');
          
          // Pattern: <img ... /> without loading="lazy"
          const imgPattern = /<img([^>]*)(?!.*loading=)([^>]*)\/>/g;
          let modified = false;
          
          content = content.replace(imgPattern, (match, before, after) => {
            if (match.includes('loading=')) return match;
            
            modified = true;
            changes.push(`Added loading="lazy" to image in ${file}`);
            return `<img${before}${after} loading="lazy" />`;
          });
          
          if (modified) {
            await fs.writeFile(filePath, content);
          }
        }
      } catch (err) {
        // Directory doesn't exist or can't be read - skip
        continue;
      }
    }
    
    if (changes.length > 0) {
      return { success: true, changes };
    }
    
    return { success: false, changes: [], error: 'No images found without loading="lazy"' };
  } catch (error) {
    return { 
      success: false, 
      changes: [], 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Extract QA validation feedback from bug description
 */
function extractQAFeedback(feedback: string): string[] {
  const qaPattern = /QA NOTE \([^)]+\): NOT FIXED\. ([^\n]+)/g;
  const matches: string[] = [];
  let match;
  
  while ((match = qaPattern.exec(feedback)) !== null) {
    matches.push(match[1]);
  }
  
  return matches;
}

/**
 * Delegate complex fixes to Claude Code
 */
export async function delegateToClaudeCode(bug: Bug): Promise<FixResult> {
  const qaFeedback = extractQAFeedback(bug.feedback);
  const hasValidationFailures = qaFeedback.length > 0;
  
  let validationSection = '';
  if (hasValidationFailures) {
    const mostRecent = qaFeedback[qaFeedback.length - 1];
    validationSection = `

**⚠️ VALIDATION AGENT REJECTED PREVIOUS FIX:**
"${mostRecent}"

**This means:**
- Previous fix attempt did NOT resolve the issue
- You must address this specific validation failure
- The validation agent will test your fix
- Only mark complete when this specific issue is resolved
`;
  }
  
  const taskPrompt = `Fix Airtable bug ${bug.id}:

**Priority:** ${bug.priority}
**Page:** ${bug.page}
**Issue:** ${bug.feedback.split('QA NOTE')[0].trim()}
${validationSection}
**Requirements:**
1. Read existing code for the ${bug.page} page
2. ${hasValidationFailures ? 'Address the SPECIFIC validation failure above' : 'Implement the fix described in the issue'}
3. Test that the build succeeds (npm run build)
4. Verify your fix actually resolves the issue
5. Report what you changed

**DO NOT:**
- Deploy to production
- Mark as fixed in Airtable
- Make unrelated changes
- Assume code that exists is working

Work in /home/ethan/.openclaw/workspace/automation-lab
`.replace(/"/g, '\\"');

  try {
    const { stdout, stderr } = await execAsync(
      `claude -p --dangerously-skip-permissions "${taskPrompt}"`,
      {
        cwd: '/home/ethan/.openclaw/workspace/automation-lab',
        timeout: 300000, // 5 minutes
      }
    );
    
    // Parse Claude Code output for changes
    const changes = [
      'Delegated to Claude Code',
      `Output: ${stdout.substring(0, 200)}...`,
    ];
    
    return { success: true, changes };
  } catch (error) {
    return {
      success: false,
      changes: [],
      error: error instanceof Error ? error.message : 'Claude Code execution failed',
    };
  }
}

/**
 * Route bug to appropriate fix strategy
 */
export async function applyFixStrategy(bug: Bug): Promise<FixResult> {
  const feedback = bug.feedback.toLowerCase();
  
  // Strategy 1: Max-length attributes
  if (feedback.includes('max-length') || feedback.includes('256+ characters')) {
    return addMaxLengthAttributes(bug);
  }
  
  // Strategy 2: Lazy loading images
  if (feedback.includes("loading='lazy'") || feedback.includes('lazy attribute')) {
    return addLazyLoadingToImages(bug);
  }
  
  // Strategy 3: Delegate to Claude Code for complex fixes
  return delegateToClaudeCode(bug);
}
