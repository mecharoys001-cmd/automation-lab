/**
 * Airtable Integration
 * Bug tracking and feedback management for Symphonix Scheduler
 */

import Airtable from 'airtable';

// Configuration from agent.yml
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || '';
const BASE_ID = 'appdyCFvZRVuCr4tb';
const TABLE_NAME = 'App Feedback';

// Initialize Airtable
const base = new Airtable({ apiKey: AIRTABLE_TOKEN }).base(BASE_ID);

export interface FeedbackRecord {
  id: string;
  completed: boolean;
  priority?: 'High' | 'Medium' | 'Low';
  page?: string;
  modalName?: string;
  feedback: string;
  screenshot?: string[];
  royFix?: boolean;  // "ROY fix" column in Airtable
}

/**
 * Get all unresolved issues
 */
export async function getUnresolvedIssues(): Promise<FeedbackRecord[]> {
  const records: FeedbackRecord[] = [];
  
  await base(TABLE_NAME)
    .select({
      filterByFormula: '{Completed} = FALSE()',
      sort: [
        { field: 'Priority', direction: 'desc' },
      ],
    })
    .eachPage((pageRecords, fetchNextPage) => {
      pageRecords.forEach((record) => {
        records.push({
          id: record.id,
          completed: record.get('Completed') as boolean || false,
          priority: record.get('Priority') as 'High' | 'Medium' | 'Low' | undefined,
          page: record.get('Page') as string | undefined,
          modalName: record.get('Modal Name') as string | undefined,
          feedback: record.get('Feedback') as string || '',
          screenshot: record.get('Screenshot/Image') as string[] | undefined,
          royFix: record.get('ROY Fix') as boolean || false,
        });
      });
      fetchNextPage();
    });

  return records;
}

/**
 * Get a specific issue by ID
 */
export async function getIssue(recordId: string): Promise<FeedbackRecord | null> {
  try {
    const record = await base(TABLE_NAME).find(recordId);
    return {
      id: record.id,
      completed: record.get('Completed') as boolean || false,
      priority: record.get('Priority') as 'High' | 'Medium' | 'Low' | undefined,
      page: record.get('Page') as string | undefined,
      modalName: record.get('Modal Name') as string | undefined,
      feedback: record.get('Feedback') as string || '',
      screenshot: record.get('Screenshot/Image') as string[] | undefined,
      royFix: record.get('ROY Fix') as boolean || false,
    };
  } catch (error) {
    console.error('Failed to fetch issue:', error);
    return null;
  }
}

/**
 * Mark an issue as fixed in "ROY Fix" column
 */
export async function markAsFixed(recordId: string): Promise<boolean> {
  try {
    await base(TABLE_NAME).update(recordId, {
      'ROY Fix': true,  // Capital F in Fix
    });
    return true;
  } catch (error) {
    console.error('Failed to mark as fixed:', error);
    return false;
  }
}

/**
 * Mark an issue as completed (final verification)
 */
export async function markAsCompleted(recordId: string): Promise<boolean> {
  try {
    await base(TABLE_NAME).update(recordId, {
      'Completed': true,
    });
    return true;
  } catch (error) {
    console.error('Failed to mark as completed:', error);
    return false;
  }
}

/**
 * Get high priority issues only
 */
export async function getHighPriorityIssues(): Promise<FeedbackRecord[]> {
  const records: FeedbackRecord[] = [];
  
  await base(TABLE_NAME)
    .select({
      filterByFormula: 'AND({Completed} = FALSE(), {Priority} = "High")',
    })
    .eachPage((pageRecords, fetchNextPage) => {
      pageRecords.forEach((record) => {
        records.push({
          id: record.id,
          completed: record.get('Completed') as boolean || false,
          priority: record.get('Priority') as 'High' | 'Medium' | 'Low' | undefined,
          page: record.get('Page') as string | undefined,
          modalName: record.get('Modal Name') as string | undefined,
          feedback: record.get('Feedback') as string || '',
          screenshot: record.get('Screenshot/Image') as string[] | undefined,
          royFix: record.get('ROY Fix') as boolean || false,
        });
      });
      fetchNextPage();
    });

  return records;
}

/**
 * Test connection to Airtable
 */
export async function testConnection(): Promise<boolean> {
  try {
    await base(TABLE_NAME).select({ maxRecords: 1 }).firstPage();
    return true;
  } catch (error) {
    console.error('Airtable connection failed:', error);
    return false;
  }
}
