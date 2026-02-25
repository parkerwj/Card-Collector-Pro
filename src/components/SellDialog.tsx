import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, logActivity } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface Item {
  id: string;
  product_name: string | null;
  set_name: string | null;
  condition: string | null;
  market_price: number;
  quantity: number;
  collection_id: string;
  org_id: string;
}

interface SellDialogProps {
  items: Item[];
  onClose: () => void;
  onComplete: () => void;
}

const channels = ['TCGplayer', 'eBay', 'Local', 'Facebook', 'Discord', 'Other'];

export function SellDialog({ items, onClose, onComplete }: SellDialogProps) {
  const { organization } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(items.map(i => [i.id, 1]))
  );
  const [soldPrice, setSoldPrice] = useState(
    items.reduce((s, i) => s + i.market_price, 0)
  );
  const [dateSold, setDateSold] = useState(new Date().toISOString().split('T')[0]);
  const [channel, setChannel] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSell = async () => {
    if (!organization || !user) return;
    setLoading(true);
    try {
      for (const item of items) {
        const qty = quantities[item.id] || 1;
        if (qty > item.quantity) {
          toast({ title: 'Error', description: `Cannot sell more than available for ${item.product_name}`, variant: 'destructive' });
          setLoading(false);
          return;
        }

        // Create sale record
        await supabase.from('sales').insert({
          org_id: organization.id,
          item_id: item.id,
          collection_id: item.collection_id,
          product_name: item.product_name,
          set_name: item.set_name,
          condition: item.condition,
          quantity_sold: qty,
          sold_price: items.length === 1 ? soldPrice : (soldPrice / items.length),
          date_sold: dateSold,
          sales_channel: channel,
          notes,
          created_by: user.id,
        });

        // Create revenue entry
        await supabase.from('transactions').insert({
          org_id: organization.id,
          type: 'revenue',
          description: `Sale: ${item.product_name || 'Item'}`,
          category: 'Sale',
          amount: items.length === 1 ? soldPrice : (soldPrice / items.length),
          date: dateSold,
          created_by: user.id,
        });

        // Reduce inventory
        const newQty = item.quantity - qty;
        if (newQty <= 0) {
          await supabase.from('items').delete().eq('id', item.id);
        } else {
          await supabase.from('items').update({ quantity: newQty }).eq('id', item.id);
        }

        await logActivity(organization.id, user.email!, 'sell', 'item', item.id, {
          product_name: item.product_name,
          quantity_sold: qty,
          sold_price: items.length === 1 ? soldPrice : (soldPrice / items.length),
          channel,
        });
      }

      toast({ title: 'Sale recorded!' });
      onComplete();
    } catch (err: unknown) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sell {items.length} Item{items.length > 1 ? 's' : ''}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between rounded-md border border-border p-2">
              <span className="truncate flex-1">{item.product_name || 'Item'}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">max {item.quantity}</span>
                <Input
                  type="number"
                  min={1}
                  max={item.quantity}
                  value={quantities[item.id]}
                  onChange={e => setQuantities(prev => ({ ...prev, [item.id]: parseInt(e.target.value) || 1 }))}
                  className="w-16 h-8 text-center"
                />
              </div>
            </div>
          ))}

          <div className="space-y-1">
            <Label className="text-xs">Total Sold Price</Label>
            <Input
              type="number"
              step="0.01"
              value={soldPrice}
              onChange={e => setSoldPrice(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Date Sold</Label>
            <Input type="date" value={dateSold} onChange={e => setDateSold(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Sales Channel</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger><SelectValue placeholder="Select channel" /></SelectTrigger>
              <SelectContent>
                {channels.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes (optional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSell} disabled={loading}>
            {loading ? 'Processing...' : `Sell for ${formatCurrency(soldPrice)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
