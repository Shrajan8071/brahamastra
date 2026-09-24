'use client';

import Link from 'next/link';
import { Pencil, Users, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-accent/5 blur-[120px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto animate-fade-in">
        {/* Logo / Title */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-6">
            <Pencil className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
            Draw on{' '}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Air
            </span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
            Create a private room, invite your friends, and draw together on a shared canvas in real time.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-16 w-full sm:w-auto">
          <Link href="/create" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto min-w-[180px]" id="btn-create-room">
              <Pencil className="w-4 h-4" />
              Create Room
            </Button>
          </Link>
          <Link href="/join" className="w-full sm:w-auto">
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto min-w-[180px]"
              id="btn-join-room"
            >
              <Users className="w-4 h-4" />
              Join Room
            </Button>
          </Link>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-xl">
          <FeatureCard
            icon={<Shield className="w-5 h-5 text-primary" />}
            title="Private"
            description="Host-approved access only"
          />
          <FeatureCard
            icon={<Zap className="w-5 h-5 text-accent" />}
            title="Real-time"
            description="See every stroke instantly"
          />
          <FeatureCard
            icon={<Pencil className="w-5 h-5 text-success" />}
            title="Multi-tool"
            description="Pen, marker, and eraser"
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 mt-auto pt-12 pb-6 text-center">
        <p className="text-xs text-muted-foreground/50">
          Temporary rooms · No account required · Built with ❤️
        </p>
      </footer>
    </main>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/50 border border-border/50 hover:border-border transition-colors">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary">
        {icon}
      </div>
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
