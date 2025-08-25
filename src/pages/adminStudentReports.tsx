// src/jss/adminStudentReports.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDoc,
  getDocs,
  query,
  where,
  doc,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { motion } from "framer-motion";
import {
  Users,
  BarChart3,
  Target,
  CalendarClock,
  ChevronDown,
  ExternalLink,
  FileText,
  ClipboardList,
} from "lucide-react";

/* ───────────────────────── Yardımcılar ───────────────────────── */
const toCollectionName = (str?: string | null): string =>
  (str || "unknown")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120)
    .toLowerCase();

const fmtDate = (d?: Date | null) =>
  d ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(d) : "—";

const percent = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

/* ───────────────────────── Tipler ───────────────────────── */
type NameIndex = Record<string, boolean>;

type SubmissionRow = {
  id: string;
  createdAt: Date | null;
  testName: string;
  category: string | null;
  grade: number | null;
  link?: string | null;
  count: number; // toplam soru
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  wrongQuestions?: number[];
};

type Agg = {
  total: number;
  totalCorrect: number;
  totalWrong: number;
  totalBlank: number;
  avgScore: number; // %
  lastActivity: Date | null;
};

/* ───────────────────────── Küçük UI Parçaları ───────────────────────── */
const StatCard: React.FC<{ icon: React.ComponentType<any>; label: string; value: React.ReactNode }> = ({
  icon: Icon,
  label,
  value,
}) => (
  <div className="rounded-xl bg-neutral-900 p-5 ring-1 ring-neutral-800 shadow">
    <div className="mb-3 flex items-center gap-2 text-neutral-300">
      <Icon className="h-4 w-4 text-neutral-400" />
      <span className="text-xs font-medium">{label}</span>
    </div>
    <div className="text-2xl font-bold text-white">{value}</div>
  </div>
);

