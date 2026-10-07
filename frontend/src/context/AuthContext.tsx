import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  picture: string | null;
  role: "admin" | "user" | "doctor";
  consultant_id?: number | null;
  // Patient profile
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  blood_type?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [token, setToken]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("ech_auth_token");
    const storedUser  = localStorage.getItem("ech_auth_user");
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("ech_auth_token");
        localStorage.removeItem("ech_auth_user");
      }
    }
    setLoading(false);
  }, []);

  const login = (newToken: string, newUser: AuthUser) => {
    localStorage.setItem("ech_auth_token", newToken);
    localStorage.setItem("ech_auth_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem("ech_auth_token");
    localStorage.removeItem("ech_auth_user");
    setToken(null);
    setUser(null);
  };

  const updateUser = (updated: AuthUser) => {
    localStorage.setItem("ech_auth_user", JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
