# Draw on Air — Architecture

## Overview

**Draw on Air** is a private, temporary, collaborative drawing-room web application. Users create private rooms with 6-digit codes, invite others through a host-approval system, and collaboratively draw on a shared canvas in real time.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router) |
| Language | JavaScript (JSX) |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Anonymous Auth |
| Realtime | Supabase Realtime (Broadcast + Presence) |
| Drawing | Native HTML Canvas + Pointer Events API |
| Deployment | Vercel + Supabase |

## Folder Structure

```
draw-on-air/
├── app/
│   ├── layout.js              # Root layout
│   ├── page.js                # Landing page (/)
│   ├── globals.css            # Global styles
│   ├── create/
│   │   └── page.js            # Create room (/create)
│   ├── join/
│   │   └── page.js            # Join room (/join)
│   └── room/
│       └── [roomId]/
│           └── page.js        # Room page (/room/[roomId])
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── landing/               # Landing page components
│   ├── room/                  # Room management components
│   ├── lobby/                 # Lobby components
│   └── drawing/               # Drawing canvas components
├── lib/
│   ├── supabase/
│   │   ├── client.js          # Browser Supabase client
│   │   └── server.js          # Server Supabase client (if needed)
│   ├── constants.js           # Shared constants (event names, states)
│   └── utils.js               # Utility functions
├── hooks/
│   ├── useAuth.js             # Authentication hook
│   ├── useRoom.js             # Room management hook
│   ├── useRealtime.js         # Realtime subscription hook
│   └── useDrawing.js          # Drawing engine hook
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── public/
├── .env.example
├── .gitignore
├── ARCHITECTURE.md
├── IMPLEMENTATION_PROGRESS.md
├── README.md
├── package.json
└── next.config.js
```

## Data Flow

```
User Action → Local Canvas Render → Collect Stroke Points → Batch/Throttle
     → Supabase Realtime Broadcast → Other Clients Render
     → On Stroke Complete → Persist to PostgreSQL
```

## Authentication Flow

1. User visits site
2. On Create/Join action, check for existing Supabase session
3. If no session, sign in anonymously via `supabase.auth.signInAnonymously()`
4. User gets a persistent Supabase auth user ID for the browser session
5. All authorization is based on this authenticated user ID
6. Display names are presentation-only, NOT identity

## Room Lifecycle

```
[Create Room] → WAITING → [Host Starts] → ACTIVE → [Host Ends] → ENDED
                  ↑                           ↑
            Join requests               New join requests
            Host approves/rejects       Host approves/rejects
                                        Drawing enabled
                                        Host can remove users
```

### State Machine

| State | Join Requests | Drawing | Host Actions |
|-------|--------------|---------|--------------|
| WAITING | Allowed | Disabled | Approve/Reject, Start Session |
| ACTIVE | Allowed | Enabled | Approve/Reject, Remove Users, End Session |
| ENDED | Blocked | Disabled | None |

## Realtime Event Flow

### Broadcast Events (Ephemeral, High-Frequency)

| Event | Direction | Purpose |
|-------|-----------|---------|
| `DRAW_START` | Client → All | New stroke beginning |
| `DRAW_POINTS` | Client → All | Batched stroke points |
| `DRAW_END` | Client → All | Stroke completed |
| `ERASE_STROKE` | Client → All | Stroke erased |
| `SESSION_STARTED` | Host → All | Session state change |
| `SESSION_ENDED` | Host → All | Session ended |
| `JOIN_REQUEST` | Joiner → Host | New join request |
| `JOIN_APPROVED` | Host → Joiner | Request approved |
| `JOIN_REJECTED` | Host → Joiner | Request rejected |
| `USER_REMOVED` | Host → User | User removed |

### Presence (Connection State)

- Track user online/offline status
- Detect host disconnection for grace period
- NOT used for drawing synchronization

## Drawing Synchronization Strategy

1. **Local-first rendering**: Draw immediately on local canvas
2. **Stroke collection**: Collect points during pointer move
3. **Batch broadcast**: Throttle broadcasts (~50ms intervals)
4. **Remote rendering**: Other clients render received points
5. **Persistence**: On stroke complete (pointerup), persist full stroke to PostgreSQL
6. **Late join sync**: 
   - Subscribe to realtime first
   - Fetch persisted strokes
   - Render persisted strokes
   - Process queued realtime events
   - Deduplicate by stroke ID

