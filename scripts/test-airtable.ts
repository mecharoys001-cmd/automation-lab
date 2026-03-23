#!/usr/bin/env tsx
/**
 * Test Airtable connection and list unresolved issues
 */

import { testConnection, getUnresolvedIssues, getHighPriorityIssues } from '../lib/airtable';

async function main() {
  console.log('🔌 Testing Airtable connection...\n');
  
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Failed to connect to Airtable');
    process.exit(1);
  }
  
  console.log('✅ Connected to Airtable\n');
  
  console.log('📋 Fetching unresolved issues...\n');
  const issues = await getUnresolvedIssues();
  
  console.log(`Found ${issues.length} unresolved issue(s)\n`);
  
  // Show high priority issues
  const highPriority = issues.filter(i => i.priority === 'High');
  console.log(`🔥 High Priority Issues (${highPriority.length}):`);
  highPriority.forEach((issue, idx) => {
    console.log(`\n${idx + 1}. [${issue.page || 'Unknown'}${issue.modalName ? ` → ${issue.modalName}` : ''}]`);
    console.log(`   ID: ${issue.id}`);
    console.log(`   ${issue.feedback.substring(0, 100)}${issue.feedback.length > 100 ? '...' : ''}`);
    console.log(`   ROY fix: ${issue.royFix ? '✅' : '⬜'}`);
  });
  
  // Show medium priority issues
  const mediumPriority = issues.filter(i => i.priority === 'Medium');
  console.log(`\n📌 Medium Priority Issues (${mediumPriority.length}):`);
  mediumPriority.slice(0, 5).forEach((issue, idx) => {
    console.log(`\n${idx + 1}. [${issue.page || 'Unknown'}${issue.modalName ? ` → ${issue.modalName}` : ''}]`);
    console.log(`   ${issue.feedback.substring(0, 80)}${issue.feedback.length > 80 ? '...' : ''}`);
  });
  
  if (mediumPriority.length > 5) {
    console.log(`\n   ... and ${mediumPriority.length - 5} more medium priority issues`);
  }
}

main().catch(console.error);
