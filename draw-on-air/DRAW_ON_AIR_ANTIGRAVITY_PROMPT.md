# Antigravity Implementation Prompt — Draw on Air

## 1. Role and objective

You are the primary implementation agent for this project.

Build the complete **Draw on Air** collaborative private drawing-room web application from scratch, under exactly this local path:

`C:\Users\budge\Desktop\19-september\brahamastra\draw-on-air`

Do not create the project in another directory.

You are expected to actually implement the application, not merely describe architecture or provide sample code.

Before making implementation decisions, inspect the existing directory and repository state. If the directory already contains a project, preserve useful existing work and adapt it rather than blindly deleting it. If it is empty, initialize the project there.

---

# 2. Mandatory stack

Use this stack unless there is a strong technical reason that makes a specific part impossible:

### Frontend / application
- Next.js
- JavaScript only
- Next.js App Router
- React
- Tailwind CSS
- shadcn/ui

### Backend / data / realtime
- Supabase
- Supabase PostgreSQL
- Supabase Anonymous Authentication
- Supabase Realtime Broadcast
- Supabase Realtime Presence
- Supabase Row Level Security (RLS)
- Supabase private Realtime channels

### Drawing
- Native HTML `<canvas>`
- Pointer Events API
- Must support:
  - mouse
  - touch
  - stylus
  - Apple Pencil where supported by the browser/device

### Deployment target
- Vercel for the Next.js application
- Supabase for database/auth/realtime

### Do NOT introduce initially
Do not add:
- Express
- separate Node.js backend
- Socket.IO server
- Firebase
- MongoDB
- Redis
- Kafka
- Kubernetes
- Docker
- AWS EC2
- another realtime provider
- another authentication provider

Keep the architecture simple and appropriate for a portfolio-scale collaborative application.

---

# 3. Product name

The application is called:

**Draw on Air**

It is a private, temporary, collaborative drawing-room application.

The core concept:

1. Host creates a private room.
2. A unique 6-digit numeric room code is generated.
3. Other users enter the room code and their display name.
4. Entering the room code alone does NOT grant access.
5. The host receives a join request.
6. The host can approve or reject the request.
7. Approved users enter the lobby/session.
8. Host starts the drawing session.
9. Approved users collaboratively draw on the same canvas in real time.
10. Every drawing stroke belongs to the user who created it.
11. Host can remove users.
12. Host can approve new users even after the session has started.
13. New users joining an active session receive the existing drawing state.
14. Participants can leave.
15. Host can end the entire session.
16. Ending the session invalidates the room.

---

# 4. Very important: implementation/checkpoint tracking

Create a project progress/checkpoint file immediately.

Use:

`C:\Users\budge\Desktop\19-september\brahamastra\draw-on-air\IMPLEMENTATION_PROGRESS.md`

This file is extremely important.

The purpose is to allow another Antigravity session to continue the implementation if the current context/token limit expires.

## Requirements for IMPLEMENTATION_PROGRESS.md

Maintain it throughout development.

It must contain:

```md
# Draw on Air — Implementation Progress

## Current Status
...

## Project State
- [ ] ...

## Completed
- [x] ...

## In Progress
- [ ] ...

## Next Steps
1. ...
2. ...
3. ...

## Important Decisions
- ...

## Database / Supabase Status
- ...

## Realtime Status
- ...

## Authentication Status
- ...

## UI Status
- ...

## Drawing Engine Status
- ...

## Security Status
- ...

## Testing Status
- ...

## Known Issues
- ...

## Files Created / Modified
- ...

## Environment Variables Required
- ...

## Last Checkpoint
- Timestamp:
- What was completed:
- What should be done next:

## Continuation Instructions
...
```

Update this file after every meaningful implementation milestone.

Do NOT wait until the entire project is complete.

At minimum, update it after:

1. project initialization
2. Supabase setup/schema
3. authentication
4. landing page
5. room creation
6. room joining
7. host approval/rejection
8. lobby
9. drawing canvas
10. realtime drawing
11. participant management
12. reconnection handling
13. security/RLS
14. testing
15. deployment preparation

The file must be detailed enough that if the current AI session ends and a new AI session starts, it can read this file and immediately understand:
- what has already been implemented
- what has not been implemented
- important architectural decisions
- current bugs
- exact next task

