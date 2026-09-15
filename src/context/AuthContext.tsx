import { API_ENDPOINTS } from '../config/apiConfig';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ---- NEW: helpers to save/clear full API row to localStorage (without changing your flow) ----
function sanitizePayload(payload: Record<string, any>): Record<string, any> {
  if (!payload || typeof payload !== 'object') return {};
  const clone = { ...payload };
  // Ensure we don’t accidentally store secrets if they ever appear
  delete (clone as any).password;
  delete (clone as any).pass;
  delete (clone as any).Psw;
  delete (clone as any).token_plain;
  return clone;
}

function saveAuthBlobAndFlatten(prefix: string, payload: Record<string, any>) {
  const clean = sanitizePayload(payload);
  // Full blob
  localStorage.setItem(prefix, JSON.stringify(clean));
  // Flattened keys
  Object.keys(clean).forEach((k) => {
    try {
      const v = clean[k];
      const value =
        v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
          ? String(v)
          : JSON.stringify(v);
      localStorage.setItem(`${prefix}.${k}`, value);
    } catch {
      // ignore serialization errors for individual keys
    }
  });
}

function clearAuthBlobAndFlatten(prefix: string) {
  localStorage.removeItem(prefix);
  const toDelete: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(`${prefix}.`)) toDelete.push(k);
  }
  toDelete.forEach((k) => localStorage.removeItem(k));
}
// ---- end NEW helpers ----

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored user data (existing behavior)
    const storedUser = localStorage.getItem('interealtor-user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const formData = new URLSearchParams();
      formData.append('UserName', username);
      formData.append('Psw', password);
      const response = await fetch(API_ENDPOINTS.LOGIN_GET, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      console.log('PHP Response:', result);
      console.log('User Info:', result.data?.[0]);

      // Handle both array and object responses
      const dataArray = Array.isArray(result.data) ? result.data : Object.values(result.data || {});

      if (result.status === 'success' && dataArray && dataArray.length > 0) {
        const userInfo = dataArray[0];
        const accountFlag = (userInfo?.Account ??'N').toString().trim().toUpperCase();
        localStorage.setItem('account', accountFlag);        
        localStorage.setItem("userName", userInfo.UserName ?? "");
        localStorage.setItem("displayName", userInfo.DisplayName ?? "");
        localStorage.setItem("nricName", userInfo.NricName ?? "");
        localStorage.setItem("pettyCashAmt", userInfo.PettyCashAmt ?? "0.00");
        




        
        console.log('Stored account:', accountFlag);

        console.log('Verify stored account:', localStorage.getItem('account'));

        // NEW: persist full API row exactly as returned (all columns)
        // - Full blob:            localStorage['interealtor-auth']
        // - Flattened each field: localStorage['interealtor-auth.<Key>']
        saveAuthBlobAndFlatten('interealtor-auth', userInfo);

        // Existing behavior: construct and store your typed User object
        const userData: User = {
          id: userInfo.NricName || userInfo.UserName,
          name: userInfo.DisplayName || userInfo.UserName,
          email: userInfo.UserName,
          role: userInfo.UserName === 'admin' ? 'admin' : 'agent',
          nricName: userInfo.NricName,
          pettyCashAmt: userInfo.PettyCashAmt
        };

        setUser(userData);
        localStorage.setItem('interealtor-user', JSON.stringify(userData));
        setIsLoading(false);
        return true;
      } else {
        setIsLoading(false);
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      setIsLoading(false);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    // Existing behavior:
    localStorage.removeItem('interealtor-user');
    // Clear account data
    localStorage.removeItem('account');
    // NEW: also clear the full API row + flattened keys we added
    clearAuthBlobAndFlatten('interealtor-auth');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
