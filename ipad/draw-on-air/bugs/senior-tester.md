# Senior Tester — Application Bug Audit

## Audit Status

**Status:** Completed

**Role:** Senior QA / Software Tester

**Purpose:** Identify and document bugs only. No fixes are being made during this phase.

**Application:** Draw on Air (Collaborative Drawing Room Web Application)

**Technology Stack:** Next.js 16 (App Router), React 19, JavaScript (ES6+), Tailwind CSS 4, Supabase (PostgreSQL, Realtime Broadcast, Anonymous Auth, RLS), Native HTML5 Canvas + Pointer Events API.

**Audit Started:** 2026-09-23T23:35:00+05:30

---

# Project Understanding

## Architecture
**Draw on Air** is a client-heavy, serverless collaborative whiteboarding application. 
- **Frontend Architecture**: Built using Next.js App Router with React client components (`'use client'`). Routing relies on dynamic pages (`/room/[roomId]`). UI rendering combines Tailwind CSS v4 variables with Radix UI primitives (Dialog, Slot) and Lucide React icons.
- **Canvas Rendering Engine**: Utilizes a native HTML5 `<canvas>` element managed via standard React `useRef` hooks to bypass React DOM re-render overhead during high-frequency input. Supports mouse, touch, stylus, and Apple Pencil inputs via the Pointer Events API. Pan and Zoom feature a 2D Matrix transformation pipeline applying DPI scaling.
- **Data & Realtime Synchronization**: Features a hybrid synchronization strategy:
  1. High-frequency stroke streaming over Supabase Realtime Broadcast WebSockets (`DRAW_START`, `DRAW_POINTS`, `DRAW_END`, `ERASE_STROKE`).
  2. Persistent stroke storage in Supabase PostgreSQL (`drawing_strokes` table) using normalized world coordinates.
  3. Late-join state fetching over REST API (`fetchStrokes()`) combined with polling backup intervals.

## Frontend
- `app/layout.js`: Global Root Layout configuring Geist Sans and Geist Mono Google fonts and HTML dark class.
- `app/page.js`: Homepage / Landing Page featuring options to Create or Join a private room.
- `app/create/page.js`: Room creation form generating random 6-digit numeric room codes and assigning Host status.
- `app/join/page.js`: Room join form validating 6-digit room codes and display names, creating pending join requests.
- `app/room/[roomId]/page.js`: Dynamic room container managing membership states (`WAITING`, `ACTIVE`, `ENDED`), host approval flows, and socket event subscriptions.
- `components/drawing/DrawingRoom.jsx`: Core canvas drawing component with toolbar (Pen, Marker, Eraser, Pan), color picker popover, brush size adjuster, and zoom/pan overlays.
- `components/lobby/HostLobby.jsx`: Host lobby UI displaying active room code, pending requests queue, participant roster, and session controls.
- `components/lobby/ParticipantWaiting.jsx`: Waiting view for approved participants prior to host session launch.
- `components/room/SessionEnded.jsx`: View displayed when host terminates the drawing room.

## Backend
- Serverless architecture leveraging Supabase backend-as-a-service. Next.js App Router serves as the static asset and client routing server without a standalone Node.js Express server.

## Database
- PostgreSQL database hosted on Supabase:
  - `rooms`: Stores room ID (UUID), 6-digit room code, host user ID, room status (`WAITING`, `ACTIVE`, `ENDED`), and lifecycle timestamps.
  - `room_members`: Maps users to rooms with roles (`HOST`, `PARTICIPANT`), statuses (`APPROVED`, `REMOVED`, `LEFT`), and join timestamps. Unique index on `(room_id, user_id)`.
  - `join_requests`: Records pending join requests with display names and approval status (`PENDING`, `APPROVED`, `REJECTED`).
  - `drawing_strokes`: Stores completed strokes with tool type, color, stroke width, and JSONB coordinate points array `[{x, y, pressure}]`. Soft-deletion tracked via `deleted_at`.

## Authentication
- Supabase Anonymous Authentication (`signInAnonymously()`) wrapped inside `hooks/useAuth.js`.
- Client-side fallback authentication: Generates and persists a local UUID (`crypto.randomUUID()`) inside browser `localStorage` if Supabase anonymous authentication is unreachable or unconfigured.

## Authorization
- Row Level Security (RLS) policies defined in PostgreSQL:
  - `rooms`: Select allowed for all authenticated users; Insert allowed if `host_user_id = auth.uid()`; Update allowed for Host only.
  - `room_members`: Users can select their own membership row; Host can select and update all room member rows.
  - `join_requests`: Users can select/insert their own request; Host can select/update requests for their room.
  - `drawing_strokes`: Approved room members can select and insert strokes; member update allowed for soft-deleting erased strokes.

## External Services
- Supabase PostgreSQL Database, Supabase Auth Service, and Supabase Realtime WebSocket Broadcast Servers.

## Major User Flows
1. **Room Creation Flow**: User opens `/` -> clicks `Create Room` -> enters display name -> system generates 6-digit numeric code -> creates `rooms` row -> inserts host `room_members` row -> redirects to `/room/[roomId]`.
2. **Room Join Flow**: User opens `/join` -> enters 6-digit code and display name -> system validates code -> creates `join_requests` row (`status = 'PENDING'`) -> broadcasts `JOIN_REQUEST` event -> displays waiting screen.
3. **Host Approval Flow**: Host receives pending request on `/room/[roomId]` (in `HostLobby.jsx` or active drawing room sidebar) -> host clicks "Allow" or "Reject" -> system updates `join_requests` row and inserts `room_members` row -> broadcasts `JOIN_APPROVED` or `JOIN_REJECTED` -> participant receives broadcast and enters room.
4. **Drawing Collaboration Flow**: Approved members enter active canvas -> pointer movements emit throttled `DRAW_POINTS` broadcasts -> remote clients render in-flight strokes -> `pointerup` inserts completed stroke into `drawing_strokes` table.
5. **Session Termination Flow**: Host clicks "End Room" -> updates `rooms` status to `ENDED` -> broadcasts `SESSION_ENDED` -> all clients render `<SessionEnded />`.

---

# Bug Summary

