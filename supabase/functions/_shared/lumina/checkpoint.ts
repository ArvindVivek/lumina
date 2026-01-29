// Checkpoint system for resumable ETL jobs
// File: supabase/functions/_shared/checkpoint.ts

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Database, ETLCheckpointInsert } from './types.ts';

// ==========================================
// TYPES
// ==========================================

export interface Checkpoint {
  jobType: 'tournaments' | 'series' | 'drafts';
  entityId: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress?: Record<string, unknown>;
  errorMessage?: string;
}

type SupabaseClientType = SupabaseClient<Database>;

// ==========================================
// CHECKPOINT FUNCTIONS
// ==========================================

/**
 * Mark a job as started/in-progress
 */
export async function markStarted(
  supabase: SupabaseClientType,
  checkpoint: Checkpoint
): Promise<void> {
  const now = new Date().toISOString();

  const record: ETLCheckpointInsert = {
    job_type: checkpoint.jobType,
    entity_id: checkpoint.entityId,
    status: 'in_progress',
    progress: checkpoint.progress || null,
    error_message: null,
    started_at: now,
    completed_at: null,
  };

  const { error } = await supabase
    .from('etl_checkpoints')
    .upsert(record, {
      onConflict: 'job_type,entity_id',
    });

  if (error) {
    throw new Error(`Failed to mark checkpoint as started: ${error.message}`);
  }
}

/**
 * Mark a job as completed successfully
 */
export async function markCompleted(
  supabase: SupabaseClientType,
  checkpoint: Checkpoint
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('etl_checkpoints')
    .update({
      status: 'completed',
      completed_at: now,
      updated_at: now,
    })
    .eq('job_type', checkpoint.jobType)
    .eq('entity_id', checkpoint.entityId);

  if (error) {
    throw new Error(`Failed to mark checkpoint as completed: ${error.message}`);
  }
}

/**
 * Mark a job as failed with error message
 */
export async function markFailed(
  supabase: SupabaseClientType,
  checkpoint: Checkpoint
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('etl_checkpoints')
    .update({
      status: 'failed',
      error_message: checkpoint.errorMessage || 'Unknown error',
      updated_at: now,
    })
    .eq('job_type', checkpoint.jobType)
    .eq('entity_id', checkpoint.entityId);

  if (error) {
    throw new Error(`Failed to mark checkpoint as failed: ${error.message}`);
  }
}

/**
 * Update job progress (for long-running operations)
 */
export async function updateProgress(
  supabase: SupabaseClientType,
  checkpoint: Checkpoint
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('etl_checkpoints')
    .update({
      progress: checkpoint.progress || null,
      updated_at: now,
    })
    .eq('job_type', checkpoint.jobType)
    .eq('entity_id', checkpoint.entityId);

  if (error) {
    throw new Error(`Failed to update checkpoint progress: ${error.message}`);
  }
}

/**
 * Get pending job entity IDs (not completed)
 */
export async function getPendingJobs(
  supabase: SupabaseClientType,
  jobType: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('etl_checkpoints')
    .select('entity_id')
    .eq('job_type', jobType)
    .neq('status', 'completed');

  if (error) {
    throw new Error(`Failed to get pending jobs: ${error.message}`);
  }

  return data?.map((row) => row.entity_id).filter((id): id is string => id !== null) || [];
}

/**
 * Get completed job entity IDs as a Set for fast lookup
 */
export async function getCompletedJobs(
  supabase: SupabaseClientType,
  jobType: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('etl_checkpoints')
    .select('entity_id')
    .eq('job_type', jobType)
    .eq('status', 'completed');

  if (error) {
    throw new Error(`Failed to get completed jobs: ${error.message}`);
  }

  const entityIds = data?.map((row) => row.entity_id).filter((id): id is string => id !== null) || [];
  return new Set(entityIds);
}

/**
 * Reset a failed job to pending state for retry
 */
export async function resetFailedJob(
  supabase: SupabaseClientType,
  checkpoint: Checkpoint
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('etl_checkpoints')
    .update({
      status: 'pending',
      error_message: null,
      updated_at: now,
    })
    .eq('job_type', checkpoint.jobType)
    .eq('entity_id', checkpoint.entityId)
    .eq('status', 'failed');

  if (error) {
    throw new Error(`Failed to reset failed job: ${error.message}`);
  }
}

/**
 * Get checkpoint statistics for a job type
 */
export async function getJobStats(
  supabase: SupabaseClientType,
  jobType: string
): Promise<{
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
}> {
  const { data, error } = await supabase
    .from('etl_checkpoints')
    .select('status')
    .eq('job_type', jobType);

  if (error) {
    throw new Error(`Failed to get job stats: ${error.message}`);
  }

  const stats = {
    pending: 0,
    in_progress: 0,
    completed: 0,
    failed: 0,
  };

  data?.forEach((row) => {
    if (row.status === 'pending') stats.pending++;
    else if (row.status === 'in_progress') stats.in_progress++;
    else if (row.status === 'completed') stats.completed++;
    else if (row.status === 'failed') stats.failed++;
  });

  return stats;
}
