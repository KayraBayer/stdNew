// src/pages/OptikForm.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  limit,
  type DocumentData,
  doc,
  updateDoc, // ✅ update için
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useAuth } from "../context/authContext";
import { useLocation } from "react-router-dom";

/* ——— Tipler ——— */
type LocationState =
  | {
      testName?: string | null;
      testId?: string | null;
      testCat?: string | null; // (varsa doğrudan bu koleksiyonda ara)
      testGrade?: number | null;
      testLink?: string | null;
      studentName?: string | null;
      nameKey?: string | null; // submission koleksiyon adı override
    }
  | null;

type Msg =
  | { type: "ok"; text: string }
  | { type: "err"; text: string };

const OPTIONS = ["A", "B", "C", "D"] as const;
type Option = (typeof OPTIONS)[number];

type AnswersMap = Record<number, Option>;

type UserLite = {
  uid?: string | null;
  email?: string | null;
};

type TestDocData = {
  name?: string;
  link?: string;
  grade?: number;
  questionCount?: number;
  count?: number;
  duration?: number | null;
  answerKey?: string;
  createdAt?: { toDate?: () => Date };
};

/* ——— Yardımcılar ——— */
const toCollectionName = (str?: string | null): string =>
  (str || "unknown")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);

const Chip: React.FC<{
  children: React.ReactNode;
  color?: "indigo" | "emerald" | "slate" | "rose";
}> = ({ children, color = "indigo" }) => {
  const map: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    slate: "bg-slate-50 text-slate-700 ring-slate-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${map[color]}`}>
      {children}
    </span>
  );
};

/* ——— Skorlayıcı ——— */
function scoreAnswers(params: { answersArray: Array<Option | "-">; answerKey: string }) {
  const { answersArray, answerKey } = params;
  const key = answerKey.trim().toUpperCase();
  const N = Math.min(answersArray.length, key.length);

  let correct = 0;
  let wrong = 0;
  let blank = 0;
  const wrongQuestions: number[] = [];
  const correctQuestions: number[] = [];
  const blankQuestions: number[] = [];

  for (let i = 0; i < N; i++) {
    const userAns = answersArray[i];
    const keyAns = key[i] as Option | undefined;
    if (!userAns || userAns === "-") {
      blank++;
      blankQuestions.push(i + 1);
    } else if (keyAns && userAns === keyAns) {
      correct++;
      correctQuestions.push(i + 1);
    } else {
      wrong++;
      wrongQuestions.push(i + 1);
    }
  }

  return {
    correctCount: correct,
    wrongCount: wrong,
    blankCount: blank,
    wrongQuestions,
    correctQuestions,
    blankQuestions,
    compared: N,
    keyLength: key.length,
  };
}

/* ——— Belirli kategoride bul ——— */
async function findInCategory(category: string, testName: string) {
  const snap = await getDocs(
    query(collection(db, category), where("name", "==", testName), limit(1))
  );
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  const data = docSnap.data() as TestDocData;
  return { category, data, id: docSnap.id };
}

/* ——— Test adından kategoriyi bul ——— */
async function findTestByNameWithCategory(testName: string, hintedCategory?: string | null) {
  if (hintedCategory) {
    const hit = await findInCategory(hintedCategory, testName);
    if (hit) return { ...hit, type: "hint" as const };
  }

  const [normCatsSnap, specialCatsSnap] = await Promise.all([
    getDocs(collection(db, "kategoriAdlari")),
    getDocs(collection(db, "ozelKategoriler")),
  ]);

  const normCats = normCatsSnap.docs
    .map((d) => String((d.data() as DocumentData)?.name || "").trim())
    .filter(Boolean);
  const specialCats = specialCatsSnap.docs
    .map((d) => String((d.data() as DocumentData)?.name || "").trim())
    .filter(Boolean);

  for (const cat of normCats) {
    const hit = await findInCategory(cat, testName);
    if (hit) return { ...hit, type: "normal" as const };
  }
  for (const cat of specialCats) {
    const hit = await findInCategory(cat, testName);
    if (hit) return { ...hit, type: "special" as const };
  }

  return null;
}

