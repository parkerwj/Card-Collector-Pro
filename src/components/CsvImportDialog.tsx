import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { logActivity } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Upload, FileText } from 'lucide-react';

interface CsvImportDialogProps {
  open: boolean;
  onClose: () => void;
  collectionId: string;
  onComplete: () => void;
}

export function CsvImportDialog({ open, onClose, collectionId, onComplete }: CsvImportDialogProps) {
  const { organization } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string[][]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      setPreview(lines.slice(0, 4).map(l => parseCsvLine(l)));
    };
    reader.readAsText(f);
  };

  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += char; }
    }
    result.push(current.trim());
    return result;
  };

  const handleImport = async () => {
    if (!file || !organization || !user) return;
    setLoading(true);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { toast({ title: 'Error', description: 'CSV has no data rows', variant: 'destructive' }); return; }

      const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
      let imported = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = parseCsvLine(lines[i]);
        if (values.length < 2) continue;

        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

        const tcgplayerId = row.tcgplayer_id || '';
        const productName = row.product_name || '';
        const setName = row.set_name || '';
        const condition = row.condition || '';
        const totalQty = parseInt(row.total_quantity) || 1;
        const addToQty = row.add_to_quantity?.toLowerCase() === 'true' || row.add_to_quantity === '1';

        // Check if item exists for add_to_quantity
        if (addToQty && (tcgplayerId || (productName && setName))) {
          let query = supabase.from('items').select('id, quantity').eq('collection_id', collectionId);
          if (tcgplayerId) query = query.eq('tcgplayer_id', tcgplayerId);
          else query = query.eq('product_name', productName).eq('set_name', setName).eq('condition', condition);
          
          const { data: existing } = await query.limit(1);
          if (existing && existing.length > 0) {
            const ex = existing[0] as { id: string; quantity: number };
            await supabase.from('items').update({ quantity: ex.quantity + totalQty }).eq('id', ex.id);
            imported++;
            continue;
          }
        }

        await supabase.from('items').insert({
          collection_id: collectionId,
          org_id: organization.id,
          created_by: user.id,
          tcgplayer_id: tcgplayerId || null,
          product_line: row.product_line || null,
          set_name: setName || null,
          product_name: productName || null,
          title: row.title || null,
          number: row.number || null,
          rarity: row.rarity || null,
          condition: condition || null,
          market_price: parseFloat(row.tcg_market_price) || 0,
          direct_low: parseFloat(row.tcg_direct_low) || 0,
          low_price_with_shipping: parseFloat(row.tcg_low_price_with_shipping) || 0,
          low_price: parseFloat(row.tcg_low_price) || 0,
          marketplace_price: parseFloat(row.tcg_marketplace_price) || 0,
          quantity: totalQty,
          photo_url: row.photo_url || null,
        });
        imported++;
      }

      await logActivity(organization.id, user.email!, 'csv_import', 'collection', collectionId, { rows_imported: imported });
      toast({ title: `Imported ${imported} items!` });
      onComplete();
      onClose();
    } catch (err: unknown) {
      toast({ title: 'Import Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Import CSV</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {file ? (
              <>
                <FileText className="h-8 w-8 text-primary mb-2" />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Click to select CSV file</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {preview.length > 0 && (
            <div className="overflow-x-auto text-xs rounded border border-border">
              <table className="w-full">
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className={i === 0 ? 'font-medium bg-muted/30' : ''}>
                      {row.slice(0, 5).map((cell, j) => (
                        <td key={j} className="px-2 py-1 border-r border-border truncate max-w-[100px]">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleImport} disabled={!file || loading}>
            {loading ? 'Importing...' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
