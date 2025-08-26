// src/jss/UserDashboard.tsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { motion } from "framer-motion";
import {
  ChevronDown,
  BookOpen,
  ClipboardList,
  User2,
  BarChart3,
  FileText,
  ExternalLink,
  SquareLibrary,
} from "lucide-react";
import { db } from "../firebaseConfig";
import { useAuth } from "./context/authContext";
import { useNavigate } from "react-router-dom";

/* ───────────────────────── Yardımcılar ───────────────────────── */
const titleCaseTR = (s = ""): string =>
  String(s)
    .trim()
    .split(/\s+/)
    .map((w) =>
      w
        .split("-")
        .map((p) =>
          p
            ? p[0].toLocaleUpperCase("tr-TR") +
              p.slice(1).toLocaleLowerCase("tr-TR")
            : ""
        )
        .join("-")
    )
    .join(" ");

const clean = (s: unknown): string => {
  if (s == null) return "";
  const t = String(s).trim();
  return t === "undefined" || t === "null" ? "" : t;
};

const toCollectionName = (str?: string | null): string =>
  (str || "unknown")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120)
    .toLowerCase();

/* ——— TR + Sayısal (natural) sıralama ——— */
const trCollator = new Intl.Collator("tr", { numeric: true, sensitivity: "base" });
const cmp = (a: string, b: string) => trCollator.compare(a ?? "", b ?? "");
const sortByName = <T extends { name: string }>(xs: T[]) => xs.sort((a, b) => cmp(a.name, b.name));
const sortByCat = <T extends { cat: string }>(xs: T[]) => xs.sort((a, b) => cmp(a.cat, b.cat));

/* ——— type normalize ——— */
const normType = (v?: unknown) => String(v ?? "").trim().toLowerCase();

/* ───────────────────────── Tipler ───────────────────────── */
type Grade = 5 | 6 | 7 | 8;

type SlideItem = { name: string; link?: string };
type TestItem = { name: string; link?: string; closing?: Date | null; questionCount: number };

type CatList<T> = { cat: string; list: T[] };

type SlidesByGrade = Record<number, CatList<SlideItem>[]>;
type TestsByGrade = Record<number, CatList<TestItem>[]>;

type AuthCtx = { user: { uid: string; email?: string | null } | null };

/* — Ödev tipi — */
type AssignmentItem = {
  id: string;
  name: string;
  category: string;
  grade?: number | null;
  link?: string | null;
  questionCount: number;
  isSpecial?: boolean;
};

type Stats = {
  submissions: number;
  compared: number; // karşılaştırılan toplam soru
  correct: number;
  wrong: number;
  blank: number;
  accuracy: number; // 0..1
};

/* ───────────────────────── Pastel yardımcıları ───────────────────────── */
const pastelBg = {
  indigo: "bg-indigo-50 ring-indigo-100 text-indigo-600",
  emerald: "bg-emerald-50 ring-emerald-100 text-emerald-600",
  violet: "bg-violet-50 ring-violet-100 text-violet-600",
  rose: "bg-rose-50 ring-rose-100 text-rose-600",
  amber: "bg-amber-50 ring-amber-100 text-amber-600",
} as const;

const pastelText = {
  indigo: "text-indigo-700",
  emerald: "text-emerald-700",
  violet: "text-violet-700",
  rose: "text-rose-600",
  amber: "text-amber-700",
} as const;

type PastelColor = keyof typeof pastelBg;

/* Test buton/rozet temaları (Tailwind için sabit sınıflar) */
type Accent = "emerald" | "rose";
const TEST_THEME: Record<
  Accent,
  {
    badgeColor: PastelColor;
    chip: string;
    text: string;
    border: string;
    btn: string;
    btnHover: string;
    ring: string;
    underline: string;
  }
> = {
  emerald: {
    badgeColor: "emerald",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    text: "text-emerald-700",
    border: "border-emerald-300",
    btn: "bg-emerald-600",
    btnHover: "hover:bg-emerald-500",
    ring: "focus-visible:ring-emerald-400",
    underline: "decoration-emerald-300",
  },
  rose: {
    badgeColor: "rose",
    chip: "bg-rose-50 text-rose-700 ring-rose-100",
    text: "text-rose-700",
    border: "border-rose-300",
    btn: "bg-rose-600",
    btnHover: "hover:bg-rose-500",
    ring: "focus-visible:ring-rose-400",
    underline: "decoration-rose-300",
  },
};

