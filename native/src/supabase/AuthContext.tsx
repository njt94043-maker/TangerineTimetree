import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './client';
import { onAuthError } from '@shared/supabase/clientRef';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '@shared/supabase/types';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  signIn: async () => null,
  signOut: async () => {},
});

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data);
  }

  useEffect(() => {
    // Handle auth errors from shared queries (expired JWT, etc.)
    onAuthError(() => {
      supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
    });

    // Get initial session and refresh to validate JWT
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (s) {
        try {
          const { data } = await supabase.auth.refreshSession();
          const refreshed = data.session;
          setSession(refreshed);
          setUser(refreshed?.user ?? null);
          if (refreshed?.user) fetchProfile(refreshed.user.id);
        } catch {
          // Refresh failed — session expired, clear auth state
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
