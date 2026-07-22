import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { loadLocalSettings } from './db';

let supabaseInstance: SupabaseClient | null = null;
let currentUrl: string | null = null;
let currentKey: string | null = null;

// Clean up URL and key for safety
const sanitizeInput = (val: string) => val ? val.trim() : '';

export function getSupabaseClient(): SupabaseClient | null {
  const settings = loadLocalSettings();
  const url = sanitizeInput(settings.supabaseUrl || (import.meta as any).env.VITE_SUPABASE_URL || '');
  const key = sanitizeInput(settings.supabaseAnonKey || (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '');

  if (!url || !key) {
    return null;
  }

  // If the credentials changed, recreate the instance
  if (!supabaseInstance || currentUrl !== url || currentKey !== key) {
    try {
      supabaseInstance = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      currentUrl = url;
      currentKey = key;
    } catch (e) {
      console.error('Failed to create Supabase client:', e);
      return null;
    }
  }

  return supabaseInstance;
}

export interface SupabaseUserMapped {
  email: string;
  displayName: string;
  id: string;
}

// Check auth state and listen for changes
export const initAuth = (
  onAuthSuccess?: (user: SupabaseUserMapped, token: string) => void,
  onAuthFailure?: () => void
) => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }

  // Fetch initial session
  supabase.auth.getSession().then(({ data: { session }, error }) => {
    if (error) {
      console.error('Error fetching session:', error);
      if (onAuthFailure) onAuthFailure();
      return;
    }

    if (session && session.user && session.user.email) {
      const mappedUser: SupabaseUserMapped = {
        email: session.user.email,
        displayName: session.user.user_metadata?.full_name || session.user.email.split('@')[0] || 'Administrator',
        id: session.user.id,
      };
      if (onAuthSuccess) onAuthSuccess(mappedUser, session.access_token);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });

  // Subscribe to changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session && session.user && session.user.email) {
      const mappedUser: SupabaseUserMapped = {
        email: session.user.email,
        displayName: session.user.user_metadata?.full_name || session.user.email.split('@')[0] || 'Administrator',
        id: session.user.id,
      };
      if (onAuthSuccess) onAuthSuccess(mappedUser, session.access_token);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });

  return () => {
    subscription.unsubscribe();
  };
};

// Sign up with Email and Password
export const signUpWithEmail = async (email: string, password: string): Promise<SupabaseUserMapped> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client belum dikonfigurasi. Hubungkan URL & Anon Key terlebih dahulu.');
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: email.split('@')[0]
      }
    }
  });

  if (error) {
    throw error;
  }

  if (!data.user || !data.user.email) {
    throw new Error('Registrasi berhasil, silakan cek email Anda untuk konfirmasi (jika email konfirmasi aktif di Supabase).');
  }

  return {
    email: data.user.email,
    displayName: data.user.user_metadata?.full_name || data.user.email.split('@')[0] || 'Administrator',
    id: data.user.id,
  };
};

// Sign in with Email and Password
export const signInWithEmail = async (email: string, password: string): Promise<{ user: SupabaseUserMapped; token: string }> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client belum dikonfigurasi. Hubungkan URL & Anon Key terlebih dahulu.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  if (!data.user || !data.user.email || !data.session) {
    throw new Error('Login gagal. Gagal mendapatkan session pengguna.');
  }

  return {
    user: {
      email: data.user.email,
      displayName: data.user.user_metadata?.full_name || data.user.email.split('@')[0] || 'Administrator',
      id: data.user.id,
    },
    token: data.session.access_token,
  };
};

// Sign in with Google (OAuth)
export const signInWithGoogle = async () => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase client belum dikonfigurasi. Hubungkan URL & Anon Key terlebih dahulu.');
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });

  if (error) {
    throw error;
  }
};

// Logout
export const logoutSupabase = async () => {
  const supabase = getSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
};