Never claim a feature is completed unless it actually works.

---

# 5. Also create an architecture/technical notes file

Create:

`C:\Users\budge\Desktop\19-september\brahamastra\draw-on-air\ARCHITECTURE.md`

Document:
- architecture
- folder structure
- data flow
- authentication flow
- room lifecycle
- realtime event flow
- drawing synchronization strategy
- database schema
- RLS strategy
- host authorization
- reconnection strategy
- deployment architecture
- important implementation decisions

Keep it updated if architecture changes.

---

# 6. First inspect the environment

Before implementation:

1. Inspect the target directory.
2. Determine whether a Git repository already exists.
3. Check Node.js version.
4. Check npm/pnpm availability.
5. Check whether Next.js is already initialized.
6. Check existing package.json.
7. Check existing environment files.
8. Check whether Supabase configuration already exists.
9. Do not overwrite useful existing work.
10. Create a backup only if necessary before destructive changes.

Then update `IMPLEMENTATION_PROGRESS.md`.

---

# 7. Application pages

Implement at least these routes:

```text
/
 /create
 /join
 /room/[roomId]
```

You may introduce additional routes/components where useful.

---

# 8. Landing page

The homepage should be clean, modern, minimal, and responsive.

Show:

**Draw on Air**

Short description explaining that users can create a private collaborative drawing room.

Two primary actions:

- Create Room
- Join Room

Do not overcrowd the page.

Use shadcn/ui components where appropriate.

---

# 9. Create Room flow

When a user clicks `Create Room`:

1. Authenticate the user anonymously with Supabase.
2. Ask for a display name if needed.
3. Generate a random unique 6-digit numeric room ID.
4. Verify that the room ID does not already exist.
5. Create the room in Supabase.
6. Set the authenticated user as the host.
7. Set room state to:

`WAITING`

8. Redirect the host to:

`/room/[roomId]`

The room code must be exactly six numeric digits.

Examples:

```text
381204
729451
105832
```

Do not use alphabetic characters.

Do not rely on client-side randomness alone for authorization.

---

# 10. Room security

The 6-digit room code is only a room identifier.

It is NOT authentication.

Knowing:

`123456`

must NOT automatically allow someone into the room.

The actual authorization model must be based on the authenticated Supabase user identity and server/database authorization.

Never trust:
- localStorage
- cookies created only by frontend JavaScript
- URL parameters
- client-side `isHost`
- hidden frontend state

for security decisions.

The backend/database/RLS must enforce authorization.

---

# 11. Join flow

On `/join`:

Allow the user to enter:

- 6-digit room ID
- display name

Validate:
- room ID must be exactly six digits
- display name must be non-empty
- reasonable maximum display-name length

When submitted:

1. Authenticate anonymously if necessary.
2. Find the room.
3. Verify room exists.
4. Verify room is not `ENDED`.
5. Create a join request.
6. Do NOT immediately grant room access.
7. Show:

`Waiting for host approval...`

The user should receive realtime updates when the host approves or rejects the request.

---

# 12. Host lobby

Before the drawing session starts, the host must see a lobby.

The lobby must show:

### Pending Requests

For each request:
- display name
- request status
- Allow
- Reject

### Approved Participants

Show:
- display name
- online/offline status where available
- participant status

The host is allowed to see the full participant list.

---

# 13. Participant privacy

Normal participants must NOT be able to see the complete participant list.

This is important.

A participant should know:
- their own identity
- whether they are approved
- whether they are connected
- information necessary for the drawing session

But do not expose a full roster to ordinary participants unless explicitly needed for a feature.

The host has full participant visibility.

Enforce this at the data/security layer, not merely by hiding UI elements.

---

# 14. Host starts session

The host has a:

`Start Session`

button.

When clicked:

1. Verify current user is actually the host.
2. Verify room is in `WAITING`.
3. Change room state to:

`ACTIVE`

4. Broadcast the session-start event.
5. All approved participants should transition into drawing mode.

Only the host can perform this operation.

---

# 15. Room state machine

Use exactly these conceptual room states:

```text
WAITING
ACTIVE
ENDED
```

### WAITING
- host exists
- join requests allowed
- host can approve/reject
- participants wait
- host can start session

### ACTIVE
- drawing enabled
- realtime collaboration enabled
- host can remove participants
- host can approve new participants
- new approved users receive current drawing state

