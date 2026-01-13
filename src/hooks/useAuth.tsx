import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    nickname: string
  ) => Promise<{ error: string | null; needsEmailConfirmation?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null; code?: string }>;
  verifyRecoveryCode: (email: string, code: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
    nickname: string
  ): Promise<{ error: string | null; needsEmailConfirmation?: boolean }> => {
    try {
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();
      const trimmedNickname = nickname.trim().replace(/\s+/g, ' '); // Collapse multiple spaces

      // Validate inputs
      if (!trimmedEmail || !trimmedPassword || !trimmedNickname) {
        return { error: 'All fields are required' };
      }

      if (trimmedPassword.length < 6) {
        return { error: 'Password must be at least 6 characters' };
      }

      if (trimmedNickname.length < 2 || trimmedNickname.length > 20) {
        return { error: 'Nickname must be 2-20 characters' };
      }

      // Check if nickname is taken
      const { data: existingNick } = await supabase
        .from('leaderboard')
        .select('id')
        .eq('nickname', trimmedNickname)
        .maybeSingle();

      if (existingNick) {
        return { error: 'Nickname already taken' };
      }

      const redirectUrl = `${window.location.origin}/`;

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPassword,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            nickname: trimmedNickname,
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          return { error: 'Email already registered. Use LOGIN command.' };
        }
        return { error: error.message };
      }

      // If confirmation is required, there will be no session yet.
      // We'll create the leaderboard entry on first successful login instead.
      const needsEmailConfirmation = !data.session;

      return { error: null, needsEmailConfirmation };
    } catch (err: any) {
      return { error: err.message || 'Signup failed' };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();

      if (!trimmedEmail || !trimmedPassword) {
        return { error: 'Email and password are required' };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (error) {
        if (error.message.includes('Invalid login')) {
          return { error: 'Invalid email or password' };
        }
        return { error: error.message };
      }

      // Ensure a leaderboard entry exists for this user (especially after email-confirmation signups)
      if (data.user) {
        const nicknameFromMeta = (data.user.user_metadata as any)?.nickname as string | undefined;
        const fallbackNickname = trimmedEmail.split('@')[0]?.slice(0, 20) || 'Player';
        const nickname = (nicknameFromMeta || fallbackNickname).trim();

        const { data: existing } = await supabase
          .from('leaderboard')
          .select('id')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from('leaderboard').insert({
            nickname,
            user_id: data.user.id,
            xp: 0,
            level: 1,
            queries_executed: 0,
            tables_created: 0,
            rows_inserted: 0,
            badges: [],
            current_streak: 0,
            highest_streak: 0,
          });
        }
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Login failed' };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<{ error: string | null; code?: string }> => {
    try {
      const trimmedEmail = email.trim();

      if (!trimmedEmail) {
        return { error: 'Email is required' };
      }

      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/`,
      });

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Reset failed' };
    }
  }, []);

  const verifyRecoveryCode = useCallback(async (_email: string, _code: string): Promise<{ error: string | null }> => {
    // This is a placeholder - Supabase handles recovery via email link
    return { error: 'Recovery code verification is handled via email link' };
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signUp,
      signIn,
      signOut,
      resetPassword,
      verifyRecoveryCode,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  // Return safe defaults if outside provider (during HMR or portals)
  if (context === undefined) {
    return {
      user: null,
      session: null,
      loading: true,
      signUp: async () => ({ error: 'Auth not initialized' }),
      signIn: async () => ({ error: 'Auth not initialized' }),
      signOut: async () => {},
      resetPassword: async () => ({ error: 'Auth not initialized' }),
      verifyRecoveryCode: async () => ({ error: 'Auth not initialized' }),
    } as AuthContextType;
  }
  return context;
};