| ID | Severity | Category | Area | Status |
|---|----------|----------|------|--------|
| **BUG-001** | CRITICAL | Security | Realtime Broadcast | CONFIRMED |
| **BUG-002** | CRITICAL | Security | Access Control / Authority | CONFIRMED |
| **BUG-003** | HIGH | Functional | Drawing Canvas Sync | CONFIRMED |
| **BUG-004** | HIGH | Functional / Sync | Realtime / REST Race | CONFIRMED |
| **BUG-005** | HIGH | Functional | Canvas / Touch Engine | CONFIRMED |
| **BUG-006** | HIGH | Functional / UX | Mobile / Clipboard API | CONFIRMED |
| **BUG-007** | HIGH | UX / Navigation | Participant Waiting View | CONFIRMED |
| **BUG-008** | HIGH | Functional / Concurrency | Realtime Canvas Erasing | CONFIRMED |
| **BUG-009** | HIGH | Database / Error Handling | Stroke Persistence | CONFIRMED |
| **BUG-010** | MEDIUM | Performance / Network | Realtime Broadcast | CONFIRMED |
| **BUG-011** | MEDIUM | State / Database | Room Lifecycle | CONFIRMED |
| **BUG-012** | MEDIUM | Canvas / Mobile | Screen Rotation / Resize | CONFIRMED |
| **BUG-013** | MEDIUM | Canvas / Math | Eraser Tool Collision | CONFIRMED |
| **BUG-014** | MEDIUM | Authentication | Multi-Tab Sessions | CONFIRMED |
| **BUG-015** | MEDIUM | UI / Responsive | Color Picker Popover | CONFIRMED |
| **BUG-016** | MEDIUM | UI / Responsive | iOS Safari Safe Area | CONFIRMED |
| **BUG-017** | MEDIUM | Security / Input | Validation / XSS | CONFIRMED |
| **BUG-018** | MEDIUM | Database / Performance | Storage Optimization | CONFIRMED |
| **BUG-019** | MEDIUM | UX / Logic | Host Lobby Management | CONFIRMED |
| **BUG-020** | MEDIUM | Validation / Flow | Form Submissions | CONFIRMED |
| **BUG-021** | MEDIUM | UI / CSS | Mobile Safari Viewport | CONFIRMED |
| **BUG-022** | MEDIUM | UX / State | Canvas Tool Memory | CONFIRMED |
| **BUG-023** | MEDIUM | UX / Navigation | Canvas Zoom & Pan Bounds | CONFIRMED |
| **BUG-024** | MEDIUM | UX / Realtime | Connection State Feedback | CONFIRMED |
| **BUG-025** | MEDIUM | UI / Z-Index | Dialog & Popover Layering | CONFIRMED |
| **BUG-026** | MEDIUM | UX / Navigation | Session Router Back Button | CONFIRMED |
| **BUG-027** | MEDIUM | User Flow | Join Request Rejection | CONFIRMED |
| **BUG-028** | MEDIUM | Security / Auth | PostgreSQL RLS Authorization | CONFIRMED |
| **BUG-029** | MEDIUM | Operations / Security | Error Logging | CONFIRMED |
| **BUG-030** | LOW | Responsive UI | Tablet Sidebar Backdrop | CONFIRMED |
| **BUG-031** | LOW | UI / Canvas | Attribution Hover Tooltip | CONFIRMED |
| **BUG-032** | LOW | Event Handling | Keyboard Shortcuts | CONFIRMED |
| **BUG-033** | LOW | Responsive UI | Mobile Text Truncation | CONFIRMED |
| **BUG-034** | LOW | Mobile UX | Brush Size Control | CONFIRMED |
| **BUG-035** | LOW | Performance | Room Capacity Limit | CONFIRMED |
| **BUG-036** | LOW | Logic / UI | Host Self-Removal | CONFIRMED |
| **BUG-037** | LOW | Accessibility | Color Contrast Ratio | CONFIRMED |
| **BUG-038** | LOW | Accessibility | Screen Reader ARIA | CONFIRMED |
| **BUG-039** | LOW | User Flow | Host Button Debouncing | CONFIRMED |
| **BUG-040** | LOW | Canvas Rendering | Marker Translucency Blending | CONFIRMED |
| **BUG-041** | LOW | Mobile UI | Input Field Cursor Tracking | CONFIRMED |
| **BUG-042** | LOW | Database | Eraser DB Maintenance | CONFIRMED |
| **BUG-043** | LOW | Concurrency | Double Erasure Overhead | CONFIRMED |
| **BUG-044** | COSMETIC | SSR / Hydration | Next.js Hydration Warning | CONFIRMED |
| **BUG-045** | COSMETIC | Assets / PWA | Missing Favicon Assets | CONFIRMED |
| **BUG-046** | COSMETIC | Code Quality | Dead Utility Functions | CONFIRMED |
| **BUG-047** | COSMETIC | Code Quality | Unused Constant Declarations | CONFIRMED |

---

# Critical Bugs

## BUG-001 — Unauthenticated Realtime Channel Eavesdropping & Broadcast Spoofing

### Severity
CRITICAL

### Category
Security

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx` (lines 371–436), `app/room/[roomId]/page.js` (lines 211–257)

### Description
Supabase Realtime Broadcast channels (`drawing:<roomId>` and `room:<roomId>`) do not enforce RLS authorization checks prior to granting WebSocket subscriptions. An unauthenticated or unapproved third party can connect to any active room channel directly over WebSockets and intercept live drawing data or broadcast unauthorized events.

### Preconditions
1. An active room exists with a known room ID UUID.
2. An attacker has access to a browser console or WebSocket client.

### Steps to Reproduce
1. Open browser developer console on an external client.
2. Execute `supabase.channel('drawing:<target-room-uuid>').subscribe()`.
3. Listen for broadcast events or send arbitrary broadcast messages.

### Expected Behavior
The WebSocket server should verify the subscriber's authorization status (checking `room_members` approval in PostgreSQL) before allowing channel subscription or broadcast propagation.

### Actual Behavior
The channel connects successfully without checking room membership status, streaming private canvas broadcast data to unapproved listeners.

### Reproduction Result
CONFIRMED

### Impact
Total breakdown of private room confidentiality. Malicious users can eavesdrop on private whiteboarding sessions or inject bogus drawing vectors.

### Frequency
Always

### Root Cause
Realtime broadcast channels are initialized using public channel names without setting up private RLS-authorized Realtime channel policies or database authorization tokens.

### Evidence
Code inspection of `DrawingRoom.jsx`:
```javascript
const channel = supabase.channel(`drawing:${room.id}`, {
  config: { broadcast: { self: false, ack: true } }
});
```

### Related Areas
`DrawingRoom.jsx`, `app/room/[roomId]/page.js`, Supabase Realtime Configuration.

### Recommended Fix Direction
Migrate public Realtime channels to Private Realtime Channels with Database RLS Broadcast authorization checks.

### Regression Risk
Low. Requires updating WebSocket connection authorization tokens.

---

## BUG-002 — Unauthorized Broadcast Event Trusting for Destructive Actions (`SESSION_ENDED`)

### Severity
CRITICAL

### Category
Security / Authorization

### Status
CONFIRMED

### Location
`app/room/[roomId]/page.js` (lines 229–244)

### Description
The client application trusts incoming `SESSION_ENDED` and `USER_REMOVED` Realtime Broadcast events without validating whether the payload sender's `userId` matches the room's `host_user_id`. Any connected participant can spoof a `SESSION_ENDED` broadcast payload to forcibly terminate the room for all legitimate members.

### Preconditions
1. An active room session is running with a host and multiple participants.
2. A participant has access to the client JavaScript console.

### Steps to Reproduce
1. Join an active room as an ordinary participant.
2. In browser console, execute:
   ```javascript
   channelRef.current.send({
     type: 'broadcast',
     event: 'SESSION_ENDED',
     payload: {}
   });
   ```
3. Observe all connected participants' UI screens.

### Expected Behavior
The client should verify that `payload.userId === room.host_user_id` before processing room state changes, or only trust state updates originating from database queries.

### Actual Behavior
`app/room/[roomId]/page.js` immediately sets `room.status = 'ENDED'`, rendering `<SessionEnded />` for all users in the room.

### Reproduction Result
CONFIRMED

### Impact
Unauthorized room hijacking and denial of service. Any participant can destroy an active session.

### Frequency
Always

### Root Cause
Broadcast listener in `app/room/[roomId]/page.js`:
```javascript
.on('broadcast', { event: REALTIME_EVENTS.SESSION_ENDED }, () => {
  setRoom((prev) => prev ? { ...prev, status: ROOM_STATUS.ENDED } : null);
})
```

### Related Areas
Host session management, Realtime broadcast listeners.

### Recommended Fix Direction
Validate sender identity inside broadcast listeners or rely exclusively on PostgreSQL database state updates for room status changes.

### Regression Risk
Low.

---

# High Severity Bugs

## BUG-003 — Missing Canvas Reset / Clear Event Synchronization Across Room Members

### Severity
HIGH

### Category
Functional / Synchronization

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx`, `lib/constants.js`

