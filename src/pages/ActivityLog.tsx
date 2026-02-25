import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { formatDate } from '@/lib/supabase-helpers';
import { ClipboardList } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ActivityEntry {
  id: string;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export default function ActivityLog() {
  const { organization } = useOrganization();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    if (!organization) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('activity_log')
        .select('*')
        .eq('org_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(200);
      setEntries((data || []) as ActivityEntry[]);
    };
    fetch();
  }, [organization]);

  const actionColor = (action: string) => {
    if (action === 'create' || action === 'csv_import') return 'default';
    if (action === 'update') return 'secondary';
    if (action === 'delete') return 'destructive';
    if (action === 'sell') return 'outline';
    return 'secondary';
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="font-display text-2xl font-bold">Activity Log</h1>

      <div className="space-y-2">
        {entries.map(entry => (
          <div key={entry.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={actionColor(entry.action) as "default" | "secondary" | "destructive" | "outline"} className="text-xs">
                    {entry.action}
                  </Badge>
                  <Badge variant="outline" className="text-xs">{entry.entity_type}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{entry.user_email}</p>
                {Object.keys(entry.details).length > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                    {Object.entries(entry.details)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' · ')}
                  </p>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0 ml-2">
                {formatDate(entry.created_at)}
              </span>
            </div>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="flex flex-col items-center py-20 text-muted-foreground">
            <ClipboardList className="h-12 w-12 mb-3 opacity-30" />
            <p>No activity yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
