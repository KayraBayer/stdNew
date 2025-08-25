import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "../../firebaseConfig";

/* ---------- Varsayılan değerler --------- */
const AuthContext = createContext({
  user: null,
  loading: true,
  startLoading: () => {},
  stopLoading: () => {},
  signOut: () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);   // ilk açılışta true

  /* Firebase dinleyicisi */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);                          // her değişimde kapat
    });
    return () => unsub();
  }, []);

  /* Dışarıdan loading’i kontrol */
  const startLoading = () => setLoading(true);
  const stopLoading  = () => setLoading(false);

  /* Oturumu sonlandır */
  const signOut = () => firebaseSignOut(auth);

  const value = { user, loading, startLoading, stopLoading, signOut };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        /* İsterseniz spinner ekleyin */
        <div className="flex h-screen items-center justify-center bg-[#0d0d0d]">
          <p className="text-gray-400">Yükleniyor…</p>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
