// Grocery Warehouse ERP System - Client-side Auth Service
import { db, User } from './db';

const isClient = typeof window !== 'undefined';

export const auth = {
  login: async (username: string, password: string): Promise<User> => {
    const users = await db.getUsers(true); // Get all including soft deleted (we check is_deleted later)
    
    // Find active user with matching credentials
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    
    if (!user) {
      throw new Error('Invalid username or password.');
    }
    
    if (user.is_deleted) {
      throw new Error('This account has been deactivated/deleted. Contact Admin.');
    }

    // Save session
    if (isClient) {
      localStorage.setItem('erp_current_user', JSON.stringify(user));
    }
    
    return user;
  },

  getCurrentUser: (): User | null => {
    if (!isClient) return null;
    const data = localStorage.getItem('erp_current_user');
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
      if (isClient) {
        localStorage.setItem('erp_current_user', JSON.stringify(dbUser));
      }
      return dbUser;
    }
    auth.logout();
    return null;
  },

  logout: (): void => {
    if (isClient) {
      localStorage.removeItem('erp_current_user');
    }
  },

  checkPermission: (allowedRoles: User['role'][]): boolean => {
    const currentUser = auth.getCurrentUser();
    if (!currentUser) return false;
    
    // Role Hierarchy check
    // Admins have full access to everything.
    if (currentUser.role === 'admin') return true;
    
    return allowedRoles.includes(currentUser.role);
  }
};
