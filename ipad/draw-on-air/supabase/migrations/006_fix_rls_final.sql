-- Draw on Air — FINAL Fix: No Circular RLS Dependencies
-- Run this ENTIRE script in your Supabase SQL Editor

-- ============================================================
-- STEP 1: Create SECURITY DEFINER helper (bypasses RLS internally)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_room_participant(_room_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = _room_id
      AND user_id = _user_id
      AND status = 'APPROVED'
  );
$$;

-- Also create a helper to check if user is host of a room (avoids repeated subquery pattern)
CREATE OR REPLACE FUNCTION public.is_room_host(_room_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rooms
    WHERE id = _room_id
      AND host_user_id = _user_id
  );
$$;

-- ============================================================
-- STEP 2: Fix room_members SELECT policies
-- KEY RULE: room_members SELECT must NEVER call is_room_participant()
--           because that would query room_members → circular recursion!
--           Only use direct column checks or queries to OTHER tables (rooms).
-- ============================================================

-- Drop ALL existing select policies on room_members
DROP POLICY IF EXISTS "members_select_own" ON room_members;
DROP POLICY IF EXISTS "members_select_host" ON room_members;
DROP POLICY IF EXISTS "members_select_room_participants" ON room_members;
DROP POLICY IF EXISTS "members_select_policy" ON room_members;

-- Policy 1: User can see their own membership row (direct column check — no recursion)
CREATE POLICY "members_select_own" ON room_members
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Policy 2: Room host can see ALL members in their room (queries rooms table — no recursion)
CREATE POLICY "members_select_host" ON room_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms
      WHERE rooms.id = room_members.room_id
        AND rooms.host_user_id = auth.uid()
    )
  );

-- Policy 3: Approved members can see each other (uses SECURITY DEFINER — no RLS loop)
-- is_room_participant() runs as table owner, bypassing RLS on room_members
CREATE POLICY "members_select_approved_peers" ON room_members
  FOR SELECT TO authenticated
  USING (
    public.is_room_participant(room_id, auth.uid())
  );

-- ============================================================
-- STEP 3: Fix drawing_strokes policies
-- These CAN safely use is_room_participant() because SECURITY DEFINER bypasses RLS
-- ============================================================

DROP POLICY IF EXISTS "strokes_select_member" ON drawing_strokes;
DROP POLICY IF EXISTS "strokes_insert_member" ON drawing_strokes;
DROP POLICY IF EXISTS "strokes_update_member" ON drawing_strokes;
DROP POLICY IF EXISTS "strokes_update_own" ON drawing_strokes;

-- SELECT: approved members + host can read strokes
CREATE POLICY "strokes_select_member" ON drawing_strokes
  FOR SELECT TO authenticated
  USING (
    public.is_room_participant(room_id, auth.uid())
    OR public.is_room_host(room_id, auth.uid())
  );

-- INSERT: only approved members + host can create strokes for themselves
CREATE POLICY "strokes_insert_member" ON drawing_strokes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.is_room_participant(room_id, auth.uid())
      OR public.is_room_host(room_id, auth.uid())
    )
  );

-- UPDATE: stroke owner can update (for soft delete / eraser)
CREATE POLICY "strokes_update_own" ON drawing_strokes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- UPDATE: any approved member or host can update strokes (eraser tool affects others' strokes)
CREATE POLICY "strokes_update_member" ON drawing_strokes
  FOR UPDATE TO authenticated
  USING (
    public.is_room_participant(room_id, auth.uid())
    OR public.is_room_host(room_id, auth.uid())
  );

-- ============================================================
-- STEP 4: Fix join_requests policies if needed
-- ============================================================

-- Ensure join_requests select policies are simple and non-recursive
DROP POLICY IF EXISTS "requests_select_own" ON join_requests;
DROP POLICY IF EXISTS "requests_select_host" ON join_requests;

CREATE POLICY "requests_select_own" ON join_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "requests_select_host" ON join_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms
      WHERE rooms.id = join_requests.room_id
        AND rooms.host_user_id = auth.uid()
    )
  );

-- ============================================================
-- VERIFICATION: List all policies to confirm they were applied
-- ============================================================
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('room_members', 'drawing_strokes', 'join_requests')
ORDER BY tablename, policyname;
