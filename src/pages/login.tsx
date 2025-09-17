// src/pages/Login.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { auth } from "../firebaseConfig";
import { useAuth } from "./context/authContext";
import Logo from "../assets/logo.png";
import Spinner from "./components/spinner";

const ADMIN_EMAIL = "admin@mail.com";
type FormData = { email: string; password: string };

/* --- DEBUG anahtarı (isteğe bağlı) --- */
const DEBUG_LOGIN = true;

/* --- Firebase hata → TR mesaj --- */
const isInvalidCred = (code?: string, msg?: string) => {
  const m = (msg || "").toLowerCase();
  return (
    code === "auth/invalid-credential" ||
    code === "auth/invalid-login-credentials" || // bazı sürümlerde böyle
    code === "auth/wrong-password" ||
    code === "auth/user-not-found" ||
    code === "auth/invalid-email" ||
    m.includes("invalid_login_credentials") ||
    m.includes("invalid-credential")
  );
};

const authErrorTR = (e: unknown): string => {
  const err = e as { code?: string; message?: string; customData?: any };
  const code = err?.code;
  const msg = err?.message;

  if (isInvalidCred(code, msg)) return "E-mail veya şifre yanlış.";
  if (code === "auth/too-many-requests") return "Çok fazla başarısız deneme. Lütfen biraz sonra tekrar deneyin.";
  if (code === "auth/network-request-failed") return "Ağ hatası. Bağlantınızı kontrol edin.";
  if (code === "auth/user-disabled") return "Hesabınız devre dışı bırakılmış.";
  if (code === "auth/operation-not-allowed") return "Bu oturum yöntemi şu anda etkin değil.";
  // genel fallback
  return "Giriş başarısız. Lütfen tekrar deneyin.";
};

export default function Login(): React.ReactElement {
  const navigate = useNavigate();
  const { startLoading, stopLoading } = useAuth() as { startLoading: () => void; stopLoading: () => void };

  const [formData, setFormData] = useState<FormData>({ email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError("");
    setLoading(true);
    startLoading();
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      const { user } = await signInWithEmailAndPassword(auth, formData.email, formData.password);
      navigate(user.email === ADMIN_EMAIL ? "/admin" : "/dashboard");
    } catch (err) {
      if (DEBUG_LOGIN) console.error("Login error:", err);
      setError(authErrorTR(err));
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  return (
    <section className="relative min-h-screen bg-gradient-to-b from-sky-50 to-white">
      {/* Arka plan yumuşak vurgu */}
      <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-72 w-[90%] rounded-[3rem] bg-[radial-gradient(closest-side,rgba(37,99,235,0.18),transparent)] blur-2xl" />

      {/* Tam ekran giriş spinner */}
      {loading && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm">
          <Spinner size={40} label="Giriş yapılıyor..." />
        </div>
      )}

      {/* Tek sütun — hem yatay hem dikey merkez */}
      <div className="relative z-10 mx-auto max-w-6xl px-4">
        <div className="grid min-h-[90vh] place-items-center">
          <div className="w-full max-w-md">
            {/* Logo — ortalı */}
            <div className="flex items-center justify-center">
              <img src={Logo} alt="Öğrenci Portalı" className="h-16 w-auto md:h-20" />
            </div>

            {/* Giriş kartı */}
            <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h1 className="text-center text-xl font-extrabold tracking-tight text-slate-900">Giriş Yap</h1>

              {error && (
                <div
                  className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200"
                  role="alert"
                  aria-live="assertive"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    placeholder="e-mail"
                    value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoComplete="username"
                    required
                  />
                </div>

                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPwd ? "text" : "password"}
                    name="password"
                    placeholder="şifre"
                    value={formData.password}
                    onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white py-3 pl-10 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                    aria-label={showPwd ? "Şifreyi gizle" : "Şifreyi göster"}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={() => setRemember(!remember)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Beni hatırla
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  aria-busy={loading}
                  className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 disabled:opacity-60"
                >
                  {loading ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <Spinner size={18} />
                      Giriş yapılıyor...
                    </span>
                  ) : (
                    "Giriş"
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-xs text-slate-500">
                © {new Date().getFullYear()} EB Öğrenci Portalı
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
