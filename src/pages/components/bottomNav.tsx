import { motion } from "framer-motion";

const NAV = [5, 6, 7, 8] as const;
type Grade = typeof NAV[number];

type BottomNavProps = {
  active: Grade;
  onSelect: (grade: Grade) => void;
};

export default function BottomNav({ active, onSelect }: BottomNavProps) {
  const idx = Math.max(NAV.indexOf(active), 0);

  return (
    <nav className="fixed bottom-6 left-1/2 z-50 w-[80%] -translate-x-1/2">
      <div className="relative mx-auto h-16 rounded-3xl bg-neutral-900 shadow-lg px-4">
        {/* Bombe + Yazı */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
          <div className="h-12 w-28 rounded-full bg-neutral-900 flex items-center justify-center">
            <span className="text-sm font-medium text-white">Sınıf Seçimi</span>
          </div>
        </div>

        {/* Notch */}
        <motion.div
          layoutId="notch"
          className="absolute -top-3 h-16 w-16 rounded-full bg-neutral-900"
          style={{ left: `calc(${idx * 25}% + 12.5% - 2rem)` }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />

        {/* Sınıf düğmeleri */}
        <ul className="relative z-10 grid h-full grid-cols-4">
          {NAV.map((grade) => (
            <li key={grade} className="flex items-center justify-center">
              <button
                aria-label={`${grade}. sınıf`}
                onClick={() => onSelect(grade)}
                className="relative flex h-full w-full items-center justify-center text-gray-400"
              >
                {active === grade ? (
                  <motion.span
                    layoutId="pill"
                    className="absolute -top-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-lg font-semibold text-white shadow-xl"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    {grade}
                  </motion.span>
                ) : (
                  <span className="text-lg font-medium">{grade}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
