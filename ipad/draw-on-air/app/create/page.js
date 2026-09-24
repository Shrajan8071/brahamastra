'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase/client';
import { generateRoomCode, isValidDisplayName } from '@/lib/utils';
import { ROOM_STATUS, MEMBER_ROLE, MEMBER_STATUS } from '@/lib/constants';

export default function CreateRoomPage() {
  const router = useRouter();
  const { user, loading: authLoading, ensureAuth } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function handleCreateRoom(e) {
    if (creating) return;
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    setError('');

    const trimmedName = displayName.trim();
    if (!isValidDisplayName(trimmedName)) {
      setError('Please enter a display name (1-30 characters).');
      return;
    }

    setCreating(true);

    try {
      // Ensure user is authenticated
      const currentUser = await ensureAuth();
      if (!currentUser) {
        throw new Error('Failed to authenticate. Please try again.');
      }

      // Generate a unique room code (with retry)
      let roomCode;
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        roomCode = generateRoomCode();
        
        // Check if code already exists
        const { data: existingRoom } = await supabase
          .from('rooms')
          .select('id')
          .eq('room_code', roomCode)
          .maybeSingle();

        if (!existingRoom) break;
        attempts++;
      }

      if (attempts >= maxAttempts) {
        throw new Error('Failed to generate unique room code. Please try again.');
      }

      // Create the room
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert({
          room_code: roomCode,
          host_user_id: currentUser.id,
          status: ROOM_STATUS.WAITING,
        })
        .select()
        .single();

      if (roomError) {
        throw new Error(roomError.message || 'Failed to create room.');
      }

      // Add host as a room member
      const { error: memberError } = await supabase
        .from('room_members')
        .insert({
          room_id: room.id,
          user_id: currentUser.id,
          display_name: trimmedName,
          role: MEMBER_ROLE.HOST,
          status: MEMBER_STATUS.APPROVED,
        });

      if (memberError) {
        // Clean up room if member creation fails
        await supabase.from('rooms').delete().eq('id', room.id);
        throw new Error(memberError.message || 'Failed to set up room.');
      }

      // Navigate to the room
      router.push(`/room/${room.id}`);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setCreating(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative">
      {/* Background gradients */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[20%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
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
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 border border-primary/20">
                <Pencil className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Create Room</CardTitle>
                <CardDescription>Set up a private drawing room</CardDescription>
              </div>
            </div>
          </CardHeader>

          <form action="javascript:void(0);" onSubmit={handleCreateRoom} suppressHydrationWarning>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="display-name"
                  className="text-sm font-medium text-foreground"
                >
                  Your Display Name
                </label>
                <Input
                  id="display-name"
                  placeholder="Enter your name..."
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={30}
                  disabled={creating}
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
                  handleCreateRoom(e);
                }}
                className="w-full touch-manipulation cursor-pointer"
                size="lg"
                disabled={creating}
                id="btn-submit-create"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating Room...
                  </>
                ) : (
                  <>
                    <Pencil className="w-4 h-4" />
                    Create Room
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
