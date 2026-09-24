-- Draw on Air — Fix Infinite Recursion in Room Members RLS Policy
-- Run this script in your Supabase SQL Editor

-- 1. Create a SECURITY DEFINER function to check room membership without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_room_participant(_room_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = _room_id
    AND user_id = _user_id
    AND status = 'APPROVED'
  );
$$;

-- 2. Drop previous recursive policies on room_members
DROP POLICY IF EXISTS "members_select_own" ON room_members;
DROP POLICY IF EXISTS "members_select_host" ON room_members;
DROP POLICY IF EXISTS "members_select_room_participants" ON room_members;
DROP POLICY IF EXISTS "members_select_policy" ON room_members;

-- 3. Create non-recursive SELECT policy for room_members
CREATE POLICY "members_select_policy" ON room_members
  FOR SELECT
  TO authenticated
  USING (
    -- User can always view their own membership row
    auth.uid() = user_id
    OR
    -- Room host can view all members
    EXISTS (
      SELECT 1 FROM public.rooms
      WHERE rooms.id = room_members.room_id
      AND rooms.host_user_id = auth.uid()
    )
    OR
    -- Approved participants can view all other room members (via SECURITY DEFINER)
    public.is_room_participant(room_id, auth.uid())
  );

-- 4. Update drawing_strokes policies to use SECURITY DEFINER function
DROP POLICY IF EXISTS "strokes_select_member" ON drawing_strokes;
DROP POLICY IF EXISTS "strokes_insert_member" ON drawing_strokes;
DROP POLICY IF EXISTS "strokes_update_member" ON drawing_strokes;

CREATE POLICY "strokes_select_member" ON drawing_strokes
  FOR SELECT
  TO authenticated
  USING (
    public.is_room_participant(room_id, auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.rooms
      WHERE rooms.id = drawing_strokes.room_id
      AND rooms.host_user_id = auth.uid()
    )
  );

CREATE POLICY "strokes_insert_member" ON drawing_strokes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.is_room_participant(room_id, auth.uid())
      OR
      EXISTS (
        SELECT 1 FROM public.rooms
        WHERE rooms.id = drawing_strokes.room_id
        AND rooms.host_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "strokes_update_member" ON drawing_strokes
  FOR UPDATE
  TO authenticated
  USING (
    public.is_room_participant(room_id, auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.rooms
      WHERE rooms.id = drawing_strokes.room_id
      AND rooms.host_user_id = auth.uid()
    )
  );
