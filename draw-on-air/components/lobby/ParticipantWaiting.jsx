'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, LogOut } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function ParticipantWaiting({ room, membership, onLeave }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function handleExit() {
    setLeaving(true);
    if (onLeave) {
      await onLeave();
    } else {
      router.push('/');
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[20%] w-[500px] h-[500px] rounded-full bg-accent/5 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <Card className="text-center">
          <CardContent className="pt-8 pb-8 space-y-6">
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Clock className="w-8 h-8 text-primary animate-pulse-soft" />
              </div>
            </div>
            <div>
              <Badge variant="default" className="mb-3">
                Approved
              </Badge>
              <h2 className="text-xl font-semibold mb-2">
                Waiting for session to start...
              </h2>
              <p className="text-sm text-muted-foreground">
                The host will start the drawing session shortly. Sit tight!
              </p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50 border border-border/50">
              <p className="text-xs text-muted-foreground">Room Code</p>
              <p className="text-lg font-mono font-bold tracking-[0.2em] text-primary">
                {room.room_code}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExit}
              disabled={leaving}
              className="w-full text-destructive hover:text-destructive gap-2 cursor-pointer"
              id="btn-leave-waiting"
            >
              <LogOut className="w-4 h-4" />
              {leaving ? 'Leaving Room...' : 'Leave Room'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
