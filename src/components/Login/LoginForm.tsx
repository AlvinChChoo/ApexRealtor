import { PLACEHOLDER_LOGIN_URL } from '../../config/apiConfig';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

/* =========================
   Types
========================= */
type UserRow = {
  UserName: string;
  DisplayName: string;
  NricName?: string;
  PettyCashAmt?: string;
  Account?: 'Y' | 'N'; // <- flag we will persist
  // add any other fields you return
};

type AuthContextType = {
  user: UserRow | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* =========================
   Config
========================= */
// 👇 Replace with your actual endpoint
const LOGIN_URL = PLACEHOLDER_LOGIN_URL;

/* =========================
   Provider
========================= */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserRow | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Restore session on app load
  useEffect(() => {
    const cached = localStorage.getItem('user');
    if (cached) {
      try {
        const parsed: UserRow = JSON.parse(cached);
        setUser(parsed);
      } catch {
        // If parsing fails, clear bad cache
        localStorage.removeItem('user');
        localStorage.removeItem('account');
      }
    }
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        setIsLoading(false);
        return false;
      }

      const data = await res.json();

      // Your sample showed:
      // 0: { UserName: "10007", DisplayName: "San San", Account: "Y", ... }
      // So the payload may be: [ {...} ] or { data: [ {...} ] } or just { ... }
      const row: UserRow | undefined =
        Array.isArray(data) ? data[0] :
        Array.isArray(data?.data) ? data.data[0] :
        (data && typeof data === 'object' ? data : undefined);

      if (!row || !row.UserName) {
        setIsLoading(false);
        return false;
      }

      // Update state
      setUser(row);

      // ✅ Persist for other screens/routes:
      localStorage.setItem('user', JSON.stringify(row));
      localStorage.setItem('account', row.Account ?? 'N'); // specifically save "Account"

      setIsLoading(false);
      return true;
    } catch (e) {
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('account');
  };

  const value = useMemo<AuthContextType>(() => ({
    user,
    isLoading,
    login,
    logout,
  }), [user, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/* =========================
   Hook
========================= */
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