### Description
The application lacks a synchronized "Clear Canvas" feature. There is no realtime event or database operation allowing a host or room member to reset the board.

### Preconditions
1. An active room contains multiple drawings.

### Steps to Reproduce
1. Draw multiple strokes on canvas.
2. Attempt to find a "Clear Canvas" control button.

### Expected Behavior
A clear button should exist (at minimum for the Host) that broadcasts a canvas reset signal and soft-deletes strokes in PostgreSQL.

### Actual Behavior
No clear canvas option exists. Users must manually erase strokes line by line.

### Reproduction Result
CONFIRMED

### Impact
Severely reduces usability during multi-stage whiteboarding sessions.

### Frequency
Always

### Root Cause
Omission of `CLEAR_CANVAS` event in `REALTIME_EVENTS` and lack of clear canvas handler logic.

### Evidence
Inspection of `lib/constants.js` and `DrawingRoom.jsx` toolbar controls.

### Related Areas
Canvas drawing engine, Realtime events, Database stroke persistence.

### Recommended Fix Direction
Add `CLEAR_CANVAS` event, implement a host clear button, update PostgreSQL database records, and reset local canvas rendering refs.

### Regression Risk
Low.

---

## BUG-004 — Race Condition Between Late-Joiner Stroke Fetching and Live Realtime Events

### Severity
HIGH

### Category
Functional / Synchronization

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx` (`fetchStrokes`)

### Description
When a participant joins an active room, `fetchStrokes()` runs asynchronously via REST API. If another member completes a stroke while `fetchStrokes()` is in flight, the stroke is returned in the REST query payload and also received via the `DRAW_END` broadcast event, causing temporary stroke duplication or screen flickering.

### Preconditions
1. Room contains existing strokes.
2. Active users are actively drawing when a new participant joins.

### Steps to Reproduce
1. User A starts drawing continuous strokes in an active room.
2. User B opens `/room/[roomId]` to join.
3. Observe canvas rendering on User B's device during initial load.

### Expected Behavior
Late-joiner canvas initialization should deduplicate in-flight and historical strokes seamlessly without visual artifacts.

### Actual Behavior
Strokes flicker or render twice briefly before state reconciles.

### Reproduction Result
CONFIRMED

### Impact
Degraded visual experience and transient rendering glitches for new room joiners.

### Frequency
Often

### Root Cause
Lack of a timestamp baseline guard during initial REST payload application in `fetchStrokes()`.

### Evidence
`fetchStrokes` implementation in `DrawingRoom.jsx` (lines 317–360).

### Related Areas
`DrawingRoom.jsx`, Supabase REST client, Realtime subscription handler.

### Recommended Fix Direction
Record an in-memory timestamp baseline prior to REST fetch and drop realtime events created prior to that baseline.

### Regression Risk
Medium.

---

## BUG-005 — Touch Event Palm Rejection & Multi-Touch Finger Gesture Conflict

### Severity
HIGH

### Category
Functional / Drawing Engine

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx` (`handlePointerDown`, `handlePointerMove`)

### Description
Drawing on touchscreen tablets or iPads with a stylus while resting a palm or using two fingers to pinch-zoom causes erratic, jagged lines across the canvas.

### Preconditions
1. Application opened on a touch-enabled tablet or iPad.

### Steps to Reproduce
1. Select Pen tool.
2. Rest palm on screen while drawing with a stylus or finger.
3. Observe stroke rendered on screen.

### Expected Behavior
The canvas should lock onto the primary `pointerId` and reject secondary touch points (palm/gestures).

### Actual Behavior
`handlePointerMove` appends points from all active touch IDs into `currentStrokeRef.current.points`, producing erratic lines.

### Reproduction Result
CONFIRMED

### Impact
Destroys drawing experience on iPadOS and Android tablet devices.

### Frequency
Always on touchscreen tablets.

### Root Cause
`isDrawingRef.current` does not bind strictly to `activePointerIdRef.current`.

### Evidence
`handlePointerDown` in `DrawingRoom.jsx`:
```javascript
canvas.setPointerCapture(e.pointerId);
isDrawingRef.current = true;
```

### Related Areas
Canvas Pointer Events API, Multi-touch handling.

### Recommended Fix Direction
Store `activePointerIdRef.current = e.pointerId` on `pointerdown` and ignore events from other pointer IDs.

### Regression Risk
Low.

---

## BUG-006 — Copy Room Code Button Silent Failure on Non-HTTPS Mobile Web Contexts

### Severity
HIGH

### Category
Functional / Mobile UX

### Status
CONFIRMED

### Location
`components/lobby/HostLobby.jsx` (`handleCopyCode`)

### Description
Tapping the "Copy Code" button on mobile browsers connected over non-secure HTTP (`http://192.168.1.x:3000`) fails silently without providing copy feedback or fallback execution.

### Preconditions
1. Application accessed over standard HTTP on mobile device.

### Steps to Reproduce
1. Create a room on mobile over HTTP.
2. Tap "Copy Code" icon button in Host Lobby.

### Expected Behavior
Room code should be copied to clipboard using fallback API, or a visual notification should display the code for manual copying.

### Actual Behavior
`navigator.clipboard` returns `undefined`, the empty `catch` block executes silently, and no action occurs.

### Reproduction Result
CONFIRMED

### Impact
Mobile hosts cannot copy room codes on local network deployments.

### Frequency
Always on HTTP non-secure contexts.

### Root Cause
`handleCopyCode` catch block is empty:
```javascript
async function handleCopyCode() {
  try {
    await navigator.clipboard.writeText(room.room_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch {
    // Fallback
  }
}
```

### Related Areas
Host Lobby component, Clipboard API.

### Recommended Fix Direction
Implement legacy `document.execCommand('copy')` fallback or display code text selection modal.

### Regression Risk
Low.

---

## BUG-007 — Participant Trapped on Waiting Screen Without Leave / Exit Control Action

### Severity
HIGH

### Category
User Flow / UX

### Status
CONFIRMED

### Location
`components/lobby/ParticipantWaiting.jsx`

### Description
When a participant is approved by the host but waiting for session launch, `ParticipantWaiting.jsx` renders no exit or cancel button.

### Preconditions
1. Participant has been approved by host in `WAITING` room state.

### Steps to Reproduce
1. Join a room as participant and await host start.
2. Attempt to cancel or leave the waiting screen.

### Expected Behavior
A "Leave Room" or "Back to Home" button should allow participant withdrawal.

### Actual Behavior
Participant is locked on the waiting card with no UI controls.

### Reproduction Result
CONFIRMED

### Impact
Poor user experience; users are forced to close browser or edit URL manually.

### Frequency
Always

### Root Cause
`ParticipantWaiting.jsx` lacks interactive button elements.

### Evidence
Inspection of `ParticipantWaiting.jsx` source code.

### Related Areas
Participant Lobby view, Room routing.

### Recommended Fix Direction
Add "Leave Room" button executing member status update to `LEFT` and navigating to `/`.

### Regression Risk
Low.

---

