import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Profile {
  id: string;
  user_id: string;
  org_id: string | null;
  email: string;
}

interface Organization {
  id: string;
  name: string;
  logo_url: string | null;
  invite_code: string;
  created_by: string;
}

export function useOrganization() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    setProfile(data as Profile | null);

    if (data?.org_id) {
      const { data: org } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', data.org_id)
        .single();
      setOrganization(org as Organization | null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const createOrganization = async (name: string, logoUrl?: string) => {
    if (!user) throw new Error('Not authenticated');
    
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name, logo_url: logoUrl || null, created_by: user.id })
      .select()
      .single();
    
    if (orgError) throw orgError;

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ org_id: (org as Organization).id })
      .eq('user_id', user.id);
    
    if (profileError) throw profileError;

    await fetchProfile();
    return org as Organization;
  };

  const joinOrganization = async (inviteCode: string) => {
    if (!user) throw new Error('Not authenticated');

    const { data: org, error: findError } = await supabase
      .from('organizations')
      .select('*')
      .eq('invite_code', inviteCode.trim())
      .single();

    if (findError || !org) throw new Error('Invalid invite code');

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ org_id: (org as Organization).id })
      .eq('user_id', user.id);

    if (profileError) throw profileError;

    await fetchProfile();
    return org as Organization;
  };

  return {
    profile,
    organization,
    loading,
    createOrganization,
    joinOrganization,
    refetch: fetchProfile,
  };
}
