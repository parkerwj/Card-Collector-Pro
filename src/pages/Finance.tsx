import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate, logActivity } from '@/lib/supabase-helpers';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit2, Trash2, DollarSign } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';

interface Transaction {
  id: string;
  type: string;
  description: string;
  category: string | null;
  amount: number;
  date: string;
  payment_type: string;
  paid_by: string | null;
  reimbursed: boolean;
  reimbursed_date: string | null;
  created_at: string;
}

const categories = ['Supplies', 'Shipping', 'Inventory', 'Marketing', 'Software', 'Sale', 'Other'];

export default function Finance() {
  const { organization } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formType, setFormType] = useState<'expense' | 'revenue'>('expense');

  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentType, setPaymentType] = useState('business');
  const [paidBy, setPaidBy] = useState('');
  const [reimbursed, setReimbursed] = useState(false);
  const [reimbursedDate, setReimbursedDate] = useState('');

  const fetchTransactions = async () => {
    if (!organization) return;
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('org_id', organization.id)
      .order('date', { ascending: false });
    setTransactions((data || []) as Transaction[]);
  };

  useEffect(() => { fetchTransactions(); }, [organization]);

  const resetForm = () => {
    setDescription(''); setCategory(''); setAmount(''); setDate(new Date().toISOString().split('T')[0]);
    setPaymentType('business'); setPaidBy(''); setReimbursed(false); setReimbursedDate('');
    setEditingTx(null);
  };

  const openAdd = (type: 'expense' | 'revenue') => {
    resetForm();
    setFormType(type);
    setShowForm(true);
  };

  const openEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setFormType(tx.type as 'expense' | 'revenue');
    setDescription(tx.description);
    setCategory(tx.category || '');
    setAmount(tx.amount.toString());
    setDate(tx.date);
    setPaymentType(tx.payment_type);
    setPaidBy(tx.paid_by || '');
    setReimbursed(tx.reimbursed);
    setReimbursedDate(tx.reimbursed_date || '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!organization || !user || !description.trim() || !amount) return;
    const payload = {
      org_id: organization.id,
      type: formType,
      description: description.trim(),
      category: category || null,
      amount: parseFloat(amount),
      date,
      payment_type: formType === 'expense' ? paymentType : 'business',
      paid_by: paymentType === 'personal' ? paidBy || null : null,
      reimbursed: paymentType === 'personal' ? reimbursed : false,
      reimbursed_date: reimbursed ? reimbursedDate || null : null,
      created_by: user.id,
    };

    if (editingTx) {
      const { error } = await supabase.from('transactions').update(payload).eq('id', editingTx.id);
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      await logActivity(organization.id, user.email!, 'update', formType, editingTx.id, { description: description.trim() });
    } else {
      const { data, error } = await supabase.from('transactions').insert(payload).select().single();
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      await logActivity(organization.id, user.email!, 'create', formType, (data as Transaction).id, { description: description.trim(), amount: parseFloat(amount) });
    }

    setShowForm(false);
    resetForm();
    fetchTransactions();
  };

  const handleDelete = async () => {
    if (!deletingId || !organization || !user) return;
    const { error } = await supabase.from('transactions').delete().eq('id', deletingId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    await logActivity(organization.id, user.email!, 'delete', 'transaction', deletingId);
    setDeletingId(null);
    fetchTransactions();
  };

  const revenue = transactions.filter(t => t.type === 'revenue').reduce((s, t) => s + t.amount, 0);
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const profit = revenue - expenses;

  // Personal expense summary
  const personalExpenses = transactions.filter(t => t.type === 'expense' && t.payment_type === 'personal');
  const personalSummary: Record<string, { total: number; unreimbursed: number }> = {};
  personalExpenses.forEach(t => {
    const name = t.paid_by || 'Unknown';
    if (!personalSummary[name]) personalSummary[name] = { total: 0, unreimbursed: 0 };
    personalSummary[name].total += t.amount;
    if (!t.reimbursed) personalSummary[name].unreimbursed += t.amount;
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">Finance</h1>
        <div className="flex gap-2">
          <Button onClick={() => openAdd('expense')} size="sm" variant="secondary">
            <Plus className="mr-1 h-4 w-4" /> Expense
          </Button>
          <Button onClick={() => openAdd('revenue')} size="sm">
            <Plus className="mr-1 h-4 w-4" /> Revenue
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="stat-card">
          <span className="text-xs text-muted-foreground">Revenue</span>
          <p className="font-display text-lg font-bold text-primary">{formatCurrency(revenue)}</p>
        </div>
        <div className="stat-card">
          <span className="text-xs text-muted-foreground">Expenses</span>
          <p className="font-display text-lg font-bold">{formatCurrency(expenses)}</p>
        </div>
        <div className="stat-card border-primary/30 gold-glow-sm">
          <span className="text-xs text-muted-foreground">Profit</span>
          <p className={`font-display text-lg font-bold ${profit >= 0 ? 'gold-gradient-text' : 'text-destructive'}`}>
            {formatCurrency(profit)}
          </p>
        </div>
      </div>

      {/* Personal expense summary */}
      {Object.keys(personalSummary).length > 0 && (
        <div className="rounded-lg border border-border bg-card p-3">
          <h3 className="text-xs font-medium text-muted-foreground mb-2">Personal Expense Summary</h3>
          <div className="space-y-1 text-sm">
            {Object.entries(personalSummary).map(([name, data]) => (
              <div key={name} className="flex justify-between">
                <span>{name}</span>
                <span>
                  Total: {formatCurrency(data.total)} ·{' '}
                  <span className={data.unreimbursed > 0 ? 'text-destructive' : 'text-primary'}>
                    Unreimbursed: {formatCurrency(data.unreimbursed)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div className="space-y-2">
        {transactions.map(tx => (
          <div key={tx.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge variant={tx.type === 'revenue' ? 'default' : 'secondary'} className="text-xs">
                  {tx.type}
                </Badge>
                {tx.payment_type === 'personal' && (
                  <Badge variant="outline" className="text-xs">personal</Badge>
                )}
                {tx.reimbursed && (
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">reimbursed</Badge>
                )}
              </div>
              <p className="font-medium mt-1 truncate">{tx.description}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(tx.date)}
                {tx.paid_by && ` · Paid by ${tx.paid_by}`}
                {tx.category && ` · ${tx.category}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`font-mono font-medium ${tx.type === 'revenue' ? 'text-primary' : ''}`}>
                {tx.type === 'expense' ? '-' : '+'}{formatCurrency(tx.amount)}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(tx)}>
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeletingId(tx.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        {transactions.length === 0 && (
          <div className="flex flex-col items-center py-20 text-muted-foreground">
            <DollarSign className="h-12 w-12 mb-3 opacity-30" />
            <p>No transactions yet</p>
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTx ? 'Edit' : 'Add'} {formType === 'expense' ? 'Expense' : 'Revenue'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Amount</Label>
                <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {formType === 'expense' && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Payment Type</Label>
                  <Select value={paymentType} onValueChange={setPaymentType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {paymentType === 'personal' && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Paid By</Label>
                      <Input value={paidBy} onChange={e => setPaidBy(e.target.value)} placeholder="Name" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={reimbursed} onCheckedChange={(v) => setReimbursed(!!v)} id="reimbursed" />
                      <Label htmlFor="reimbursed" className="text-xs">Reimbursed</Label>
                    </div>
                    {reimbursed && (
                      <div className="space-y-1">
                        <Label className="text-xs">Reimbursed Date</Label>
                        <Input type="date" value={reimbursedDate} onChange={e => setReimbursedDate(e.target.value)} />
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={!description.trim() || !amount}>
              {editingTx ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
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