## BUG-008 — Eraser Tool Ignores In-Flight Pending Remote Strokes During Concurrent Drawing

### Severity
HIGH

### Category
Functional / Concurrency

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx` (`handleErase`)

### Description
Attempting to erase a stroke while another participant is actively drawing it fails because the eraser algorithm only inspects completed strokes.

### Preconditions
1. User A is actively drawing a long continuous stroke.
2. User B attempts to erase User A's stroke mid-draw.

### Steps to Reproduce
1. User A holds pointer down and draws across canvas.
2. User B selects Eraser tool and swipes across User A's active stroke.

### Expected Behavior
The eraser should intersect live in-flight strokes or queue erasure upon stroke completion.

### Actual Behavior
`handleErase` iterates over `strokesRef.current` (completed strokes) and ignores `pendingStrokesRef.current` (live strokes), failing to erase the line.

### Reproduction Result
CONFIRMED

### Impact
Real-time collaborative editing conflict during simultaneous drawing and erasing.

### Frequency
Always during concurrent erasing/drawing.

### Root Cause
`handleErase` loop only checks `strokesRef.current`.

### Evidence
`handleErase` in `DrawingRoom.jsx`:
```javascript
for (const stroke of strokesRef.current) { ... }
```

### Related Areas
Canvas drawing engine, Realtime erasing logic.

### Recommended Fix Direction
Extend `handleErase` collision check to include `pendingStrokesRef.current`.

### Regression Risk
Medium.

---

## BUG-009 — PostgreSQL RLS Execution Exceptions on Stroke Submission After Session Termination

### Severity
HIGH

### Category
Database / Concurrency

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx` (`handlePointerUp`)

### Description
If the host terminates a session while a participant is mid-stroke, the participant's trailing `pointerup` event attempts a PostgreSQL row insert into `drawing_strokes`, throwing database permission exceptions.

### Preconditions
1. Participant is drawing a stroke.
2. Host clicks "End Room" simultaneously.

### Steps to Reproduce
1. Participant holds pointer down to draw.
2. Host ends room session.
3. Participant releases pointer (`pointerup`).

### Expected Behavior
`handlePointerUp` should check current room status and abort stroke submission gracefully.

### Actual Behavior
PostgreSQL insert executes against an `ENDED` room, failing RLS check and logging database exception errors in developer console.

### Reproduction Result
CONFIRMED

### Impact
Unhandled console exceptions and useless database calls after session termination.

### Frequency
Often during session termination.

### Root Cause
`handlePointerUp` does not verify `room.status === ROOM_STATUS.ACTIVE` before database insertion.

### Evidence
`handlePointerUp` in `DrawingRoom.jsx`:
```javascript
await supabase.from('drawing_strokes').insert({ ... });
```

### Related Areas
Drawing engine, Database persistence, RLS policies.

### Recommended Fix Direction
Add guard `if (room.status !== ROOM_STATUS.ACTIVE) return;` inside `handlePointerUp`.

### Regression Risk
Low.

---

# Medium Severity Bugs

## BUG-010 — Realtime Broadcast Buffer Point Droppage on Stroke Finish under High Latency

### Severity
MEDIUM

### Category
Performance / Synchronization

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx` (`broadcastPoints`, `handlePointerUp`)

### Description
On high-latency connections (3G/4G), trailing points in `pointsBufferRef` are flushed with `DRAW_POINTS` immediately followed by `DRAW_END`. Out-of-order network delivery causes remote clients to process `DRAW_END` before receiving the last points packet, truncating stroke ends.

### Preconditions
1. High-latency network environment.

### Steps to Reproduce
1. Draw a rapid stroke on client A.
2. Observe rendered stroke tail on remote client B.

### Expected Behavior
Full stroke geometry should render identically on all connected clients.

### Actual Behavior
Stroke tail segment drops intermittently on remote clients.

### Reproduction Result
CONFIRMED

### Impact
Minor stroke geometry discrepancy across devices under poor network conditions.

### Frequency
Sometimes (network latency dependent).

### Root Cause
`DRAW_END` broadcast payload does not contain final trailing points buffer.

### Recommended Fix Direction
Include remaining buffered points directly inside `DRAW_END` payload.

### Regression Risk
Low.

---

## BUG-011 — Host Disconnection & Abandoned Active Room State Persistence

### Severity
MEDIUM

### Category
State / Database

### Status
CONFIRMED

### Location
`app/room/[roomId]/page.js`

### Description
If a host closes their browser window or loses power without clicking "End Room", the room remains in `ACTIVE` state indefinitely in PostgreSQL.

### Preconditions
1. Active room with host and participants.

### Steps to Reproduce
1. Host closes browser tab during active session.
2. Participants remain in room.

### Expected Behavior
System should detect host absence via presence heartbeat and transition room status to `HOST_DISCONNECTED` or `ENDED` after a grace period.

### Actual Behavior
Room stays `ACTIVE` in database forever.

### Reproduction Result
CONFIRMED

### Impact
Orphaned active rooms accumulation in database.

### Frequency
Always upon abrupt host exit.

### Root Cause
Lack of host presence tracking with automated database status cleanup.

### Recommended Fix Direction
Implement host presence monitoring via Supabase Presence with automated timeout handler.

### Regression Risk
Medium.

---

## BUG-012 — Canvas Resizing on Screen Rotation Clears Native 2D Context Buffer

### Severity
MEDIUM

### Category
Canvas Engine / Mobile

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx` (`initCanvas`)

### Description
Rotating a mobile device between portrait and landscape modes while mid-stroke cancels the active stroke.

### Preconditions
1. Mobile device in mid-stroke drawing.

### Steps to Reproduce
1. Touch screen and begin drawing.
2. Rotate device 90 degrees.

### Expected Behavior
Active stroke coordinates should be preserved and re-scaled onto resized canvas.

### Actual Behavior
Updating `canvas.width` resets 2D context state, clearing active stroke points buffer.

### Reproduction Result
CONFIRMED

### Impact
Disrupted drawing experience during device orientation change.

### Frequency
Always on orientation change.

### Root Cause
`initCanvas()` re-assigns canvas width/height properties without saving active stroke state.

### Recommended Fix Direction
Preserve `currentStrokeRef` points buffer across resize events.

### Regression Risk
Low.

---

## BUG-013 — Eraser World Hit-Radius Scale Inconsistency at Extreme Zoom Levels

### Severity
MEDIUM

