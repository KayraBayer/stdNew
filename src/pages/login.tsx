// src/pages/Login.tsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { collection, getDocs, query, where, type DocumentData, type QueryDocumentSnapshot } from "firebase/firestore";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  BookOpen,
  ClipboardList,
  FileText,
  ExternalLink,
  SquareLibrary,
  Presentation,
  Layers,
} from "lucide-react";
import { auth, db } from "../firebaseConfig";
import { useAuth } from "./context/authContext";
import Logo from "../assets/logo.png";
import BottomNav from "./components/bottomNav";
import Spinner from "./components/spinner";
import { motion } from "framer-motion";

const ADMIN_EMAIL = "admin@mail.com";

/* ——— Tipler ——— */
type SlideItem = { name: string; link?: string };
type SlideCategoryBlock = { category: string; slides: SlideItem[] };

type TestItem = { name: string; link?: string; closing: Date | null };
type TestCategoryBlock = { category: string; tests: TestItem[] };

type FormData = { email: string; password: string };

type PastelColor = "indigo" | "emerald" | "rose" | "slate";

/* ——— Dark-Pastel yardımcıları ——— */
const pastelBadge: Record<PastelColor, string> = {
  indigo: "bg-indigo-500/10 text-indigo-300 ring-indigo-400/20",
  emerald: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/20",
  rose: "bg-rose-500/10 text-rose-300 ring-rose-400/20",
  slate: "bg-white/5 text-slate-200 ring-white/10",
};
const pastelText: Record<Exclude<PastelColor, "slate">, string> = {
  indigo: "text-indigo-300",
  emerald: "text-emerald-300",
  rose: "text-rose-300",
};

const IconBadge: React.FC<{ color?: PastelColor; className?: string; children: React.ReactNode }> = ({
  color = "indigo",
  children,
  className = "",
}) => (
  <span className={`inline-flex m-1 h-7 w-7 items-center justify-center rounded-full ring-1 ${pastelBadge[color]} ${className}`}>
    {children}
  </span>
);

const SectionHeader: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  color?: Exclude<PastelColor, "slate">;
  children: React.ReactNode;
}> = ({ icon: Icon, color = "indigo", children }) => (
  <div className="mb-3 flex items-center gap-2">
    <IconBadge color={color}>
      <Icon className="h-4 w-4" />
    </IconBadge>
    <h2 className={`text-base font-semibold ${pastelText[color]}`}>{children}</h2>
  </div>
);

const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = "", children }) => (
  <div className={`rounded-xl border border-white/10 bg-neutral-900 shadow-sm ${className}`}>{children}</div>
);

/* ——— Mobil için stabil Collapsible (dark) ——— */
const Collapsible: React.FC<{
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: PastelColor;
  children: React.ReactNode;
}> = ({ title, icon: Icon, color = "indigo", children }) => {
  const [open, setOpen] = useState(false);
  const [maxH, setMaxH] = useState(0);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => setMaxH(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const t = setTimeout(measure, 50);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, [children, open]);

  return (
    <Card>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-xl border-b border-white/10 px-4 py-3 text-left text-[15px] font-semibold text-slate-200 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        <span className="inline-flex items-center gap-2">
          <IconBadge color={color}>
            <Icon className="h-4 w-4" />
          </IconBadge>
          {title}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }} className="text-slate-400">
          ▼
        </motion.span>
      </button>

      <motion.div
        initial={false}
        animate={open ? { maxHeight: maxH, opacity: 1 } : { maxHeight: 0, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden"
      >
        {/* Mobilde içerik uzun ise kart içi scroll */}
        <div ref={contentRef} className="max-h-72 overflow-y-auto px-4 pb-4 pt-3">
          {children}
        </div>
      </motion.div>
    </Card>
  );
};

