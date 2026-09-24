'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase/client';
import { ROOM_STATUS, MEMBER_ROLE, MEMBER_STATUS, REQUEST_STATUS, REALTIME_EVENTS } from '@/lib/constants';
import { LoadingScreen } from '@/components/ui/spinner';
import { HostLobby } from '@/components/lobby/HostLobby';
import { ParticipantWaiting } from '@/components/lobby/ParticipantWaiting';
import { DrawingRoom } from '@/components/drawing/DrawingRoom';
import { SessionEnded } from '@/components/room/SessionEnded';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { ArrowLeft, Clock, Users, XCircle, Loader2 } from 'lucide-react';
import { isValidDisplayName } from '@/lib/utils';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId;
  const { user, loading: authLoading, ensureAuth } = useAuth();

  const [room, setRoom] = useState(null);
  const [membership, setMembership] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Inline join request state for direct room URL access
  const [directName, setDirectName] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [directError, setDirectError] = useState('');

  // Join requests (host only)
  const [joinRequests, setJoinRequests] = useState([]);
  // Room members (all users)
  const [members, setMembers] = useState([]);

  const channelRef = useRef(null);

  // Load room members (for ALL users: host AND participants)
  const loadMembersData = useCallback(async () => {
    if (!roomId) return;
    const { data: membersList } = await supabase
      .from('room_members')
      .select('*')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });

    let finalMembers = membersList || [];

    // Ensure host is included in members list for all participants even if RLS filtered it out
    const hasHost = finalMembers.some((m) => m.role === MEMBER_ROLE.HOST);
    if (!hasHost && room?.host_user_id) {
      finalMembers = [
        {
          id: `host-${room.host_user_id}`,
          room_id: roomId,
          user_id: room.host_user_id,
          display_name: 'Host',
          role: MEMBER_ROLE.HOST,
          status: MEMBER_STATUS.APPROVED,
        },
        ...finalMembers,
      ];
    }

    setMembers(finalMembers);
  }, [roomId, room]);

  // Load host-only data (join requests)
  const loadHostData = useCallback(async () => {
    if (!roomId) return;

    const { data: requests } = await supabase
      .from('join_requests')
      .select('*')
      .eq('room_id', roomId)
      .eq('status', REQUEST_STATUS.PENDING)
      .order('created_at', { ascending: true });

    setJoinRequests(requests || []);
    await loadMembersData();
  }, [roomId, loadMembersData]);

  // Load room data and membership status
  const loadRoomData = useCallback(async () => {
    if (!user?.id || !roomId) return;

    try {
      // Fetch room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .maybeSingle();

      if (roomError || !roomData) {
        setError('Room not found.');
        setLoading(false);
        return;
      }

      setRoom(roomData);
      const hostStatus = roomData.host_user_id === user.id;
      setIsHost(hostStatus);

      if (hostStatus) {
        setMembership({
          room_id: roomId,
          user_id: user.id,
          role: MEMBER_ROLE.HOST,
          status: MEMBER_STATUS.APPROVED,
        });
        await loadHostData();
        setLoading(false);
        return;
      }

      // Fetch user's membership in room_members
      const { data: memberData } = await supabase
        .from('room_members')
        .select('*')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .maybeSingle();

      let activeMembership = memberData;

      // If no room_members row yet, check join_requests
      if (!activeMembership) {
        const { data: requestData } = await supabase
          .from('join_requests')
          .select('*')
          .eq('room_id', roomId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (requestData) {
          if (requestData.status === REQUEST_STATUS.PENDING) {
            activeMembership = {
              id: requestData.id,
              room_id: roomId,
              user_id: user.id,
              display_name: requestData.display_name,
              role: MEMBER_ROLE.PARTICIPANT,
              status: 'PENDING_APPROVAL',
            };
          } else if (requestData.status === REQUEST_STATUS.APPROVED) {
            activeMembership = {
              id: requestData.id,
              room_id: roomId,
              user_id: user.id,
              display_name: requestData.display_name,
              role: MEMBER_ROLE.PARTICIPANT,
              status: MEMBER_STATUS.APPROVED,
            };
          } else if (requestData.status === REQUEST_STATUS.REJECTED) {
            activeMembership = {
              id: requestData.id,
              room_id: roomId,
              user_id: user.id,
              display_name: requestData.display_name,
              role: MEMBER_ROLE.PARTICIPANT,
              status: 'REJECTED',
            };
          }
        }
      }

      setMembership(activeMembership);
      await loadMembersData();
      setLoading(false);
    } catch {
      setError('Failed to load room data.');
      setLoading(false);
    }
  }, [user, roomId, loadMembersData, loadHostData]);

  // Initial load
  useEffect(() => {
    if (!authLoading && user?.id) {
      loadRoomData();
    }
  }, [authLoading, user, loadRoomData]);

  // Polling backup to keep members and join requests in sync for ALL users
  useEffect(() => {
    if (!roomId || !user?.id) return;

    const interval = setInterval(() => {
      loadMembersData();
      if (isHost) {
        loadHostData();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [roomId, user, isHost, loadMembersData, loadHostData]);

  // Browser beforeunload prompt during active drawing sessions
  useEffect(() => {
    if (room?.status !== ROOM_STATUS.ACTIVE) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Are you sure you want to leave the active drawing room?';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [room?.status]);

  // Set up realtime subscriptions
  useEffect(() => {
    if (!roomId || !user?.id) return;

    const channel = supabase
      .channel(`room:${roomId}`)
      .on('broadcast', { event: REALTIME_EVENTS.JOIN_REQUEST }, () => {
        if (isHost) {
          loadHostData();
        }
      })
      .on('broadcast', { event: REALTIME_EVENTS.JOIN_APPROVED }, (payload) => {
        loadMembersData();
        if (payload.payload?.userId && payload.payload.userId === user.id) {
          loadRoomData();
        }
      })
      .on('broadcast', { event: REALTIME_EVENTS.JOIN_REJECTED }, (payload) => {
        if (payload.payload?.userId && payload.payload.userId === user.id) {
          setMembership({ status: 'REJECTED' });
        }
      })
      .on('broadcast', { event: REALTIME_EVENTS.USER_REMOVED }, (payload) => {
        const isHostSender = payload.payload?.senderId === room?.host_user_id || isHost;
        if (isHostSender && payload.payload?.userId && payload.payload.userId === user.id) {
          setMembership((prev) => prev ? { ...prev, status: MEMBER_STATUS.REMOVED } : null);
          setError('You have been removed from this room by the host.');
        }
        loadMembersData();
        if (isHost) {
          loadHostData();
        }
      })
      .on('broadcast', { event: REALTIME_EVENTS.SESSION_STARTED }, () => {
        setRoom((prev) => prev ? { ...prev, status: ROOM_STATUS.ACTIVE } : null);
      })
      .on('broadcast', { event: REALTIME_EVENTS.SESSION_ENDED }, (payload) => {
        const isHostSender = payload.payload?.senderId === room?.host_user_id || isHost;
        if (isHostSender) {
          setRoom((prev) => prev ? { ...prev, status: ROOM_STATUS.ENDED } : null);
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_members',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          loadMembersData();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user, isHost, room, loadHostData, loadMembersData, loadRoomData]);

  // Handle direct join request from room page
  async function handleDirectJoinRequest(e) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    setDirectError('');

    const trimmedName = directName.trim();
    if (!isValidDisplayName(trimmedName)) {
      setDirectError('Please enter a display name (1-30 characters).');
      return;
    }

    setSendingRequest(true);

    try {
      const currentUser = await ensureAuth();
      if (!currentUser) throw new Error('Authentication failed.');

      const { error: requestError } = await supabase
        .from('join_requests')
        .insert({
          room_id: roomId,
          user_id: currentUser.id,
          display_name: trimmedName,
          status: REQUEST_STATUS.PENDING,
        });

      if (requestError) throw requestError;

      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: REALTIME_EVENTS.JOIN_REQUEST,
          payload: {
            userId: currentUser.id,
            displayName: trimmedName,
          },
        });
      }

      setMembership({
        room_id: roomId,
        user_id: currentUser.id,
        display_name: trimmedName,
        role: MEMBER_ROLE.PARTICIPANT,
        status: 'PENDING_APPROVAL',
      });
    } catch (err) {
      setDirectError(err.message || 'Failed to send join request.');
    } finally {
      setSendingRequest(false);
    }
  }

  // Approve join request
  const handleApprove = useCallback(async (request) => {
    try {
      await supabase
        .from('join_requests')
        .update({ status: REQUEST_STATUS.APPROVED, responded_at: new Date().toISOString() })
        .eq('id', request.id);

      await supabase
        .from('room_members')
        .insert({
          room_id: roomId,
          user_id: request.user_id,
          display_name: request.display_name,
          role: MEMBER_ROLE.PARTICIPANT,
          status: MEMBER_STATUS.APPROVED,
        });

      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: REALTIME_EVENTS.JOIN_APPROVED,
          payload: { userId: request.user_id },
        });
      }

      await loadHostData();
    } catch {
      // Ignored
    }
  }, [roomId, loadHostData]);

  // Reject join request
  const handleReject = useCallback(async (request) => {
    try {
      await supabase
        .from('join_requests')
        .update({ status: REQUEST_STATUS.REJECTED, responded_at: new Date().toISOString() })
        .eq('id', request.id);

      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: REALTIME_EVENTS.JOIN_REJECTED,
          payload: { userId: request.user_id },
        });
      }

      await loadHostData();
    } catch {
      // Ignored
    }
  }, [loadHostData]);

  // Start session (host only)
  const handleStartSession = useCallback(async () => {
    try {
      const { error: updateError } = await supabase
        .from('rooms')
        .update({
          status: ROOM_STATUS.ACTIVE,
          started_at: new Date().toISOString(),
        })
        .eq('id', roomId)
        .eq('host_user_id', user.id);

      if (updateError) throw updateError;

      setRoom((prev) => prev ? { ...prev, status: ROOM_STATUS.ACTIVE } : null);

      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: REALTIME_EVENTS.SESSION_STARTED,
          payload: {},
        });
      }
    } catch {
      // Ignored
    }
  }, [roomId, user]);

  // End session (host only)
  const handleEndSession = useCallback(async () => {
    try {
      const { error: updateError } = await supabase
        .from('rooms')
        .update({
          status: ROOM_STATUS.ENDED,
          ended_at: new Date().toISOString(),
        })
        .eq('id', roomId)
        .eq('host_user_id', user.id);

      if (updateError) throw updateError;

      setRoom((prev) => prev ? { ...prev, status: ROOM_STATUS.ENDED } : null);

      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: REALTIME_EVENTS.SESSION_ENDED,
          payload: { senderId: user.id },
        });
      }
    } catch {
      // Ignored
    }
  }, [roomId, user]);

  // Remove participant (host only)
  const handleRemoveParticipant = useCallback(async (member) => {
    try {
      await supabase
        .from('room_members')
        .update({
          status: MEMBER_STATUS.REMOVED,
          left_at: new Date().toISOString(),
        })
        .eq('id', member.id);

      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: REALTIME_EVENTS.USER_REMOVED,
          payload: { userId: member.user_id, senderId: user.id },
        });
      }

      await loadHostData();
    } catch {
      // Ignored
    }
  }, [loadHostData]);

  // Leave room (participant)
  const handleLeave = useCallback(async () => {
    try {
      await supabase
        .from('room_members')
        .update({
          status: MEMBER_STATUS.LEFT,
          left_at: new Date().toISOString(),
        })
        .eq('room_id', roomId)
        .eq('user_id', user.id);

      router.push('/');
    } catch {
      // Ignored
    }
  }, [roomId, user, router]);

  // Loading state
  if (authLoading || loading) {
    return <LoadingScreen message="Loading room..." />;
  }

  // Error state
  if (error) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center animate-fade-in">
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive mb-4 max-w-md">
            {error}
          </div>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  // No room found
  if (!room) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center animate-fade-in">
          <h2 className="text-xl font-semibold mb-2">Room not found</h2>
          <p className="text-muted-foreground mb-4">This room does not exist or has been removed.</p>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  // Room ended
  if (room.status === ROOM_STATUS.ENDED) {
    return <SessionEnded />;
  }

  // Pending approval state — show Waiting status
  if (membership?.status === 'PENDING_APPROVAL') {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative">
        <div className="relative z-10 w-full max-w-md animate-fade-in">
          <Card className="text-center">
            <CardContent className="pt-8 pb-8 space-y-6">
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
              <div className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                <p className="text-xs text-muted-foreground">Room Code</p>
                <p className="text-lg font-mono font-bold tracking-[0.2em] text-primary">
                  {room.room_code}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  // Request Rejected state
  if (membership?.status === 'REJECTED') {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative">
        <div className="relative z-10 w-full max-w-md animate-fade-in">
          <Card className="text-center">
            <CardContent className="pt-8 pb-8 space-y-6">
              <div className="flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-destructive" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Request Rejected</h2>
                <p className="text-sm text-muted-foreground">
                  The host has declined your request to join this room.
                </p>
              </div>
              <Link href="/">
                <Button variant="outline" className="mt-2">
                  Back to Home
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  // Removed member
  if (membership?.status === MEMBER_STATUS.REMOVED) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center animate-fade-in">
          <h2 className="text-xl font-semibold mb-2">Removed</h2>
          <p className="text-muted-foreground mb-4">You have been removed from this room by the host.</p>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  // Not a member and not the host — render Inline Join Request form directly on room page
  if (!membership && !isHost) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative">
        <div className="relative z-10 w-full max-w-md animate-fade-in">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 border border-accent/20">
                  <Users className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <CardTitle>Join Room</CardTitle>
                  <CardDescription>Request permission from the host to join</CardDescription>
                </div>
              </div>
            </CardHeader>
            <form action="javascript:void(0);" onSubmit={handleDirectJoinRequest}>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-secondary/50 border border-border/50 text-center">
                  <p className="text-xs text-muted-foreground">Room Code</p>
                  <p className="text-xl font-mono font-bold tracking-[0.2em] text-primary">
                    {room.room_code}
                  </p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="direct-name" className="text-sm font-medium">Your Display Name</label>
                  <Input
                    id="direct-name"
                    placeholder="Enter your name..."
                    value={directName}
                    onChange={(e) => setDirectName(e.target.value)}
                    maxLength={30}
                    disabled={sendingRequest}
                  />
                </div>
                {directError && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    {directError}
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleDirectJoinRequest(e);
                  }}
                  className="w-full touch-manipulation cursor-pointer"
                  size="lg"
                  disabled={sendingRequest}
                >
                  {sendingRequest ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending Request...
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4" />
                      Send Join Request
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

  // WAITING state — show lobby
  if (room.status === ROOM_STATUS.WAITING) {
    if (isHost) {
      return (
        <HostLobby
          room={room}
          members={members}
          joinRequests={joinRequests}
          onApprove={handleApprove}
          onReject={handleReject}
          onStartSession={handleStartSession}
          onRemoveParticipant={handleRemoveParticipant}
          onEndSession={handleEndSession}
        />
      );
    }
    return <ParticipantWaiting room={room} membership={membership} onLeave={handleLeaveRoom} />;
  }

  // ACTIVE state — show drawing room
  if (room.status === ROOM_STATUS.ACTIVE) {
    return (
      <DrawingRoom
        room={room}
        user={user}
        membership={membership}
        isHost={isHost}
        members={members}
        joinRequests={joinRequests}
        onApprove={handleApprove}
        onReject={handleReject}
        onRemoveParticipant={handleRemoveParticipant}
        onEndSession={handleEndSession}
        onLeave={handleLeave}
        onRefreshHostData={loadHostData}
      />
    );
  }

  return <LoadingScreen message="Loading..." />;
}
