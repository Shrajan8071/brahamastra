'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, Loader2, Clock, XCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase/client';
import { isValidRoomCode, isValidDisplayName } from '@/lib/utils';
import { ROOM_STATUS, REQUEST_STATUS, MEMBER_ROLE, MEMBER_STATUS, REALTIME_EVENTS } from '@/lib/constants';

export default function JoinRoomPage() {
  const router = useRouter();
  const { user, loading: authLoading, ensureAuth } = useAuth();
  const [roomCode, setRoomCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [joining, setJoining] = useState(false);
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [requestStatus, setRequestStatus] = useState(null); // PENDING, APPROVED, REJECTED
  const [error, setError] = useState('');
  const [roomId, setRoomId] = useState(null);
  const channelRef = useRef(null);

  // Clean up realtime subscription on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  // Listen for approval/rejection via realtime
  useEffect(() => {
    if (!roomId || !user?.id || !waitingApproval) return;

    const channel = supabase
      .channel(`room:${roomId}`)
      .on('broadcast', { event: REALTIME_EVENTS.JOIN_APPROVED }, (payload) => {
        if (payload.payload?.userId && payload.payload.userId === user.id) {
          setRequestStatus(REQUEST_STATUS.APPROVED);
          // Navigate to the room after a brief delay
          setTimeout(() => {
            router.push(`/room/${roomId}`);
          }, 1000);
        }
      })
      .on('broadcast', { event: REALTIME_EVENTS.JOIN_REJECTED }, (payload) => {
        if (payload.payload?.userId && payload.payload.userId === user.id) {
          setRequestStatus(REQUEST_STATUS.REJECTED);
          setWaitingApproval(false);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user, waitingApproval, router]);

  async function handleJoinRoom(e) {
    if (joining) return;
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    setError('');

    const trimmedCode = roomCode.trim();
    const trimmedName = displayName.trim();

    if (!isValidRoomCode(trimmedCode)) {
      setError('Please enter a valid 6-digit room code.');
      return;
    }

    if (!isValidDisplayName(trimmedName)) {
      setError('Please enter a display name (1-30 characters).');
      return;
    }

    setJoining(true);

    try {
      // Ensure user is authenticated
      const currentUser = await ensureAuth();
      if (!currentUser?.id) {
        throw new Error('Failed to authenticate. Please try again.');
      }

      // Find the room
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('id, status, host_user_id')
        .eq('room_code', trimmedCode)
        .maybeSingle();

      if (roomError || !room) {
        throw new Error('Room not found. Please check the code and try again.');
      }

      if (room.status === ROOM_STATUS.ENDED) {
        throw new Error('This room has ended and is no longer available.');
      }

      // Check if user is the host
      if (room.host_user_id === currentUser.id) {
        router.push(`/room/${room.id}`);
        return;
      }

      // Check room capacity limit (max 20 members)
      const { count: memberCount } = await supabase
        .from('room_members')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id)
        .eq('status', MEMBER_STATUS.APPROVED);

      if (memberCount && memberCount >= 20) {
        throw new Error('This room has reached maximum capacity (20 members).');
      }

      // Check if user is already an approved member
      const { data: existingMember } = await supabase
        .from('room_members')
        .select('id, status')
        .eq('room_id', room.id)
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (existingMember) {
        if (existingMember.status === MEMBER_STATUS.APPROVED) {
          router.push(`/room/${room.id}`);
          return;
        }
        if (existingMember.status === MEMBER_STATUS.REMOVED) {
          throw new Error('You have been removed from this room.');
        }
      }

      // Check for any existing join request for this user
      const { data: existingRequest } = await supabase
        .from('join_requests')
        .select('id, status')
        .eq('room_id', room.id)
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingRequest) {
        if (existingRequest.status === REQUEST_STATUS.PENDING) {
          // Already pending — wait
          setRoomId(room.id);
          setWaitingApproval(true);
          setRequestStatus(REQUEST_STATUS.PENDING);
          setJoining(false);
          return;
        }

        if (existingRequest.status === REQUEST_STATUS.REJECTED) {
          // Re-activate request with new display name
          await supabase
            .from('join_requests')
            .update({
              status: REQUEST_STATUS.PENDING,
              display_name: trimmedName,
              created_at: new Date().toISOString(),
            })
            .eq('id', existingRequest.id);
        }
      } else {
        // Create new join request
        const { error: requestError } = await supabase
          .from('join_requests')
          .insert({
            room_id: room.id,
            user_id: currentUser.id,
            display_name: trimmedName,
            status: REQUEST_STATUS.PENDING,
          });

        if (requestError) {
          throw new Error(requestError.message || 'Failed to send join request.');
        }
      }

      setRoomId(room.id);
      setWaitingApproval(true);
      setRequestStatus(REQUEST_STATUS.PENDING);

      // Send broadcast notification to host once channel is subscribed
      const channel = supabase.channel(`room:${room.id}`);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: REALTIME_EVENTS.JOIN_REQUEST,
            payload: {
              userId: currentUser.id,
              displayName: trimmedName,
            },
          });
        }
      });
      channelRef.current = channel;
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setJoining(false);
    }
  }

  // If waiting for approval
  if (waitingApproval) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-20%] right-[20%] w-[500px] h-[500px] rounded-full bg-accent/5 blur-[120px]" />
        </div>

        <div className="relative z-10 w-full max-w-md animate-fade-in">
          <Card className="text-center">
            <CardContent className="pt-8 pb-8 space-y-6">
              {requestStatus === REQUEST_STATUS.PENDING && (
                <>
                  <div className="flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <Clock className="w-8 h-8 text-primary animate-pulse-soft" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold mb-2">Waiting for host approval...</h2>
                    <p className="text-sm text-muted-foreground">
                      The host will see your request and can approve or reject it.
                    </p>
                  </div>
                </>
              )}

              {requestStatus === REQUEST_STATUS.APPROVED && (
                <>
                  <div className="flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-success/10 border border-success/20 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-success" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold mb-2">Approved!</h2>
                    <p className="text-sm text-muted-foreground">
                      Joining the room...
                    </p>
                  </div>
                </>
              )}

              {requestStatus === REQUEST_STATUS.REJECTED && (
                <>
                  <div className="flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                      <XCircle className="w-8 h-8 text-destructive" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold mb-2">Request Rejected</h2>
                    <p className="text-sm text-muted-foreground">
                      The host has declined your request to join.
                    </p>
                  </div>
                  <Link href="/">
                    <Button variant="outline" className="mt-2">
                      Back to Home
                    </Button>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[20%] w-[500px] h-[500px] rounded-full bg-accent/5 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 border border-accent/20">
                <Users className="w-5 h-5 text-accent" />
              </div>
              <div>
                <CardTitle>Join Room</CardTitle>
                <CardDescription>Enter a room code to join</CardDescription>
              </div>
            </div>
          </CardHeader>

          <form action="javascript:void(0);" onSubmit={handleJoinRoom} suppressHydrationWarning>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="room-code"
                  className="text-sm font-medium text-foreground"
                >
                  Room Code
                </label>
                <Input
                  id="room-code"
                  placeholder="Enter 6-digit code..."
                  value={roomCode}
                  onChange={(e) => {
                    // Only allow digits, max 6
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setRoomCode(val);
                  }}
                  maxLength={6}
                  inputMode="numeric"
                  disabled={joining}
                  suppressHydrationWarning
                  className="text-center text-2xl tracking-[0.3em] font-mono"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="join-display-name"
                  className="text-sm font-medium text-foreground"
                >
                  Your Display Name
                </label>
                <Input
                  id="join-display-name"
                  placeholder="Enter your name..."
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={30}
                  disabled={joining}
                  suppressHydrationWarning
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {error}
                </div>
              )}
            </CardContent>

            <CardFooter>
              <Button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleJoinRoom(e);
                }}
                className="w-full touch-manipulation cursor-pointer"
                size="lg"
                disabled={joining}
                id="btn-submit-join"
              >
                {joining ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4" />
                    Join Room
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  );
}
