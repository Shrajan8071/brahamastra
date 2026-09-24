# Draw on Air — Collaborative Private Drawing Rooms

**Draw on Air** is a private, temporary, real-time collaborative drawing application built with Next.js (App Router), Tailwind CSS, shadcn/ui, and Supabase.

Hosts can create temporary drawing rooms protected by a unique 6-digit room code and an explicit host approval flow. Approved participants draw together on a shared canvas with low-latency realtime stroke synchronization and persistent canvas history.

---

## Features

- 🔒 **Private & Secure Rooms**: 6-digit numeric room code with host approval system. Entering the room code does NOT grant immediate access.
- 🎨 **HTML5 Canvas Drawing Engine**: Built on the native Pointer Events API supporting mouse, touch, stylus, and Apple Pencil with High-DPI screen scaling.
- ✒️ **Multi-Tool Suite**: Pen, translucent Marker, and stroke-level Eraser with adjustable brush sizes and color palette.
- ⚡ **Realtime Synchronization**: Low-latency stroke streaming using Supabase Realtime Broadcast throttling + PostgreSQL stroke persistence.
- 📐 **Cross-Device Resolution Independence**: Normalized (0.0 to 1.0) coordinate space ensuring drawings scale perfectly across desktops, laptops, tablets (iPad), and mobile phones.
- 👤 **Stroke Attribution**: Tap or hover any stroke to view owner attribution ("Drawn by...").
- 👑 **Host Control Panel**:
  - Live approve/reject pending join requests
  - Participant roster view with ability to remove users
  - Start Session trigger
  - End Session (invalidates room permanently)
- 🔒 **Privacy & RLS**: Participants only see approved data; host access control enforced at the database Row-Level Security layer.
- 👤 **Anonymous Authentication**: Frictionless onboarding using Supabase Anonymous Auth (no user signup required).

---

## Tech Stack

| Component | Technology |
|---|---|
| **Frontend Framework** | Next.js 14+ (App Router, JavaScript) |
| **Styling** | Tailwind CSS + Lucide Icons |
| **UI Components** | shadcn/ui primitives |
| **Backend & Database** | Supabase PostgreSQL |
| **Authentication** | Supabase Anonymous Auth |
| **Realtime Engine** | Supabase Realtime (Broadcast + Presence) |
| **Canvas API** | HTML5 Canvas + Pointer Events API |
| **Deployment** | Vercel (Frontend) + Supabase (Backend) |

---

## Architecture Overview

```
User Browser (HTML5 Canvas + React)
        │
        ├── Ephemeral Strokes (Realtime Broadcast ~50ms throttle)
        │       ▼
        ├── Persistent Completed Strokes (PostgreSQL JSONB)
        │       ▼
   Supabase Service
   ├── Anonymous Auth
   ├── PostgreSQL DB + RLS Policies
   └── Realtime Channels (Private Channels)
```

For complete technical details, see [ARCHITECTURE.md](file:///c:/Users/budge/Desktop/19-september/brahamastra/draw-on-air/ARCHITECTURE.md).

---

## Prerequisites & Requirements

- Node.js 18.17.0 or newer
- npm 9+ or pnpm
- A Supabase Project (free tier works great)

---

## Local Setup Instructions

1. **Clone or Navigate to the directory**:
   ```bash
   cd brahamastra/draw-on-air
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```
   (Refer to `.env.example` for reference).

4. **Run Database Migrations**:
   - Open your Supabase Dashboard -> SQL Editor.
   - Run the contents of [`supabase/migrations/001_initial_schema.sql`](file:///c:/Users/budge/Desktop/19-september/brahamastra/draw-on-air/supabase/migrations/001_initial_schema.sql).
   - Enable Anonymous Auth in Supabase Dashboard under **Authentication -> Providers -> Anonymous**.

5. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Database Migration & Schema

The SQL schema includes:
- `rooms`: Room management and lifecycle (`WAITING`, `ACTIVE`, `ENDED`)
- `room_members`: Approved participants and host role mappings
- `join_requests`: Pending join approvals
- `drawing_strokes`: Persisted stroke paths stored as JSONB with soft-delete support
- Row Level Security (RLS) policies enforcing host privilege and member isolation.

---

## Testing the Application Locally

To test real-time collaboration locally:
1. Open [http://localhost:3000](http://localhost:3000) in **Browser Window A**.
2. Click **Create Room**, enter your name, and create a room. You will receive a 6-digit room code (e.g. `481920`).
3. Open an **Incognito / Private Window B** (or another browser) and visit [http://localhost:3000/join](http://localhost:3000/join).
4. Enter the 6-digit code and a display name.
5. Notice that Window B shows *"Waiting for host approval..."*.
6. Switch to Window A (Host). You will see the pending join request. Click **Allow**.
7. Window B automatically updates to the approved waiting lobby.
8. Window A clicks **Start Session**. Both windows enter drawing mode!
9. Draw in Window A or B — observe real-time synchronization, stroke attribution, and eraser behavior.

---

## Production Build & Deployment to Vercel

1. **Test Production Build Locally**:
   ```bash
   npm run build
   ```

2. **Deploy to Vercel**:
   - Push your code to GitHub / GitLab / Bitbucket.
   - Import the project into Vercel.
   - Add environment variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
   - Click **Deploy**.

---

## Security Notes

- The 6-digit room code is used ONLY as a lookup key, NOT as authentication.
- Access authorization is validated via Supabase Anonymous Auth tokens matched against `room_members` records in database RLS policies.
- Client-side variables like `isHost` are used strictly for UI rendering; host operations (`handleStartSession`, `handleEndSession`, `handleRemoveParticipant`) require valid host auth match at the database level.
- Service role keys are NEVER exposed on the client side.

---

## Known Limitations & Future Improvements

- **Undo/Redo Stack**: Future updates can introduce per-user stroke undo stacks.
- **Background Persistence Auto-Archiving**: Automatically clean up ended room strokes after 30 days.
- **Canvas Image Export**: Add an "Export PNG/SVG" button for saving completed drawings.