### ENDED
- room is invalid
- no new participants
- drawing disabled
- users should see a session-ended message
- room cannot be restarted

Do not allow invalid state transitions.

---

# 16. Drawing canvas

The drawing interface should be dark and modern.

Use a native HTML canvas.

Do not use a heavy drawing library unless there is a compelling reason.

The canvas must support:

- pen
- marker
- eraser

Suggested controls:

```text
Pen
Marker
Eraser
Brush Size
Clear/Undo if appropriate
```

Keep the toolbar minimal.

---

# 17. Drawing behavior

Support:

- mouse drawing
- touch drawing
- stylus drawing
- Apple Pencil where browser/device APIs expose it

Use Pointer Events.

Handle:

```text
pointerdown
pointermove
pointerup
pointercancel
pointerleave
```

Use pointer capture where appropriate.

Prevent unwanted browser scrolling/gestures while drawing.

The canvas should work on:
- desktop
- laptop
- iPad
- mobile

Handle device pixel ratio correctly so drawings remain sharp.

Resize handling must not unexpectedly destroy the drawing.

---

# 18. Drawing synchronization architecture

This is extremely important.

DO NOT send the entire canvas image through realtime for every pointer movement.

DO NOT insert every pointer coordinate as a PostgreSQL row.

Use an event/stroke-based model.

Conceptually:

```text
User draws
    ↓
Local canvas renders immediately
    ↓
Collect stroke points
    ↓
Batch/throttle points
    ↓
Supabase Realtime Broadcast
    ↓
Other clients render stroke locally
    ↓
When stroke finishes
    ↓
Persist completed stroke
```

Local rendering must feel immediate.

Realtime synchronization should be optimized for low latency.

---

# 19. Stroke model

Every stroke should have:

- unique stroke ID
- room ID
- user ID
- display name or resolvable owner identity
- tool type
- color
- brush size
- points
- timestamps
- creation order/version where needed

Example conceptual object:

```js
{
  id,
  roomId,
  userId,
  tool: "pen",
  color,
  width,
  points: [
    { x, y, pressure },
    { x, y, pressure }
  ],
  createdAt
}
```

Do not blindly copy this exact schema if a better normalized database representation is needed.

---

# 20. Stroke ownership / attribution

Every stroke must belong to the authenticated user who created it.

When a user hovers/selects/taps a stroke or a point belonging to a stroke, display a subtle indicator such as:

`Drawn by Rahul`

or:

`Drawn by You`

depending on ownership.

Do not make attribution visually distracting.

Prefer stroke-level attribution rather than trying to infer ownership from raw canvas pixels.

---

# 21. Eraser design

Prefer a stroke-based eraser for the initial implementation.

The eraser should remove/disable an existing stroke rather than destructively altering a shared raster image.

This makes:
- synchronization easier
- ownership easier
- persistence easier
- attribution easier
- reconnection easier

If needed, model erasure as an operation/event rather than physically deleting history immediately.

Make sure all clients converge to the same final drawing state.

---

# 22. Persistent drawing state

Completed drawing state must be persisted in Supabase.

When a new participant joins an ACTIVE session:

1. Authenticate.
2. Verify approved membership.
3. Fetch the current persisted drawing state.
4. Render it locally.
5. Subscribe to realtime drawing events.
6. Then continue receiving new strokes.

Avoid a race condition where the user fetches old strokes and misses realtime strokes created during the fetch.

Design the synchronization order carefully.

Possible approach:

1. Establish realtime subscription.
2. Fetch persisted state.
3. Apply persisted state.
4. Process newer realtime events.
5. Deduplicate by stroke/operation ID.

Use a robust approach rather than a fragile implementation.

---

# 23. Realtime architecture

Use Supabase Realtime.

Use:

### Broadcast
For high-frequency ephemeral events such as:

```text
DRAW_START
DRAW_POINTS
DRAW_END
ERASE_STROKE
SESSION_STARTED
SESSION_ENDED
JOIN_REQUEST
JOIN_APPROVED
JOIN_REJECTED
USER_REMOVED
```

You may adjust event names if implementation requires it.

Do NOT store every high-frequency realtime point as a database row.

### Presence

Use Supabase Presence for connection/online state.

