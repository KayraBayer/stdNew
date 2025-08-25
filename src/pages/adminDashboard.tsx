// src/jss/adminDashboard.tsx
import React, { useEffect, useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
  addDoc,
  collection,
  getCountFromServer,
  getDocs,
  serverTimestamp,
  doc,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { auth, db, secondaryAuth } from "../firebaseConfig";
import { Link } from "react-router-dom";
import { BarChart3, Send } from "lucide-react";

/* ——— Tipler ——— */
type Stats = { students: number; tests: number };

type CategoryDoc = { id: string; name: string } & Record<string, unknown>;

type StudentForm = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
};

type NewTestCategory = { name: string };
type NewSlideCategory = { name: string; grade: string };
type NewSpecialCategory = { name: string };

type TestData = {
  collection: string;
  grade: string;
  name: string;
  link: string;
  questionCount: string;
  answerKey: string;
};

type SlideData = {
  collection: string;
  grade: string;
  name: string;
  link: string;
};

type ExamData = {
  grade: string;
  name: string;
  questionCount: string;
  duration: string;
  link: string;
};

/* ——— Doğrulamalar ——— */
const ANSWER_KEY_REGEX = /^[A-D]+$/i; // Sadece A–D harfleri

/* ——— Geçici parola üreticisi ——— */
const genTempPass = (): string =>
  Array.from({ length: 6 }, () => "0123456789".charAt(Math.floor(Math.random() * 10))).join("");

