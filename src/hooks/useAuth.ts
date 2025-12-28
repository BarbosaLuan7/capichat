import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { logger } from '@/lib/logger';

type Profile = Database['public']['Tables']['profiles']['Row'];
type AppRole = Database['public']['Enums']['app_role'];

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  teamId?: string | null;
  isActive: boolean;
  role: AppRole;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) throw roleError;
      setRole(roleData?.role || 'agent');
    } catch (err) {
      logger.error('Error fetching user data:', err);
      setError('Erro ao carregar dados do usuário');
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Defer Supabase calls with setTimeout
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
        }
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const signIn = async (email: string, password: string) => {
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
      return { error };
    }
    return { error: null };
  };

  const signUp = async (email: string, password: string, name: string) => {
    setError(null);
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name,
        },
      },
    });
    if (error) {
      setError(error.message);
      return { error };
    }
    return { error: null };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setError(error.message);
    }
    setProfile(null);
    setRole(null);
  };

  const authUser: AuthUser | null = user && profile ? {
    id: user.id,
    email: user.email || profile.email,
    name: profile.name,
    avatar: profile.avatar,
    teamId: profile.team_id,
    isActive: profile.is_active,
    role: role || 'agent',
  } : null;

  return {
    user,
    session,
    profile,
    role,
    authUser,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    isAuthenticated: !!session,
    isAdmin: role === 'admin',
    isManager: role === 'manager' || role === 'admin',
    isAgent: role === 'agent' || role === 'manager' || role === 'admin',
  };
}
