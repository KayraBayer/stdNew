// src/jss/adminAssignTests.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDoc,
  getDocs,
  query,
  where,
  doc,
  addDoc,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import {
  Users,
  Layers,
  Send,
  Search,
  RefreshCw,
  Filter,
  CheckSquare,
  Square,
} from "lucide-react";

/* ——— Yardımcılar ——— */
const toCollectionName = (str?: string | null): string =>
  (str || "unknown")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120)
    .toLowerCase();

/* ——— Tipler ——— */
type NameIndex = Record<string, boolean>;

type TestRow = {
  uid: string;                 // unique row id: `${category}__${doc.id}`
  id: string;                  // firestore doc id
  name: string;
  category: string;            // koleksiyon adı
  grade: number | null;
  link?: string | null;
  questionCount?: number | null;
  isSpecial?: boolean;         // ozelKategoriler’den mi geldi
};

export default function AdminAssignTests(): React.ReactElement {
  /* ——— Durumlar ——— */
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingTests, setLoadingTests] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const [nameIndex, setNameIndex] = useState<NameIndex>({});
  const studentKeys = useMemo(
    () => Object.keys(nameIndex).filter((k) => nameIndex[k]).sort((a, b) => a.localeCompare(b, "tr")),
    [nameIndex]
  );

  const [tests, setTests] = useState<TestRow[]>([]);
  const [gradeFilter, setGradeFilter] = useState<string>(""); // "", "5", "6", "7", "8"
  const [search, setSearch] = useState<string>("");

  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());

  /* ——— Öğrenci ad anahtarlarını çek: ogrenciAdlari/_index ——— */
  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const snap = await getDoc(doc(db, "ogrenciAdlari", "_index"));
      const names = (snap.exists() ? (snap.data()?.names as NameIndex) : {}) || {};
      setNameIndex(names);
    } catch (e) {
      console.error("ogrenciAdlari/_index okunamadı:", e);
      setNameIndex({});
    } finally {
      setLoadingStudents(false);
    }
  };

  /* ——— Tüm testleri çek (kategoriAdlari + ozelKategoriler) ——— */
  const fetchAllTests = async (grade?: number | null) => {
    setLoadingTests(true);
    try {
      // 1) Kategori listelerini al
      const [normCatsSnap, specialCatsSnap] = await Promise.all([
        getDocs(collection(db, "kategoriAdlari")),
        getDocs(collection(db, "ozelKategoriler")),
      ]);

      const normCats = normCatsSnap.docs
        .map((d: QueryDocumentSnapshot<DocumentData>) => String((d.data()?.name ?? "") as string).trim())
        .filter(Boolean);

      const specialCats = specialCatsSnap.docs
        .map((d: QueryDocumentSnapshot<DocumentData>) => String((d.data()?.name ?? "") as string).trim())
        .filter(Boolean);

      const collected: TestRow[] = [];

      const pullCat = async (catName: string, isSpecial: boolean) => {
        const baseRef = collection(db, catName);
        const snap = grade
          ? await getDocs(query(baseRef, where("grade", "==", grade)))
          : await getDocs(baseRef);

        snap.forEach((docu) => {
          const data = docu.data() as DocumentData;
          collected.push({
            uid: `${catName}__${docu.id}`,
            id: docu.id,
            name: String(data?.name ?? "—"),
            category: catName,
            grade: (data?.grade ?? null) as number | null,
            link: (data?.link ?? null) as string | null,
            questionCount: (data?.questionCount ?? data?.count ?? null) as number | null,
            isSpecial,
          });
        });
      };

      // Normal kategoriler
      for (const c of normCats) {
        await pullCat(c, false);
      }
      // Özel kategoriler
      for (const c of specialCats) {
        await pullCat(c, true);
      }

      // Ada göre sıralama
      collected.sort((a, b) => a.name.localeCompare(b.name, "tr"));

      setTests(collected);
    } catch (e) {
      console.error("Test listesi getirilemedi:", e);
      setTests([]);
    } finally {
      setLoadingTests(false);
    }
  };

  /* ——— İlk yükleme ——— */
  useEffect(() => {
    void fetchStudents();
    void fetchAllTests(null);
  }, []);

  /* ——— Sınıf filtresi değişince testleri yenile ——— */
  useEffect(() => {
    const g = gradeFilter ? parseInt(gradeFilter, 10) : null;
    void fetchAllTests(g);
    // seçimler kalsın, isteyen temizler
    // setSelectedTests(new Set());
  }, [gradeFilter]);

  /* ——— Filtrelenmiş testler (arama + sınıf zaten fetch’de filtreleniyor) ——— */
  const filteredTests = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    if (!q) return tests;
    return tests.filter(
      (t) =>
        t.name.toLocaleLowerCase("tr-TR").includes(q) ||
        t.category.toLocaleLowerCase("tr-TR").includes(q)
    );
  }, [tests, search]);

  /* ——— Öğrenci seçimleri ——— */
  const toggleStudent = (key: string) =>
    setSelectedStudents((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const selectAllStudents = () => setSelectedStudents(new Set(studentKeys));
  const clearStudents = () => setSelectedStudents(new Set());

  /* ——— Test seçimleri ——— */
  const toggleTest = (uid: string) =>
    setSelectedTests((prev) => {
      const n = new Set(prev);
      if (n.has(uid)) n.delete(uid);
      else n.add(uid);
      return n;
    });

  const pageSelectAllTests = () =>
    setSelectedTests((prev) => {
      const n = new Set(prev);
      filteredTests.forEach((t) => n.add(t.uid));
      return n;
    });

  const clearTests = () => setSelectedTests(new Set());

  /* ——— Atama ———
      Her öğrenci için ayrı bir koleksiyon: `${nameKey}_odevler`
      İçerik: { type: 'assignment', status: 'assigned', assignedAt, test: {...} }
  ——— */
  const handleAssign = async () => {
    if (assigning) return;
    if (selectedStudents.size === 0 || selectedTests.size === 0) {
      alert("Lütfen en az bir öğrenci ve en az bir test seçin.");
      return;
    }

    setAssigning(true);
    try {
      const selectedTestRows = tests.filter((t) => selectedTests.has(t.uid));
      const studentList = Array.from(selectedStudents);

      let writeCount = 0;

      for (const key of studentList) {
        const nameKey = toCollectionName(key); // first_last formatını normalize et
        const collName = `${nameKey}_odevler`;

        for (const t of selectedTestRows) {
          const payload = {
            type: "assignment" as const,
            status: "assigned" as const,
            assignedAt: serverTimestamp(),
            test: {
              id: t.id,
              name: t.name,
              category: t.category,
              grade: t.grade ?? null,
              link: t.link ?? null,
              questionCount: t.questionCount ?? null,
              isSpecial: !!t.isSpecial,
            },
          };
          await addDoc(collection(db, collName), payload);
          writeCount += 1;
        }
      }

      alert(`Atama tamamlandı. Toplam ${writeCount} ödev belgesi yazıldı.`);
      // İstersen seçimleri temizleyebilirsin:
      // clearTests();
      // clearStudents();
    } catch (e) {
      console.error("Atama hatası:", e);
      alert("Atama sırasında bir hata oluştu.");
    } finally {
      setAssigning(false);
    }
  };

  /* ——— UI ——— */
  return (
    <section className="min-h-screen bg-neutral-950 p-8 text-gray-100">
      <div className="mx-auto max-w-7xl">
        {/* Başlık */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Test Atama</h1>
            <p className="mt-1 text-sm text-neutral-400">
              Testleri bir veya birden çok öğrenciye ödev olarak atayın. Her öğrenci için ayrı <span className="font-medium">_ödev koleksiyonu</span> açılır ve testler doküman olarak kaydedilir.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                void fetchStudents();
                const g = gradeFilter ? parseInt(gradeFilter, 10) : null;
                void fetchAllTests(g);
              }}
              className="inline-flex items-center gap-2 rounded-md bg-neutral-800 px-3 py-2 text-sm ring-1 ring-neutral-700 hover:bg-neutral-700"
              title="Yenile"
            >
              <RefreshCw className="h-4 w-4" />
              Yenile
            </button>
          </div>
        </div>

        {/* Üst panel: Filtreler & Atama özeti */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          {/* Sınıf filtresi */}
          <div className="rounded-xl bg-neutral-900 p-4 ring-1 ring-neutral-800">
            <div className="mb-2 flex items-center gap-2 text-neutral-300">
              <Filter className="h-4 w-4 text-neutral-400" />
              <span className="text-xs font-medium">Sınıfa Göre Filtrele</span>
            </div>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="w-full rounded-md bg-neutral-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">Tümü</option>
              <option value="5">5. Sınıf</option>
              <option value="6">6. Sınıf</option>
              <option value="7">7. Sınıf</option>
              <option value="8">8. Sınıf</option>
            </select>
            <p className="mt-2 text-xs text-neutral-400">
              Seçilen sınıf only olarak listelenir (atamada sınır yok).
            </p>
          </div>

          {/* Atama özeti */}
          <div className="rounded-xl bg-neutral-900 p-4 ring-1 ring-neutral-800">
            <div className="mb-3 flex items-center gap-2 text-neutral-300">
              <Layers className="h-4 w-4 text-neutral-400" />
              <span className="text-xs font-medium">Özet</span>
            </div>
            <div className="grid grid-cols-3 text-center text-sm">
              <div>
                <div className="text-2xl font-bold text-white">{tests.length}</div>
                <div className="mt-1 text-xs text-neutral-400">Toplam Test</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{selectedTests.size}</div>
                <div className="mt-1 text-xs text-neutral-400">Seçili Test</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{selectedStudents.size}</div>
                <div className="mt-1 text-xs text-neutral-400">Seçili Öğrenci</div>
              </div>
            </div>
          </div>

          {/* Atama butonu */}
          <div className="rounded-xl bg-neutral-900 p-4 ring-1 ring-neutral-800">
            <div className="mb-3 flex items-center gap-2 text-neutral-300">
              <Users className="h-4 w-4 text-neutral-400" />
              <span className="text-xs font-medium">Atama</span>
            </div>
            <button
              disabled={assigning || selectedStudents.size === 0 || selectedTests.size === 0}
              onClick={handleAssign}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white shadow
                focus:outline-none focus:ring-2 focus:ring-blue-600
                ${
                  assigning || selectedStudents.size === 0 || selectedTests.size === 0
                    ? "cursor-not-allowed bg-blue-500/50"
                    : "bg-blue-600 hover:bg-blue-500"
                }`}
            >
              <Send className="h-4 w-4" />
              {assigning ? "Atanıyor..." : "Seçili Testleri Seçili Öğrencilere Ata"}
            </button>
            <p className="mt-2 text-xs text-neutral-400">
              Her öğrenci için <code className="font-mono">{"<nameKey>_odevler"}</code> koleksiyonu oluşturulur/yazılır.
            </p>
          </div>
        </div>

        {/* Alt panel: Sol öğrenci listesi / Sağ test listesi */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Öğrenci listesi */}
          <div className="lg:col-span-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-neutral-300">
                <Users className="h-4 w-4 text-neutral-400" />
                <span>Öğrenciler</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={selectAllStudents}
                  disabled={loadingStudents || studentKeys.length === 0}
                  className="rounded-md bg-neutral-900 px-2 py-1 text-xs ring-1 ring-neutral-800 hover:bg-neutral-800"
                >
                  Tümünü Seç
                </button>
                <button
                  onClick={clearStudents}
                  disabled={selectedStudents.size === 0}
                  className="rounded-md bg-neutral-900 px-2 py-1 text-xs ring-1 ring-neutral-800 hover:bg-neutral-800"
                >
                  Temizle
                </button>
              </div>
            </div>
            <div className="h-[480px] overflow-auto rounded-xl bg-neutral-900 ring-1 ring-neutral-800">
              {loadingStudents ? (
                <div className="p-4 text-center text-sm text-neutral-400">Öğrenciler yükleniyor…</div>
              ) : studentKeys.length === 0 ? (
                <div className="p-4 text-center text-sm text-neutral-400">Öğrenci bulunamadı.</div>
              ) : (
                <ul className="divide-y divide-neutral-800">
                  {studentKeys.map((k) => {
                    const selected = selectedStudents.has(k);
                    return (
                      <li key={k}>
                        <button
                          onClick={() => toggleStudent(k)}
                          className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-800 ${
                            selected ? "bg-neutral-800/70" : ""
                          }`}
                        >
                          <span className="truncate">{k}</span>
                          {selected ? (
                            <CheckSquare className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Square className="h-4 w-4 text-neutral-500" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Test listesi */}
          <div className="lg:col-span-8">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-neutral-300">
                <Layers className="h-4 w-4 text-neutral-400" />
                <span>Testler</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-md bg-neutral-900 px-2 py-1 ring-1 ring-neutral-800">
                  <Search className="h-4 w-4 text-neutral-500" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Test veya kategori ara…"
                    className="w-56 bg-transparent text-sm placeholder:text-neutral-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={pageSelectAllTests}
                  disabled={loadingTests || filteredTests.length === 0}
                  className="rounded-md bg-neutral-900 px-2 py-1 text-xs ring-1 ring-neutral-800 hover:bg-neutral-800"
                >
                  Sayfadakileri Seç
                </button>
                <button
                  onClick={clearTests}
                  disabled={selectedTests.size === 0}
                  className="rounded-md bg-neutral-900 px-2 py-1 text-xs ring-1 ring-neutral-800 hover:bg-neutral-800"
                >
                  Temizle
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-neutral-800">
              {loadingTests ? (
                <div className="p-4 text-center text-sm text-neutral-400">Testler yükleniyor…</div>
              ) : filteredTests.length === 0 ? (
                <div className="p-4 text-center text-sm text-neutral-400">Test bulunamadı.</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-neutral-900/90 text-neutral-300">
                    <tr>
                      <th className="px-3 py-3 font-semibold">Seç</th>
                      <th className="px-3 py-3 font-semibold">Test Adı</th>
                      <th className="px-3 py-3 font-semibold">Kategori</th>
                      <th className="px-3 py-3 font-semibold">Sınıf</th>
                      <th className="px-3 py-3 font-semibold">Soru</th>
                      <th className="px-3 py-3 font-semibold">Tür</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTests.map((t) => {
                      const selected = selectedTests.has(t.uid);
                      return (
                        <tr key={t.uid} className="border-t border-neutral-800">
                          <td className="px-3 py-2">
                            <button
                              onClick={() => toggleTest(t.uid)}
                              className="rounded-md px-2 py-1 ring-1 ring-neutral-700 hover:bg-neutral-800"
                              title={selected ? "Kaldır" : "Seç"}
                            >
                              {selected ? (
                                <CheckSquare className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <Square className="h-4 w-4 text-neutral-500" />
                              )}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-white">{t.name}</td>
                          <td className="px-3 py-2 text-neutral-300">{t.category}</td>
                          <td className="px-3 py-2">{t.grade ?? "—"}</td>
                          <td className="px-3 py-2">{t.questionCount ?? "—"}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ${
                                t.isSpecial
                                  ? "bg-rose-500/10 text-rose-300 ring-rose-500/20"
                                  : "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
                              }`}
                            >
                              {t.isSpecial ? "Yayın" : "Normal"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