export default function AdminDashboard(): React.ReactElement {
  /* ────────────────── Sistem istatistikleri ────────────────── */
  const [stats, setStats] = useState<Stats>({ students: 0, tests: 0 });

  const fetchStats = async (): Promise<void> => {
    const studentsSnap = await getCountFromServer(collection(db, "students"));
    const testsSnap = await getCountFromServer(collection(db, "tests"));
    setStats({
      students: studentsSnap.data().count,
      tests: testsSnap.data().count,
    });
  };

  /* ────────────────── Kategoriler ────────────────── */
  const [testCategories, setTestCategories] = useState<CategoryDoc[]>([]);
  const [slideCategories, setSlideCategories] = useState<CategoryDoc[]>([]);
  // Özel ders için KATEGORİLER: "ozelKategoriler" koleksiyonundan
  const [specialCategories, setSpecialCategories] = useState<CategoryDoc[]>([]);

  const fetchTestCategories = async (): Promise<void> => {
    const snap = await getDocs(collection(db, "kategoriAdlari"));
    setTestCategories(
      snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({
        id: d.id,
        ...(d.data() as Record<string, unknown>),
      })) as CategoryDoc[]
    );
  };

  const fetchSlideCategories = async (): Promise<void> => {
    const snap = await getDocs(collection(db, "slaytKategoriAdlari"));
    setSlideCategories(
      snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({
        id: d.id,
        ...(d.data() as Record<string, unknown>),
      })) as CategoryDoc[]
    );
  };

  const fetchSpecialCategories = async (): Promise<void> => {
    const snap = await getDocs(collection(db, "ozelKategoriler"));
    setSpecialCategories(
      snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({
        id: d.id,
        ...(d.data() as Record<string, unknown>),
      })) as CategoryDoc[]
    );
  };

  /* ────────────────── İlk yükleme ────────────────── */
  useEffect(() => {
    void fetchStats();
    void fetchTestCategories();
    void fetchSlideCategories();
    void fetchSpecialCategories(); // özel ders kategorileri
  }, []);

  /* ────────────────── Öğrenci ekleme ────────────────── */
  const [studentForm, setStudentForm] = useState<StudentForm>({
    email: "",
    firstName: "",
    lastName: "",
    password: "",
  });

  const handleStudentChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setStudentForm((p) => ({ ...p, [name]: value }));
  };

  const slugifyTR = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // aksanları sil
    .trim()
    .replace(/\s+/g, "_")                             // boşlukları _
    .replace(/[^a-z0-9_]/g, "");                      // güvenli karakter seti

  const handleAddStudent = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const { email, firstName, lastName, password } = studentForm;
    if (!email || !firstName || !lastName || !password) return;

    try {
      // 1) Auth: secondary ile kullanıcı oluştur (admin oturumu bozulmaz)
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const uid = cred.user.uid;

      const key = slugifyTR(`${firstName} ${lastName}`);

      // 2) Firestore: batch ile atomik yaz
      const batch = writeBatch(db);

      // students/<uid>
      batch.set(doc(db, "students", uid), {
        email: String(email).toLowerCase(),
        firstName,
        lastName,
        createdAt: serverTimestamp(),
      });

      // ogrenciAdlari/<uid>
      batch.set(doc(db, "ogrenciAdlari", uid), { fullname: key }, { merge: true });

      // ogrenciAdlari/_index  → names[key] = true  (diğerlerini silmeden)
      batch.set(doc(db, "ogrenciAdlari", "_index"), { names: { [key]: true } }, { merge: true });

      await batch.commit();

      // 3) UI
      setStudentForm({ email: "", firstName: "", lastName: "", password: "" });
      await fetchStats();
      alert("Öğrenci eklendi.");
    } catch (err: any) {
      alert(err?.message || "Bir hata oluştu.");
    }
  };

  /* ────────────────── TEST kategorisi ekleme ────────────────── */
  const [newTestCategory, setNewTestCategory] = useState<NewTestCategory>({ name: "" });

  const handleAddTestCategory = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!newTestCategory.name) return;
    try {
      await addDoc(collection(db, "kategoriAdlari"), newTestCategory);
      setNewTestCategory({ name: "" });
      await fetchTestCategories();
      alert("Test kategorisi eklendi.");
    } catch (err: unknown) {
      alert((err as { message?: string })?.message ?? "Hata");
    }
  };

  /* ────────────────── ÖZEL DERS kategorisi ekleme ────────────────── */
  const [newSpecialCategory, setNewSpecialCategory] = useState<NewSpecialCategory>({ name: "" });

  const handleAddSpecialCategory = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!newSpecialCategory.name) return;
    try {
      await addDoc(collection(db, "ozelKategoriler"), newSpecialCategory);
      setNewSpecialCategory({ name: "" });
      await fetchSpecialCategories();
      alert("Özel ders kategorisi eklendi.");
    } catch (err: unknown) {
      alert((err as { message?: string })?.message ?? "Hata");
    }
  };

  /* ────────────────── SLAYT kategorisi ekleme ────────────────── */
  const [newSlideCategory, setNewSlideCategory] = useState<NewSlideCategory>({
    name: "",
    grade: "",
  });

  const handleAddSlideCategory = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const { name, grade } = newSlideCategory;
    if (!name || !grade) return;
    try {
      await addDoc(collection(db, "slaytKategoriAdlari"), { name, grade: +grade });
      setNewSlideCategory({ name: "", grade: "" });
      await fetchSlideCategories();
      alert("Slayt kategorisi eklendi.");
    } catch (err: unknown) {
      alert((err as { message?: string })?.message ?? "Hata");
    }
  };

  /* ────────────────── Test ekleme ────────────────── */
  const [answerKeyErr, setAnswerKeyErr] = useState<string>("");
  const [testData, setTestData] = useState<TestData>({
    collection: "",
    grade: "",
    name: "",
    link: "",
    questionCount: "",
    answerKey: "",
  });

  const handleTestChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ): void => {
    const { name, value } = e.target;
    setTestData((p) => ({ ...p, [name]: value }));

    if (name === "answerKey") {
      setAnswerKeyErr(value === "" || ANSWER_KEY_REGEX.test(value) ? "" : "Sadece A-D harfleri içermeli");
    }
  };

  const handleAnswerKeyBlur = (): void => {
    if (!testData.answerKey) return;
    const valid = ANSWER_KEY_REGEX.test(testData.answerKey);
    setAnswerKeyErr(valid ? "" : "Sadece A-D harfleri içermeli");
  };

  const handleAddTest = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const { collection: coll, grade, name, link, questionCount, answerKey } = testData;
    if (!coll || !grade || !name || !link || !questionCount || !answerKey) return;

    // — doğrulama —
    if (!ANSWER_KEY_REGEX.test(answerKey) || answerKey.length !== Number(questionCount)) {
      setAnswerKeyErr("Anahtar uzunluğu soru sayısına eşit ve yalnız A-D olmalı");
      return;
    }

    try {
      await addDoc(collection(db, coll), {
        grade: +grade,
        name,
        link,
        questionCount: +questionCount,
        answerKey,
        createdAt: serverTimestamp(),
      });
      setTestData({
        collection: "",
        grade: "",
        name: "",
        link: "",
        questionCount: "",
        answerKey: "",
      });
      await fetchStats();
      alert("Test kaydedildi.");
    } catch (err: unknown) {
      alert((err as { message?: string })?.message ?? "Hata");
    }
  };

  /* ────────────────── Slayt ekleme ────────────────── */
  const [slideData, setSlideData] = useState<SlideData>({
    collection: "",
    grade: "",
    name: "",
    link: "",
  });

  const handleSlideChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setSlideData((p) => ({ ...p, [name]: value }));
  };

  const handleAddSlide = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const { collection: coll, grade, name, link } = slideData;
    if (!coll || !grade || !name || !link) return;

    try {
      await addDoc(collection(db, coll), {
        grade: +grade,
        name,
        link,
        createdAt: serverTimestamp(),
      });
      setSlideData({ collection: "", grade: "", name: "", link: "" });
      alert("Slayt kaydedildi.");
    } catch (err: unknown) {
      alert((err as { message?: string })?.message ?? "Hata");
    }
  };

  /* ────────────────── (ESKİ) Deneme ekleme → (YENİ) Özel Ders (Test gibi) ────────────────── */
  // Test formunun aynısı; fakat kategori kaynakları "ozelKategoriler" koleksiyonundan gelir.
  const [specialAnswerKeyErr, setSpecialAnswerKeyErr] = useState<string>("");
  const [specialTestData, setSpecialTestData] = useState<TestData>({
    collection: "",
    grade: "",
    name: "",
    link: "",
    questionCount: "",
    answerKey: "",
  });

  const handleSpecialTestChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ): void => {
    const { name, value } = e.target;
    setSpecialTestData((p) => ({ ...p, [name]: value }));

    if (name === "answerKey") {
      setSpecialAnswerKeyErr(
        value === "" || ANSWER_KEY_REGEX.test(value) ? "" : "Sadece A-D harfleri içermeli"
      );
    }
  };

  const handleSpecialAnswerKeyBlur = (): void => {
    if (!specialTestData.answerKey) return;
    const valid = ANSWER_KEY_REGEX.test(specialTestData.answerKey);
    setSpecialAnswerKeyErr(valid ? "" : "Sadece A-D harfleri içermeli");
  };

  const handleAddSpecialTest = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const { collection: coll, grade, name, link, questionCount, answerKey } = specialTestData;
    if (!coll || !grade || !name || !link || !questionCount || !answerKey) return;

    if (!ANSWER_KEY_REGEX.test(answerKey) || answerKey.length !== Number(questionCount)) {
      setSpecialAnswerKeyErr("Anahtar uzunluğu soru sayısına eşit ve yalnız A-D olmalı");
      return;
    }

    try {
      // Burada seçilen "coll" zaten "ozelKategoriler" içerisinden bir kategori adı olacak.
      await addDoc(collection(db, coll), {
        grade: +grade,
        name,
        link,
        questionCount: +questionCount,
        answerKey,
        createdAt: serverTimestamp(),
      });
      setSpecialTestData({
        collection: "",
        grade: "",
        name: "",
        link: "",
        questionCount: "",
        answerKey: "",
      });
      await fetchStats();
      alert("Özel ders testi kaydedildi.");
    } catch (err: unknown) {
      alert((err as { message?: string })?.message ?? "Hata");
    }
  };

  /* ────────────────── JSX ────────────────── */
  return (
    <div className="min-h-screen bg-neutral-950 p-8 text-gray-100">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Paneli</h1>

        <div className="flex items-center gap-2">
          <Link
            to="/admin/students"
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
            title="Öğrenci Raporlarını Aç"
          >
            <BarChart3 className="h-4 w-4" />
            Öğrenci Raporları
          </Link>

          <Link
            to="/admin/assign"
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            title="Test Atama Sayfasını Aç"
          >
            <Send className="h-4 w-4" />
            Test Atama
          </Link>
        </div>
      </div>

      {/* ——— Üst grid ——— */}
      <div className="grid gap-6 md:grid-cols-4">
        {/* ——— Öğrenci ekleme ——— */}
        <section className="rounded-xl bg-neutral-900 p-6 shadow ring-1 ring-neutral-800">
          <h2 className="mb-4 text-xl font-semibold">Öğrenci Ekle</h2>
          <form onSubmit={handleAddStudent} className="space-y-4">
            <input
              name="email"
              type="email"
              value={studentForm.email}
              onChange={handleStudentChange}
              placeholder="E-posta"
              className="w-full rounded-md bg-neutral-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                name="firstName"
                value={studentForm.firstName}
                onChange={handleStudentChange}
                placeholder="Ad"
                className="rounded-md bg-neutral-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
              <input
                name="lastName"
                value={studentForm.lastName}
                onChange={handleStudentChange}
                placeholder="Soyad"
                className="rounded-md bg-neutral-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>
            <div className="flex gap-2">
              <input
                name="password"
                value={studentForm.password}
                onChange={handleStudentChange}
                placeholder="Geçici Parola"
                className="flex-1 rounded-md bg-neutral-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
              <button
                type="button"
                onClick={() => setStudentForm((p) => ({ ...p, password: genTempPass() }))}
                className="rounded-md bg-neutral-700 px-3 text-xs hover:bg-neutral-600"
              >
                Üret
              </button>
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium hover:bg-blue-500"
            >
              Ekle
            </button>
          </form>
        </section>

        {/* ——— TEST kategorisi ve ÖZEL DERS kategorisi ekleme ——— */}
        <section className="rounded-xl bg-neutral-900 p-6 shadow ring-1 ring-neutral-800">
          <h2 className="mb-4 text-xl font-semibold">Test Kategorisi Ekle</h2>
          <form onSubmit={handleAddTestCategory} className="space-y-4">
            <input
              value={newTestCategory.name}
              onChange={(e) => setNewTestCategory((p) => ({ ...p, name: e.target.value }))}
              placeholder="Kategori adı"
              className="w-full rounded-md bg-neutral-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
            />
            <button
              type="submit"
              className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium hover:bg-blue-500"
            >
              Ekle
            </button>
          </form>

          <h2 className="mt-8 mb-4 text-xl font-semibold">Özel Ders Kategorisi Ekle</h2>
          <form onSubmit={handleAddSpecialCategory} className="space-y-4">
            <input
              value={newSpecialCategory.name}
              onChange={(e) => setNewSpecialCategory((p) => ({ ...p, name: e.target.value }))}
              placeholder="Özel kategori adı"
              className="w-full rounded-md bg-neutral-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
            />
            <button
              type="submit"
              className="w-full rounded-md bg-emerald-600 py-2 text-sm font-medium hover:bg-emerald-500"
            >
              Ekle
            </button>
          </form>
        </section>

        {/* ——— SLAYT kategorisi ekleme ——— */}
        <section className="rounded-xl bg-neutral-900 p-6 shadow ring-1 ring-neutral-800">
          <h2 className="mb-4 text-xl font-semibold">Slayt Kategorisi Ekle</h2>
          <form onSubmit={handleAddSlideCategory} className="space-y-4">
            <select
              value={newSlideCategory.grade}
              onChange={(e) => setNewSlideCategory((p) => ({ ...p, grade: e.target.value }))}
              className="w-full rounded-md bg-neutral-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
            >
              <option value="" disabled>
                Sınıf
              </option>
              <option value="5">5</option>
              <option value="6">6</option>
              <option value="7">7</option>
              <option value="8">8</option>
            </select>
            <input
              value={newSlideCategory.name}
              onChange={(e) => setNewSlideCategory((p) => ({ ...p, name: e.target.value }))}
              placeholder="Kategori adı"
              className="w-full rounded-md bg-neutral-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
            />
            <button
              type="submit"
              className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium hover:bg-blue-500"
            >
              Ekle
            </button>
          </form>
        </section>

        {/* ——— İstatistikler ——— */}
        <section className="rounded-xl bg-neutral-900 p-6 shadow ring-1 ring-neutral-800">
          <h2 className="mb-4 text-xl font-semibold">Sistem İstatistikleri</h2>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-semibold text-blue-400">{stats.students}</span> öğrenci kayıtlı
            </p>
            <p>
              <span className="font-semibold text-blue-400">{stats.tests}</span> test mevcut
            </p>
          </div>
        </section>

        {/* ——— Test + Slayt + Özel Ders formları ——— */}
        <section className="rounded-xl bg-neutral-900 p-6 shadow ring-1 ring-neutral-800 md:col-span-4">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* ——— Test formu ——— */}
            <div>
              <h2 className="mb-4 text-xl font-semibold">Test Ekle</h2>
              <form onSubmit={handleAddTest} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {/* Kategori */}
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-400">Kategori</label>
                  <select
                    name="collection"
                    value={testData.collection}
                    onChange={handleTestChange}
                    className="w-full rounded-md bg-neutral-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  >
                    <option value="" disabled>
                      Seçiniz
                    </option>
                    {testCategories.map((c) => (
                      <option key={c.id} value={(c as any).name}>
                        {(c as any).name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sınıf */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Sınıf</label>
                  <select
                    name="grade"
                    value={testData.grade}
                    onChange={handleTestChange}
                    className="w-full rounded-md bg-neutral-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  >
                    <option value="" disabled>
                      Seçiniz
                    </option>
                    <option value="5">5</option>
                    <option value="6">6</option>
                    <option value="7">7</option>
                    <option value="8">8</option>
                  </select>
                </div>

                {/* Test adı */}
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-400">Test Adı</label>
                  <input
                    name="name"
                    value={testData.name}
                    onChange={handleTestChange}
                    placeholder="Ör. 7.Sınıf Deneme–1"
                    className="w-full rounded-md bg-neutral-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>

                {/* Link */}
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-400">Test Linki</label>
                  <input
                    name="link"
                    value={testData.link}
                    onChange={handleTestChange}
                    placeholder="https://..."
                    className="w-full rounded-md bg-neutral-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>

                {/* Soru sayısı */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Soru Sayısı</label>
                  <input
                    name="questionCount"
                    type="number"
                    value={testData.questionCount}
                    onChange={handleTestChange}
                    className="w-full rounded-md bg-neutral-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>

                {/* Cevap anahtarı */}
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-400">Cevap Anahtarı</label>
                  <textarea
                    name="answerKey"
                    rows={3}
                    value={testData.answerKey}
                    onChange={handleTestChange}
                    onBlur={handleAnswerKeyBlur}
                    placeholder="Ör. ABCDABCD..."
                    className={`w-full resize-y rounded-lg bg-neutral-800 p-4 text-sm font-mono tracking-wider leading-relaxed focus:outline-none focus:ring-2 ${
                      answerKeyErr ? "ring-2 ring-red-600 focus:ring-red-600" : "focus:ring-blue-600"
                    }`}
                    required
                  />
                  {answerKeyErr && <p className="mt-1 text-xs text-red-500">{answerKeyErr}</p>}
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium hover:bg-blue-500"
                  >
                    Kaydet
                  </button>
                </div>
              </form>
            </div>

            {/* ——— Slayt formu ——— */}
            <div>
              <h2 className="mb-4 text-xl font-semibold">Slayt Ekle</h2>
              <form onSubmit={handleAddSlide} className="space-y-4">
                {/* Kategori */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Kategori</label>
                  <select
                    name="collection"
                    value={slideData.collection}
                    onChange={handleSlideChange}
                    className="w-full rounded-md bg-neutral-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  >
                    <option value="" disabled>
                      Seçiniz
                    </option>
                    {slideCategories.map((c) => (
                      <option key={c.id} value={(c as any).name}>
                        {(c as any).name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sınıf */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Sınıf</label>
                  <select
                    name="grade"
                    value={slideData.grade}
                    onChange={handleSlideChange}
                    className="w-full rounded-md bg-neutral-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  >
                    <option value="" disabled>
                      Seçiniz
                    </option>
                    <option value="5">5</option>
                    <option value="6">6</option>
                    <option value="7">7</option>
                    <option value="8">8</option>
                  </select>
                </div>

                {/* Slayt adı */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Slayt Adı</label>
                  <input
                    name="name"
                    value={slideData.name}
                    onChange={handleSlideChange}
                    placeholder="Ör. ‘Üslü Sayılar’"
                    className="w-full rounded-md bg-neutral-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>

                {/* Slayt linki */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Slayt Linki</label>
                  <input
                    name="link"
                    value={slideData.link}
                    onChange={handleSlideChange}
                    placeholder="https://..."
                    className="w-full rounded-md bg-neutral-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium hover:bg-blue-500"
                >
                  Kaydet
                </button>
              </form>
            </div>

            {/* ——— Özel Ders (Test gibi) ——— */}
            <div>
              <h2 className="mb-4 text-xl font-semibold">Özel Ders Testi Ekle</h2>
              <form onSubmit={handleAddSpecialTest} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {/* Kategori: ozelKategoriler */}
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-400">Kategori (Özel)</label>
                  <select
                    name="collection"
                    value={specialTestData.collection}
                    onChange={handleSpecialTestChange}
                    className="w-full rounded-md bg-neutral-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  >
                    <option value="" disabled>
                      Seçiniz
                    </option>
                    {specialCategories.map((c) => (
                      <option key={c.id} value={(c as any).name}>
                        {(c as any).name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sınıf */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Sınıf</label>
                  <select
                    name="grade"
                    value={specialTestData.grade}
                    onChange={handleSpecialTestChange}
                    className="w-full rounded-md bg-neutral-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  >
                    <option value="" disabled>
                      Seçiniz
                    </option>
                    <option value="5">5</option>
                    <option value="6">6</option>
                    <option value="7">7</option>
                    <option value="8">8</option>
                  </select>
                </div>

                {/* Test adı */}
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-400">Test Adı</label>
                  <input
                    name="name"
                    value={specialTestData.name}
                    onChange={handleSpecialTestChange}
                    placeholder="Ör. 8.Sınıf Özel Deneme–1"
                    className="w-full rounded-md bg-neutral-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>

                {/* Link */}
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-400">Test Linki</label>
                  <input
                    name="link"
                    value={specialTestData.link}
                    onChange={handleSpecialTestChange}
                    placeholder="https://..."
                    className="w-full rounded-md bg-neutral-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>

                {/* Soru sayısı */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Soru Sayısı</label>
                  <input
                    name="questionCount"
                    type="number"
                    value={specialTestData.questionCount}
                    onChange={handleSpecialTestChange}
                    className="w-full rounded-md bg-neutral-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>

                {/* Cevap anahtarı */}
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-400">Cevap Anahtarı</label>
                  <textarea
                    name="answerKey"
                    rows={3}
                    value={specialTestData.answerKey}
                    onChange={handleSpecialTestChange}
                    onBlur={handleSpecialAnswerKeyBlur}
                    placeholder="Ör. ABCDABCD..."
                    className={`w-full resize-y rounded-lg bg-neutral-800 p-4 text-sm font-mono tracking-wider leading-relaxed focus:outline-none focus:ring-2 ${
                      specialAnswerKeyErr ? "ring-2 ring-red-600 focus:ring-red-600" : "focus:ring-blue-600"
                    }`}
                    required
                  />
                  {specialAnswerKeyErr && <p className="mt-1 text-xs text-red-500">{specialAnswerKeyErr}</p>}
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium hover:bg-blue-500"
                  >
                    Kaydet
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