## Canvas Coordinate System

**Normalized coordinates (0-1 range)**:
- All points stored as `{ x: 0-1, y: 0-1, pressure: 0-1 }`
- `x = canvasX / canvasWidth`
- `y = canvasY / canvasHeight`
- Rendering multiplies by current canvas dimensions
- This ensures drawings look correct on any viewport size

## Database Schema

### rooms
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| room_code | varchar(6) | Unique, 6-digit numeric |
| host_user_id | uuid | References auth.users |
| status | text | WAITING / ACTIVE / ENDED |
| created_at | timestamptz | Default now() |
| started_at | timestamptz | Nullable |
| ended_at | timestamptz | Nullable |

### room_members
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| room_id | uuid | References rooms |
| user_id | uuid | References auth.users |
| display_name | varchar(50) | |
| role | text | HOST / PARTICIPANT |
| status | text | APPROVED / REMOVED / LEFT |
| joined_at | timestamptz | Default now() |
| left_at | timestamptz | Nullable |

### join_requests
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| room_id | uuid | References rooms |
| user_id | uuid | References auth.users |
| display_name | varchar(50) | |
| status | text | PENDING / APPROVED / REJECTED |
| created_at | timestamptz | Default now() |
| responded_at | timestamptz | Nullable |

### drawing_strokes
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| room_id | uuid | References rooms |
| user_id | uuid | References auth.users |
| tool | text | pen / marker / eraser |
| color | text | Hex color |
| width | real | Brush width (normalized) |
| points | jsonb | Array of {x, y, pressure} |
| created_at | timestamptz | Default now() |
| deleted_at | timestamptz | Nullable (soft delete for eraser) |

## RLS Strategy

### rooms
- Any authenticated user can SELECT rooms by room_code (to verify existence)
- Only host can UPDATE their room (status changes)
- Any authenticated user can INSERT (create room)

### room_members
- Users can SELECT their own membership record
- Host can SELECT all members for their room
- Host can UPDATE member status (remove)
- System inserts on approval

### join_requests
- Users can SELECT their own requests
- Host can SELECT requests for their room
- Users can INSERT their own requests
- Only host can UPDATE request status

### drawing_strokes
- Approved members can SELECT strokes for their room
- Approved members can INSERT strokes
- Stroke creator can UPDATE (soft delete) their own strokes

## Host Authorization

- Host is determined by `rooms.host_user_id` matching `auth.uid()`
- NEVER trust client-side state for host determination
- All privileged operations verified via RLS or server-side checks

## Reconnection Strategy

### Host Reconnection
- Grace period: 60 seconds
- Presence tracks host online state
- If host reconnects within grace period, room continues
- If host truly gone, participants see warning but room persists

### Participant Reconnection
- Re-authenticate (session should persist in browser)
- Verify membership still valid (not REMOVED)
- Re-subscribe to realtime channel
- Fetch any missed strokes since last known state
- Deduplicate by stroke ID
- Resume normal operation

## Deployment Architecture

```
User Browser
     │
     ▼
Vercel (Next.js)
     │
     ├── Static Pages (Landing, Create, Join)
     ├── Dynamic Pages (Room)
     ├── API Routes (if needed for server-side operations)
     └── Client-side Supabase SDK
              │
              ▼
         Supabase Cloud
         ├── Auth (Anonymous)
         ├── PostgreSQL (rooms, members, requests, strokes)
         ├── RLS (Row Level Security policies)
         ├── Realtime Broadcast (drawing events, notifications)
         └── Presence (online/offline tracking)
```

## Important Implementation Decisions

1. **JavaScript only** — No TypeScript, as specified in requirements
2. **Stroke-based eraser** — Removes/soft-deletes entire strokes, not pixel-level
3. **Normalized coordinates** — 0-1 range for cross-device compatibility
4. **Broadcast for ephemeral events** — Drawing points never stored as DB rows
5. **Persistence for completed strokes** — Only finished strokes go to PostgreSQL
6. **Private channels** — Room channels use `room:{roomId}` format
7. **Idempotent operations** — Stroke IDs prevent duplicates on reconnect
