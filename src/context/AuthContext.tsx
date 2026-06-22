import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Consultant, Session, User } from '../lib/supabase';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  consultant: Consultant | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ session: Session | null; user: User | null }>;
  signUp: (email: string, password: string) => Promise<{ session: Session | null; user: User | null }>;
  signOut: () => Promise<void>;
  isDemoMode: false;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  consultant: null,
  loading: true,
  signIn: async () => ({ session: null, user: null }),
  signUp: async () => ({ session: null, user: null }),
  signOut: async () => {},
  isDemoMode: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [consultant, setConsultant] = useState<Consultant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('[AuthContext] Error getting session:', error.message);
        setLoading(false);
        return;
      }
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user as unknown as User);
        loadConsultant(data.session.user.id);
      }
      setLoading(false);
    }).catch((err) => {
      console.error('[AuthContext] Unrecoverable auth error:', err);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (newSession) {
        setSession(newSession);
        setUser(newSession.user as unknown as User);
        loadConsultant(newSession.user.id);
      } else {
        setSession(null);
        setUser(null);
        setConsultant(null);
      }
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadConsultant(userId: string) {
    try {
      const { data, error } = await supabase
        .from('consultants')
        .select('*')
        .eq('auth_user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[AuthContext] Error loading consultant:', error.message);
        return;
      }

      if (data) {
        setConsultant(data);
      } else {
        console.warn('[AuthContext] No consultant row found for user:', userId);
      }
    } catch (err) {
      console.error('[AuthContext] Unexpected error loading consultant:', err);
    }
  }

  const signIn: AuthContextType['signIn'] = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data as unknown as { session: Session | null; user: User | null };
  };

  const signUp: AuthContextType['signUp'] = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: email.split('@')[0],
        },
      },
    });
    if (error) {
      if (error.status === 500 && error.message === '{}') {
        throw new Error(
          'Account creation failed — your Supabase database needs a fix. ' +
          'Go to Supabase Dashboard → SQL Editor and run the fix-auth-trigger.sql script.'
        );
      }
      throw error;
    }
    return data as unknown as { session: Session | null; user: User | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setConsultant(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, consultant, loading, signIn, signUp, signOut, isDemoMode: false }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
