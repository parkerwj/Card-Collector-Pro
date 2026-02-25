import { useState } from 'react';
import { useOrganization } from '@/hooks/useOrganization';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { Shield, Plus, Users, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Onboarding() {
  const { signOut } = useAuth();
  const { createOrganization, joinOrganization } = useOrganization();
  const { toast } = useToast();
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [orgName, setOrgName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;
    setLoading(true);
    try {
      await createOrganization(orgName.trim());
      toast({ title: 'Organization created!' });
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setLoading(true);
    try {
      await joinOrganization(inviteCode.trim());
      toast({ title: 'Joined organization!' });
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl border border-primary/30 bg-card gold-glow">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Get Started
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create or join an organization to continue
          </p>
        </div>

        {mode === 'choose' && (
          <div className="space-y-3">
            <Button
              onClick={() => setMode('create')}
              className="w-full h-14 text-base gold-glow-sm"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create Organization
            </Button>
            <Button
              onClick={() => setMode('join')}
              variant="secondary"
              className="w-full h-14 text-base"
            >
              <Users className="mr-2 h-5 w-5" />
              Join with Invite Code
            </Button>
            <Button
              onClick={signOut}
              variant="ghost"
              className="w-full text-muted-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="My Team"
                  required
                />
              </div>
              <Button type="submit" className="w-full gold-glow-sm" disabled={loading}>
                {loading ? 'Creating...' : 'Create Organization'}
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => setMode('choose')}
            >
              Back
            </Button>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="inviteCode">Invite Code</Label>
                <Input
                  id="inviteCode"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  placeholder="e.g. a1b2c3d4"
                  required
                  className="font-mono tracking-widest text-center text-lg"
                />
              </div>
              <Button type="submit" className="w-full gold-glow-sm" disabled={loading}>
                {loading ? 'Joining...' : 'Join Organization'}
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => setMode('choose')}
            >
              Back
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
