import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency, logActivity } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Plus, Trash2, Edit2, Upload, ShoppingCart, Package,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SellDialog } from '@/components/SellDialog';
import { CsvImportDialog } from '@/components/CsvImportDialog';

interface Item {
  id: string;
  tcgplayer_id: string | null;
  product_line: string | null;
  set_name: string | null;
  product_name: string | null;
  title: string | null;
  number: string | null;
  rarity: string | null;
  condition: string | null;
  market_price: number;
  direct_low: number;
  low_price_with_shipping: number;
  low_price: number;
  marketplace_price: number;
  quantity: number;
  photo_url: string | null;
  collection_id: string;
  org_id: string;
  created_by: string;
}

const emptyItem: Partial<Item> = {
  product_line: '', set_name: '', product_name: '', title: '', number: '',
  rarity: '', condition: '', market_price: 0, quantity: 1, photo_url: '',
  tcgplayer_id: '', direct_low: 0, low_price_with_shipping: 0, low_price: 0, marketplace_price: 0,
};

export default function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();

  const [collectionName, setCollectionName] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formData, setFormData] = useState<Partial<Item>>(emptyItem);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [sellItems, setSellItems] = useState<Item[]>([]);

  const fetchItems = async () => {
    if (!id) return;
    const { data: col } = await supabase.from('collections').select('name').eq('id', id).single();
    if (col) setCollectionName((col as { name: string }).name);

    const { data } = await supabase
      .from('items')
      .select('*')
      .eq('collection_id', id)
      .order('product_name');
    setItems((data || []) as Item[]);
  };

  useEffect(() => { fetchItems(); }, [id]);

  const totals = useMemo(() => ({
    count: items.reduce((s, i) => s + i.quantity, 0),
    value: items.reduce((s, i) => s + (i.market_price * i.quantity), 0),
  }), [items]);

  const toggleSelect = (itemId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev => prev.size === items.length ? new Set() : new Set(items.map(i => i.id)));
  };

  const handleSave = async () => {
    if (!organization || !user || !id) return;
    const payload = {
      ...formData,
      collection_id: id,
      org_id: organization.id,
      created_by: user.id,
      market_price: Number(formData.market_price) || 0,
      quantity: Number(formData.quantity) || 1,
      direct_low: Number(formData.direct_low) || 0,
      low_price_with_shipping: Number(formData.low_price_with_shipping) || 0,
      low_price: Number(formData.low_price) || 0,
      marketplace_price: Number(formData.marketplace_price) || 0,
    };

    if (editingItem) {
      const { error } = await supabase.from('items').update(payload).eq('id', editingItem.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      await logActivity(organization.id, user.email!, 'update', 'item', editingItem.id, { product_name: formData.product_name });
    } else {
      const { data, error } = await supabase.from('items').insert(payload).select().single();
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      await logActivity(organization.id, user.email!, 'create', 'item', (data as Item).id, { product_name: formData.product_name });
    }

    setShowItemForm(false);
    setEditingItem(null);
    setFormData(emptyItem);
    fetchItems();
  };

  const handleBulkDelete = async () => {
    if (!organization || !user) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from('items').delete().in('id', ids);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    await logActivity(organization.id, user.email!, 'delete', 'item', undefined, { count: ids.length });
    setSelected(new Set());
    setShowDeleteConfirm(false);
    fetchItems();
  };

  const openEdit = (item: Item) => {
    setEditingItem(item);
    setFormData(item);
    setShowItemForm(true);
  };

  const openAdd = () => {
    setEditingItem(null);
    setFormData(emptyItem);
    setShowItemForm(true);
  };

  const updateField = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/collections')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold truncate">{collectionName}</h1>
          <p className="text-xs text-muted-foreground">
            {totals.count} items · {formatCurrency(totals.value)}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={openAdd} size="sm"><Plus className="mr-1 h-4 w-4" /> Add Item</Button>
        <Button onClick={() => setShowCsvImport(true)} size="sm" variant="secondary">
          <Upload className="mr-1 h-4 w-4" /> Import CSV
        </Button>
        {selected.size > 0 && (
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSellItems(items.filter(i => selected.has(i.id)))}
            >
              <ShoppingCart className="mr-1 h-4 w-4" /> Sell ({selected.size})
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="mr-1 h-4 w-4" /> Delete ({selected.size})
            </Button>
          </>
        )}
      </div>

      {/* Items Table */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-muted-foreground">
          <Package className="h-12 w-12 mb-3 opacity-30" />
          <p>No items yet</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-8">
                  <Checkbox
                    checked={selected.size === items.length && items.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th>Image</th>
                <th>Name</th>
                <th>Set</th>
                <th>Condition</th>
                <th className="text-right">Price</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Value</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Checkbox
                      checked={selected.has(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                    />
                  </td>
                  <td>
                    {item.photo_url ? (
                      <img
                        src={item.photo_url}
                        alt=""
                        className="h-8 w-8 rounded object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="h-8 w-8 rounded bg-muted" />
                    )}
                  </td>
                  <td className="font-medium max-w-[150px] truncate">{item.product_name || item.title || '—'}</td>
                  <td className="text-muted-foreground max-w-[100px] truncate">{item.set_name || '—'}</td>
                  <td className="text-xs">{item.condition || '—'}</td>
                  <td className="text-right font-mono text-sm">{formatCurrency(item.market_price)}</td>
                  <td className="text-right font-mono text-sm">{item.quantity}</td>
                  <td className="text-right font-mono text-sm text-primary">{formatCurrency(item.market_price * item.quantity)}</td>
                  <td>
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSellItems([item])}>
                        <ShoppingCart className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Item Form Dialog */}
      <Dialog open={showItemForm} onOpenChange={setShowItemForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add Item'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 text-sm">
            {[
              { key: 'product_name', label: 'Product Name' },
              { key: 'product_line', label: 'Product Line' },
              { key: 'set_name', label: 'Set Name' },
              { key: 'title', label: 'Title' },
              { key: 'number', label: 'Number' },
              { key: 'rarity', label: 'Rarity' },
              { key: 'condition', label: 'Condition' },
              { key: 'tcgplayer_id', label: 'TCGplayer ID' },
              { key: 'photo_url', label: 'Photo URL' },
            ].map(f => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  value={(formData as Record<string, unknown>)[f.key] as string || ''}
                  onChange={e => updateField(f.key, e.target.value)}
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'market_price', label: 'Market Price' },
                { key: 'quantity', label: 'Quantity' },
                { key: 'direct_low', label: 'Direct Low' },
                { key: 'low_price', label: 'Low Price' },
                { key: 'low_price_with_shipping', label: 'Low w/ Shipping' },
                { key: 'marketplace_price', label: 'Marketplace Price' },
              ].map(f => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={(formData as Record<string, unknown>)[f.key] as number || 0}
                    onChange={e => updateField(f.key, parseFloat(e.target.value) || 0)}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave}>
              {editingItem ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sell Dialog */}
      {sellItems.length > 0 && (
        <SellDialog
          items={sellItems}
          onClose={() => { setSellItems([]); setSelected(new Set()); }}
          onComplete={() => { setSellItems([]); setSelected(new Set()); fetchItems(); }}
        />
      )}

      {/* CSV Import */}
      <CsvImportDialog
        open={showCsvImport}
        onClose={() => setShowCsvImport(false)}
        collectionId={id!}
        onComplete={fetchItems}
      />

      {/* Bulk Delete Confirm */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} items?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
