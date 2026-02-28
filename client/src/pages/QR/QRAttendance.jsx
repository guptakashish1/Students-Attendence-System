import React, { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  generateDailyToken,
  generateClassDailyToken,
  getTelegramBotUsername,
  getTodayDate,
} from "../../firebase";

const CLASS_OPTIONS = [
  "PlayGroup", "Nursery", "KG-1", "KG-2",
  "Class I", "Class II", "Class III", "Class IV", "Class V",
  "Class VI", "Class VII", "Class VIII", "Class IX", "Class X",
  "Class XI", "Class XII",
];

function classSlug(cls) {
  return cls.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

const QRAttendance = () => {
  const [selectedClass, setSelectedClass] = useState("all");
  const [qrLink, setQrLink]             = useState("");
  const [token, setToken]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [copied, setCopied]             = useState(false);
  const [timeLeft, setTimeLeft]         = useState("");
  const [showAllGrid, setShowAllGrid]   = useState(false);
  const [allQRs, setAllQRs]             = useState([]); // [{cls, link, token}]
  const timerRef                        = useRef(null);

  const today = getTodayDate(); // YYYY-MM-DD

  // ── Generate QR whenever class changes ────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setQrLink("");
    setToken("");
    (async () => {
      try {
        const bot = getTelegramBotUsername();
        let t, payload;
        if (selectedClass === "all") {
          t = await generateDailyToken(today);
          payload = `att_${today}_${t}`;
        } else {
          t = await generateClassDailyToken(today, selectedClass);
          const slug = classSlug(selectedClass);
          payload = `att_${today}_${slug}_${t}`;
        }
        setToken(t);
        setQrLink(bot ? `https://t.me/${bot}?start=${payload}` : "");
      } catch (err) {
        console.error("QR token error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedClass, today]);

  // ── Countdown to midnight ─────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now      = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight - now;
      const h = String(Math.floor(diff / 3_600_000)).padStart(2, "0");
      const m = String(Math.floor((diff % 3_600_000) / 60_000)).padStart(2, "0");
      const s = String(Math.floor((diff % 60_000) / 1_000)).padStart(2, "0");
      setTimeLeft(`${h}:${m}:${s}`);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // ── Generate all-class QR grid ────────────────────────────────────────────
  const handleShowAll = async () => {
    setShowAllGrid(true);
    const bot = getTelegramBotUsername();
    const results = await Promise.all(
      CLASS_OPTIONS.map(async (cls) => {
        try {
          const t    = await generateClassDailyToken(today, cls);
          const slug = classSlug(cls);
          const link = bot ? `https://t.me/${bot}?start=att_${today}_${slug}_${t}` : "";
          return { cls, link, token: t };
        } catch {
          return { cls, link: "", token: "" };
        }
      })
    );
    setAllQRs(results);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(qrLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-purple-700">📸 QR Code Attendance</h2>
          <p className="text-gray-500 text-sm mt-1">
            Select a class to generate a unique QR code for that class.
          </p>
        </div>
        <button
          onClick={handleShowAll}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition print:hidden"
        >
          🗂️ Show All Classes QR
        </button>
      </div>

      {/* ── Class Selector ── */}
      <div className="bg-white rounded-2xl shadow p-5">
        <p className="text-sm font-bold text-gray-700 mb-3">🎓 Select Class</p>
        <div className="flex flex-wrap gap-2">
          {/* All Classes pill */}
          <button
            onClick={() => { setSelectedClass("all"); setShowAllGrid(false); }}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition border ${
              selectedClass === "all"
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-purple-400 hover:text-purple-600"
            }`}
          >
            All Classes
          </button>

          {CLASS_OPTIONS.map((cls) => (
            <button
              key={cls}
              onClick={() => { setSelectedClass(cls); setShowAllGrid(false); }}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition border ${
                selectedClass === cls
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-purple-400 hover:text-purple-600"
              }`}
            >
              {cls}
            </button>
          ))}
        </div>
      </div>

      {/* ── Single Class QR Card ── */}
      {!showAllGrid && (
        <div className="bg-white rounded-2xl shadow-lg p-8 flex flex-col items-center gap-6 print:shadow-none">

          {/* Info row */}
          <div className="w-full flex flex-wrap justify-between items-center gap-2">
            <div className="flex flex-wrap gap-4">
              <span className="text-sm font-semibold text-gray-600">
                📅 Date: <span className="text-purple-700">{today}</span>
              </span>
              <span className="text-sm font-semibold text-gray-600">
                🎓 Class:{" "}
                <span className="text-purple-700 font-bold">
                  {selectedClass === "all" ? "All Classes" : selectedClass}
                </span>
              </span>
            </div>
            {token && (
              <span className="text-sm font-semibold text-gray-600">
                🔑 Token:{" "}
                <code className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-mono">
                  {token}
                </code>
              </span>
            )}
          </div>

          {/* QR Code */}
          {loading ? (
            <p className="text-purple-600 font-semibold animate-pulse py-16">
              Generating QR…
            </p>
          ) : qrLink ? (
            <div className="flex flex-col items-center gap-3">
              <div className="border-4 border-purple-300 rounded-xl p-4 bg-white shadow-sm">
                <QRCodeSVG
                  value={qrLink}
                  size={260}
                  level="H"
                  includeMargin={true}
                  fgColor="#4c1d95"
                />
              </div>
              {selectedClass !== "all" && (
                <div className="bg-purple-600 text-white px-6 py-1.5 rounded-full font-bold text-base tracking-wide">
                  {selectedClass}
                </div>
              )}
            </div>
          ) : (
            <p className="text-red-500 text-sm">
              ⚠️ Bot username not configured. Set{" "}
              <code>TELEGRAM_BOT_USERNAME</code> in firebase.js.
            </p>
          )}

          {/* Instructions */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 w-full text-center">
            <p className="text-purple-800 font-semibold text-sm">📱 How to use</p>
            <ol className="text-gray-600 text-sm mt-2 space-y-1 text-left list-decimal list-inside">
              <li>Open Telegram and scan this QR code with the camera.</li>
              <li>The attendance bot opens automatically.</li>
              <li>
                Tap <strong>Start</strong> — bot verifies &amp; marks you{" "}
                <strong>Present</strong>.
              </li>
              {selectedClass !== "all" && (
                <li className="text-purple-700 font-semibold">
                  ⚠️ Only <strong>{selectedClass}</strong> students can use this
                  QR code.
                </li>
              )}
            </ol>
          </div>

          {/* Countdown */}
          <div className="text-center">
            <p className="text-xs text-gray-400">QR refreshes at midnight — expires in</p>
            <p className="text-2xl font-mono font-bold text-purple-600">{timeLeft}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 flex-wrap justify-center print:hidden">
            <button
              onClick={handleCopy}
              disabled={!qrLink}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-semibold transition"
            >
              {copied ? "✅ Copied!" : "📋 Copy Link"}
            </button>
            <button
              onClick={() => window.print()}
              className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-semibold transition"
            >
              🖨️ Print QR
            </button>
          </div>
        </div>
      )}

      {/* ── All Classes Grid ── */}
      {showAllGrid && (
        <div className="bg-white rounded-2xl shadow p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-gray-800">🗂️ All Classes QR Codes</h3>
            <button
              onClick={() => setShowAllGrid(false)}
              className="text-sm text-gray-500 hover:text-red-500 transition font-semibold"
            >
              ✕ Close Grid
            </button>
          </div>

          {allQRs.length === 0 ? (
            <p className="text-center text-purple-600 font-semibold animate-pulse py-10">
              Generating QR codes for all classes…
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {allQRs.map(({ cls, link }) => (
                <div
                  key={cls}
                  className="flex flex-col items-center gap-2 border border-purple-100 rounded-xl p-3 hover:shadow-md transition"
                >
                  {link ? (
                    <QRCodeSVG
                      value={link}
                      size={130}
                      level="H"
                      includeMargin={true}
                      fgColor="#4c1d95"
                    />
                  ) : (
                    <div className="w-[130px] h-[130px] bg-gray-100 flex items-center justify-center rounded text-xs text-gray-400">
                      N/A
                    </div>
                  )}
                  <span className="text-xs font-bold text-purple-800 text-center bg-purple-50 px-3 py-1 rounded-full w-full text-center truncate">
                    {cls}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Countdown in grid mode */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">All QRs expire in</p>
            <p className="text-xl font-mono font-bold text-purple-600">{timeLeft}</p>
          </div>

          <div className="mt-4 flex justify-center print:hidden">
            <button
              onClick={() => window.print()}
              className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-semibold transition"
            >
              🖨️ Print All QR Codes
            </button>
          </div>
        </div>
      )}

      {/* ── How It Works ── */}
      <div className="bg-white rounded-2xl shadow p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">⚙️ How Class QR Attendance Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: "🎓",
              title: "1. Teacher Selects Class",
              desc: "Teacher picks their class and a unique class-specific QR is generated.",
            },
            {
              icon: "🤖",
              title: "2. Bot Verifies Student + Class",
              desc: "Bot checks the token and confirms student is registered in that class.",
            },
            {
              icon: "✅",
              title: "3. Marked Present",
              desc: "Attendance recorded in Firebase with timestamp instantly.",
            },
          ].map((step) => (
            <div key={step.title} className="bg-purple-50 rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">{step.icon}</div>
              <p className="font-bold text-purple-800 text-sm">{step.title}</p>
              <p className="text-gray-500 text-xs mt-1">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Security note ── */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
        🔐 <strong>Security:</strong> Each class gets its own daily token — different from other
        classes. Students can only mark attendance with their class's QR code. Tokens expire at
        midnight.
      </div>
    </div>
  );
};

export default QRAttendance;
