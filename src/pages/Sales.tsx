import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { formatCurrency, formatDate } from '@/lib/supabase-helpers';
import { ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Sale {
  id: string;
  product_name: string | null;
  set_name: string | null;
  condition: string | null;
  quantity_sold: number;
  sold_price: number;
  date_sold: string;
  sales_channel: string | null;
  notes: string | null;
  created_at: string;
}

export default function Sales() {
  const { organization } = useOrganization();
  const [sales, setSales] = useState<Sale[]>([]);

  useEffect(() => {
    if (!organization) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('sales')
        .select('*')
        .eq('org_id', organization.id)
        .order('date_sold', { ascending: false });
      setSales((data || []) as Sale[]);
    };
    fetch();
  }, [organization]);

  const totalRevenue = sales.reduce((s, sale) => s + sale.sold_price, 0);
  const totalSold = sales.reduce((s, sale) => s + sale.quantity_sold, 0);

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="font-display text-2xl font-bold">Sales</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card border-primary/30 gold-glow-sm">
          <span className="text-xs text-muted-foreground">Total Revenue</span>
          <p className="font-display text-lg font-bold gold-gradient-text">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="stat-card">
          <span className="text-xs text-muted-foreground">Items Sold</span>
          <p className="font-display text-lg font-bold">{totalSold}</p>
        </div>
      </div>

      <div className="space-y-2">
        {sales.map(sale => (
          <div key={sale.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{sale.product_name || 'Item'}</p>
                <p className="text-xs text-muted-foreground">
                  {sale.set_name && `${sale.set_name} · `}
                  {sale.condition && `${sale.condition} · `}
                  Qty {sale.quantity_sold} · {formatDate(sale.date_sold)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono font-medium text-primary">{formatCurrency(sale.sold_price)}</p>
                {sale.sales_channel && (
                  <Badge variant="outline" className="text-xs mt-0.5">{sale.sales_channel}</Badge>
                )}
              </div>
            </div>
            {sale.notes && <p className="text-xs text-muted-foreground mt-1">{sale.notes}</p>}
          </div>
        ))}
        {sales.length === 0 && (
          <div className="flex flex-col items-center py-20 text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mb-3 opacity-30" />
            <p>No sales yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
