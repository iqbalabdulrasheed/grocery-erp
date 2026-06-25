// Grocery Warehouse ERP System - Auth Service (Supabase Auth + localStorage fallback)
import { supabase } from './supabaseClient';
import { db, User } from './db';

const isClient = typeof window !== 'undefined';
const SESSION_KEY = 'erp_current_user';

export const auth = {
  login: async (username: string, password: string): Promise<User> => {
    // Fetch all users to find matching credentials (supports custom username field)
    const users = await db.getUsers(true);
    const user = users.find(
      u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );

    if (!user) throw new Error('Invalid username or password.');
    if (user.is_deleted) throw new Error('This account has been deactivated/deleted. Contact Admin.');

    if (supabase) {
      // Store session in Supabase using a synthetic email derived from username.
      // We use upsert on a user_sessions table so the session survives page reloads
      // without requiring Supabase Auth (which needs real email verification).
      const { error } = await supabase
        .from('user_sessions')
        .upsert({ user_id: user.id, user_data: user, last_seen: new Date().toISOString() });

      if (error) {
        // Non-fatal: fall through to localStorage backup
        console.warn('Supabase session save failed, using localStorage fallback:', error.message);
        if (isClient) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      }
      // Also keep a short-lived localStorage copy so getCurrentUser() stays synchronous
      if (isClient) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } else {
      if (isClient) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    }

    return user;
  },

  getCurrentUser: (): User | null => {
    // Synchronous read from localStorage cache (refreshed on login / refreshSession)
    if (!isClient) return null;
    const data = localStorage.getItem(SESSION_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data) as User;
    } catch {
      return null;
    }
  },

  refreshSession: async (userId: string): Promise<User | null> => {
    const dbUser = await db.getUserById(userId);
    if (dbUser && !dbUser.is_deleted) {
      if (supabase) {
        // Refresh the Supabase session record
        await supabase
          .from('user_sessions')
          .upsert({ user_id: userId, user_data: dbUser, last_seen: new Date().toISOString() });
      }
      // Always update the local synchronous cache
      if (isClient) localStorage.setItem(SESSION_KEY, JSON.stringify(dbUser));
      return dbUser;
    }
    auth.logout();
    return null;
  },

  logout: async (): Promise<void> => {
    const current = auth.getCurrentUser();
    if (supabase && current) {
      // Remove the session row from Supabase
      await supabase.from('user_sessions').delete().eq('user_id', current.id);
    }
    if (isClient) localStorage.removeItem(SESSION_KEY);
  },

  checkPermission: (allowedRoles: User['role'][]): boolean => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return allowedRoles.includes(currentUser.role);
  }
};