Presence is NOT the primary drawing synchronization mechanism.

---

# 24. Private realtime channels

Use private Supabase Realtime channels.

A room channel can conceptually be:

```text
room:<roomId>
```

Do not make room drawing data publicly accessible.

Realtime authorization must be backed by database/RLS policies.

---

# 25. Database schema

Use Supabase PostgreSQL.

Create a proper migration/schema.

At minimum create conceptual tables for:

## rooms

Fields such as:

```text
id
room_code
host_user_id
status
created_at
started_at
ended_at
```

## room_members

Fields such as:

```text
id
room_id
user_id
display_name
role
status
joined_at
left_at
```

Roles:

```text
HOST
PARTICIPANT
```

Statuses can include:

```text
APPROVED
REMOVED
LEFT
```

## join_requests

Fields such as:

```text
id
room_id
user_id
display_name
status
created_at
responded_at
```

Statuses:

```text
PENDING
APPROVED
REJECTED
```

## drawing_strokes

Fields such as:

```text
id
room_id
user_id
tool
color
width
points
created_at
deleted_at
```

Use JSON/JSONB for points if appropriate.

You may add additional fields/tables if needed.

---

# 26. Supabase Anonymous Authentication

Use Supabase Anonymous Sign-In.

Each browser session should have an authenticated Supabase user ID.

Do not treat display name as identity.

Identity is:

```text
Supabase auth user ID
```

Display name is merely presentation data.

Be aware that anonymous authentication is temporary/browser-dependent. That is acceptable for this project's temporary-room use case.

---

# 27. RLS and authorization

This is a major requirement.

Enable RLS on all application tables.

Write policies so that:

### Rooms
- authenticated users can access only appropriate room data
- host-only operations are protected

### Room members
- users can access their own membership
- host can see/manage members
- normal participants cannot freely enumerate all members

### Join requests
- requester can see their own request/status
- host can see requests for their room
- only host can approve/reject

### Drawing strokes
- approved room members can read drawing state
- approved room members can create drawing operations
- authorization must verify membership

### End session
Only host can end a session.

### Remove participant
Only host can remove participants.

### Start session
Only host can start.

Do not rely solely on frontend checks.

---

# 28. Host authorization

The host must be determined from trusted database/auth state.

Do NOT trust:

```js
localStorage.getItem("isHost")
```

or:

```js
const isHost = true;
```

or URL parameters.

Every privileged operation must be authorized using authenticated user identity + database state/RLS/server-side validation.

---

# 29. Host disconnect/reconnection

Handle host disconnection gracefully.

Do NOT immediately destroy the room merely because the host's browser temporarily disconnects.

Provide a grace/reconnection mechanism.

For example:
- detect host presence/disconnect
- allow a reasonable grace period
- allow host to reconnect
- only terminate/invalidate if the host is actually gone according to the application's defined policy

Document the chosen timeout/policy in `ARCHITECTURE.md`.

---

# 30. Participant disconnect/reconnection

If a normal participant temporarily disconnects:

- do not lose their identity immediately
- allow reconnection
- restore their approved membership
- resubscribe to realtime
- synchronize missing drawing state
- prevent duplicate strokes/events

Presence should help determine online state.

---

# 31. Host removes participant

During ACTIVE:

Host can remove a participant.

When removed:

1. Update membership state securely.
2. Broadcast `USER_REMOVED`.
3. Removed user immediately loses drawing permissions.
4. Removed user sees a clear message.
5. Removed user cannot continue sending drawing operations.
6. Existing drawings remain unless host explicitly chooses another operation.

A removed user must not regain access simply by refreshing the page.

---

# 32. New participants after session starts

Host must be able to approve new join requests while ACTIVE.

Approved users:

1. enter drawing room
2. receive current persisted drawing
3. subscribe to realtime
4. begin drawing normally

They should NOT receive drawing history from unauthorized rooms.

---

# 33. Participant leaving

A normal participant can leave the room.

When they leave:
- mark membership appropriately
- unsubscribe from realtime
- drawing remains
- other users continue normally

Their existing strokes remain associated with their identity.

---

# 34. End session

Host sees:

`End Session`

When clicked, use confirmation.

After confirmation:

1. verify host
2. change room status to `ENDED`
3. stop new join requests
4. stop drawing
5. notify all connected users
6. show session-ended UI
7. unsubscribe from realtime
8. invalidate future access

