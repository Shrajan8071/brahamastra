'use client';

import Link from 'next/link';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function SessionEnded() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[20%] w-[400px] h-[400px] rounded-full bg-destructive/3 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <Card className="text-center">
          <CardContent className="pt-8 pb-8 space-y-6">
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-muted border border-border flex items-center justify-center">
                <XCircle className="w-8 h-8 text-muted-foreground" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Session Ended</h2>
              <p className="text-sm text-muted-foreground">
                The host has ended this drawing session. The room is no longer active.
              </p>
            </div>
            <Link href="/">
              <Button variant="outline">Back to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
