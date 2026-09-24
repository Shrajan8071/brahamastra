# Draw on Air — Final Production Release & Bug Audit Report (`bugs.md`)

## Executive Summary
This document represents the **final, comprehensive multi-pass audit** of the **Draw on Air** codebase (`c:\Users\budge\Desktop\19-september\brahamastra\draw-on-air`). 

- **Pass 1**: Architecture, realtime WebSockets, canvas math, high-DPI rendering, and initial database/RLS policies.
- **Pass 2**: Real-world user handling flows, UI defects, mobile tap targets, z-index layering, and viewport CSS bugs.
- **Pass 3 (Final Release Pass)**: Production deployment & release readiness, multi-user realtime concurrency (single room & parallel rooms), security/malpractice vulnerabilities, Next.js hydration issues, and dead code cleanup.

**Audit Goal**: Uncover every single defect across all vectors so the engineering team can launch a secure, bug-free production application.

---

## 📊 Master Summary Table of All 47 Identified Bugs

| Bug ID | Title | Category | Severity | Affected Component |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-001** | Missing Canvas Reset / Clear Event Synchronization Across Room Members | Realtime / Sync | 🔴 High | `DrawingRoom.jsx` |
| **BUG-002** | Race Condition Between Late-Joiner Stroke Fetching and Live Realtime Events | Realtime / Sync | 🔴 High | `DrawingRoom.jsx` |
| **BUG-003** | Touch Event Palm Rejection & Multi-Touch Finger Gesture Conflict | Canvas / Drawing | 🔴 High | `DrawingRoom.jsx` |
| **BUG-004** | Copy Room Code Button Silent Failure on Non-HTTPS Mobile Web Contexts | User Flow / UX | 🔴 High | `HostLobby.jsx` |
| **BUG-005** | Participant Trapped on Waiting Screen Without Leave / Exit Control Action | User Flow / UX | 🔴 High | `ParticipantWaiting.jsx` |
| **BUG-006** | Realtime Broadcast Buffer Point Droppage on Stroke Finish under High Latency | Realtime / Sync | 🟠 Medium | `DrawingRoom.jsx` |
| **BUG-007** | Host Disconnection & Abandoned Active Room State Persistence | State / DB | 🟠 Medium | `app/room/[roomId]/page.js` |
| **BUG-008** | Canvas Resizing on Screen Rotation Clears Native 2D Context Buffer | Canvas / Drawing | 🟠 Medium | `DrawingRoom.jsx` |
| **BUG-009** | Eraser World Hit-Radius Scale Inconsistency at Extreme Zoom Levels | Canvas / Drawing | 🟠 Medium | `DrawingRoom.jsx` |
| **BUG-010** | Fallback Local User ID Storage Collision Across Multiple Browser Tabs | Auth / Security | 🟠 Medium | `useAuth.js` |
| **BUG-011** | Bottom Toolbar Color Picker Popover Overflow Clipping on Small Mobile Screens | Responsive UI | 🟠 Medium | `DrawingRoom.jsx` |
| **BUG-012** | iOS Top Navigation Header Camera Notch Overlay and Unsafe Tap Targets | Responsive UI | 🟠 Medium | `DrawingRoom.jsx`, `globals.css` |
| **BUG-013** | Unsanitized Display Name Inputs Allowing Formatting & UI Layout Breaks | Security / Validation | 🟠 Medium | `lib/utils.js`, `DrawingRoom.jsx` |
| **BUG-014** | Unbounded PostgreSQL JSONB Array Storage Growth on Long Drawing Sessions | Database / Perf | 🟠 Medium | `001_initial_schema.sql` |
| **BUG-015** | Instant Unconfirmed Participant Removal on Host Tap | User Flow / UX | 🟠 Medium | `HostLobby.jsx`, `DrawingRoom.jsx` |
| **BUG-016** | Form Double-Submission Vulnerability on Rapid Keyboard Enter / Tap | User Flow | 🟠 Medium | `app/create/page.js`, `app/join/page.js` |
| **BUG-017** | Mobile Safari Dynamic Viewport Height Collapse (`100vh` vs `100dvh`) | UI / Mobile | 🟠 Medium | `DrawingRoom.jsx`, `globals.css` |
| **BUG-018** | Pen Brush Size Unintended Reset Upon Eraser Tool Selection | UX / Canvas | 🟠 Medium | `DrawingRoom.jsx` |
| **BUG-019** | Unbounded Canvas Pan Offset Disappearance Without Recenter Anchor | UX / Canvas | 🟠 Medium | `DrawingRoom.jsx` |
| **BUG-020** | Realtime Network Disconnection Silence Without User Status Toast/Banner | UX / Realtime | 🟠 Medium | `DrawingRoom.jsx`, `page.js` |
| **BUG-021** | Dialog Modal and Color Picker Popover Z-Index Stacking Collision (`z-50`) | UI / Z-Index | 🟠 Medium | `dialog.jsx`, `DrawingRoom.jsx` |
| **BUG-022** | Unhandled Browser Back Button Navigation During Active Session | User Flow | 🟠 Medium | `app/room/[roomId]/page.js` |
| **BUG-023** | Re-Join Blockade for Previously Rejected Participants | User Flow | 🟠 Medium | `app/join/page.js` |
| **BUG-024** | RLS Select Policy Disconnect for Fallback Local Authentication Users | Security / Auth | 🟠 Medium | `001_initial_schema.sql` |
| **BUG-025** | Sidebar Backdrop Click-Through Vulnerability on Tablet Viewports | Responsive UI | 🟡 Low | `DrawingRoom.jsx` |
| **BUG-026** | Attribution Hover Tooltip Viewport Boundary Clipping & Overflow | Canvas / UI | 🟡 Low | `DrawingRoom.jsx` |
| **BUG-027** | Spacebar Panning Key Listener Conflict with Custom Interactive Elements | Event / Shortcuts | 🟡 Low | `DrawingRoom.jsx` |
| **BUG-028** | Host Lobby Action Buttons Wrap & Truncate on 320px Mobile Screen Widths | Responsive UI | 🟡 Low | `HostLobby.jsx` |
| **BUG-029** | Brush Size Change Lacks Long-Press Auto-Repeat Interval on Touchscreens | Mobile UX | 🟡 Low | `DrawingRoom.jsx` |
| **BUG-030** | Absence of Maximum Room Participant Capacity Ceiling | Performance / Room | 🟡 Low | `app/join/page.js` |
| **BUG-031** | Potential Host Self-Removal / Lockout Execution in Member List | Logic / UI | 🟡 Low | `HostLobby.jsx` |
| **BUG-032** | Sub-Optimal Color Contrast on Low-Brightness Mobile Screens (`10px #8888a0`) | UI / Accessibility | 🟡 Low | `DrawingRoom.jsx`, `globals.css` |
| **BUG-033** | Missing Accessible ARIA Labels on Color Palette & Canvas Elements | Accessibility | 🟡 Low | `DrawingRoom.jsx` |
| **BUG-034** | Rapid Double-Click Race Condition on Host "Start Session" Button | User Flow | 🟡 Low | `HostLobby.jsx` |
| **BUG-035** | Marker Tool Layer Overlap Blending Artifacts Within Single Continuous Stroke | Canvas / Render | 🟡 Low | `DrawingRoom.jsx` |
| **BUG-036** | Room Code Text Selection Alignment Distortions on Custom Mobile Keyboards | Mobile UI | 🟡 Low | `app/join/page.js` |
| **BUG-037** | Soft-Deleted Eraser Rows Accumulation in PostgreSQL Database | Database | 🟡 Low | `001_initial_schema.sql` |
| **BUG-038** | Next.js Client/Server Hydration Mismatch Warning on Initial Page Load | SSR / Hydration | 🔵 Cosmetic | `useAuth.js`, `client.js` |
| **BUG-039** | Missing Public Favicon and Apple Touch Icon Assets | Assets / SEO | 🔵 Cosmetic | `app/layout.js` |
| **BUG-040** | Unauthenticated Realtime Channel Eavesdropping & Broadcast Spoofing | 🚨 Security | 🔴 Critical | `DrawingRoom.jsx`, `page.js` |
| **BUG-041** | Unauthorized Broadcast Event Trusting for Destructive Actions (`SESSION_ENDED`) | 🚨 Security | 🔴 Critical | `app/room/[roomId]/page.js` |
| **BUG-042** | Eraser Tool Ignores In-Flight Pending Remote Strokes During Concurrent Drawing | Realtime / Sync | 🔴 High | `DrawingRoom.jsx` |
| **BUG-043** | PostgreSQL RLS Execution Exceptions on Stroke Submission After Session Termination | DB / Concurrency | 🔴 High | `DrawingRoom.jsx` |
| **BUG-044** | Unhandled Hydration Mismatch on Browser Extension Attribute Injection | SSR / Hydration | 🟠 Medium | `app/create/page.js`, `page.js` |
| **BUG-045** | Sensitive Internal Database Error Message Leaks in Production Console Logs | Security / Operations | 🟠 Medium | All `page.js` files |
| **BUG-046** | Concurrent Double-Erasure WebSockets Duplicate Database Update Overhead | Realtime / DB | 🟡 Low | `DrawingRoom.jsx` |
| **BUG-047** | Dead Code: Unused Utility Functions (`formatTime`) and Stub Constants | Code Cleanliness | 🔵 Cosmetic | `lib/utils.js`, `constants.js` |

