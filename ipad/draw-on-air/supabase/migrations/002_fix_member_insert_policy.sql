-- Draw on Air — Security Patch Migration
-- Fixes: members_insert policy was too permissive (allowed any user to add themselves)
-- Run this in your Supabase SQL Editor

-- 1. Drop the old permissive insert policy
DROP POLICY IF EXISTS "members_insert_authenticated" ON room_members;

-- 2. Create the corrected policy: only host can insert members
CREATE POLICY "members_insert_host_only" ON room_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- The inserter must be the host of the room
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = room_members.room_id
      AND rooms.host_user_id = auth.uid()
    )
    OR (
      -- Allow self-insert only when creating as HOST role (room creator flow)
      auth.uid() = user_id
      AND role = 'HOST'
    )
  );

-- 3. Drop the old permissive self-update policy
DROP POLICY IF EXISTS "members_update_own" ON room_members;

-- 4. Create the corrected policy: participants can only set status to LEFT
CREATE POLICY "members_update_own" ON room_members
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
  )
  WITH CHECK (
    status = 'LEFT'
  );
