import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Edit2, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/supabase-helpers';
import { logActivity } from '@/lib/supabase-helpers';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Collection {
  id: string;
  name: string;
  created_at: string;
  item_count?: number;
  total_value?: number;
}

export default function Collections() {
  const { organization } = useOrganization();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [name, setName] = useState('');

  const fetchCollections = async () => {
    if (!organization) return;
    const { data: cols } = await supabase
      .from('collections')
      .select('*')
      .eq('org_id', organization.id)
      .order('created_at', { ascending: false });

    if (!cols) return;

    // Get item stats per collection
    const enriched = await Promise.all(
      (cols as Collection[]).map(async (col) => {
        const { data: items } = await supabase
          .from('items')
          .select('quantity, market_price')
          .eq('collection_id', col.id);
        const itemArr = (items || []) as { quantity: number; market_price: number }[];
        return {
          ...col,
          item_count: itemArr.reduce((s, i) => s + (i.quantity || 0), 0),
          total_value: itemArr.reduce((s, i) => s + ((i.market_price || 0) * (i.quantity || 0)), 0),
        };
      })
    );
    setCollections(enriched);
  };

  useEffect(() => { fetchCollections(); }, [organization]);

  const handleCreate = async () => {
    if (!name.trim() || !organization || !user) return;
    const { data, error } = await supabase
      .from('collections')
      .insert({ name: name.trim(), org_id: organization.id, created_by: user.id })
      .select()
      .single();
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    await logActivity(organization.id, user.email!, 'create', 'collection', (data as Collection).id, { name: name.trim() });
    setName('');
    setShowCreate(false);
    fetchCollections();
  };

  const handleRename = async () => {
    if (!name.trim() || !editingId || !organization || !user) return;
    const { error } = await supabase.from('collections').update({ name: name.trim() }).eq('id', editingId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    await logActivity(organization.id, user.email!, 'update', 'collection', editingId, { name: name.trim() });
    setName('');
    setEditingId(null);
    fetchCollections();
  };

  const handleDelete = async () => {
    if (!deletingId || !organization || !user) return;
    const { error } = await supabase.from('collections').delete().eq('id', deletingId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    await logActivity(organization.id, user.email!, 'delete', 'collection', deletingId);
    setDeletingId(null);
    fetchCollections();
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Collections</h1>
        <Button onClick={() => { setName(''); setShowCreate(true); }} size="sm">
          <Plus className="mr-1 h-4 w-4" /> New
        </Button>
      </div>

      {collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Layers className="h-12 w-12 mb-3 opacity-30" />
          <p>No collections yet</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {collections.map((col) => (
            <div
              key={col.id}
              className="stat-card flex items-center justify-between cursor-pointer"
              onClick={() => navigate(`/collections/${col.id}`)}
            >
              <div className="min-w-0">
                <h3 className="font-display font-semibold truncate">{col.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {col.item_count} items · {formatCurrency(col.total_value)}
                </p>
              </div>
              <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => { setName(col.name); setEditingId(col.id); }}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => setDeletingId(col.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Collection</DialogTitle></DialogHeader>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Collection name" onKeyDown={e => e.key === 'Enter' && handleCreate()} />
          <DialogFooter>
            <Button onClick={handleCreate} disabled={!name.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!editingId} onOpenChange={() => setEditingId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename Collection</DialogTitle></DialogHeader>
          <Input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRename()} />
          <DialogFooter>
            <Button onClick={handleRename} disabled={!name.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Collection?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this collection and all its items.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