/* ——— Liste bileşenleri (dark-pastel) ——— */
const SlideList: React.FC<{ items?: SlideCategoryBlock[] }> = ({ items = [] }) =>
  items.length ? (
    <div className="space-y-4">
      {items.map((cat) => (
        <div key={cat.category} className="space-y-2">
          <div className="flex items-center gap-2">
            <IconBadge color="indigo">
              <BookOpen className="h-4 w-4" />
            </IconBadge>
            <p className="text-sm font-medium text-indigo-300">{cat.category}</p>
          </div>
          <ul className="space-y-1.5 text-sm leading-6 text-slate-300">
            {cat.slides.map((s, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <IconBadge color="indigo" className="h-6 w-6">
                  <FileText className="h-3.5 w-3.5" />
                </IconBadge>
                {s.link ? (
                  <a
                    href={s.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline decoration-indigo-700/40 underline-offset-2 hover:text-indigo-300"
                  >
                    {s.name}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  s.name
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  ) : (
    <p className="text-xs text-slate-400">Bu sınıf için slayt yok.</p>
  );

const TestList: React.FC<{ items?: TestCategoryBlock[] }> = ({ items = [] }) =>
  items.length ? (
    <div className="space-y-4">
      {items.map((cat) => (
        <div key={cat.category} className="space-y-2">
          <div className="flex items-center gap-2">
            <IconBadge color="emerald">
              <SquareLibrary className="h-4 w-4" />
            </IconBadge>
            <p className="text-sm font-medium text-emerald-300">{cat.category}</p>
          </div>
          <ul className="space-y-1.5 text-sm leading-6 text-slate-300">
            {cat.tests.map((t, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <IconBadge color="emerald" className="h-6 w-6">
                  <ClipboardList className="h-3.5 w-3.5" />
                </IconBadge>
                {t.link ? (
                  <a
                    href={t.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline decoration-emerald-700/40 underline-offset-2 hover:text-emerald-300"
                  >
                    {t.name}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  t.name
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  ) : (
    <p className="text-xs text-slate-400">Bu sınıf için test yok.</p>
  );

export default function Login(): React.ReactElement {
  const navigate = useNavigate();
  const { startLoading, stopLoading } = useAuth() as { startLoading: () => void; stopLoading: () => void };

  const [formData, setFormData] = useState<FormData>({ email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(false);

  const [loading, setLoading] = useState(false); // giriş spinner
  const [error, setError] = useState("");

  const [slides, setSlides] = useState<SlideCategoryBlock[]>([]);
  const [categories, setCategories] = useState<TestCategoryBlock[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number>(5);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // veri çek
  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      setIsLoadingData(true);
      try {
        // Slayt kategorileri
        const slideCatSnap = await getDocs(collection(db, "slaytKategoriAdlari"));
        const slideCatNames = slideCatSnap.docs.map((d) => (d.data() as { name?: string }).name).filter(Boolean) as string[];

        const fetchSlides = async (cat: string): Promise<SlideItem[]> => {
          const snap = await getDocs(query(collection(db, cat), where("grade", "==", selectedGrade)));
          return snap.docs.map((s) => {
            const data = s.data() as { name?: string; link?: string };
            return { name: data.name ?? "Adsız", link: data.link ?? "" };
          });
        };

        const slideLists = await Promise.all(
          slideCatNames.map(async (cat) => ({
            category: cat,
            slides: (await fetchSlides(cat)).sort((a, b) => a.name.localeCompare(b.name, "tr", { sensitivity: "base" })),
          }))
        );

        setSlides(
          slideLists
            .filter((c) => c.slides.length)
            .sort((a, b) => a.category.localeCompare(b.category, "tr", { sensitivity: "base" }))
        );

        // Test kategorileri
        const testCatSnap = await getDocs(collection(db, "kategoriAdlari"));
        const testCatNames = testCatSnap.docs.map((d) => (d.data() as { name?: string }).name).filter(Boolean) as string[];

        const fetchTests = async (cat: string): Promise<TestItem[]> => {
          const snap = await getDocs(query(collection(db, cat), where("grade", "==", selectedGrade)));
          return snap.docs.map((t) => {
            const data = t.data() as {
              name?: string;
              link?: string;
              createdAt?: { toDate?: () => Date };
              duration?: number;
            };
            const start = data.createdAt?.toDate?.() ?? null;
            const end = start ? new Date(start.getTime() + ((data.duration ?? 0) * 60_000)) : null;
            return { name: data.name ?? "Adsız", link: data.link ?? "", closing: end };
          });
        };

        const testList = await Promise.all(
          testCatNames.map(async (cat) => ({
            category: cat,
            tests: (await fetchTests(cat)).sort((a, b) => a.name.localeCompare(b.name, "tr", { sensitivity: "base" })),
          }))
        );

        setCategories(
          testList
            .filter((c) => c.tests.length)
            .sort((a, b) => a.category.localeCompare(b.category, "tr", { sensitivity: "base" }))
        );
      } catch (err) {
        console.error("Firestore veri çekme hatası:", err);
      } finally {
        setIsLoadingData(false);
      }
    };

    void fetchData();
  }, [selectedGrade]);

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
      const msg = (err as { message?: string })?.message ?? "Giriş başarısız.";
      setError(msg);
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  return (
    <section className="relative min-h-screen bg-neutral-950 px-4 py-6 pb-[calc(88px+env(safe-area-inset-bottom))] text-slate-200">
      {/* Tam ekran giriş spinner overlay */}
      {loading && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 backdrop-blur-sm">
          <Spinner size={40} label="Giriş yapılıyor..." />
        </div>
      )}

      {/* LOGO — kartların üstünde, ortalanmış */}
      <div className="mx-auto mb-3 flex max-w-6xl items-center justify-center">
        <img src={Logo} alt="Site Logosu" className="h-24 w-auto opacity-90 md:h-36" />
      </div>

      {/* Masaüstünde sabit yükseklikli üçlü düzen */}
      <div className="mx-auto grid w-full max-w-6xl items-stretch gap-6 md:grid-cols-3">
        {/* SOL: Slaytlar */}
        <Card className="hidden md:flex md:h-[400px] flex-col p-4">
          <SectionHeader icon={Presentation} color="indigo">
            Konu Anlatım Slaytları
          </SectionHeader>
          <div className="mt-1 min-h-0 flex-1 overflow-y-auto pr-1">
            {isLoadingData ? <Spinner label="Slaytlar yükleniyor..." /> : <SlideList items={slides} />}
          </div>
        </Card>

        {/* ORTA: Giriş formu */}
        <Card className="relative mx-auto flex w-full max-w-md flex-col p-5 md:h-[400px]">
          <h1 className="text-center text-xl font-extrabold tracking-tight text-slate-100">Giriş Yap</h1>

          {error && (
            <div className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300 ring-1 ring-rose-400/20">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 flex min-h-0 flex-1 flex-col">
            {/* ÜST: alanlar */}
            <div className="space-y-3">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  placeholder="e-mail"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  className="w-full rounded-md border border-white/10 bg-neutral-900 py-3 pl-10 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="w-full rounded-md border border-white/10 bg-neutral-900 py-3 pl-10 pr-10 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  aria-label={showPwd ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* ALT: aksiyonlar — dibe sabit */}
            <div className="mt-auto space-y-3 pt-2">
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={() => setRemember(!remember)}
                  className="h-4 w-4 rounded border-white/20 bg-neutral-900 text-indigo-500 focus:ring-indigo-500"
                />
                Beni Hatırla
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm ring-1 ring-indigo-700/20 transition-colors hover:bg-indigo-500 disabled:opacity-60"
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
            </div>
          </form>
        </Card>

        {/* SAĞ: Testler */}
        <Card className="hidden md:flex md:h-[400px] flex-col p-4">
          <SectionHeader icon={Layers} color="emerald">
            Testler
          </SectionHeader>
          <div className="mt-1 min-h-0 flex-1 overflow-y-auto pr-1">
            {isLoadingData ? <Spinner label="Testler yükleniyor..." /> : <TestList items={categories} />}
          </div>
        </Card>
      </div>

      {/* Mobil: kısa tut + scroll içeride */}
      <div className="mx-auto mt-4 w-full max-w-md space-y-3 md:hidden">
        <Collapsible title="Konu Anlatım Slaytları" icon={BookOpen} color="indigo">
          {isLoadingData ? <Spinner label="Slaytlar yükleniyor..." /> : <SlideList items={slides} />}
        </Collapsible>
        <Collapsible title="Testler" icon={SquareLibrary} color="emerald">
          {isLoadingData ? <Spinner label="Testler yükleniyor..." /> : <TestList items={categories} />}
        </Collapsible>
      </div>

      {/* Alt navbar marjı */}
      <div className="mx-auto mt-4 max-w-6xl">
        <BottomNav active={selectedGrade as 5 | 6 | 7 | 8} onSelect={setSelectedGrade as (g: 5 | 6 | 7 | 8) => void} />
      </div>
    </section>
  );
}
