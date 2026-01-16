import { useState, useEffect, createContext, useContext, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { initSessionCache } from '@/lib/auth/sessionCache';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isRecoveryMode: boolean;
  clearRecoveryMode: () => void;
  signUp: (
    email: string,
    password: string,
    nickname: string
  ) => Promise<{ error: string | null; needsEmailConfirmation?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  sendCustomOtp: (email: string, purpose: 'signup' | 'recovery' | 'email_change') => Promise<{ error: string | null }>;
  verifyCustomOtp: (email: string, code: string, purpose: 'signup' | 'recovery' | 'email_change') => Promise<{ error: string | null }>;
  createUserAfterOtp: (email: string, password: string, nickname: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  verifyOtp: (email: string, token: string, type: 'signup' | 'recovery' | 'email_change') => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  updateEmail: (newEmail: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Events that should always be processed, never skipped
const CRITICAL_EVENTS: AuthChangeEvent[] = ['SIGNED_OUT', 'TOKEN_REFRESHED'];

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  
  // Track if we just completed an auth action to prevent race conditions
  // Only skip duplicate SIGNED_IN events, never skip critical events
  const justCompletedAuthRef = useRef(false);
  const pendingAuthActionRef = useRef<string | null>(null);
  
  const clearRecoveryMode = useCallback(() => {
    setIsRecoveryMode(false);
  }, []);

  useEffect(() => {
    // Initialize the global session cache
    initSessionCache();

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[AuthProvider] Auth event:', event, 'user:', newSession?.user?.id?.slice(0, 8));
        }

        // Always process critical events - never skip these
        if (CRITICAL_EVENTS.includes(event)) {
          setSession(newSession);
          setUser(newSession?.user ?? null);
          setLoading(false);
          
          // Show helpful message on token refresh failure
          if (event === 'SIGNED_OUT' && pendingAuthActionRef.current === null) {
            // Unexpected signout - might be rate limit
            console.warn('[AuthProvider] Unexpected SIGNED_OUT event');
          }
          return;
        }
        
        // Detect PASSWORD_RECOVERY event - user clicked recovery link in email
        if (event === 'PASSWORD_RECOVERY') {
          if (process.env.NODE_ENV === 'development') {
            console.log('[AuthProvider] PASSWORD_RECOVERY detected, enabling recovery mode');
          }
          setIsRecoveryMode(true);
          setSession(newSession);
          setUser(newSession?.user ?? null);
          setLoading(false);
          return;
        }

        // For SIGNED_IN, check if we should skip due to recent auth action
        if (event === 'SIGNED_IN' && justCompletedAuthRef.current) {
          // Skip duplicate SIGNED_IN from our own action
          if (process.env.NODE_ENV === 'development') {
            console.log('[AuthProvider] Skipping duplicate SIGNED_IN');
          }
          return;
        }

        // Process the event
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
    }).catch((error) => {
      console.error('[AuthProvider] Error getting session:', error);
      setLoading(false);
      // Don't toast here - might be normal startup with no session
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
      const trimmedNickname = nickname.trim().replace(/\s+/g, ' ');

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

      // Check if email confirmation is needed
      const needsEmailConfirmation = !data.session;

      // If auto-confirm is enabled and we have a session, create leaderboard entry
      if (data.session && data.user) {
        // Set the flag to prevent race condition
        justCompletedAuthRef.current = true;
        
        // Update state immediately
        setSession(data.session);
        setUser(data.user);

        // Create leaderboard entry
        const { data: existing } = await supabase
          .from('leaderboard')
          .select('id')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from('leaderboard').insert({
            nickname: trimmedNickname,
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

        // Reset the flag after a short delay
        setTimeout(() => {
          justCompletedAuthRef.current = false;
        }, 2000);
      }

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

      if (data.user && data.session) {
        // Set the flag to prevent race condition
        justCompletedAuthRef.current = true;
        
        // Update state immediately
        setSession(data.session);
        setUser(data.user);

        // Ensure a leaderboard entry exists
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

        // Reset the flag after a short delay
        setTimeout(() => {
          justCompletedAuthRef.current = false;
        }, 2000);
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Login failed' };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  }, []);

  // Custom OTP - Send via our edge function (no magic links, pure 6-char code)
  const sendCustomOtp = useCallback(async (
    email: string,
    purpose: 'signup' | 'recovery' | 'email_change'
  ): Promise<{ error: string | null }> => {
    try {
      const trimmedEmail = email.trim().toLowerCase();
      
      if (!trimmedEmail) {
        return { error: 'Email is required' };
      }

      const response = await supabase.functions.invoke('auth-send-otp', {
        body: { email: trimmedEmail, purpose },
      });

      if (response.error) {
        return { error: response.error.message || 'Failed to send verification code' };
      }

      if (response.data?.error) {
        return { error: response.data.error };
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Failed to send verification code' };
    }
  }, []);

  // Custom OTP - Verify via our edge function
  const verifyCustomOtp = useCallback(async (
    email: string,
    code: string,
    purpose: 'signup' | 'recovery' | 'email_change'
  ): Promise<{ error: string | null }> => {
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedCode = code.trim().toUpperCase();
      
      if (!trimmedEmail || !trimmedCode) {
        return { error: 'Email and code are required' };
      }

      const response = await supabase.functions.invoke('auth-verify-otp', {
        body: { email: trimmedEmail, code: trimmedCode, purpose },
      });

      if (response.error) {
        return { error: response.error.message || 'Failed to verify code' };
      }

      if (response.data?.error) {
        return { error: response.data.error };
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Failed to verify code' };
    }
  }, []);

  // Create user after OTP verification (for signup flow)
  const createUserAfterOtp = useCallback(async (
    email: string,
    password: string,
    nickname: string
  ): Promise<{ error: string | null }> => {
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPassword = password.trim();
      const trimmedNickname = nickname.trim().replace(/\s+/g, ' ');

      // Now create the user (auto-confirm should be enabled for this flow since OTP was verified)
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            nickname: trimmedNickname,
            email_verified: true, // Mark as verified since OTP was validated
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          return { error: 'Email already registered. Use LOGIN command.' };
        }
        return { error: error.message };
      }

      if (data.session && data.user) {
        justCompletedAuthRef.current = true;
        setSession(data.session);
        setUser(data.user);

        // Create leaderboard entry
        const { data: existing } = await supabase
          .from('leaderboard')
          .select('id')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (!existing) {
          await supabase.from('leaderboard').insert({
            nickname: trimmedNickname,
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

        setTimeout(() => {
          justCompletedAuthRef.current = false;
        }, 2000);
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Account creation failed' };
    }
  }, []);

  // Reset password using native Supabase email links
  const resetPassword = useCallback(async (email: string): Promise<{ error: string | null }> => {
    try {
      const trimmedEmail = email.trim();

      if (!trimmedEmail) {
        return { error: 'Email is required' };
      }

      const redirectUrl = `${window.location.origin}/`;

      // Use native Supabase password reset - sends email with reset link
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: redirectUrl,
      });

      if (error) {
        if (error.message.includes('User not found') || error.message.includes('user_not_found')) {
          return { error: 'No account found with this email' };
        }
        return { error: error.message };
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Reset failed' };
    }
  }, []);

  const verifyOtp = useCallback(async (
    email: string,
    token: string,
    type: 'signup' | 'recovery' | 'email_change'
  ): Promise<{ error: string | null }> => {
    try {
      // Map our types to Supabase's expected types
      // For recovery via signInWithOtp, we use 'email' type
      const otpType = type === 'recovery' ? 'email' : type;
      
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: token.trim(),
        type: otpType,
      });

      if (error) {
        if (error.message.includes('expired')) {
          return { error: 'Code has expired. Please request a new one.' };
        }
        if (error.message.includes('invalid')) {
          return { error: 'Invalid code. Please check and try again.' };
        }
        return { error: error.message };
      }

      if (data.user && data.session) {
        // Set the flag to prevent race condition
        justCompletedAuthRef.current = true;
        
        // Update state immediately
        setSession(data.session);
        setUser(data.user);

        // For signup, create leaderboard entry after verification
        if (type === 'signup') {
          const nicknameFromMeta = (data.user.user_metadata as any)?.nickname as string | undefined;
          const fallbackNickname = email.split('@')[0]?.slice(0, 20) || 'Player';
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

        // Reset the flag after a short delay
        setTimeout(() => {
          justCompletedAuthRef.current = false;
        }, 2000);
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Verification failed' };
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Password update failed' };
    }
  }, []);

  const updateEmail = useCallback(async (newEmail: string): Promise<{ error: string | null }> => {
    try {
      const trimmedEmail = newEmail.trim();
      
      if (!trimmedEmail) {
        return { error: 'Email is required' };
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return { error: 'Invalid email format' };
      }

      const { error } = await supabase.auth.updateUser({
        email: trimmedEmail,
      });

      if (error) {
        if (error.message.includes('already')) {
          return { error: 'This email is already in use' };
        }
        return { error: error.message };
      }

      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Email update failed' };
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      isRecoveryMode,
      clearRecoveryMode,
      signUp,
      signIn,
      signOut,
      sendCustomOtp,
      verifyCustomOtp,
      createUserAfterOtp,
      resetPassword,
      verifyOtp,
      updatePassword,
      updateEmail,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    return {
      user: null,
      session: null,
      loading: true,
      isRecoveryMode: false,
      clearRecoveryMode: () => {},
      signUp: async () => ({ error: 'Auth not initialized' }),
      signIn: async () => ({ error: 'Auth not initialized' }),
      signOut: async () => {},
      sendCustomOtp: async () => ({ error: 'Auth not initialized' }),
      verifyCustomOtp: async () => ({ error: 'Auth not initialized' }),
      createUserAfterOtp: async () => ({ error: 'Auth not initialized' }),
      resetPassword: async () => ({ error: 'Auth not initialized' }),
      verifyOtp: async () => ({ error: 'Auth not initialized' }),
      updatePassword: async () => ({ error: 'Auth not initialized' }),
      updateEmail: async () => ({ error: 'Auth not initialized' }),
    } as AuthContextType;
  }
  return context;
};