Do not allow normal participants to end the room.

---

# 35. Error handling

Implement useful error states for:

- room not found
- invalid room code
- room already ended
- join request rejected
- request already pending
- user removed
- unauthorized action
- network disconnected
- realtime connection failure
- Supabase failure
- failed room creation
- failed session start
- failed drawing persistence

Do not expose raw database errors to users.

Provide human-readable messages.

---

# 36. Loading states

Every async operation needs an appropriate loading state.

Examples:

- Creating room...
- Joining...
- Waiting for host...
- Approving...
- Rejecting...
- Starting session...
- Loading canvas...
- Reconnecting...

Prevent duplicate button submissions.

---

# 37. UI/UX requirements

Visual style:

- modern
- minimal
- clean
- dark-friendly
- professional
- portfolio-quality

Avoid:
- excessive gradients
- excessive animations
- unnecessary glassmorphism everywhere
- huge cards
- clutter
- excessive decorative content

The drawing canvas should be the main focus.

Use shadcn/ui where appropriate for:
- buttons
- dialogs
- inputs
- badges
- dropdowns
- alerts
- tooltips

---

# 38. Responsive design

The application must work on:

- desktop
- laptop
- iPad
- mobile

Pay special attention to drawing UX on touch devices.

The drawing canvas should adapt to viewport dimensions.

The toolbar must remain usable on smaller screens.

Do not create horizontal overflow unnecessarily.

---

# 39. Performance requirements

Optimize for real-time collaboration.

Do NOT:
- rerender the entire React tree on every pointer movement
- write every pointer movement to PostgreSQL
- broadcast enormous canvas images continuously
- recreate canvas unnecessarily

Use refs and imperative canvas operations where appropriate.

React state should not be the source of truth for every high-frequency drawing coordinate.

Use:
- requestAnimationFrame where useful
- batching/throttling
- local immediate rendering
- compact realtime events
- stroke-level persistence

---

# 40. Canvas coordinate system

Design a consistent coordinate system so that drawings remain correctly positioned across different viewport sizes.

Prefer normalized coordinates or another robust coordinate model.

Do not assume all participants have the same canvas width/height.

Document the chosen coordinate system in `ARCHITECTURE.md`.

---

# 41. Environment variables

Use `.env.local` for local secrets/configuration.

Do not commit secrets.

Use appropriate public Supabase configuration in the browser and never expose service-role secrets to the client.

At minimum expect something conceptually like:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

If additional variables are needed, document them in:

`IMPLEMENTATION_PROGRESS.md`

and provide a safe `.env.example`.

Never put the Supabase service-role key in client-side code.

---

# 42. Supabase setup

Create proper SQL migration files inside the project, for example:

```text
supabase/
  migrations/
```

Do not rely only on manually clicking things in the Supabase dashboard.

The schema should be reproducible.

Include:
- tables
- indexes
- constraints
- RLS
- policies
- functions/triggers if required

Document any dashboard-only configuration that cannot be represented in SQL.

---

# 43. Database indexes

Think about query performance.

At minimum consider indexes for:

- room_code
- room status
- room_members.room_id
- room_members.user_id
- join_requests.room_id
- join_requests.status
- drawing_strokes.room_id
- drawing_strokes.created_at

Do not blindly add indexes without considering actual queries.

---

# 44. Data consistency

The application must handle duplicate events safely.

For example:
- duplicate join request events
- duplicate drawing events
- reconnect events
- repeated approval events
- repeated session-start events

Use unique IDs/idempotency where appropriate.

---

# 45. Security checklist

Before declaring the project complete, verify:

- [ ] Room code alone does not grant access.
- [ ] Host status cannot be forged through frontend state.
- [ ] Participant cannot approve themselves.
- [ ] Participant cannot start session.
- [ ] Participant cannot end session.
- [ ] Participant cannot remove another participant.
- [ ] Removed participant cannot draw.
- [ ] User cannot read unauthorized room data.
- [ ] User cannot read unauthorized drawing data.
- [ ] User cannot manipulate another user's identity.
- [ ] Service-role secrets are never exposed client-side.
- [ ] RLS is enabled.
- [ ] Realtime channels are private/authorized.

---

# 46. Testing

