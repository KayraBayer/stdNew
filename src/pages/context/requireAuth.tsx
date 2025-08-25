// requireAuth.js
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./authContext";
import { getIdTokenResult } from "firebase/auth";

const ADMIN_EMAIL = "admin@mail.com";

export default function RequireAuth({ children, role }) {
  const { user, loading } = useAuth();
  const [claims, setClaims] = useState(null);

  useEffect(() => {
    let on = true;
    (async () => {
      if (!user) { setClaims(null); return; }
      try {
        // ⚠️ token’ı yenileyerek claim’leri garantile
        const res = await getIdTokenResult(user, true);
        if (on) setClaims(res.claims || {});
      } catch {
        if (on) setClaims({});
      }
    })();
    return () => { on = false; };
  }, [user]);

  // İlk yükleniş veya claims beklenirken
  if (loading || (user && claims === null)) {
    return null; // istersen buraya spinner koy
  }

  if (!user) return <Navigate to="/" replace />;

  const emailIsAdmin = (user.email || "").toLowerCase() === ADMIN_EMAIL;
  const isAdmin = claims?.admin === true || emailIsAdmin;

  if (role === "admin" && !isAdmin) return <Navigate to="/dashboard" replace />;
  if (role === "user"  &&  isAdmin) return <Navigate to="/admin"     replace />;

  return children;
}
