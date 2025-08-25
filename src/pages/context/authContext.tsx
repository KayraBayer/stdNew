// src/pages/context/authContext.tsx
import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from "firebase/auth";
import { auth } from "../../firebaseConfig";

/* ---------- Tipler ---------- */
type AuthContextType = {
  user: User | null;
  loading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
  signOut: () => Promise<void>;
};

type AuthProviderProps = {
  children: ReactNode;
};

/* ---------- Context ---------- */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* ---------- Provider ---------- */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // ilk açılışta true

  // Firebase auth state dinleyicisi
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false); // her değişimde yüklemeyi kapat
    });
    return () => unsub();
  }, []);

  // Dışarıdan loading kontrolü
  const startLoading = () => setLoading(true);
  const stopLoading = () => setLoading(false);

  // Oturumu sonlandır
  const signOut = () => firebaseSignOut(auth);

  const value: AuthContextType = { user, loading, startLoading, stopLoading, signOut };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        // İstersen buraya component/spinner koy
        <div className="flex h-screen items-center justify-center bg-[#0d0d0d]">
          <p className="text-gray-400">Yükleniyor…</p>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

/* ---------- Hook ---------- */
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth, AuthProvider içinde kullanılmalıdır.");
  }
  return ctx;
}