Create meaningful tests where practical.

At minimum manually test the complete flow with multiple browser tabs/windows:

### Test 1 — Host
- Create room.
- Verify 6-digit code.
- Verify host enters room.

### Test 2 — Unauthorized join
- Open another browser.
- Enter room code.
- Verify it does not immediately enter.

### Test 3 — Approval
- Host sees request.
- Host approves.
- Participant enters.

### Test 4 — Rejection
- Host rejects.
- Participant receives rejection.

### Test 5 — Lobby privacy
- Host sees participant list.
- Normal participant does not see full participant list.

### Test 6 — Drawing
- Host draws.
- Participant sees drawing.
- Participant draws.
- Host sees drawing.

### Test 7 — Attribution
- Hover/tap/select stroke.
- Correct user identity appears.

### Test 8 — Eraser
- Erase a stroke.
- All clients converge to same state.

### Test 9 — Late join
- Session is already ACTIVE.
- Host approves another user.
- New user receives existing canvas.

### Test 10 — Removal
- Host removes participant.
- Participant loses drawing access.
- Existing strokes remain.

### Test 11 — Participant leave
- Participant leaves.
- Existing drawing remains.

### Test 12 — Host end
- Host ends session.
- All clients see session ended.
- Room cannot be re-entered.

### Test 13 — Reconnection
- Disconnect network temporarily.
- Reconnect.
- Verify state is recovered.

### Test 14 — Refresh
- Refresh active participant page.
- Verify membership and canvas state recover correctly.

---

# 47. Git

If the repository is not already initialized:

Initialize Git.

Create sensible commits at major milestones if appropriate.

Do not commit:
- `.env.local`
- secrets
- service-role keys
- node_modules
- build artifacts

Create/update `.gitignore` appropriately.

---

# 48. Code quality

Write production-quality code.

Requirements:
- meaningful names
- reusable components
- clear separation of concerns
- avoid giant components
- avoid duplicated Supabase logic
- centralize realtime event names
- centralize database/client initialization
- use clear TypeScript-like organization concepts even though the project MUST remain JavaScript

Again:

**Do not convert this project to TypeScript.**

Use `.js` / `.jsx`.

---

# 49. Suggested project structure

You may improve this structure, but keep the architecture organized:

```text
draw-on-air/
│
├── app/
│   ├── page.js
│   ├── create/
│   │   └── page.js
│   ├── join/
│   │   └── page.js
│   └── room/
│       └── [roomId]/
│           └── page.js
│
├── components/
│   ├── ui/
│   ├── landing/
│   ├── room/
│   ├── lobby/
│   └── drawing/
│
├── lib/
│   ├── supabase/
│   ├── realtime/
│   ├── auth/
│   ├── room/
│   └── drawing/
│
├── hooks/
│
├── utils/
│
├── supabase/
│   └── migrations/
│
├── public/
│
├── .env.example
├── .gitignore
├── ARCHITECTURE.md
├── IMPLEMENTATION_PROGRESS.md
├── package.json
└── ...
```

Adjust as necessary.

---

# 50. Important architecture rule

Separate:

## Persistent state

Supabase PostgreSQL:

```text
rooms
members
join requests
completed strokes
session state
```

from:

## Ephemeral realtime state

Supabase Realtime:

```text
drawing events
join notifications
approval notifications
session notifications
presence
```

Do not use PostgreSQL as a high-frequency WebSocket replacement.

---

# 51. Do not over-engineer

This is a portfolio/personal application.

Do not introduce distributed systems complexity unnecessarily.

Do not create:
- microservices
- Kubernetes
- Redis
- Kafka
- dedicated WebSocket servers
- multiple backend services

unless a future requirement genuinely makes it necessary.

The goal is a robust but understandable application.

---

# 52. Deployment

Prepare the project for:

**Vercel + Supabase**

The final architecture should be:

```text
User Browser
     │
     ▼
Vercel
     │
     ├── Next.js UI
     ├── React
     ├── Canvas
     └── Server/API logic
             │
             ▼
        Supabase
        ├── Auth
        ├── PostgreSQL
        ├── RLS
        ├── Realtime Broadcast
        └── Presence
```

Make sure the project can be deployed to Vercel without architectural changes.

---

# 53. Important implementation behavior

Do not stop after creating the UI.