/* ——— Ödev TAMAMLAMA: <nameKey>_odevler içinde test.category + test.name eşleşiyorsa ve status=='assigned' ise update ——— */
async function completeAssignmentsByCatAndName(params: {
  nameKey: string;
  category: string;
  testName: string;
}) {
  const { nameKey, category, testName } = params;
  const collName = `${nameKey}_odevler`;

  try {
    // Tam üç koşullu sorgu (index isteyebilir)
    try {
      const snap = await getDocs(
        query(
          collection(db, collName),
          where("status", "==", "assigned"),
          where("test.category", "==", category),
          where("test.name", "==", testName)
        )
      );
      await Promise.all(
        snap.docs.map((d) =>
          updateDoc(doc(db, collName, d.id), {
            status: "completed",     // ✅ string durum güncelle
            completedAt: serverTimestamp(),
          })
        )
      );
      return;
    } catch {
      // Fallback: yalnızca status ile çek, client'ta hem category hem name filtresi uygula
      const tmp = await getDocs(
        query(collection(db, collName), where("status", "==", "assigned"))
      );
      const filtered = tmp.docs.filter((d) => {
        const data = d.data() as DocumentData;
        const t = (data.test || {}) as Record<string, unknown>;
        return String(t.category || "").trim() === category && String(t.name || "").trim() === testName;
      });
      await Promise.all(
        filtered.map((d) =>
          updateDoc(doc(db, collName, d.id), {
            assigned: false,
            status: "completed",
            completedAt: serverTimestamp(),
          })
        )
      );
    }
  } catch (e) {
    console.warn("Ödevi tamamlarken hata:", e);
  }
}

