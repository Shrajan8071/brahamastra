-- Draw on Air — Fix Room Members Select Policy Migration
-- Run this in your Supabase SQL Editor

-- Drop restrictive select policies
DROP POLICY IF EXISTS "members_select_own" ON room_members;
DROP POLICY IF EXISTS "members_select_host" ON room_members;
DROP POLICY IF EXISTS "members_select_room_participants" ON room_members;

-- Allow room host AND approved room members to see all participants in their room
CREATE POLICY "members_select_room_participants" ON room_members
  FOR SELECT
  TO authenticated
  USING (
    -- User is the host of the room
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = room_members.room_id
      AND rooms.host_user_id = auth.uid()
    )
    OR
    -- User is an approved member of the room
    EXISTS (
      SELECT 1 FROM room_members AS rm
      WHERE rm.room_id = room_members.room_id
      AND rm.user_id = auth.uid()
      AND rm.status = 'APPROVED'
    )
  );