const Chip: React.FC<{ children: React.ReactNode; tone?: "indigo" | "emerald" | "rose" | "amber" | "slate" }> = ({
  children,
  tone = "slate",
}) => {
  const map: Record<string, string> = {
    indigo: "bg-indigo-100/10 text-indigo-300 ring-indigo-500/20",
    emerald: "bg-emerald-100/10 text-emerald-300 ring-emerald-500/20",
    rose: "bg-rose-100/10 text-rose-300 ring-rose-500/20",
    amber: "bg-amber-100/10 text-amber-300 ring-amber-500/20",
    slate: "bg-slate-100/10 text-slate-300 ring-slate-500/20",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ring-1 ${map[tone]}`}>
      {children}
    </span>
  );
};

const RowDetails: React.FC<{ wrong?: number[] }> = ({ wrong = [] }) => {
  const [open, setOpen] = useState(false);
  if (!wrong.length) return null;
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-xs text-neutral-300 hover:text-white"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        Yanlış soruları göster
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {wrong.map((n) => (
            <span
              key={n}
              className="rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-300 ring-1 ring-rose-500/20"
            >
              {n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

/* ───────────────────────── Ana Bileşen ───────────────────────── */
export default function AdminStudentReports(): React.ReactElement {
  const [nameIndex, setNameIndex] = useState<NameIndex>({});
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [filter, setFilter] = useState<string>(""); // test adı filtre
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [agg, setAgg] = useState<Agg>({
    total: 0,
    totalCorrect: 0,
    totalWrong: 0,
    totalBlank: 0,
    avgScore: 0,
    lastActivity: null,
  });

  /* ——— isim indexini çek (ogrenciAdlari/_index) ——— */
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "ogrenciAdlari", "_index"));
        const names = (snap.exists() ? (snap.data()?.names as NameIndex) : {}) || {};
        setNameIndex(names);
      } catch (e) {
        console.error("ogrenciAdlari/_index okunamadı:", e);
        setNameIndex({});
      }
    })();
  }, []);

  const nameKeys = useMemo(
    () =>
      Object.keys(nameIndex)
        .sort((a, b) => a.localeCompare(b, "tr"))
        .filter((k) => nameIndex[k]),
    [nameIndex]
  );

  /* ——— seçilen öğrenciye ait submission'ları çek ——— */
  const loadStudent = async (key: string) => {
    if (!key) return;
    setLoading(true);
    try {
      // Aynı öğrenci için iki olası koleksiyon adı: ham (indexteki) ve normalize edilmiş
      const rawKey = key.toLowerCase();
      const normalizedKey = toCollectionName(key);

      const collected: SubmissionRow[] = [];

      // Helper: tek koleksiyonu tara
      const fetchFrom = async (collName: string) => {
        const snap = await getDocs(query(collection(db, collName), where("type", "==", "submission")));
        snap.forEach((d) => {
          const data = d.data() as DocumentData;
          const scoring = (data.scoring || {}) as any;
          const created: Date | null = data.createdAt?.toDate?.() || null;
          collected.push({
            id: d.id,
            createdAt: created,
            testName: String(data?.test?.name ?? "—"),
            category: (data?.test?.category ?? null) as string | null,
            grade: (data?.test?.grade ?? null) as number | null,
            link: (data?.test?.link ?? null) as string | null,
            count: Number(data?.count ?? data?.answeredCount ?? 0),
            answeredCount: Number(data?.answeredCount ?? 0),
            correctCount: Number(scoring?.correctCount ?? 0),
            wrongCount: Number(scoring?.wrongCount ?? 0),
            blankCount: Number(scoring?.blankCount ?? 0),
            wrongQuestions: (scoring?.wrongQuestions as number[]) || [],
          });
        });
      };

      // Her iki varyanttan da topla (tekrar edenleri ayıkla)
      await fetchFrom(rawKey);
      if (normalizedKey !== rawKey) {
        await fetchFrom(normalizedKey);
      }

      // Tekilleştir (testName + createdAt timestamp kullan)
      const seen = new Set<string>();
      const dedup = collected.filter((r) => {
        const k = `${r.testName}__${r.createdAt?.getTime?.() ?? "0"}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      // Tarihe göre sırala (yeniden eskiye)
      dedup.sort((a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0));

      // Toplamlar
      const totals = dedup.reduce(
        (acc, r) => {
          const den = r.correctCount + r.wrongCount + r.blankCount;
          acc.total += 1;
          acc.totalCorrect += r.correctCount;
          acc.totalWrong += r.wrongCount;
          acc.totalBlank += r.blankCount;
          if (den > 0) acc._scoreSum += (r.correctCount / den) * 100;
          const t = r.createdAt?.getTime?.();
          if (t && (!acc._last || t > acc._last)) acc._last = t;
          return acc;
        },
        { total: 0, totalCorrect: 0, totalWrong: 0, totalBlank: 0, _scoreSum: 0, _last: 0 as number | 0 }
      );

      const avg = totals.total > 0 ? Math.round(totals._scoreSum / totals.total) : 0;

      setRows(dedup);
      setAgg({
        total: totals.total,
        totalCorrect: totals.totalCorrect,
        totalWrong: totals.totalWrong,
        totalBlank: totals.totalBlank,
        avgScore: avg,
        lastActivity: totals._last ? new Date(totals._last) : null,
      });
    } catch (e) {
      console.error("Öğrenci submission yükleme hatası:", e);
      setRows([]);
      setAgg({ total: 0, totalCorrect: 0, totalWrong: 0, totalBlank: 0, avgScore: 0, lastActivity: null });
    } finally {
      setLoading(false);
    }
  };

  // Seçim değişince yükle
  useEffect(() => {
    if (selectedKey) void loadStudent(selectedKey);
  }, [selectedKey]);

  const filteredRows = useMemo(() => {
    const f = filter.trim().toLocaleLowerCase("tr-TR");
    if (!f) return rows;
    return rows.filter((r) => r.testName.toLocaleLowerCase("tr-TR").includes(f));
  }, [rows, filter]);

  return (
    <section className="min-h-screen bg-neutral-950 p-8 text-gray-100">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold">Öğrenci Raporları</h1>
            <p className="mt-1 text-sm text-neutral-400">
              Öğrencilerin çözdüğü testleri, doğru/yanlış dağılımını ve tarihçeyi görüntüleyin.
            </p>
          </div>

          {/* Öğrenci seçici */}
          <div className="flex gap-2">
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm ring-1 ring-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="" disabled>
                Öğrenci seçin
              </option>
              {nameKeys.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Test adı filtrele..."
              className="w-56 rounded-lg bg-neutral-900 px-4 py-2 text-sm ring-1 ring-neutral-800 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </header>

        {/* İstatistikler */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Users} label="Toplam Çözüm" value={agg.total} />
          <StatCard icon={Target} label="Ortalama Skor" value={<span>{agg.avgScore}%</span>} />
          <StatCard
            icon={BarChart3}
            label="Doğru / Yanlış / Boş"
            value={
              <div className="flex items-center gap-2">
                <Chip tone="emerald">{agg.totalCorrect} D</Chip>
                <Chip tone="rose">{agg.totalWrong} Y</Chip>
                <Chip tone="amber">{agg.totalBlank} B</Chip>
              </div>
            }
          />
          <StatCard icon={CalendarClock} label="Son Aktivite" value={fmtDate(agg.lastActivity)} />
        </div>

        {/* Tablo */}
        <div className="overflow-x-auto rounded-xl bg-neutral-900 ring-1 ring-neutral-800 shadow">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-neutral-900/90 backdrop-blur">
              <tr className="text-neutral-300">
                <th className="px-4 py-3 font-semibold">Tarih</th>
                <th className="px-4 py-3 font-semibold">Test</th>
                <th className="px-4 py-3 font-semibold">Kategori</th>
                <th className="px-4 py-3 font-semibold">Sınıf</th>
                <th className="px-4 py-3 font-semibold">Doğru</th>
                <th className="px-4 py-3 font-semibold">Yanlış</th>
                <th className="px-4 py-3 font-semibold">Boş</th>
                <th className="px-4 py-3 font-semibold">Skor</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-neutral-400">
                    Yükleniyor…
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-neutral-400">
                    Kayıt bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r) => {
                  const den = r.correctCount + r.wrongCount + r.blankCount;
                  const p = percent(r.correctCount, den);
                  return (
                    <tr key={`${r.id}-${r.createdAt?.getTime?.() ?? 0}`} className="border-t border-neutral-800">
                      <td className="px-4 py-3 text-neutral-300">{fmtDate(r.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{r.testName}</span>
                          {r.link ? (
                            <a
                              href={r.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-indigo-200"
                              title="Testi aç"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.category ? (
                          <span className="inline-flex items-center gap-1 text-xs text-neutral-300">
                            <FileText className="h-3.5 w-3.5 text-neutral-400" />
                            {r.category}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{r.grade ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-emerald-300">{r.correctCount}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-rose-300">{r.wrongCount}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-amber-300">{r.blankCount}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 rounded bg-neutral-800">
                            <motion.div
                              className="h-2 rounded bg-emerald-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${p}%` }}
                              transition={{ type: "spring", stiffness: 120, damping: 15 }}
                            />
                          </div>
                          <span className="text-neutral-300">{p}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <RowDetails wrong={r.wrongQuestions} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
          <span className="inline-flex items-center gap-1">
            <ClipboardList className="h-3.5 w-3.5 text-emerald-300" />
            Doğru
          </span>
          <span className="inline-flex items-center gap-1">
            <ClipboardList className="h-3.5 w-3.5 text-rose-300" />
            Yanlış
          </span>
          <span className="inline-flex items-center gap-1">
            <ClipboardList className="h-3.5 w-3.5 text-amber-300" />
            Boş
          </span>
        </div>
      </div>
    </section>
  );
}
