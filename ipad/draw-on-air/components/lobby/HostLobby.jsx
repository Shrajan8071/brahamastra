'use client';

import { useState } from 'react';
import { Copy, Check, Play, Users, UserX, XCircle, LogOut, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MEMBER_STATUS, MEMBER_ROLE } from '@/lib/constants';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export function HostLobby({
  room,
  members,
  joinRequests,
  onApprove,
  onReject,
  onStartSession,
  onRemoveParticipant,
  onEndSession,
}) {
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [participantToRemove, setParticipantToRemove] = useState(null);

  const approvedMembers = members.filter(
    (m) => m.status === MEMBER_STATUS.APPROVED && m.role !== MEMBER_ROLE.HOST
  );

  async function handleCopyCode() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(room.room_code);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = room.room_code;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignored
    }
  }

  async function handleStart() {
    if (starting) return;
    setStarting(true);
    try {
      await onStartSession();
    } catch {
      setStarting(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-8 relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[30%] w-[400px] h-[400px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-lg space-y-6 animate-fade-in">
        {/* Room Header */}
        <div className="text-center space-y-3">
          <Badge variant="default" className="text-xs uppercase tracking-wider">
            Waiting for participants
          </Badge>
          <h1 className="text-2xl font-bold">Your Room</h1>
        </div>

        {/* Room Code Card */}
        <Card>
          <CardContent className="pt-6 text-center space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Room Code
            </p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl font-mono font-bold tracking-[0.3em] text-primary select-all">
                {room.room_code}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyCode}
                className="shrink-0 cursor-pointer"
                id="btn-copy-code"
                aria-label="Copy Room Code to Clipboard"
                title="Copy Room Code"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this code with others to let them join
            </p>
          </CardContent>
        </Card>

        {/* Pending Requests */}
        {joinRequests.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-warning" />
                Pending Requests
                <Badge variant="warning" className="ml-auto">
                  {joinRequests.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {joinRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border/50 gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{req.display_name}</p>
                    <p className="text-xs text-muted-foreground">Wants to join</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => onApprove(req)}
                      id={`btn-approve-${req.id}`}
                    >
                      Allow
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onReject(req)}
                      id={`btn-reject-${req.id}`}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Approved Participants */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Participants
              <Badge variant="default" className="ml-auto">
                {approvedMembers.length + 1}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Host */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full bg-success shrink-0" />
                <p className="text-sm font-medium truncate">
                  {members.find((m) => m.role === MEMBER_ROLE.HOST)?.display_name || 'You'}
                </p>
              </div>
              <Badge variant="default" className="shrink-0">Host</Badge>
            </div>

            {/* Other members */}
            {approvedMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-success shrink-0" />
                  <p className="text-sm font-medium truncate">{member.display_name}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => setParticipantToRemove(member)}
                  id={`btn-remove-${member.id}`}
                  aria-label={`Remove participant ${member.display_name}`}
                >
                  <UserX className="w-4 h-4" />
                </Button>
              </div>
            ))}

            {approvedMembers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No participants yet. Share the room code!
              </p>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            onClick={handleStart}
            disabled={starting}
            className="w-full touch-manipulation cursor-pointer"
            id="btn-start-session"
          >
            <Play className="w-4 h-4" />
            {starting ? 'Starting...' : 'Start Drawing Session'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="w-full text-destructive hover:text-destructive touch-manipulation"
            onClick={() => setShowEndConfirm(true)}
            id="btn-end-session-lobby"
          >
            <XCircle className="w-4 h-4" />
            End Room
          </Button>
        </div>
      </div>

      {/* Participant Removal Confirmation Dialog */}
      <Dialog open={!!participantToRemove} onOpenChange={() => setParticipantToRemove(null)}>
        <DialogContent className="z-[100]">
          <DialogHeader>
            <DialogTitle>Remove Participant?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong className="text-foreground">{participantToRemove?.display_name}</strong> from the lobby?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setParticipantToRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const target = participantToRemove;
                setParticipantToRemove(null);
                if (target) onRemoveParticipant(target);
              }}
            >
              Remove Participant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Confirmation Dialog */}
      <Dialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <DialogContent className="z-[100]">
          <DialogHeader>
            <DialogTitle>End Room?</DialogTitle>
            <DialogDescription>
              This will permanently end the room. All participants will be disconnected
              and the room cannot be restarted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowEndConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowEndConfirm(false);
                onEndSession();
              }}
            >
              End Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