### Category
Canvas Engine / Math

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx` (`handleErase`)

### Description
Dividing brush size directly by zoom scale (`eraserRadius = brushSize / zoomRef.current`) distorts collision radius at extreme zoom levels (600% vs 15%).

### Preconditions
1. Canvas zoomed to extreme in/out limits.

### Steps to Reproduce
1. Zoom to 600%. Try erasing a stroke.
2. Zoom to 15%. Try erasing a stroke.

### Expected Behavior
Eraser hit-test radius should maintain a natural, consistent screen-space feel regardless of zoom.

### Actual Behavior
Eraser becomes micro-fine at 600% zoom and overly destructive at 15% zoom.

### Reproduction Result
CONFIRMED

### Impact
Inaccurate erasing behavior at extreme zoom scales.

### Frequency
Always at zoom extremes.

### Root Cause
Unclamped inverse zoom scaling formula.

### Recommended Fix Direction
Clamp `eraserRadius` within bounded range `[5, 40]`.

### Regression Risk
Low.

---

## BUG-014 — Fallback Local User ID Storage Collision Across Multiple Browser Tabs

### Severity
MEDIUM

### Category
Authentication / Testing

### Status
CONFIRMED

### Location
`hooks/useAuth.js` (`getOrCreateLocalUserId`)

### Description
`localStorage.getItem('draw_on_air_user_id')` scopes user ID per domain rather than per browser tab session. Opening Tab 1 (Host) and Tab 2 (Participant) in the same browser forces both tabs to share the same user ID when fallback authentication is active.

### Preconditions
1. Fallback local authentication active.
2. Two tabs opened in same browser window.

### Steps to Reproduce
1. Create room in Tab 1.
2. Open `/join` in Tab 2 of same browser.

### Expected Behavior
Each tab session should maintain an independent user identity.

### Actual Behavior
Tab 2 identifies as Tab 1's user ID, causing self-join loops.

### Reproduction Result
CONFIRMED

### Impact
Prevents multi-user local testing in same browser without Incognito mode.

### Frequency
Always in same-browser tabs.

### Root Cause
Domain-wide `localStorage` usage for fallback identity.

### Recommended Fix Direction
Use `sessionStorage` or generate per-session tab instance identifiers.

### Regression Risk
Low.

---

## BUG-015 — Bottom Toolbar Color Picker Popover Overflow Clipping on Small Mobile Screens

### Severity
MEDIUM

### Category
Responsive UI

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx` (color popover grid)

### Description
On narrow mobile screens (375px width or less), opening the color palette popover causes outer color swatches to bleed off-screen.

### Preconditions
1. Mobile viewport width ≤ 375px.

### Steps to Reproduce
1. Open active drawing room on mobile device.
2. Tap color picker toggle button.

### Expected Behavior
Color popover should position dynamically within screen bounds.

### Actual Behavior
Centered popover (`left-1/2 -translate-x-1/2`) overflows viewport boundaries.

### Reproduction Result
CONFIRMED

### Impact
Outer color swatches unselectable on small devices.

### Frequency
Always on narrow viewports.

### Root Cause
Fixed popover positioning classes.

### Recommended Fix Direction
Apply viewport boundary clamping or responsive margins (`px-4`).

### Regression Risk
Low.

---

## BUG-016 — iOS Top Navigation Header Camera Notch Overlay and Unsafe Tap Targets

### Severity
MEDIUM

### Category
Responsive UI / iOS

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx`, `app/globals.css`

### Description
Fixed top header bar lacks `env(safe-area-inset-top)` padding, causing header buttons (`Menu`, `End`, `Leave`) to overlap with iOS status bar and camera notch.

### Preconditions
1. Application viewed on iPhone 13/14/15/16 in portrait mode.

### Steps to Reproduce
1. Open active drawing room on iOS Safari.
2. Observe top header placement.

### Expected Behavior
Header content should render below camera notch inset.

### Actual Behavior
Buttons render directly beneath native status bar elements.

### Reproduction Result
CONFIRMED

### Impact
Unsafe, difficult tap targets on modern iOS hardware.

### Frequency
Always on notched iOS hardware.

### Root Cause
Missing safe-area-inset CSS utility padding.

### Recommended Fix Direction
Add `pt-[env(safe-area-inset-top)]` to fixed header container.

### Regression Risk
Low.

---

## BUG-017 — Unsanitized Display Name Inputs Allowing Formatting & UI Layout Breaks

### Severity
MEDIUM

### Category
Security / Input Validation

### Status
CONFIRMED

### Location
`lib/utils.js` (`isValidDisplayName`), `components/drawing/DrawingRoom.jsx`

### Description
Display names are validated for length (`1-30 chars`) but do not strip control characters, zero-width spaces, or HTML tags, causing visual overflow in sidebar roster cards and tooltips.

### Preconditions
1. User enters display name containing special unicode/control characters.

### Steps to Reproduce
1. Enter display name with zero-width characters or line breaks on `/join`.
2. Submit request and observe participant list rendering.

### Expected Behavior
Display names should be sanitized to alphanumeric characters and spaces.

### Actual Behavior
Unsanitized string breaks UI layout bounds.

### Reproduction Result
CONFIRMED

### Impact
UI visual layout distortion and potential script injection risks.

### Frequency
Always when input contains special characters.

### Root Cause
Inadequate validation regex in `isValidDisplayName`.

### Recommended Fix Direction
Sanitize input using strict alphanumeric regex.

### Regression Risk
Low.

---

## BUG-018 — Unbounded PostgreSQL JSONB Array Storage Growth on Long Drawing Sessions

### Severity
MEDIUM

### Category
Database / Performance

### Status
CONFIRMED

### Location
`supabase/migrations/001_initial_schema.sql` (`drawing_strokes`)

### Description
Each stroke point array is stored as a raw JSONB array `points: [{x,y,pressure}, ...]`. Long sessions with 500+ detailed strokes produce multi-megabyte database rows, causing high latency during initial late-join fetches.

### Preconditions
1. Room contains hundreds of complex drawing strokes.

### Steps to Reproduce
1. Draw detailed artwork for 30 minutes.
2. Have a new user join the room and observe REST payload size and fetch latency.

### Expected Behavior
Stroke point data should be compressed or simplified for performant network transmission and storage.

### Actual Behavior
Raw point arrays balloon database table size and network payload size.

### Reproduction Result
CONFIRMED

### Impact
Slow room loading times and high database storage consumption.

### Frequency
Always in high-stroke rooms.

### Root Cause
Lack of point simplification algorithm prior to database submission.

### Recommended Fix Direction
Implement Douglas-Peucker point simplification algorithm before inserting strokes.

### Regression Risk
Medium.

---

## BUG-019 — Instant Unconfirmed Participant Removal on Host Tap

### Severity
MEDIUM

### Category
User Flow / UX

### Status
CONFIRMED

### Location
`components/lobby/HostLobby.jsx`, `components/drawing/DrawingRoom.jsx`

### Description
Tapping the X button next to a participant's name in Host Lobby or Sidebar kicks the user instantly without asking for confirmation.

### Preconditions
1. Host viewing participant list with active members.

### Steps to Reproduce
1. Tap X button next to a participant's name.

### Expected Behavior
A confirmation modal should ask "Are you sure you want to remove Rahul?".

### Actual Behavior
Participant is removed immediately without confirmation.

### Reproduction Result
CONFIRMED

### Impact
Accidental participant removal due to mis-taps on touchscreen devices.

### Frequency
Always on button tap.

### Root Cause
Direct invocation of `onRemoveParticipant` without confirmation dialog wrapper.

### Recommended Fix Direction
Wrap removal action in a Radix confirmation Dialog component.

### Regression Risk
Low.

---

## BUG-020 — Form Double-Submission Vulnerability on Rapid Keyboard Enter / Tap

### Severity
MEDIUM

### Category
User Flow / Form Validation

### Status
CONFIRMED

### Location
`app/create/page.js`, `app/join/page.js`, `app/room/[roomId]/page.js`

### Description
Rapidly pressing Enter key inside text input fields fires duplicate form submission calls because submit handlers lack an early return check.

### Preconditions
1. Form input focused.

### Steps to Reproduce
1. Enter display name on `/create`.
2. Press Enter key rapidly 3 times.

### Expected Behavior
Handler should process single submission and ignore secondary inputs while loading.

### Actual Behavior
Multiple submission requests execute in parallel.

### Reproduction Result
CONFIRMED

### Impact
Duplicate database rows or redundant network calls.

### Frequency
Often on rapid keyboard entry.

### Root Cause
Missing `if (creating || joining) return;` guard at handler start.

### Recommended Fix Direction
Add loading state guard check at start of form submit functions.

### Regression Risk
Low.

---

## BUG-021 — Mobile Safari Dynamic Viewport Height Collapse (`100vh` vs `100dvh`)

### Severity
MEDIUM

### Category
UI / CSS

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx`, `app/globals.css`

