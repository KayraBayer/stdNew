// requireAuth.tsx
import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { getIdTokenResult, type User } from "firebase/auth";
import { useAuth } from "./authContext";

const ADMIN_EMAIL = "admin@mail.com" as const;

type Role = "admin" | "user";

type CustomClaims = {
  admin?: boolean;
  // Gerekirse başka custom claim'ler eklersin
  [k: string]: unknown;
};

type RequireAuthProps = {
  children: ReactNode;
  role?: Role;
};

export default function RequireAuth({ children, role }: RequireAuthProps) {
  // useAuth hook'unun tipi projede tanımlı değilse aşağıdaki cast işini görür.
  const { user, loading } = useAuth() as { user: User | null; loading: boolean };

  const [claims, setClaims] = useState<CustomClaims | null>(null);

  useEffect(() => {
    let on = true;

    (async () => {
      if (!user) {
        if (on) setClaims(null);
        return;
      }
      try {
        // Token'ı force-refresh ile yenile: custom claim'ler garantilensin
        const res = await getIdTokenResult(user, true);
        if (on) setClaims((res && (res.claims as CustomClaims)) || {});
      } catch {
        if (on) setClaims({});
      }
    })();

    return () => {
      on = false;
    };
  }, [user]);

  // İlk yükleniş ya da claim'ler beklenirken (buraya spinner konulabilir)
  if (loading || (user && claims === null)) {
    return null;
  }

  // Oturum yoksa giriş sayfasına
  if (!user) return <Navigate to="/" replace />;

  const emailIsAdmin = (user.email || "").toLowerCase() === ADMIN_EMAIL;
  const adminClaim = typeof claims?.admin === "boolean" ? claims.admin : false;
  const isAdmin = adminClaim || emailIsAdmin;

  if (role === "admin" && !isAdmin) return <Navigate to="/dashboard" replace />;
  if (role === "user" && isAdmin) return <Navigate to="/admin" replace />;

  return <>{children}</>;
}
