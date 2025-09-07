// src/pages/SolvedTests.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDoc,
  getDocs,
  doc,
  query,
  where,
  limit,
  type DocumentData,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { useAuth } from "./context/authContext";
import { useNavigate } from "react-router-dom";

/* ───────── Helpers ───────── */
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

/* ───────── Types ───────── */
type AuthCtx = { user: { uid: string; email?: string | null } | null };

type Submission = {
  id: string;
  test: {
    id?: string | null;
    name?: string | null;
    category?: string | null;
    grade?: number | null;
    link?: string | null;
  };
  count: number; // toplam soru
  answeredCount: number;
  createdAt?: Date | null;
  scoring?: {
    status?: "ok" | "missing-key";
    compared?: number;
    correctCount?: number;
    wrongCount?: number;
    blankCount?: number;
  };
};

type Stats = {
  submissions: number;
  compared: number;
  correct: number;
  wrong: number;
  blank: number;
  accuracy: number; // 0..1 (boşlar hariç)
};

const initialStats: Stats = {
  submissions: 0,
  compared: 0,
  correct: 0,
  wrong: 0,
  blank: 0,
  accuracy: 0,
};

/* ───────── Page ───────── */
export default function SolvedTests(): React.ReactElement {
  const { user } = useAuth() as AuthCtx;
  const navigate = useNavigate();

  const [studentName, setStudentName] = useState<string>("");
  const [nameKey, setNameKey] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState<Submission[]>([]);

  // Öğrenci adı & nameKey bul (UID dokümanı > email sorgusu)
  useEffect(() => {
    (async () => {
      try {
        if (!user) {
          setStudentName("");
          setNameKey("");
          setLoading(false);
          return;
        }

        // 1) students/{uid} dene
        let first = "";
        let last = "";
        try {
          const snap = await getDoc(doc(db, "students", user.uid));
          if (snap.exists()) {
            const d = snap.data() as Record<string, unknown>;
            first = clean(d.firstName ?? d.firstname);
            last = clean(d.lastName ?? d.lastname);
          }
        } catch {
          /* ignore */
        }

        // 2) yoksa email ile ara
        if (!first && user.email) {
          try {
            const qref = query(
              collection(db, "students"),
              where("email", "==", user.email),
              limit(1)
            );
            const qsnap = await getDocs(qref);
            if (!qsnap.empty) {
              const d = qsnap.docs[0].data() as Record<string, unknown>;
              first = clean(d.firstName ?? d.firstname);
              last = clean(d.lastName ?? d.lastname);
            }
          } catch {
            /* ignore */
          }
        }

        const full =
          `${first} ${last}`.trim() || (user.email?.split("@")[0] ?? "bilinmeyen");
        const nk = toCollectionName(full);

        setStudentName(full);
        setNameKey(nk);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // Gönderimleri çek
  useEffect(() => {
    (async () => {
      if (!nameKey) return;
      setLoading(true);
      try {
        const qref = query(collection(db, nameKey), where("type", "==", "submission"));
        const snap = await getDocs(qref);
        const items: Submission[] = snap.docs.map((d) => {
          const data = d.data() as DocumentData;
          const ts = data.createdAt?.toDate?.() ?? null;
          return {
            id: d.id,
            test: {
              id: data?.test?.id ?? null,
              name: data?.test?.name ?? null,
              category: data?.test?.category ?? null,
              grade: typeof data?.test?.grade === "number" ? data.test.grade : null,
              link: data?.test?.link ?? null,
            },
            count: typeof data.count === "number" ? data.count : 0,
            answeredCount:
              typeof data.answeredCount === "number" ? data.answeredCount : 0,
            createdAt: ts,
            scoring: data.scoring ?? {},
          };
        });

        // Yeni > eski sırala
        items.sort((a, b) => {
          const ta = a.createdAt?.getTime?.() ?? 0;
          const tb = b.createdAt?.getTime?.() ?? 0;
          return tb - ta;
        });

        setSubs(items);
      } catch (e) {
        console.error("Gönderimler alınamadı:", e);
        setSubs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [nameKey]);

  // Toplu istatistikler
  const stats = useMemo<Stats>(() => {
    if (!subs.length) return initialStats;
    let compared = 0,
      correct = 0,
      wrong = 0,
      blank = 0;

    for (const s of subs) {
      const sc = s.scoring;
      if (sc?.status === "ok") {
        compared += sc.compared || 0;
        correct += sc.correctCount || 0;
        wrong += sc.wrongCount || 0;
        blank += sc.blankCount || 0;
      }
    }
    const denom = compared;
    return {
      submissions: subs.length,
      compared,
      correct,
      wrong,
      blank,
      accuracy: denom > 0 ? correct / denom : 0,
    };
  }, [subs]);

  // Eğer giriş yoksa uyarı
  if (!user) {
    return (
      <section className="min-h-screen bg-slate-50 grid place-items-center px-4">
        <div className="max-w-md rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 text-center">
          <h1 className="mb-2 text-xl font-bold text-slate-900">Çözdüğüm Testler</h1>
          <p className="text-sm text-slate-600">
            Bu sayfayı görmek için giriş yapmalısınız.
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Giriş Sayfasına Dön
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-slate-50 px-3 py-6 sm:px-5 sm:py-8 md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col items-center justify-between gap-2 sm:mb-8 sm:flex-row">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
            Çözdüğüm Testler
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
              Öğrenci: <span className="font-semibold">{studentName || "—"}</span>
            </span>
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-100">
              Toplam Test: <span className="font-semibold">{stats.submissions}</span>
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
              Doğruluk:{" "}
              <span className="font-semibold">
                {(stats.accuracy * 100).toFixed(1)}%
              </span>
            </span>
          </div>
        </div>

        {/* İstatistik kartları */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:grid-cols-4">
          <div className="rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-100">
            <div className="text-2xl font-extrabold text-emerald-700">
              {stats.correct}
            </div>
            <div className="mt-1 text-xs font-medium text-emerald-700/80">Doğru</div>
          </div>
          <div className="rounded-lg bg-rose-50 p-3 ring-1 ring-rose-100">
            <div className="text-2xl font-extrabold text-rose-700">{stats.wrong}</div>
            <div className="mt-1 text-xs font-medium text-rose-700/80">Yanlış</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
            <div className="text-2xl font-extrabold text-slate-700">{stats.blank}</div>
            <div className="mt-1 text-xs font-medium text-slate-700/80">Boş</div>
          </div>
          <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
            <div className="text-xl font-extrabold text-slate-900">{stats.compared}</div>
            <div className="mt-1 text-xs font-medium text-slate-600">
              Çözülen Soru
            </div>
          </div>
        </div>

        {/* Liste */}
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-slate-800">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-3 font-semibold">Tarih</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-semibold">Kategori</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-semibold">Test Adı</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-semibold">Sınıf</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-semibold text-center">Doğru</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-semibold text-center">Yanlış</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-semibold text-center">Boş</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-semibold text-center">Doğruluk</th>
                  <th className="border-b border-slate-200 px-3 py-3 font-semibold text-center">Test</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                      Yükleniyor…
                    </td>
                  </tr>
                ) : subs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                      Henüz gönderim yok.
                    </td>
                  </tr>
                ) : (
                  subs.map((s, idx) => {
                    const sc = s.scoring || {};
                    const denom = sc?.compared ?? 0;
                    const acc = denom > 0 ? (sc.correctCount || 0) / denom : 0;
                    const date =
                      s.createdAt
                        ? s.createdAt.toLocaleString("tr-TR")
                        : "—";
                    const zebra = idx % 2 ? "bg-white" : "bg-slate-50";

                    return (
                      <tr key={s.id} className={`${zebra}`}>
                        <td className="border-b border-slate-200 px-3 py-2">{date}</td>
                        <td className="border-b border-slate-200 px-3 py-2">
                          {s.test.category || "—"}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2">
                          <span title={s.test.name || ""} className="line-clamp-2">
                            {s.test.name || "—"}
                          </span>
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2">
                          {s.test.grade ?? "—"}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 text-center text-emerald-700 font-semibold">
                          {sc.correctCount ?? "—"}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 text-center text-rose-700 font-semibold">
                          {sc.wrongCount ?? "—"}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 text-center">
                          {sc.blankCount ?? "—"}
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 text-center">
                          {(acc * 100).toFixed(1)}%
                        </td>
                        <td className="border-b border-slate-200 px-3 py-2 text-center">
                          {s.test.link ? (
                            <a
                              href={s.test.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-md bg-white px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50"
                            >
                              Aç
                            </a>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
          >
            Geri
          </button>
        </div>
      </div>
    </section>
  );
}
