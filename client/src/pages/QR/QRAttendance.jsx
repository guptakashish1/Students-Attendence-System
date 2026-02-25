import React, { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { generateDailyToken, getTelegramBotUsername, getTodayDate } from "../../firebase";

const QRAttendance = () => {
  const [qrLink, setQrLink]       = useState("");
  const [token, setToken]          = useState("");
  const [loading, setLoading]      = useState(true);
  const [copied, setCopied]        = useState(false);
  const [timeLeft, setTimeLeft]    = useState("");
  const timerRef                   = useRef(null);

  const today = getTodayDate(); // YYYY-MM-DD

  // ── Generate / load today's token ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const t   = await generateDailyToken(today);
        const bot = getTelegramBotUsername();
        const payload = `att_${today}_${t}`;
        const link    = `https://t.me/${bot}?start=${payload}`;
        setToken(t);
        setQrLink(link);
      } catch (err) {
        console.error("QR token error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [today]);

  // ── Countdown to midnight refresh ─────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      const now  = new Date();
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

  const handleCopy = () => {
    navigator.clipboard.writeText(qrLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <p className="text-purple-600 text-lg font-semibold animate-pulse">
          Generating QR Code…
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* ── Header ── */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-purple-700">📸 QR Code Attendance</h2>
        <p className="text-gray-500 text-sm mt-1">
          Display this QR code in class. Students scan it with Telegram to mark their attendance.
        </p>
      </div>

      {/* ── Main card ── */}
      <div className="bg-white rounded-2xl shadow-lg p-8 flex flex-col items-center gap-6 print:shadow-none">
        {/* Date badge */}
        <div className="w-full flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-600">📅 Date: <span className="text-purple-700">{today}</span></span>
          <span className="text-sm font-semibold text-gray-600">
            🔑 Token: <code className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-mono">{token}</code>
          </span>
        </div>

        {/* QR Code */}
        {qrLink ? (
          <div className="border-4 border-purple-300 rounded-xl p-4 bg-white">
            <QRCodeSVG
              value={qrLink}
              size={260}
              level="H"
              includeMargin={true}
              fgColor="#4c1d95"
            />
          </div>
        ) : (
          <p className="text-red-500 text-sm">
            ⚠️ Bot username not configured. Please set <code>TELEGRAM_BOT_USERNAME</code> in firebase.js.
          </p>
        )}

        {/* Instruction */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 w-full text-center">
          <p className="text-purple-800 font-semibold text-sm">📱 How to use</p>
          <ol className="text-gray-600 text-sm mt-2 space-y-1 text-left list-decimal list-inside">
            <li>Open your Telegram app and point the camera here.</li>
            <li>The attendance bot opens automatically.</li>
            <li>Tap <strong>Start</strong> — the bot verifies &amp; marks you <strong>Present</strong>.</li>
            <li>You must be registered with the bot first (see Bot Registration page).</li>
          </ol>
        </div>

        {/* Expiry countdown */}
        <div className="text-center">
          <p className="text-xs text-gray-400">QR refreshes at midnight — expires in</p>
          <p className="text-2xl font-mono font-bold text-purple-600">{timeLeft}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-wrap justify-center print:hidden">
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition"
          >
            {copied ? "✅ Copied!" : "📋 Copy Link"}
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-semibold transition"
          >
            🖨️ Print QR
          </button>
        </div>
      </div>

      {/* ── How It Works ── */}
      <div className="mt-8 bg-white rounded-2xl shadow p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">⚙️ How QR Attendance Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: "📲", title: "1. Scan", desc: "Student scans the QR code with Telegram (camera or in-app scanner)." },
            { icon: "🤖", title: "2. Bot Verifies", desc: "The bot checks the daily token and confirms the student is registered." },
            { icon: "✅", title: "3. Marked Present", desc: "Attendance is recorded in Firebase with a timestamp instantly." },
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
      <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
        🔐 <strong>Security:</strong> The QR token changes every day. Students cannot reuse yesterday&apos;s QR.
        Only students registered with the bot can mark attendance via QR.
      </div>
    </div>
  );
};

export default QRAttendance;
