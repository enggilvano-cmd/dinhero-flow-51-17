import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name?: string;
  whatsapp?: string;
  avatar_url?: string;
  role: 'admin' | 'user' | 'limited';
  is_active: boolean;
  trial_expires_at?: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, whatsapp?: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  isAdmin: () => boolean;
  hasRole: (role: 'admin' | 'user' | 'limited') => boolean;
  isTrialActive: () => boolean;
  getTrialTimeRemaining: () => string | null;
  initializeUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchProfile = async (userId: string) => {
    try {
      console.log('Fetching profile for user:', userId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar o perfil do usuário.",
          variant: "destructive",
        });
        return;
      }
      
      console.log('Profile fetched:', data);
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao carregar perfil.",
        variant: "destructive",
      });
    }
  };

  const logActivity = async (action: string, resourceType: string, resourceId?: string) => {
    if (user) {
      try {
        const result = await supabase.rpc('log_user_activity', {
          p_user_id: user.id,
          p_action: action,
          p_resource_type: resourceType,
          p_resource_id: resourceId
        });
        
        if (result.error) {
          console.error('Error logging activity:', result.error);
        }
      } catch (error) {
        console.error('Error logging activity:', error);
      }
    }
  };

  const initializeUserData = async () => {
    if (!user) return;
    
    try {
      console.log('Initializing user data for:', user.id);
      
      // Initialize default categories if none exist
      const { data: categories } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (!categories || categories.length === 0) {
        console.log('Initializing default categories');
        await supabase.rpc('initialize_default_categories', { p_user_id: user.id });
      }

      // Initialize default settings if none exist
      const { data: settings } = await supabase
        .from('user_settings')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!settings) {
        console.log('Initializing default settings');
        await supabase.rpc('initialize_default_settings', { p_user_id: user.id });
      }
      
      console.log('User data initialization completed');
    } catch (error) {
      console.error('Error initializing user data:', error);
    }
  };

  useEffect(() => {
    console.log('Setting up auth state listener...');
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
          
          if (event === 'SIGNED_IN') {
            setTimeout(async () => {
              await logActivity('signed_in', 'auth');
              await initializeUserData();
            }, 0);
          }
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.id);
      
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Attempting to sign in user:', email);
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        toast({
          title: "Erro no login",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log('Sign in successful');
        toast({
          title: "Login realizado",
          description: "Bem-vindo de volta!",
        });
      }

      return { error };
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast({
        title: "Erro no login",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, whatsapp?: string) => {
    try {
      console.log('Attempting to sign up user:', email);
      
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            whatsapp: whatsapp,
          }
        }
      });

      if (error) {
        console.error('Sign up error:', error);
        toast({
          title: "Erro no cadastro",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log('Sign up successful');
        toast({
          title: "Cadastro realizado",
          description: "Verifique seu email para confirmar a conta.",
        });
      }

      return { error };
    } catch (error: any) {
      console.error('Sign up error:', error);
      toast({
        title: "Erro no cadastro",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      console.log('Attempting to sign out');
      
      await logActivity('signed_out', 'auth');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Sign out error:', error);
        toast({
          title: "Erro ao sair",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log('Sign out successful');
        toast({
          title: "Logout realizado",
          description: "Até logo!",
        });
      }

      return { error };
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      console.log('Attempting to reset password for:', email);
      
      const redirectUrl = `${window.location.origin}/auth?mode=reset`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        console.error('Reset password error:', error);
        toast({
          title: "Erro na recuperação",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log('Reset password successful');
        toast({
          title: "Email enviado",
          description: "Verifique seu email para redefinir a senha.",
        });
      }

      return { error };
    } catch (error: any) {
      console.error('Reset password error:', error);
      toast({
        title: "Erro na recuperação",
        description: error.message,
        variant: "destructive",
      });
      return { error };
    }
  };

  const isAdmin = () => {
    const result = profile?.role === 'admin' && profile?.is_active;
    console.log('isAdmin check:', { role: profile?.role, active: profile?.is_active, result });
    return result;
  };

  const hasRole = (role: 'admin' | 'user' | 'limited') => {
    return profile?.role === role && profile?.is_active;
  };

  const isTrialActive = () => {
    if (!profile || profile.role === 'admin') return true;
    if (!profile.trial_expires_at) return false;
    
    const expiresAt = new Date(profile.trial_expires_at);
    const now = new Date();
    return expiresAt > now && profile.is_active;
  };

  const getTrialTimeRemaining = () => {
    if (!profile || profile.role === 'admin' || !profile.trial_expires_at) return null;
    
    const expiresAt = new Date(profile.trial_expires_at);
    const now = new Date();
    const timeLeft = expiresAt.getTime() - now.getTime();
    
    if (timeLeft <= 0) return 'Expirado';
    
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m restantes`;
    } else {
      return `${minutes}m restantes`;
    }
  };

  return (
    <AuthContext.Provider 
      value={{
        user,
        session,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        isAdmin,
        hasRole,
        isTrialActive,
        getTrialTimeRemaining,
        initializeUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}