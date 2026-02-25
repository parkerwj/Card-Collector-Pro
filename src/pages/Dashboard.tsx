import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { formatCurrency } from '@/lib/supabase-helpers';
import { Layers, Package, DollarSign, TrendingUp, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Stats {
  totalItems: number;
  totalValue: number;
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  collectionCount: number;
}

export default function Dashboard() {
  const { organization } = useOrganization();
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats>({
    totalItems: 0, totalValue: 0, totalRevenue: 0, totalExpenses: 0, profit: 0, collectionCount: 0,
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!organization) return;
    const fetchStats = async () => {
      const [itemsRes, collectionsRes, revenueRes, expensesRes] = await Promise.all([
        supabase.from('items').select('quantity, market_price').eq('org_id', organization.id),
        supabase.from('collections').select('id').eq('org_id', organization.id),
        supabase.from('transactions').select('amount').eq('org_id', organization.id).eq('type', 'revenue'),
        supabase.from('transactions').select('amount').eq('org_id', organization.id).eq('type', 'expense'),
      ]);

      const items = (itemsRes.data || []) as { quantity: number; market_price: number }[];
      const totalItems = items.reduce((s, i) => s + (i.quantity || 0), 0);
      const totalValue = items.reduce((s, i) => s + ((i.market_price || 0) * (i.quantity || 0)), 0);
      const totalRevenue = ((revenueRes.data || []) as { amount: number }[]).reduce((s, r) => s + (r.amount || 0), 0);
      const totalExpenses = ((expensesRes.data || []) as { amount: number }[]).reduce((s, r) => s + (r.amount || 0), 0);

      setStats({
        totalItems,
        totalValue,
        totalRevenue,
        totalExpenses,
        profit: totalRevenue - totalExpenses,
        collectionCount: (collectionsRes.data || []).length,
      });
    };
    fetchStats();
  }, [organization]);

  const copyInviteCode = () => {
    if (!organization?.invite_code) return;
    navigator.clipboard.writeText(organization.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Invite code copied!' });
  };

  const statCards = [
    { label: 'Portfolio Value', value: formatCurrency(stats.totalValue), icon: TrendingUp, accent: true },
    { label: 'Total Items', value: stats.totalItems.toLocaleString(), icon: Package },
    { label: 'Collections', value: stats.collectionCount.toString(), icon: Layers },
    { label: 'Revenue', value: formatCurrency(stats.totalRevenue), icon: DollarSign },
    { label: 'Expenses', value: formatCurrency(stats.totalExpenses), icon: DollarSign },
    { label: 'Profit', value: formatCurrency(stats.profit), icon: TrendingUp },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Dashboard</h1>
        {organization?.invite_code && (
          <button
            onClick={copyInviteCode}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-mono text-muted-foreground hover:border-primary/30 transition-colors"
          >
            {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
            {organization.invite_code}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`stat-card ${card.accent ? 'border-primary/30 gold-glow-sm' : ''}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <card.icon className={`h-4 w-4 ${card.accent ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <p className={`font-display text-lg font-bold ${card.accent ? 'gold-gradient-text' : ''}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