---

## 🔒 Security & Malpractice Audit (Pass 3 Focus)

### 1. [BUG-040] Unauthenticated Realtime Channel Eavesdropping & Broadcast Spoofing
- **Severity**: 🔴 Critical / Security
- **Category**: Security & Access Control
- **File Location**: `DrawingRoom.jsx`, `app/room/[roomId]/page.js`
- **Vulnerability**: Supabase Realtime Broadcast channels `drawing:<roomId>` and `room:<roomId>` do not check host approval status before granting WebSocket subscription.
- **Exploit Scenario**: A malicious user opens the browser WebSockets console and executes `supabase.channel('drawing:123456-uuid').subscribe()`. They can instantly stream all private drawing strokes or broadcast unauthorized events without entering a room code or being approved by the host.
- **Suggested Fix**: Enable Supabase RLS Authorization on Realtime Channels using Database-backed authorization or RLS Private Realtime Channels.

### 2. [BUG-041] Unauthorized Broadcast Event Trusting for Destructive Actions (`SESSION_ENDED`)
- **Severity**: 🔴 Critical / Security
- **Category**: Security & Malpractice
- **File Location**: `app/room/[roomId]/page.js` (line 242)
- **Vulnerability**: Client accepts `SESSION_ENDED` and `USER_REMOVED` broadcast events over WebSockets without checking if `payload.senderId === room.host_user_id`.
- **Exploit Scenario**: A malicious participant sends a broadcast event `{ type: 'broadcast', event: 'SESSION_ENDED' }`. Every participant's screen immediately transitions to `<SessionEnded />`, hijacking the host's authority.
- **Suggested Fix**: Verify `payload.userId === room.host_user_id` inside event handlers before executing state changes.

