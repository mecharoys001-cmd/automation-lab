/**
 * Deploy Pipeline - Validates, commits, and deploys bug fixes
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import type { Bug, FixResult } from './fix-strategies';
import { markAsFixed } from '../lib/airtable';

const execAsync = promisify(exec);

export interface DeployResult {
  success: boolean;
  deployUrl?: string;
  error?: string;
}

/**
 * Validate build before deployment
 */
async function validateBuild(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('bash scripts/validate-fix.sh', {
      cwd: '/home/ethan/.openclaw/workspace/automation-lab',
    });
    console.log(stdout);
    return true;
  } catch (error) {
    console.error('❌ Validation failed:', error);
    return false;
  }
}

/**
 * Commit changes with bug reference
 */
async function commitChanges(bug: Bug, changes: string[]): Promise<boolean> {
  try {
    const commitMsg = `fix(${bug.page}): ${bug.feedback.substring(0, 50)} [${bug.id}]

Changes:
${changes.map(c => `- ${c}`).join('\n')}

Airtable: ${bug.id}`;

    await execAsync('git add -A', {
      cwd: '/home/ethan/.openclaw/workspace/automation-lab',
    });
    
    await execAsync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, {
      cwd: '/home/ethan/.openclaw/workspace/automation-lab',
    });
    
    return true;
  } catch (error) {
    console.error('❌ Commit failed:', error);
    return false;
  }
}

/**
 * Deploy to Vercel production
 */
async function deployToVercel(): Promise<DeployResult> {
  try {
    const { stdout } = await execAsync('npx vercel --prod --yes', {
      cwd: '/home/ethan/.openclaw/workspace/automation-lab',
      timeout: 300000, // 5 minutes
    });
    
    // Extract deploy URL from output
    const urlMatch = stdout.match(/https:\/\/[^\s]+/);
    const deployUrl = urlMatch ? urlMatch[0] : undefined;
    
    return { success: true, deployUrl };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Deploy failed',
    };
  }
}

/**
 * Rollback changes on failure
 */
async function rollback(): Promise<void> {
  try {
    await execAsync('git reset --hard HEAD~1', {
      cwd: '/home/ethan/.openclaw/workspace/automation-lab',
    });
    console.log('🔄 Rolled back changes');
  } catch (error) {
    console.error('❌ Rollback failed:', error);
  }
}

/**
 * Log deployment result
 */
async function logDeployment(
  bug: Bug,
  fixResult: FixResult,
  deployResult: DeployResult
): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    bugId: bug.id,
    priority: bug.priority,
    page: bug.page,
    fixSuccess: fixResult.success,
    deploySuccess: deployResult.success,
    changes: fixResult.changes,
    deployUrl: deployResult.deployUrl,
    error: deployResult.error || fixResult.error,
  };
  
  const logPath = '/home/ethan/.openclaw/workspace/automation-lab/reports/bug-fixes/deployments.jsonl';
  await fs.appendFile(logPath, JSON.stringify(logEntry) + '\n');
}

/**
 * Main deployment function
 */
export async function deployFix(bug: Bug, fixResult: FixResult): Promise<boolean> {
  console.log(`🚀 Deploying fix for ${bug.id}...`);
  
  try {
    // 1. Validate build
    console.log('📦 Validating build...');
    const buildValid = await validateBuild();
    if (!buildValid) {
      throw new Error('Build validation failed');
    }
    
    // 2. Commit changes
    console.log('💾 Committing changes...');
    const committed = await commitChanges(bug, fixResult.changes);
    if (!committed) {
      throw new Error('Commit failed');
    }
    
    // 3. Deploy to Vercel
    console.log('🌐 Deploying to production...');
    const deployResult = await deployToVercel();
    
    if (!deployResult.success) {
      await rollback();
      throw new Error(deployResult.error || 'Deploy failed');
    }
    
    // 4. Mark as fixed in Airtable
    console.log('✓ Marking as fixed in Airtable...');
    await markAsFixed(bug.id);
    
    // 5. Log success
    await logDeployment(bug, fixResult, deployResult);
    
    console.log(`✅ Successfully deployed fix for ${bug.id}`);
    console.log(`   URL: ${deployResult.deployUrl}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Deploy failed for ${bug.id}:`, error);
    
    const deployResult: DeployResult = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    
    await logDeployment(bug, fixResult, deployResult);
    return false;
  }
}
