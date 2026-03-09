-- Create batch delete function for sessions (handles large datasets)
-- Used by: /api/data/clear-all, /api/data/clear-sessions, /api/sessions/nuke

CREATE OR REPLACE FUNCTION delete_all_sessions_batched(
  p_program_id UUID,
  p_batch_size INTEGER DEFAULT 5000
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_deleted INTEGER := 0;
  v_batch_deleted INTEGER;
BEGIN
  LOOP
    -- Delete one batch of sessions (cascade will handle session_tags)
    DELETE FROM sessions
    WHERE id IN (
      SELECT id
      FROM sessions
      WHERE program_id = p_program_id
      LIMIT p_batch_size
    );
    
    GET DIAGNOSTICS v_batch_deleted = ROW_COUNT;
    v_total_deleted := v_total_deleted + v_batch_deleted;
    
    -- Exit when no more rows to delete
    EXIT WHEN v_batch_deleted = 0;
    
    -- Small delay to avoid overwhelming the database
    PERFORM pg_sleep(0.1);
  END LOOP;
  
  RETURN v_total_deleted;
END;
$$;

COMMENT ON FUNCTION delete_all_sessions_batched IS 
  'Batch-deletes all sessions for a program to avoid timeout on large datasets. Returns total count deleted.';