---

## ⚡ Multi-User Concurrency & Parallel Rooms Audit (Pass 3 Focus)

### 3. [BUG-042] Eraser Tool Ignores In-Flight Pending Remote Strokes During Concurrent Drawing
- **Severity**: 🔴 High
- **Category**: Realtime Concurrency
- **File Location**: `components/drawing/DrawingRoom.jsx` (`handleErase`)
- **Symptom**: When User A attempts to erase a line while User B is actively drawing it, the eraser fails completely.
- **Root Cause**: `handleErase` iterates over `strokesRef.current` (completed strokes) but does not search `pendingStrokesRef.current` (live in-flight strokes).
- **Suggested Fix**: Expand eraser collision loop to check both `strokesRef.current` and `pendingStrokesRef.current`.

### 4. [BUG-043] PostgreSQL RLS Execution Exceptions on Stroke Submission After Session Termination
- **Severity**: 🔴 High
- **Category**: Concurrency & Database
- **File Location**: `components/drawing/DrawingRoom.jsx` (`handlePointerUp`)
- **Symptom**: If the host clicks "End Room" while participants are mid-stroke, trailing `pointerup` handlers throw database exception errors in terminal logs.
- **Root Cause**: `handlePointerUp` executes `supabase.from('drawing_strokes').insert(...)` without verifying if `room.status === 'ACTIVE'`.
- **Suggested Fix**: Wrap stroke insertion in `if (room.status !== ROOM_STATUS.ACTIVE) return;`.

---

## 🧹 Code Cleanliness & Production Release Audit (Pass 3 Focus)

### 5. [BUG-045] Sensitive Internal Database Error Message Leaks in Production Console Logs
- **Severity**: 🟠 Medium
- **Category**: Operations & Security
- **File Locations**: `app/create/page.js`, `app/join/page.js`, `app/room/[roomId]/page.js`, `DrawingRoom.jsx`
- **Symptom**: Browser developer console displays raw error objects containing PostgreSQL table names, query strings, and database schemas.
- **Suggested Fix**: Replace verbose `console.error` logs with sanitized user messages in production environments.

### 6. [BUG-047] Dead Code: Unused Utility Functions and Stub Constants
- **Severity**: 🔵 Cosmetic / Dead Code
- **Category**: Code Cleanliness
- **File Locations**: `lib/utils.js` (`formatTime`), `lib/constants.js` (`CANVAS_STATE_REQUEST`, `CANVAS_STATE_RESPONSE`), `CLAUDE.md`
- **Details**:
  - `lib/utils.js`: `formatTime(timestamp)` function is declared but never imported or called anywhere.
  - `lib/constants.js`: `CANVAS_STATE_REQUEST` and `CANVAS_STATE_RESPONSE` are unused stub constants.
  - `CLAUDE.md`: Empty 11-byte stub file.
- **Suggested Fix**: Remove unused utility functions, clean unused constants, and remove empty stub files.

---

## 🎯 Final Release Readiness Statement

With all **47 bugs documented across 3 rigorous passes**, your development team now has a comprehensive blueprint covering:
1. **Security & Access Controls**: Protecting room channels against unauthorized WebSocket listeners and broadcast spoofing.
2. **Realtime Multi-User Concurrency**: Handling simultaneous drawing, erasing, joining, and ending across single and parallel rooms.
3. **User Flow & UX Polish**: Preventing form double-submissions, handling copy fallback on non-HTTPS, and enabling participant leave options.
4. **Mobile & Responsive UI**: Resolving dynamic viewport heights, camera notch safe-areas, and popover positioning.
5. **Code Hygiene**: Sanitizing console error logs and purging dead code.
