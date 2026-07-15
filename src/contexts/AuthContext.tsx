import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Profile } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      console.log('[Auth] Checking initial auth state...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('[Auth] Error getting session:', sessionError);
        setLoading(false);
        return;
      }

      console.log('[Auth] Got session:', session);

      if (session) {
        console.log('[Auth] Fetching profile for user:', session.user.id);
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profileError) {
          console.error('[Auth] Error fetching profile:', profileError);
        } else {
          console.log('[Auth] Got profile:', profileData);
          console.log('[Auth] User role:', profileData?.role);
          if (profileData) setProfile(profileData);
        }
      }

      console.log('[Auth] Setting loading to false');
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('[Auth] Auth state changed:', _event, session?.user?.id);
      
      if (session) {
        console.log('[Auth] Fetching profile for user:', session.user.id);
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profileError) {
          console.error('[Auth] Error fetching profile:', profileError);
        } else {
          console.log('[Auth] Got profile:', profileData);
          console.log('[Auth] User role:', profileData?.role);
          if (profileData) setProfile(profileData);
        }
      } else {
        console.log('[Auth] No session, clearing profile');
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    console.log('[Auth] Signing out user');
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
