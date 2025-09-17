import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from "firebase/auth";
import { auth } from "../../firebaseConfig";

/* ---------- Tipler ---------- */
type AuthContextType = {
  user: User | null;
  loading: boolean;              // sayfa/işlem yüklenmesi (UI kapatmaz)
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

  // Uygulamanın ilk açılışında auth durumunu beklediğimiz "hydration" bayrağı
  const [hydrating, setHydrating] = useState<boolean>(true);

  // Genel amaçlı loading (işlemler için); artık UI'ı kilitlemeyecek
  const [loading, setLoading] = useState<boolean>(false);

  // Firebase auth state dinleyicisi
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setHydrating(false); // sadece ilk durum çözüldüğünde kapat
    });
    return () => unsub();
  }, []);

  // Dışarıdan loading kontrolü (UI'ı kapatmaz; sayfacıklar bunu gösterebilir)
  const startLoading = () => setLoading(true);
  const stopLoading = () => setLoading(false);

  // Oturumu sonlandır
  const signOut = () => firebaseSignOut(auth);

  const value: AuthContextType = { user, loading, startLoading, stopLoading, signOut };

  return (
    <AuthContext.Provider value={value}>
      {/* Yalnızca ilk "hydration" sırasında tam ekran iskelet */}
      {hydrating ? (
        <div className="flex h-screen items-center justify-center bg-[#0d0d0d]">
          <p className="text-gray-400">Yükleniyor…</p>
        </div>
      ) : (
        children
      )}

      {/* İstersen burada global (non-blocking) bir gösterge koyabilirsin:
          loading && <div className="fixed bottom-4 right-4 rounded bg-black/70 px-3 py-1.5 text-xs text-white">İşlem sürüyor…</div>
         Ama UI'ı kapatmayalım ki sayfa içi hatalar/mesajlar görünsün. */}
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