export default function OptikForm(): React.ReactElement {
  const { user } = useAuth() as { user: UserLite | null };
  const { state } = useLocation() as { state: LocationState };

  // —— URL & state paramları —— //
  const params = new URLSearchParams(window.location.search);
  const count = Math.max(1, parseInt(params.get("count") || "20", 10));
  const testName = params.get("test") || state?.testName || "Adsız Test";
  const testId = params.get("id") || state?.testId || null;
  const hintedCat = params.get("cat") || state?.testCat || null; // varsa direkt denenecek
  const testGrade = params.get("grade")
    ? parseInt(params.get("grade") as string, 10)
    : state?.testGrade ?? null;
  const testLink = params.get("link") || state?.testLink || null;

  // Öğrenci adı önce state / URL’den gelsin, yoksa DB’den çek
  const initialStudent = (state?.studentName || params.get("student") || "").trim();
  const [studentName, setStudentName] = useState<string>(initialStudent);

  const rows = useMemo<number[]>(
    () => Array.from({ length: count }, (_, i) => i + 1),
    [count]
  );

  const [answers, setAnswers] = useState<AnswersMap>({});
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false); // ✅ Kaydetme tamamlandıktan sonra butonları kilitle
  const [msg, setMsg] = useState<Msg | null>(null);
  const answered = useMemo(() => Object.keys(answers).length, [answers]);

  // Renklendirme için sonuç (doğru şıkları göstermiyoruz)
  const [result, setResult] = useState<null | {
    wrongQuestions: number[];
    correctQuestions: number[];
    blankQuestions: number[];
  }>(null);

  // Öğrenci adı state/URL ile gelmediyse, DB’den çek (fallback)
  useEffect(() => {
    let cancelled = false;
    if (studentName) return; // isim zaten var, sorguya gerek yok
    const fetchStudentName = async () => {
      try {
        if (!user?.email) return;
        const qref = query(collection(db, "students"), where("email", "==", user.email), limit(1));
        const snap = await getDocs(qref);
        if (cancelled) return;

        if (!snap.empty) {
          const data = snap.docs[0].data() as Record<string, unknown>;
          const first = (data.firstname || data.firstName || "") as string;
          const last = (data.lastname || data.lastName || "") as string;
          const full = `${first} ${last}`.trim();
          setStudentName(full || (user.email?.split("@")[0] ?? "Bilinmeyen"));
        } else {
          setStudentName(user.email?.split("@")[0] ?? "Bilinmeyen");
        }
      } catch {
        if (!cancelled) setStudentName(user?.email?.split("@")[0] ?? "Bilinmeyen");
      }
    };
    fetchStudentName();
    return () => {
      cancelled = true;
    };
  }, [user, studentName]);

  const handlePick = (qNo: number, opt: Option) => setAnswers((p) => ({ ...p, [qNo]: opt }));

  const handleClear = () => {
    if (submitted) return; // ✅ gönderim sonrası temizlemeye izin verme
    setAnswers({});
    setMsg(null);
    setResult(null);
  };

  const handleSubmit = async () => {
    setMsg(null);
    if (!user) {
      setMsg({ type: "err", text: "Giriş yapmadan cevap gönderemezsiniz." });
      return;
    }

    // cevapları tek string + dizi
    let answersString = "";
    const answersArray: Array<Option | "-"> = Array.from({ length: count }, (_, i) => {
      const v = answers[i + 1] ?? "-";
      answersString += v;
      return v;
    });

    setSaving(true);
    try {
      // 1) Testi (ve kategorisini) bul -> cevap anahtarını al
      const found = await findTestByNameWithCategory(testName, hintedCat);

      const nameKeyNormalized =
        (state?.nameKey && typeof state.nameKey === "string" && state.nameKey
          ? state.nameKey
          : toCollectionName(studentName)
        )
          .toLocaleLowerCase("tr-TR");

      if (!found) {
        // Yine de submission kaydet ama skor olmadan
        const collectionName = nameKeyNormalized;

        const payloadNoKey = {
          type: "submission" as const,
          test: {
            id: testId,
            name: testName,
            category: hintedCat ?? null,
            grade: testGrade,
            link: testLink,
          },
          user: { uid: user.uid || null, email: user.email || null, name: studentName || null },
          count,
          answeredCount: answered,
          answers: answersString,
          answersArray,
          answersMap: answers,
          createdAt: serverTimestamp(),
          scoring: { status: "missing-key" },
        };

        await addDoc(collection(db, collectionName), payloadNoKey);

        // ✅ Ödevi TAMAMLA (kategori varsa)
        if (hintedCat) {
          await completeAssignmentsByCatAndName({
            nameKey: nameKeyNormalized,
            category: hintedCat,
            testName,
          });
        }

        setSubmitted(true); // ✅ kayıttan sonra hem "Kaydet" hem "Temizle" inaktif
        setResult(null);
        setMsg({
          type: "err",
          text:
            "Cevaplar kaydedildi fakat test anahtarı bulunamadı; sonuç hesaplanamadı. (Kategori eşleşmedi)",
        });
        return;
      }

      const { category, data } = found;
      const key = String(data?.answerKey || "").trim().toUpperCase();
      if (!key) {
        // Anahtar yoksa yine skorlayamayız
        const collectionName = nameKeyNormalized;

        const payloadNoKey = {
          type: "submission" as const,
          test: {
            id: testId,
            name: testName,
            category,
            grade: testGrade ?? (data?.grade ?? null),
            link: testLink ?? (data?.link ?? null),
          },
          user: { uid: user.uid || null, email: user.email || null, name: studentName || null },
          count,
          answeredCount: answered,
          answers: answersString,
          answersArray,
          answersMap: answers,
          createdAt: serverTimestamp(),
          scoring: { status: "missing-key" },
        };

        await addDoc(collection(db, collectionName), payloadNoKey);

        // ✅ Ödevi TAMAMLA
        await completeAssignmentsByCatAndName({
          nameKey: nameKeyNormalized,
          category,
          testName,
        });

        setSubmitted(true); // ✅ butonları kilitle
        setResult(null);
        setMsg({
          type: "err",
          text:
            "Cevaplar kaydedildi fakat bu test için cevap anahtarı bulunamadı; sonuç hesaplanamadı.",
        });
        return;
      }

      // 2) Skorla
      const {
        correctCount,
        wrongCount,
        blankCount,
        wrongQuestions,
        correctQuestions,
        blankQuestions,
        compared,
        keyLength,
      } = scoreAnswers({ answersArray, answerKey: key });

      // 3) Submission yaz
      const collectionName = nameKeyNormalized;

      const payload = {
        type: "submission" as const,
        test: {
          id: testId,
          name: testName, // — Test adını da tut
          category, // — Adından ulaşılan kategori (koleksiyon)
          grade: testGrade ?? (data?.grade ?? null),
          link: testLink ?? (data?.link ?? null),
        },
        user: { uid: user.uid || null, email: user.email || null, name: studentName || null },
        count,
        answeredCount: answered,
        answers: answersString,
        answersArray,
        answersMap: answers,
        createdAt: serverTimestamp(),
        scoring: {
          status: "ok",
          answerKey: key,
          keyLength,
          compared, // kaç soru karşılaştırıldı
          correctCount,
          wrongCount,
          blankCount,
          wrongQuestions, // yanlış soruların numaraları
          correctQuestions,
          blankQuestions,
        },
      };

      await addDoc(collection(db, collectionName), payload);

      // ✅ Ödevi TAMAMLA
      await completeAssignmentsByCatAndName({
        nameKey: nameKeyNormalized,
        category,
        testName,
      });

      setSubmitted(true); // ✅ başarılı kayıttan sonra da kilitle
      setResult({ wrongQuestions, correctQuestions, blankQuestions });
      setMsg({
        type: "ok",
        text: `Cevaplar kaydedildi. Doğru: ${correctCount}, Yanlış: ${wrongCount}, Boş: ${blankCount}.`,
      });
    } catch (e) {
      console.error(e);
      setMsg({ type: "err", text: "Kaydetme sırasında bir hata oluştu." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="min-h-screen bg-slate-50 px-5 py-8 text-slate-800 md:px-6">
      <div className="mx-auto max-w-5xl">
        {/* Başlık + etiketler */}
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Optik Cevap Formu
          </h1>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Chip color="slate">
              Öğrenci: <span className="font-semibold">{studentName || "—"}</span>
            </Chip>
            <Chip color="indigo">
              Test: <span className="font-semibold">{testName}</span>
            </Chip>
            {hintedCat ? (
              <Chip color="rose">
                Kategori: <span className="font-semibold">{hintedCat}</span>
              </Chip>
            ) : null}
            <Chip color="emerald">
              İşaretlenen: <span className="font-semibold">{answered}</span> / {count}
            </Chip>
          </div>
        </div>

        {/* Bildirim */}
        {msg && (
          <div
            className={`mb-4 rounded-xl px-4 py-3 text-sm ring-1 ${
              msg.type === "ok"
                ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                : "bg-rose-50 text-rose-700 ring-rose-100"
            }`}
          >
            {msg.text}
          </div>
        )}

        {/* Kart */}
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="overflow-x-auto rounded-xl">
            <table className="w-full border-separate border-spacing-0 text-center text-sm">
              <thead className="sticky top-0 z-10 bg-indigo-50 text-indigo-800">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-3 text-left text-[13px] font-semibold">
                    Soru
                  </th>
                  {OPTIONS.map((h) => (
                    <th
                      key={h}
                      className="border-b border-slate-200 px-3 py-3 text-[13px] font-semibold"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {rows.map((n) => {
                  const isWrong = submitted && result?.wrongQuestions.includes(n);
                  const isCorrect = submitted && result?.correctQuestions.includes(n);
                  const baseZebra = n % 2 ? "bg-slate-50" : "bg-white";
                  const rowBg = isWrong ? "bg-rose-50" : isCorrect ? "bg-emerald-50" : baseZebra;
                  const rowOutline = isWrong
                    ? "outline outline-1 outline-rose-200"
                    : isCorrect
                    ? "outline outline-1 outline-emerald-200"
                    : "";

                  return (
                    <tr key={n} className={`transition-colors hover:bg-indigo-50/40 ${rowBg} ${rowOutline}`}>
                      <td className="border-b border-slate-200 px-3 py-2.5 text-left font-medium">
                        {n}
                      </td>
                      {OPTIONS.map((opt) => {
                        const id = `q${n}-${opt}`;
                        const checked = answers[n] === opt;
                        return (
                          <td key={opt} className="border-b border-slate-200 px-3 py-2.5">
                            <input
                              id={id}
                              type="radio"
                              name={`q${n}`}
                              value={opt}
                              className="sr-only peer"
                              checked={!!checked}
                              onChange={() => setAnswers((p) => ({ ...p, [n]: opt }))}
                              disabled={submitted} // gönderim sonrası kapalı
                            />
                            <label
                              htmlFor={id}
                              className={`inline-flex h-5 w-5 items-center justify-center rounded-full ring-1 ring-slate-300 transition
                                         hover:ring-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
                                         peer-checked:bg-indigo-600 peer-checked:ring-indigo-300
                                         ${submitted ? "opacity-60 pointer-events-none" : ""}`}
                              title={opt}
                            >
                              <span className="block h-2.5 w-2.5 rounded-full bg-white opacity-0 transition-opacity peer-checked:opacity-100" />
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Alt bar */}
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row">
            <div className="h-2 w-full rounded-full bg-slate-100 sm:max-w-xs">
              <div
                className="h-2 rounded-full bg-indigo-300"
                style={{ width: `${(answered / count) * 100}%` }}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClear}
                disabled={saving || submitted}
                className={`rounded-lg px-4 py-2 text-sm font-medium ring-1 transition-colors focus:outline-none
                  ${
                    saving || submitted
                      ? "bg-white text-slate-400 ring-slate-200 cursor-not-allowed"
                      : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-400"
                  }`}
              >
                Temizle
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || submitted}
                className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
                            ${
                              saving || submitted
                                ? "cursor-not-allowed bg-indigo-400"
                                : "bg-indigo-600 hover:bg-indigo-500"
                            }`}
              >
                {submitted ? "Kaydedildi" : saving ? "Kaydediliyor..." : "Cevapları Kaydet"}
              </button>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          İpucu: Hücrelere tıklayarak işaretleyebilir, <span className="font-medium">Temizle</span> ile
          sıfırlayabilirsiniz.
        </p>
      </div>
    </section>
  );
}
