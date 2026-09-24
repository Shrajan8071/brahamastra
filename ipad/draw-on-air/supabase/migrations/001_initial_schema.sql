-- Draw on Air — Initial Database Schema
-- Run this in your Supabase SQL Editor or as a migration

-- ============================================
-- 1. TABLES
-- ============================================

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code VARCHAR(6) NOT NULL UNIQUE,
  host_user_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'ACTIVE', 'ENDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

-- Room members table
CREATE TABLE IF NOT EXISTS room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  display_name VARCHAR(50) NOT NULL,
  role TEXT NOT NULL DEFAULT 'PARTICIPANT' CHECK (role IN ('HOST', 'PARTICIPANT')),
  status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (status IN ('APPROVED', 'REMOVED', 'LEFT')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  UNIQUE (room_id, user_id)
);

-- Join requests table
CREATE TABLE IF NOT EXISTS join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  display_name VARCHAR(50) NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);

-- Drawing strokes table
CREATE TABLE IF NOT EXISTS drawing_strokes (
  id TEXT PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tool TEXT NOT NULL CHECK (tool IN ('pen', 'marker', 'eraser')),
  color TEXT NOT NULL DEFAULT '#e8e8ed',
  width REAL NOT NULL DEFAULT 0.003,
  points JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ============================================
-- 2. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_rooms_room_code ON rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_rooms_host ON rooms(host_user_id);

CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_room_members_room_user ON room_members(room_id, user_id);

CREATE INDEX IF NOT EXISTS idx_join_requests_room ON join_requests(room_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON join_requests(status);
CREATE INDEX IF NOT EXISTS idx_join_requests_room_status ON join_requests(room_id, status);
CREATE INDEX IF NOT EXISTS idx_join_requests_user ON join_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_drawing_strokes_room ON drawing_strokes(room_id);
CREATE INDEX IF NOT EXISTS idx_drawing_strokes_room_created ON drawing_strokes(room_id, created_at);

-- ============================================
-- 3. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawing_strokes ENABLE ROW LEVEL SECURITY;

-- ---- ROOMS ----

-- Any authenticated user can read rooms (needed to look up by room_code)
CREATE POLICY "rooms_select_authenticated" ON rooms
  FOR SELECT
  TO authenticated
  USING (true);

-- Any authenticated user can create a room
CREATE POLICY "rooms_insert_authenticated" ON rooms
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_user_id);

-- Only the host can update their room
CREATE POLICY "rooms_update_host" ON rooms
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_user_id)
  WITH CHECK (auth.uid() = host_user_id);

-- ---- ROOM MEMBERS ----

-- Users can see their own membership
CREATE POLICY "members_select_own" ON room_members
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Host can see all members in their room
CREATE POLICY "members_select_host" ON room_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = room_members.room_id
      AND rooms.host_user_id = auth.uid()
    )
  );

-- Only host can insert members (when approving join requests)
CREATE POLICY "members_insert_host_only" ON room_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- The inserter must be the host of the room, OR inserting themselves as HOST role
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = room_members.room_id
      AND rooms.host_user_id = auth.uid()
    )
    OR (
      -- Allow self-insert only when creating as HOST (room creator)
      auth.uid() = user_id
      AND role = 'HOST'
    )
  );

-- Host can update member status (remove participants)
CREATE POLICY "members_update_host" ON room_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = room_members.room_id
      AND rooms.host_user_id = auth.uid()
    )
  );

-- Users can update their own membership (only to leave)
CREATE POLICY "members_update_own" ON room_members
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
  )
  WITH CHECK (
    -- Participants can only set their status to LEFT
    status = 'LEFT'
  );

-- ---- JOIN REQUESTS ----

-- Users can see their own requests
CREATE POLICY "requests_select_own" ON join_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Host can see requests for their room
CREATE POLICY "requests_select_host" ON join_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = join_requests.room_id
      AND rooms.host_user_id = auth.uid()
    )
  );

-- Authenticated users can create join requests
CREATE POLICY "requests_insert_authenticated" ON join_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Host can update request status (approve/reject)
CREATE POLICY "requests_update_host" ON join_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM rooms
      WHERE rooms.id = join_requests.room_id
      AND rooms.host_user_id = auth.uid()
    )
  );

-- ---- DRAWING STROKES ----

-- Approved members can read strokes for their room
CREATE POLICY "strokes_select_member" ON drawing_strokes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = drawing_strokes.room_id
      AND room_members.user_id = auth.uid()
      AND room_members.status = 'APPROVED'
    )
  );

-- Approved members can create strokes
CREATE POLICY "strokes_insert_member" ON drawing_strokes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = drawing_strokes.room_id
      AND room_members.user_id = auth.uid()
      AND room_members.status = 'APPROVED'
    )
  );

-- Stroke creator can update (soft delete for eraser)
CREATE POLICY "strokes_update_own" ON drawing_strokes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Any approved member can update strokes (for eraser to work across users)
CREATE POLICY "strokes_update_member" ON drawing_strokes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = drawing_strokes.room_id
      AND room_members.user_id = auth.uid()
      AND room_members.status = 'APPROVED'
    )
  );
