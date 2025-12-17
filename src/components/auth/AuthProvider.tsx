// Authentication context and provider
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/lib/types';
import { fetchUserById, verifyUserCredentials } from '@/services/users';
import { recordAuditLog } from '@/services/audit';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

interface AuthSession {
  userId: string;
  createdAt: string;
}

const SESSION_STORAGE_KEY = 'pims_auth_session';

const getStoredSession = (): AuthSession | null => {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.userId) return null;
    return parsed;
  } catch {
    return null;
  }
};

const setStoredSession = (session: AuthSession | null) => {
  try {
    if (!session) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } else {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // ignore storage errors
  }
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const session = getStoredSession();
        if (!session) {
          setLoading(false);
          return;
        }

        const existingUser = await fetchUserById(session.userId);
        if (existingUser && existingUser.active) {
          setUser(existingUser);
        } else {
          setStoredSession(null);
        }
      } catch (error) {
        console.error('Failed to restore session', error);
        setStoredSession(null);
      } finally {
        setLoading(false);
      }
    };

    void restoreSession();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const authenticatedUser = await verifyUserCredentials(username, password);
      if (!authenticatedUser) {
        return false;
      }

      setUser(authenticatedUser);
      setStoredSession({
        userId: authenticatedUser.id,
        createdAt: new Date().toISOString(),
      });

      try {
        await recordAuditLog({
          userId: authenticatedUser.id,
          userName: authenticatedUser.fullName,
          module: 'auth',
          action: 'login',
          details: `User ${authenticatedUser.username} logged in`,
        });
      } catch (auditError) {
        // Don't fail login if audit log fails
        console.warn('Failed to record audit log:', auditError);
      }

      return true;
    } catch (error: any) {
      console.error('Login failed:', error);
      // Re-throw connection errors so they can be displayed to the user
      if (error?.message?.includes('Database connection failed')) {
        throw error;
      }
      return false;
    }
  };

  const logout = async () => {
    if (user) {
      try {
        await recordAuditLog({
          userId: user.id,
          userName: user.fullName,
          module: 'auth',
          action: 'logout',
          details: `User ${user.username} logged out`,
        });
      } catch (error) {
        console.error('Failed to record logout log', error);
      }
    }

    setUser(null);
    setStoredSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