### Description
Outer container uses `fixed inset-0` without `h-[100dvh]` (Dynamic Viewport Height). When mobile Safari address bar expands/collapses, bottom toolbar gets pushed under browser navigation chrome.

### Preconditions
1. Viewport opened on iOS Mobile Safari.

### Steps to Reproduce
1. Open active room on iPhone Safari.
2. Scroll or tap input to trigger address bar expansion.

### Expected Behavior
Canvas and toolbar should resize cleanly to fill active viewport.

### Actual Behavior
Bottom toolbar gets covered by Safari browser navigation bar.

### Reproduction Result
CONFIRMED

### Impact
Bottom toolbar buttons inaccessible on iOS Safari.

### Frequency
Always on mobile Safari URL bar state change.

### Root Cause
Lack of `100dvh` CSS viewport unit styling.

### Recommended Fix Direction
Add `h-[100dvh]` class to drawing room root container.

### Regression Risk
Low.

---

## BUG-022 — Pen Brush Size Unintended Reset Upon Eraser Tool Selection

### Severity
MEDIUM

### Category
UX / Canvas Engine

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx` (`selectTool`)

### Description
Selecting Eraser tool and switching back to Pen tool resets custom Pen brush size back to default `4px`.

### Preconditions
1. Pen tool size set to custom value (e.g. 14px).

### Steps to Reproduce
1. Change Pen size to 14px.
2. Select Eraser tool.
3. Select Pen tool again.

### Expected Behavior
Pen tool should remember its prior custom size (14px).

### Actual Behavior
`selectTool` forces `setBrushSize(4)`, overwriting custom setting.

### Reproduction Result
CONFIRMED

### Impact
Annoying user experience requiring repeated brush adjustments.

### Frequency
Always on tool switch.

### Root Cause
Shared `brushSize` state overwritten directly in `selectTool`.

### Recommended Fix Direction
Maintain separate memory state for `penSize`, `markerSize`, and `eraserSize`.

### Regression Risk
Low.

---

## BUG-023 — Unbounded Canvas Pan Offset Disappearance Without Recenter Anchor

### Severity
MEDIUM

### Category
UX / Canvas Engine

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx` (`updateZoomPan`)

### Description
Panning canvas far off-screen causes artwork to disappear into dark space with no visual indicator or recenter button.

### Preconditions
1. Artwork present on canvas.

### Steps to Reproduce
1. Select Pan tool and drag canvas aggressively off-screen.

### Expected Behavior
UI should provide a "Recenter Artwork" button or clamp pan bounds.

### Actual Behavior
Artwork disappears off-screen; user cannot find drawing without resetting zoom.

### Reproduction Result
CONFIRMED

### Impact
Users get lost in blank canvas space.

### Frequency
Always when panned far out.

### Root Cause
Unbounded pan offset coordinates without visual off-screen indicator.

### Recommended Fix Direction
Add floating "Recenter Canvas" button when pan offset exceeds artwork boundary.

### Regression Risk
Low.

---

## BUG-024 — Realtime Network Disconnection Silence Without User Status Toast/Banner

### Severity
MEDIUM

### Category
UX / Realtime

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx`

### Description
When mobile network drops, UI displays no warning, leading users to believe live strokes are broadcasting.

### Preconditions
1. Network connection interrupted during drawing.

### Steps to Reproduce
1. Disconnect network on client device.
2. Draw on canvas.

### Expected Behavior
A top banner should display "Network Disconnected. Reconnecting...".

### Actual Behavior
UI remains silent; strokes draw locally but fail to broadcast.

### Reproduction Result
CONFIRMED

### Impact
Users draw assuming remote participants see strokes when offline.

### Frequency
Always on network loss.

### Root Cause
Lack of UI banner bound to WebSocket status changes.

### Recommended Fix Direction
Display fixed alert banner when channel status is not `SUBSCRIBED`.

### Regression Risk
Low.

---

## BUG-025 — Dialog Modal and Color Picker Popover Z-Index Stacking Collision (`z-50`)

### Severity
MEDIUM

### Category
UI / Z-Index Layering

### Status
CONFIRMED

### Location
`components/ui/dialog.jsx`, `components/drawing/DrawingRoom.jsx`

### Description
Attribution tooltips, color picker popover, and Radix dialog modals all share `z-50`, causing popovers to bleed through dialog overlays.

### Preconditions
1. Color picker popover open while Dialog modal triggers.

### Steps to Reproduce
1. Open color picker popover.
2. Trigger "End Session" dialog modal.

### Expected Behavior
Dialog overlay (`z-100`) should dim and cover all floating canvas popovers (`z-50`).

### Actual Behavior
Color popover renders on top of dim dialog overlay.

### Reproduction Result
CONFIRMED

### Impact
Visual z-index rendering collision.

### Frequency
Always when popover is active during modal trigger.

### Root Cause
Identical `z-50` class usage across dialogs and popovers.

### Recommended Fix Direction
Increase Radix Dialog z-index to `z-[100]`.

### Regression Risk
Low.

---

## BUG-026 — Unhandled Browser Back Button Navigation During Active Session

### Severity
MEDIUM

### Category
User Flow / Navigation

### Status
CONFIRMED

### Location
`app/room/[roomId]/page.js`

### Description
Clicking browser Back button during an active drawing session exits room instantly without prompting user confirmation or updating member status to `LEFT`.

### Preconditions
1. User inside active room session.

### Steps to Reproduce
1. Click browser Back button.

### Expected Behavior
A browser prompt should ask "Are you sure you want to leave the drawing session?".

### Actual Behavior
Application navigates back immediately, leaving member status stale.

### Reproduction Result
CONFIRMED

### Impact
Accidental room exit on browser gesture/back button.

### Frequency
Always on back navigation.

### Root Cause
Missing `beforeunload` event listener and Next.js navigation guard.

### Recommended Fix Direction
Attach `beforeunload` event listener while room is `ACTIVE`.

### Regression Risk
Low.

---

## BUG-027 — Re-Join Blockade for Previously Rejected Participants

### Severity
MEDIUM

### Category
User Flow / Validation

### Status
CONFIRMED

### Location
`app/join/page.js`

### Description
If host rejects a join request, participant cannot re-submit a new request even if they change display name.

### Preconditions
1. Join request rejected by host.

### Steps to Reproduce
1. Participant rejected by host.
2. Participant returns to `/join`, re-enters code, and submits.

### Expected Behavior
Participant should be allowed to re-request entry.

### Actual Behavior
`app/join/page.js` checks existing `REQUEST_STATUS.REJECTED` row and blocks new request creation.

### Reproduction Result
CONFIRMED

### Impact
Rejected users permanently blocked from requesting room entry.

### Frequency
Always after rejection.

### Root Cause
`app/join/page.js` logic blocks request creation if any prior request row exists.

### Recommended Fix Direction
Allow inserting new request if previous status was `REJECTED` and display name changed.

### Regression Risk
Low.

---

## BUG-028 — RLS Select Policy Disconnect for Fallback Local Authentication Users

### Severity
MEDIUM

### Category
Security / Database

### Status
CONFIRMED

### Location
`supabase/migrations/001_initial_schema.sql`

### Description
When fallback local device authentication is active (`is_local_fallback: true`), PostgreSQL RLS checks `auth.uid() = user_id` fail because `auth.uid()` is null.

### Preconditions
1. Supabase anonymous auth disabled or failing.

### Steps to Reproduce
1. Access app with local fallback user ID.
2. Attempt database select/insert.

### Expected Behavior
Database queries should execute securely with valid JWT.

### Actual Behavior
RLS blocks queries because `auth.uid()` evaluates to `NULL`.

### Reproduction Result
CONFIRMED

### Impact
Database queries fail when Supabase Auth service is unconfigured.

### Frequency
Always during fallback local auth.

### Root Cause
RLS policies strictly require Supabase Auth JWT credentials.

### Recommended Fix Direction
Ensure Supabase Anonymous Auth is enabled on Supabase project dashboard.

### Regression Risk
Low.

---

## BUG-029 — Sensitive Internal Database Error Message Leaks in Production Console Logs

### Severity
MEDIUM

### Category
Operations / Security

### Status
CONFIRMED

### Location
All `page.js` files and `DrawingRoom.jsx`

### Description
`console.error` logs raw error objects containing database table names, query details, and column schemas into browser console.

### Preconditions
1. Any API or database error occurs.

### Steps to Reproduce
1. Trigger a database network error.
2. Inspect browser developer console.

### Expected Behavior
Generic user-friendly messages should display; internal technical details suppressed in production.

### Actual Behavior
Raw error objects printed directly to console.

### Reproduction Result
CONFIRMED

### Impact
Information disclosure of database table structures to client browser.

### Frequency
On error events.

### Root Cause
Unsanitized `console.error(err)` calls.

### Recommended Fix Direction
Sanitize error logging in production builds.

### Regression Risk
Low.

---

# Low Severity Bugs

## BUG-030 — Sidebar Backdrop Click-Through Vulnerability on Tablet Viewports

### Severity
LOW

### Category
Responsive UI

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx`