/* ───────────────────────── UI Parçaları ───────────────────────── */
const IconBadge: React.FC<{
  color?: PastelColor;
  className?: string;
  children: React.ReactNode;
}> = ({ color = "indigo", children, className = "" }) => (
  <span
    className={`inline-flex items-center justify-center rounded-full ring-1 h-6 w-6 sm:h-7 sm:w-7 ${pastelBg[color]} ${className}`}
  >
    {children}
  </span>
);

const SectionHeader: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  color?: PastelColor;
  children: React.ReactNode;
}> = ({ icon: Icon, color = "indigo", children }) => (
  <div className="mb-4 sm:mb-5 flex items-center gap-2">
    <IconBadge color={color}>
      <Icon className="h-4 w-4" />
    </IconBadge>
    <h2 className={`text-base sm:text-lg font-semibold ${pastelText[color]}`}>{children}</h2>
  </div>
);

const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className = "",
  children,
}) => (
  <div className={`rounded-xl border border-slate-300 bg-white shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

/* Katlanabilir blok (stabil animasyon) */
const Collapsible: React.FC<{ title: React.ReactNode; children: React.ReactNode }> = ({
  title,
  children,
}) => {
  const [open, setOpen] = useState<boolean>(false);
  const [maxH, setMaxH] = useState<number>(0);
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
    <div className="mb-4 sm:mb-5 rounded-xl border border-slate-300 bg-white shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-xl border-b border-slate-200 px-4 py-3 sm:px-5 sm:py-3.5 text-left text-[15px] font-semibold text-slate-800 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
      >
        {title}
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="text-slate-500"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </button>

      <motion.div
        initial={false}
        animate={open ? { maxHeight: maxH, opacity: 1 } : { maxHeight: 0, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden"
        style={{ willChange: "max-height, opacity" }}
      >
        <div ref={contentRef} className="px-4 pb-4 pt-3 sm:px-6 sm:pb-5 sm:pt-4">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

/* Slayt listesi */
const SlideList: React.FC<{ cats?: CatList<SlideItem>[] }> = ({ cats = [] }) =>
  cats.length ? (
    <div className="space-y-4 sm:space-y-5">
      {cats.map(({ cat, list }) => (
        <div key={cat} className="space-y-2">
          <div className="flex items-center gap-2">
            <IconBadge color="indigo">
              <BookOpen className="h-4 w-4" />
            </IconBadge>
            <p className="text-sm font-medium text-indigo-700">{cat}</p>
          </div>
          <ul className="space-y-1.5 text-sm leading-6 text-slate-700">
            {list.map((s, i) => (
              <li key={`${cat}-${i}`} className="flex items-center gap-2 min-w-0">
                <IconBadge color="indigo" className="h-6 w-6 shrink-0">
                  <FileText className="h-3.5 w-3.5" />
                </IconBadge>
                {s.link ? (
                  <a
                    href={s.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-700 min-w-0 max-w-[70vw] sm:max-w-none"
                    title={s.name}
                  >
                    <span className="truncate">{s.name}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                ) : (
                  <span className="truncate" title={s.name}>{s.name}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  ) : (
    <p className="text-xs text-slate-500">Bu sınıf için slayt yok.</p>
  );

/* Test listesi (renk varyant destekli) */
const TestList: React.FC<{
  cats?: CatList<TestItem>[];
  studentName: string;
  solvedSet: Set<string>;
  accent?: Accent; // "emerald" (normal) | "rose" (özel)
}> = ({ cats = [], studentName, solvedSet, accent = "emerald" }) => {
  const navigate = useNavigate();
  const th = TEST_THEME[accent];

  return cats.length ? (
    <div className="space-y-4 sm:space-y-5">
      {cats.map(({ cat, list }) => (
        <div key={`${accent}-${cat}`} className="space-y-2">
          <div className="flex items-center gap-2">
            <IconBadge color={th.badgeColor}>
              <SquareLibrary className="h-4 w-4" />
            </IconBadge>
            <p className={`text-sm font-medium ${th.text}`}>{cat}</p>
          </div>

          <ul className="space-y-2 text-sm leading-6 text-slate-700">
            {list.map((t, i) => {
              const qCount = t.questionCount ?? 20;
              const hasLink = Boolean(t.link);
              const isSolved = !!solvedSet?.has?.(t.name);

              return (
                <li
                  key={`${cat}-${i}`}
                  className="flex flex-col gap-2 rounded-lg md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <IconBadge color={th.badgeColor} className="h-6 w-6 shrink-0">
                      <ClipboardList className="h-3.5 w-3.5" />
                    </IconBadge>
                    <span className="truncate" title={t.name}>{t.name}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${th.chip}`}
                    >
                      {qCount} soru
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {/* Testi Gör */}
                    {hasLink ? (
                      <a
                        href={t.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center justify-center rounded-md border bg-white px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 ${th.border} ${th.text} ${th.ring}`}
                      >
                        Testi Gör
                        <ExternalLink className="ml-1 h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <button
                        disabled
                        className="inline-flex cursor-not-allowed items-center justify-center rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500"
                        title="Bu test için bağlantı eklenmemiş."
                      >
                        Testi Gör
                      </button>
                    )}

                    {/* Testi Çöz */}
                    <button
                      aria-disabled={isSolved}
                      disabled={isSolved}
                      onClick={() => {
                        if (isSolved) return;
                        const url = `/optik?count=${qCount}&test=${encodeURIComponent(
                          t.name
                        )}&student=${encodeURIComponent(studentName)}`;
                        navigate(url);
                      }}
                      title={isSolved ? "Bu test daha önce çözüldü." : "Testi çöz"}
                      className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium shadow-sm transition-colors focus:outline-none focus-visible:ring-2
                        ${
                          isSolved
                            ? "cursor-not-allowed bg-slate-200 text-slate-500 ring-1 ring-slate-300"
                            : `${th.btn} text-white ring-1 ring-black/5 ${th.btnHover} ${th.ring}`
                        }`}
                    >
                      {isSolved ? "Çözüldü" : "Testi Çöz"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  ) : (
    <p className="text-xs text-slate-500">Bu sınıf için test yok.</p>
  );
};

/* ───────────────────────── Sayfa ───────────────────────── */
export default function UserDashboard(): React.ReactElement {
  const { user } = useAuth() as AuthCtx;

  const GRADES = useMemo<Grade[]>(() => [5, 6, 7, 8], []);

  const [slides, setSlides] = useState<SlidesByGrade>({});
  const [tests, setTests] = useState<TestsByGrade>({});
  const [specialTests, setSpecialTests] = useState<TestsByGrade>({});
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [solvedSet, setSolvedSet] = useState<Set<string>>(new Set());

  /* Atanan ödevler */
  const [assigned, setAssigned] = useState<AssignmentItem[]>([]);

  /* İstatistikler */
  const [stats, setStats] = useState<Stats>({
    submissions: 0,
    compared: 0,
    correct: 0,
    wrong: 0,
    blank: 0,
    accuracy: 0,
  });

  /* Profil */
  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const uidDoc = await getDoc(doc(db, "students", user.uid));
        setProfile(uidDoc.exists() ? { id: uidDoc.id, ...uidDoc.data() } : {});
      } catch (e) {
        console.error("Profil çekilemedi:", e);
        setProfile({});
      }
    })();
  }, [user]);

  /* Slayt & test verileri (normal + özel kategoriler) */
  useEffect(() => {
    const getData = async () => {
      try {
        const [slideCatsSnap, testCatsSnap, specialCatsSnap] = await Promise.all([
          getDocs(collection(db, "slaytKategoriAdlari")),
          getDocs(collection(db, "kategoriAdlari")),
          getDocs(collection(db, "ozelKategoriler")),
        ]);

        const slideCats = slideCatsSnap.docs
          .map((d) => clean((d.data() as DocumentData).name))
          .filter(Boolean) as string[];
        const testCats = testCatsSnap.docs
          .map((d) => clean((d.data() as DocumentData).name))
          .filter(Boolean) as string[];
        const specialCats = specialCatsSnap.docs
          .map((d) => clean((d.data() as DocumentData).name))
          .filter(Boolean) as string[];

        slideCats.sort(cmp);
        testCats.sort(cmp);
        specialCats.sort(cmp);

        const slidesObj: SlidesByGrade = {};
        const testsObj: TestsByGrade = {};
        const specialObj: TestsByGrade = {};

        await Promise.all(
          GRADES.map(async (g) => {
            /* Slaytlar → sadece type: "slayt" */
            const slideArr: CatList<SlideItem>[] = [];
            await Promise.all(
              slideCats.map(async (cat) => {
                const snap = await getDocs(query(collection(db, cat), where("grade", "==", g)));
                const list: SlideItem[] = snap.docs.flatMap<SlideItem>((s) => {
                  const d = s.data() as DocumentData & { type?: string; name?: string; link?: string };
                  if (normType(d.type) !== "slayt") return [];
                  const name = clean(d.name);
                  if (!name) return [];
                  return [{ name, link: clean(d.link) || undefined }];
                });
                sortByName(list);
                if (list.length) slideArr.push({ cat, list });
              })
            );
            sortByCat(slideArr);
            slidesObj[g] = slideArr;

            /* Normal testler → sadece type: "test" */
            const testArr: CatList<TestItem>[] = [];
            await Promise.all(
              testCats.map(async (cat) => {
                const snap = await getDocs(query(collection(db, cat), where("grade", "==", g)));
                const list: TestItem[] = snap.docs.flatMap<TestItem>((t) => {
                  const d = t.data() as DocumentData & {
                    type?: string;
                    name?: string;
                    link?: string;
                    createdAt?: { toDate?: () => Date };
                    duration?: number;
                    questionCount?: number;
                    count?: number;
                  };
                  if (normType(d.type) !== "test") return [];
                  const start = d.createdAt?.toDate?.();
                  const closing = start ? new Date(start.getTime() + (d.duration || 0) * 60_000) : null;
                  const name = clean(d.name);
                  if (!name) return [];
                  return [{
                    name,
                    link: clean(d.link) || undefined,
                    closing,
                    questionCount:
                      typeof d.questionCount === "number"
                        ? d.questionCount
                        : typeof d.count === "number"
                        ? d.count
                        : 20,
                  }];
                });
                sortByName(list);
                if (list.length) testArr.push({ cat, list });
              })
            );
            sortByCat(testArr);
            testsObj[g] = testArr;

            /* Yayınlar (özel) → sadece type: "yayın" */
            const specialArr: CatList<TestItem>[] = [];
            await Promise.all(
              specialCats.map(async (cat) => {
                const snap = await getDocs(query(collection(db, cat), where("grade", "==", g)));
                const list: TestItem[] = snap.docs.flatMap<TestItem>((t) => {
                  const d = t.data() as DocumentData & {
                    type?: string;
                    name?: string;
                    link?: string;
                    questionCount?: number;
                    count?: number;
                  };
                  if (normType(d.type) !== "yayın") return [];
                  const name = clean(d.name);
                  if (!name) return [];
                  return [{
                    name,
                    link: clean(d.link) || undefined,
                    questionCount:
                      typeof d.questionCount === "number"
                        ? d.questionCount
                        : typeof d.count === "number"
                        ? d.count
                        : 20,
                  }];
                });
                sortByName(list);
                if (list.length) specialArr.push({ cat, list });
              })
            );
            sortByCat(specialArr);
            specialObj[g] = specialArr;
          })
        );

        setSlides(slidesObj);
        setTests(testsObj);
        setSpecialTests(specialObj);
      } catch (err) {
        console.error("Firestore veri çekme hatası:", err);
      }
    };

    void getData();
  }, [GRADES]);

  /* Ad / Soyad */
  const { firstName, lastName } = useMemo(() => {
    const f = clean(profile?.firstName as string | undefined);
    const l = clean(profile?.lastName as string | undefined);
    return {
      firstName: f ? titleCaseTR(f) : "-",
      lastName: l ? titleCaseTR(l) : "-",
    };
  }, [profile]);

  /* Öğrenci tam adı (fallback: e-posta öneki) -> nameKey normalize */
  const nameKey = useMemo(() => {
    const composed =
      `${firstName && firstName !== "-" ? firstName : ""} ${lastName && lastName !== "-" ? lastName : ""}`.trim() ||
      (user?.email?.split("@")[0] ?? "bilinmeyen");
    return toCollectionName(composed);
  }, [firstName, lastName, user]);

  /* Daha önce çözülen testler (submission set) */
  useEffect(() => {
    if (!nameKey) return;
    (async () => {
      try {
        const qref = query(collection(db, nameKey), where("type", "==", "submission"));
        const snap = await getDocs(qref);
        const s = new Set<string>();
        snap.forEach((d) => {
          const tn = (d.data() as DocumentData)?.test?.name;
          if (tn) s.add(String(tn));
        });
        setSolvedSet(s);
      } catch (e) {
        console.error("Çözülen testler alınamadı:", e);
        setSolvedSet(new Set());
      }
    })();
  }, [nameKey]);

  /* Atanan ödevler (`<nameKey>_odevler`) */
  useEffect(() => {
    if (!nameKey) return;
    (async () => {
      try {
        const collName = `${nameKey}_odevler`;

        // Çift koşullu sorgu index isterse fallback yapalım:
        let snap;
        try {
          snap = await getDocs(
            query(
              collection(db, collName),
              where("type", "==", "assignment"),
              where("status", "==", "assigned")
            )
          );
        } catch {
          // Fallback: sadece type ile çek, status'u client'ta filtrele
          snap = await getDocs(query(collection(db, collName), where("type", "==", "assignment")));
        }

        const arr: AssignmentItem[] = [];
        snap.forEach((d) => {
          const data = d.data() as DocumentData;
          if (data.status && data.status !== "assigned") return; // fallback senaryosunda filtre
          const t = (data.test || {}) as Record<string, unknown>;
          const name = clean(t.name);
          if (!name) return;
          arr.push({
            id: d.id,
            name,
            category: clean(t.category),
            grade: (t.grade as number) ?? null,
            link: (t.link as string) || null,
            questionCount:
              typeof t.questionCount === "number" ? (t.questionCount as number) : 20,
            isSpecial: !!t.isSpecial,
          });
        });

        arr.sort((a, b) => cmp(a.name, b.name));
        setAssigned(arr);
      } catch (e) {
        console.error("Atanan ödevler getirilemedi:", e);
        setAssigned([]);
      }
    })();
  }, [nameKey]);

  /* İstatistikleri hesapla (submissions) */
  useEffect(() => {
    if (!nameKey) return;
    (async () => {
      try {
        const qref = query(collection(db, nameKey), where("type", "==", "submission"));
        const snap = await getDocs(qref);

        let submissions = 0;
        let compared = 0;
        let correct = 0;
        let wrong = 0;
        let blank = 0;

        snap.forEach((d) => {
          const data = d.data() as DocumentData;
          if (data?.type !== "submission") return;
          submissions += 1;
          const scoring = data?.scoring as
            | {
                status?: string;
                compared?: number;
                correctCount?: number;
                wrongCount?: number;
                blankCount?: number;
              }
            | undefined;

          if (scoring && scoring.status === "ok") {
            compared += scoring.compared || 0;
            correct += scoring.correctCount || 0;
            wrong += scoring.wrongCount || 0;
            blank += scoring.blankCount || 0;
          }
        });

        const denom = correct + wrong; // boşları dahil etmeden doğruluk
        const accuracy = denom > 0 ? correct / denom : 0;

        setStats({ submissions, compared, correct, wrong, blank, accuracy });
      } catch (e) {
        console.error("İstatistikler hesaplanamadı:", e);
        setStats({ submissions: 0, compared: 0, correct: 0, wrong: 0, blank: 0, accuracy: 0 });
      }
    })();
  }, [nameKey]);

  /* ───────────────────────── UI ───────────────────────── */
  const navigate = useNavigate();

  return (
    <section className="min-h-screen bg-slate-50 px-3 py-6 sm:px-5 sm:py-8 md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 sm:mb-10 flex items-center justify-center gap-2">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
            Öğrenci Paneli
          </h1>
        </div>

        {/* 3 kolonlu ızgara: Slayt/Test kartı 2 kolon kaplar, sağda dikey yığın */}
        <div className="grid gap-6 md:gap-8 lg:grid-cols-3">
          {/* SOL (2 kolon): Slayt & Testler */}
          <Card className="p-4 sm:p-6 md:p-8 lg:col-span-2">
            <SectionHeader icon={BookOpen} color="indigo">
              Slaytlar &amp; Testler
            </SectionHeader>

            {([5, 6, 7, 8] as Grade[]).map((g) => (
              <Collapsible key={g} title={`${g}. Sınıf`}>
                {/* Slaytlar */}
                <h3 className={`mb-2 text-sm font-semibold ${pastelText.indigo}`}>Slaytlar</h3>
                <SlideList cats={slides[g] || []} />

                {/* Normal Testler */}
                <h3 className={`mb-2 mt-5 text-sm font-semibold ${pastelText.emerald}`}>Testler</h3>
                <TestList
                  cats={tests[g] || []}
                  studentName={nameKey}
                  solvedSet={solvedSet}
                  accent="emerald"
                />

                {/* Yayınlar (özel) */}
                <h3 className={`mb-2 mt-5 text-sm font-semibold ${pastelText.rose}`}>Yayınlar</h3>
                <TestList
                  cats={specialTests[g] || []}
                  studentName={nameKey}
                  solvedSet={solvedSet}
                  accent="rose"
                />
              </Collapsible>
            ))}
          </Card>

          {/* SAĞ: Üstte Aktif Ödevler, altında Kişisel Bilgiler ve İstatistikler */}
          <div className="flex flex-col gap-6 md:gap-8">
            {/* Aktif Ödevler */}
            <Card className="p-4 sm:p-6 md:p-8">
              <SectionHeader icon={ClipboardList} color="rose">
                Aktif Ödevler
              </SectionHeader>

              {assigned.length === 0 ? (
                <p className="text-center text-sm leading-7 text-slate-600">
                  Şu anda atanmış ödev bulunmuyor.
                </p>
              ) : (
                <ul className="space-y-2.5 text-sm">
                  {assigned.map((a) => {
                    const isSolved = solvedSet.has(a.name);
                    const th = a.isSpecial ? TEST_THEME.rose : TEST_THEME.emerald;
                    return (
                      <li
                        key={a.id}
                        className="flex flex-col gap-2 rounded-lg md:flex-row md:items-center md:justify-between"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <IconBadge color={th.badgeColor} className="h-6 w-6 shrink-0">
                            <ClipboardList className="h-3.5 w-3.5" />
                          </IconBadge>
                          <span className="truncate" title={a.name}>{a.name}</span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${th.chip}`}
                            title={a.isSpecial ? "Özel test" : "Normal test"}
                          >
                            {a.questionCount} soru
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {/* Testi Gör */}
                          {a.link ? (
                            <a
                              href={a.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center justify-center rounded-md border bg-white px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 ${th.border} ${th.text} ${th.ring}`}
                            >
                              Testi Gör
                              <ExternalLink className="ml-1 h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <button
                              disabled
                              className="inline-flex cursor-not-allowed items-center justify-center rounded-md border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500"
                              title="Bu test için bağlantı eklenmemiş."
                            >
                              Testi Gör
                            </button>
                          )}

                          {/* Testi Çöz */}
                          <button
                            aria-disabled={isSolved}
                            disabled={isSolved}
                            onClick={() => {
                              if (isSolved) return;
                              const url = `/optik?count=${a.questionCount}&test=${encodeURIComponent(
                                a.name
                              )}&student=${encodeURIComponent(nameKey)}&cat=${encodeURIComponent(
                                a.category
                              )}&grade=${a.grade ?? ""}&link=${encodeURIComponent(a.link || "")}`;
                              // SPA içinde kalalım:
                              navigate(url);
                            }}
                            title={isSolved ? "Bu test daha önce çözüldü." : "Testi çöz"}
                            className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium shadow-sm transition-colors focus:outline-none focus-visible:ring-2
                              ${
                                isSolved
                                  ? "cursor-not-allowed bg-slate-200 text-slate-500 ring-1 ring-slate-300"
                                  : `${th.btn} text-white ring-1 ring-black/5 ${th.btnHover} ${th.ring}`
                              }`}
                          >
                            {isSolved ? "Çözüldü" : "Testi Çöz"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            {/* Kişisel Bilgiler */}
            <Card className="p-4 sm:p-6 md:p-8">
              <SectionHeader icon={User2} color="violet">
                Kişisel Bilgiler
              </SectionHeader>
              <dl className="divide-y divide-slate-200 text-sm">
                <div className="grid grid-cols-2 gap-y-2 py-3">
                  <dt className="font-medium text-slate-600">Ad</dt>
                  <dd className="text-right">{firstName || "-"}</dd>
                </div>
                <div className="grid grid-cols-2 gap-y-2 py-3">
                  <dt className="font-medium text-slate-600">Soyad</dt>
                  <dd className="text-right">{lastName || "-"}</dd>
                </div>
                <div className="grid grid-cols-2 gap-y-2 py-3">
                  <dt className="font-medium text-slate-600">E-posta</dt>
                  <dd className="text-right">{user?.email || "-"}</dd>
                </div>
              </dl>
            </Card>

            {/* İstatistikler */}
            <Card className="p-4 sm:p-6 md:p-8">
              <SectionHeader icon={BarChart3} color="amber">
                İstatistikler
              </SectionHeader>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 text-center sm:grid-cols-4">
                <div className="rounded-lg bg-amber-50 p-2.5 sm:p-3 ring-1 ring-amber-100">
                  <div className="text-xl sm:text-2xl font-extrabold text-amber-700">{stats.submissions}</div>
                  <div className="mt-1 text-[11px] sm:text-xs font-medium text-amber-700/80">Test</div>
                </div>
                <div className="rounded-lg bg-emerald-50 p-2.5 sm:p-3 ring-1 ring-emerald-100">
                  <div className="text-xl sm:text-2xl font-extrabold text-emerald-700">{stats.correct}</div>
                  <div className="mt-1 text-[11px] sm:text-xs font-medium text-emerald-700/80">Doğru</div>
                </div>
                <div className="rounded-lg bg-rose-50 p-2.5 sm:p-3 ring-1 ring-rose-100">
                  <div className="text-xl sm:text-2xl font-extrabold text-rose-700">{stats.wrong}</div>
                  <div className="mt-1 text-[11px] sm:text-xs font-medium text-rose-700/80">Yanlış</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 sm:p-3 ring-1 ring-slate-200">
                  <div className="text-xl sm:text-2xl font-extrabold text-slate-700">{stats.blank}</div>
                  <div className="mt-1 text-[11px] sm:text-xs font-medium text-slate-700/80">Boş</div>
                </div>
              </div>

              <div className="mt-3 sm:mt-4 grid grid-cols-2 gap-3 sm:gap-4">
                <div className="rounded-lg bg-white p-2.5 sm:p-3 ring-1 ring-slate-200">
                  <p className="text-center text-[12px] sm:text-[13px] text-slate-600">
                    Karşılaştırılan soru
                  </p>
                  <p className="mt-1 text-center text-lg sm:text-xl font-bold text-slate-900">
                    {stats.compared}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-2.5 sm:p-3 ring-1 ring-slate-200">
                  <p className="text-center text-[12px] sm:text-[13px] text-slate-600">
                    Doğruluk
                  </p>
                  <p className="mt-1 text-center text-lg sm:text-xl font-bold text-slate-900">
                    {(stats.accuracy * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              {stats.submissions === 0 && (
                <p className="mt-4 text-center text-xs text-slate-500">
                  Henüz gönderim yok. Test çözdükçe istatistikler burada görünecek.
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