The application must be genuinely functional.

A fake frontend with mocked:
- room creation
- join requests
- approval
- drawing
- realtime events

is NOT acceptable.

Use real Supabase integration.

---

# 54. Work autonomously

Implement the project in logical milestones.

Do not repeatedly ask for confirmation for routine implementation choices.

If a small implementation decision is ambiguous, choose the simplest robust solution and document it in `ARCHITECTURE.md`.

Only ask for user input when an external credential or genuinely unavailable information is required.

For example, Supabase project credentials may need to be supplied/configured by the user. In that case:
1. implement everything that can be implemented locally first
2. document exactly what is needed
3. create `.env.example`
4. update `IMPLEMENTATION_PROGRESS.md`

Do not leave the entire application unfinished just because Supabase credentials are not yet configured.

---

# 55. Checkpoint behavior when context/token limit approaches

This is extremely important.

If you detect that the current context/token budget is becoming limited:

1. Stop starting large new features.
2. Finish the smallest safe unit of work.
3. Run/build/test what you changed.
4. Update `IMPLEMENTATION_PROGRESS.md`.
5. Record:
   - exactly what was completed
   - exactly what remains
   - files changed
   - current bugs
   - next action
   - commands needed to continue
6. Do not leave the project in an undocumented half-finished state.

At the beginning of every new session, FIRST read:

```text
IMPLEMENTATION_PROGRESS.md
ARCHITECTURE.md
```

Then inspect the actual repository state.

Never assume the previous AI completed something merely because the progress file says so. Verify important completed work against the code.

---

# 56. Definition of done

Do not declare the project complete until:

- [ ] Next.js application runs locally.
- [ ] Landing page works.
- [ ] Create Room works.
- [ ] Unique 6-digit room codes work.
- [ ] Supabase anonymous authentication works.
- [ ] Join Room works.
- [ ] Join requests work.
- [ ] Host approval works.
- [ ] Host rejection works.
- [ ] Lobby works.
- [ ] Participant privacy is enforced.
- [ ] Session start works.
- [ ] Canvas works with mouse.
- [ ] Canvas works with touch.
- [ ] Canvas works with stylus where supported.
- [ ] Pen works.
- [ ] Marker works.
- [ ] Eraser works.
- [ ] Drawing is synchronized in real time.
- [ ] Drawing persistence works.
- [ ] New participants receive existing drawing state.
- [ ] Stroke ownership works.
- [ ] Attribution UI works.
- [ ] Host can remove participants.
- [ ] Removed participants cannot continue drawing.
- [ ] Participants can leave.
- [ ] Host can approve participants after session starts.
- [ ] Host can end session.
- [ ] Ended rooms cannot be used.
- [ ] Reconnection works reasonably.
- [ ] RLS is implemented.
- [ ] Realtime authorization is implemented.
- [ ] Secrets are protected.
- [ ] Error/loading states work.
- [ ] Responsive UI works.
- [ ] No unnecessary dependencies/services were added.
- [ ] Production build succeeds.
- [ ] `IMPLEMENTATION_PROGRESS.md` is up to date.
- [ ] `ARCHITECTURE.md` is up to date.
- [ ] `.env.example` exists.
- [ ] README contains setup instructions.

---

# 57. Final README requirements

Create a useful `README.md` containing:

1. Project overview
2. Features
3. Tech stack
4. Architecture
5. Local setup
6. Supabase setup
7. Environment variables
8. Database migrations
9. Running locally
10. Testing
11. Deployment to Vercel
12. Security notes
13. Known limitations
14. Future improvements

---

# 58. Final instruction

Start now.

Your first actions should be:

1. Inspect:
   `C:\Users\budge\Desktop\19-september\brahamastra\draw-on-air`
2. Create/read the project state.
3. Create `IMPLEMENTATION_PROGRESS.md`.
4. Create `ARCHITECTURE.md`.
5. Initialize or adapt the Next.js JavaScript project.
6. Set up the recommended architecture.
7. Implement the project milestone by milestone.
8. Keep the checkpoint file continuously updated.
9. Test each major feature before moving on.
10. Do not merely explain what you would do — actually implement it.

The final result should be a working, secure, real-time collaborative drawing application called **Draw on Air**, ready for local testing and Vercel + Supabase deployment.