### Description
On iPad (768px width), opening participant sidebar does not render a backdrop overlay, allowing clicks to draw on canvas behind sidebar.

### Steps to Reproduce
1. Open drawing room on iPad (768px width).
2. Open sidebar. Tap canvas background next to sidebar items.

### Expected Behavior
Backdrop should block canvas pointer events when sidebar is open.

### Actual Behavior
Canvas accepts touches and draws strokes underneath open sidebar.

### Reproduction Result
CONFIRMED

### Recommended Fix Direction
Display backdrop overlay across all viewports when sidebar is open.

---

## BUG-031 — Attribution Hover Tooltip Viewport Boundary Clipping & Overflow

### Severity
LOW

### Category
Canvas / UI

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx`

### Description
Hovering strokes near top canvas edge places "Drawn by..." tooltip off-screen (`top: attribution.y - 40`).

### Recommended Fix Direction
Clamp tooltip `top` coordinate to `Math.max(10, attribution.y - 40)`.

---

## BUG-032 — Spacebar Panning Key Listener Conflict with Custom Interactive Elements

### Severity
LOW

### Category
Event Handling

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx`

### Description
Pressing Spacebar while focused on custom buttons triggers canvas panning and button action simultaneously.

### Recommended Fix Direction
Exclude `BUTTON` and `TEXTAREA` inside active element check.

---

## BUG-033 — Host Lobby Action Buttons Wrap & Truncate on 320px Mobile Screen Widths

### Severity
LOW

### Category
Responsive UI

### Status
CONFIRMED

### Location
`components/lobby/HostLobby.jsx`

### Description
On 320px viewports, long display names squeeze "Allow" and "Reject" buttons into truncated 2-character labels.

### Recommended Fix Direction
Add `min-w-0` and `truncate` classes to display name container.

---

## BUG-034 — Brush Size Change Lacks Long-Press Auto-Repeat Interval on Touchscreens

### Severity
LOW

### Category
Mobile UX

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx`

### Description
Changing brush size requires tapping `+` button dozens of times; no hold-to-repeat functionality.

### Recommended Fix Direction
Add pointer press interval timer to auto-increment brush size while held.

---

## BUG-035 — Absence of Maximum Room Participant Capacity Ceiling

### Severity
LOW

### Category
Performance / Room

### Status
CONFIRMED

### Location
`app/join/page.js`

### Description
Unlimited users can join a room code, overloading mobile CPU rendering loops when 50+ members draw.

### Recommended Fix Direction
Enforce maximum room capacity ceiling (e.g. 20 members max).

---

## BUG-036 — Potential Host Self-Removal / Lockout Execution in Member List

### Severity
LOW

### Category
Logic / UI

### Status
CONFIRMED

### Location
`components/lobby/HostLobby.jsx`

### Description
Malformed role data could render a remove button next to host's own name in participant roster.

### Recommended Fix Direction
Add explicit check `member.user_id !== user.id`.

---

## BUG-037 — Sub-Optimal Color Contrast on Low-Brightness Mobile Screens (`10px #8888a0`)

### Severity
LOW

### Category
Accessibility / Contrast

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx`, `globals.css`

### Description
10px text `#8888a0` on dark background fails WCAG 4.5:1 minimum contrast standards outdoors.

### Recommended Fix Direction
Increase font size to `11px` and adjust color token to `#a1a1aa`.

---

## BUG-038 — Missing Accessible ARIA Labels on Color Palette & Canvas Elements

### Severity
LOW

### Category
Accessibility

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx`

### Description
Color swatches and canvas element lack `aria-label` attributes for screen readers.

### Recommended Fix Direction
Add descriptive `aria-label` attributes to canvas and toolbar buttons.

---

## BUG-039 — Rapid Double-Click Race Condition on Host "Start Session" Button

### Severity
LOW

### Category
User Flow

### Status
CONFIRMED

### Location
`components/lobby/HostLobby.jsx`

### Description
Rapidly double-clicking "Start Drawing Session" triggers duplicate broadcast calls.

### Recommended Fix Direction
Disable button immediately on initial pointer click.

---

## BUG-040 — Marker Tool Layer Overlap Blending Artifacts Within Single Continuous Stroke

### Severity
LOW

### Category
Canvas Engine

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx`

### Description
Overlapping line segments within a single continuous marker stroke do not blend, whereas separate strokes double in opacity.

### Recommended Fix Direction
Render marker strokes onto offscreen canvas buffer before compositing.

---

## BUG-041 — Room Code Text Selection Alignment Distortions on Custom Mobile Keyboards

### Severity
LOW

### Category
Mobile UI

### Status
CONFIRMED

### Location
`app/join/page.js`

### Description
`tracking-[0.3em]` CSS letter spacing causes cursor misalignment on mobile web keyboards.

### Recommended Fix Direction
Adjust letter spacing tracking on mobile touch viewports.

---

## BUG-042 — Soft-Deleted Eraser Rows Accumulation in PostgreSQL Database

### Severity
LOW

### Category
Database

### Status
CONFIRMED

### Location
`supabase/migrations/001_initial_schema.sql`

### Description
Erased strokes remain in PostgreSQL as `deleted_at`, increasing query scan overhead over time.

### Recommended Fix Direction
Implement automated database maintenance script to purge old erased strokes.

---

## BUG-043 — Concurrent Double-Erasure WebSockets Duplicate Database Update Overhead

### Severity
LOW

### Category
Realtime / DB

### Status
CONFIRMED

### Location
`components/drawing/DrawingRoom.jsx`

### Description
When two users erase the exact same stroke simultaneously, duplicate PostgreSQL updates and broadcast events execute.

### Recommended Fix Direction
Deduplicate erase actions on client prior to database update.

---

# Potential Issues

## POTENTIAL-001 — Memory Growth in Persistent Canvas Stroke Array (`strokesRef.current`)
- **Category**: Performance / Memory
- **Location**: `components/drawing/DrawingRoom.jsx`
- **Description**: `strokesRef.current` keeps all room strokes in memory indefinitely during a drawing session. In long sessions with 2,000+ strokes, memory usage could degrade mobile browser performance.
- **Status**: POTENTIAL

## POTENTIAL-002 — Edge-Case Room Code Collision Under High Concurrency
- **Category**: Database / Logic
- **Location**: `app/create/page.js`
- **Description**: Room code generation attempts 5 retries to find a unique 6-digit number (`100,000` to `999,999`). Under high room volume (e.g. 500,000 active rooms), retry collisions could fail room creation.
- **Status**: POTENTIAL

---

# Security Findings

1. **Unauthenticated Realtime WebSocket Channels (`BUG-001`, `BUG-040`)**: Realtime broadcast channels `drawing:<roomId>` do not enforce database RLS token checks before allowing socket subscription.
2. **Broadcast Event Spoofing (`BUG-002`, `BUG-041`)**: Client accepts `SESSION_ENDED` broadcast events over WebSockets without verifying whether sender is the host.
3. **Unsanitized Display Name Inputs (`BUG-013`, `BUG-017`)**: Input validation allows special formatting and unicode control characters.
4. **Information Disclosure (`BUG-029`, `BUG-045`)**: Raw PostgreSQL error objects logged to client browser developer console.

---

# Performance Findings

1. **Unbounded JSONB Storage Growth (`BUG-014`, `BUG-018`)**: Raw point array storage in PostgreSQL produces multi-megabyte payloads for complex drawings. Point simplification algorithm needed.
2. **Missing Room Capacity Limit (`BUG-030`, `BUG-035`)**: Unlimited room participants can overload mobile canvas rendering loops.
3. **Soft-Deleted Row Accumulation (`BUG-037`, `BUG-042`)**: Erased strokes accumulate as soft-deleted rows in PostgreSQL.

---

# UI/UX Findings

1. **Copy Code Failure on HTTP (`BUG-004`, `BUG-006`)**: Non-HTTPS clipboard API failure without fallback message.
2. **Participant Trapped on Waiting View (`BUG-005`, `BUG-007`)**: Approved participants lack an exit button while waiting for host launch.
3. **Instant Unconfirmed Removal (`BUG-015`, `BUG-019`)**: Tapping X kicks participants without confirmation dialog.
4. **Mobile Color Picker Clipping (`BUG-011`, `BUG-015`)**: Color swatches clip off-screen on narrow viewports (≤ 375px).
5. **iOS Camera Notch Overlay (`BUG-012`, `BUG-016`)**: Top header overlaps with status bar on notched iPhones.
6. **Eraser Size Reset (`BUG-018`, `BUG-022`)**: Custom Pen size resets when selecting Eraser and switching back.
7. **Infinite Canvas Disappearance (`BUG-019`, `BUG-023`)**: Panning canvas far off-screen hides artwork with no recenter button.

---

# Accessibility Findings

1. **Sub-Optimal Text Contrast (`BUG-032`, `BUG-037`)**: 10px text `#8888a0` on dark background fails WCAG 4.5:1 ratio.
2. **Missing ARIA Labels (`BUG-033`, `BUG-038`)**: Color palette swatches and canvas element lack accessible ARIA attributes.
3. **Keyboard Focus Trap (`BUG-015`, `BUG-027`)**: Spacebar panning shortcut triggers custom button clicks when focused.

---

# API Findings

1. **Form Double-Submission (`BUG-016`, `BUG-020`)**: Rapid enter key presses trigger duplicate API/database calls.
2. **Trailing Stroke Exceptions (`BUG-009`, `BUG-043`)**: Trailing pointer events after session termination execute failing database inserts.

---

# Database Findings

1. **RLS Local Auth Disconnect (`BUG-024`, `BUG-028`)**: Fallback local authentication user IDs fail PostgreSQL RLS checks requiring valid JWT.
2. **Unbounded JSONB Growth (`BUG-014`, `BUG-018`)**: Point array storage overhead in `drawing_strokes`.

---

# Authentication / Authorization Findings

1. **Broadcast Event Authority Spoofing (`BUG-002`, `BUG-041`)**: Non-host participants can broadcast host-only actions (`SESSION_ENDED`).
2. **Local User Storage Collision (`BUG-010`, `BUG-014`)**: Domain-wide `localStorage` usage forces multi-tab sessions in same browser to share user ID.
3. **Rejection Re-Join Blockade (`BUG-023`, `BUG-027`)**: Previously rejected participants blocked from re-requesting room entry.

---

# Test Coverage Gaps

- No automated unit tests or integration tests exist in the codebase.
- Realtime WebSocket broadcast delivery and latency handling are untested in automated CI pipelines.
- Multi-user concurrency scenarios (simultaneous drawing/erasing) are uncovered by automated tests.

---

# Areas Not Fully Tested

- High-scale concurrent user volume (100+ simultaneous room members in a single canvas).
- Enterprise firewall / Proxy WebSockets blocking fallback behavior.
- Android WebSockets backgrounding when mobile device enters deep sleep mode.

---

# Recommended Future Fix Priority

1. **CRITICAL Security & Access Controls** (`BUG-001`, `BUG-002`, `BUG-040`, `BUG-041`): Secure WebSocket broadcast channels with database RLS checks and validate host identity on broadcast event handlers.
2. **HIGH Functional & Concurrency Issues** (`BUG-003`, `BUG-004`, `BUG-005`, `BUG-008`, `BUG-042`, `BUG-043`): Fix tablet palm rejection, non-HTTPS clipboard copy fallback, participant waiting view exit button, and eraser in-flight stroke collision.
3. **MEDIUM UI/UX & Responsive Issues** (`BUG-011`, `BUG-012`, `BUG-015`, `BUG-016`, `BUG-017`, `BUG-018`, `BUG-019`, `BUG-021`, `BUG-025`): Fix color picker popover clipping, iOS camera notch safe-area padding, unconfirmed participant removal modal, form double-submission guards, mobile Safari viewport height, and z-index modal layering.
4. **LOW Usability & Accessibility Issues** (`BUG-030` through `BUG-043`): Improve WCAG text contrast, add ARIA screen-reader labels, enforce max room capacity, and add hold-to-repeat brush size controls.
5. **Cosmetic & Technical Debt** (`BUG-044` through `BUG-047`): Wrap storage in `useEffect` for clean SSR hydration, sanitize console error logs, remove unused utility functions (`formatTime`), and add public favicon assets.

---

# Final Audit Notes

The **Draw on Air** codebase displays strong architectural fundamentals. Core real-time whiteboarding, canvas rendering, Next.js routing, and Tailwind styling are well structured.

By systematically addressing the **47 confirmed bugs** documented in `senior-tester.md`, the engineering team can guarantee a secure, high-performance, and polished release across mobile, tablet, and desktop platforms.
