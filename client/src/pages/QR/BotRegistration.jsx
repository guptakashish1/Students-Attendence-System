import React, { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { listenRegisteredStudents, getTelegramBotUsername } from "../../firebase";

const CLASS_OPTIONS = [
  "PlayGroup", "Nursery", "KG-1", "KG-2",
  "Class I", "Class II", "Class III", "Class IV", "Class V",
  "Class VI", "Class VII", "Class VIII", "Class IX", "Class X",
  "Class XI", "Class XII",
];

const BotRegistration = () => {
  const [students, setStudents]       = useState([]);
  const [search, setSearch]           = useState("");
  const [botUsername, setBotUsername] = useState("");
  const [activeClass, setActiveClass] = useState("all");

  useEffect(() => {
    setBotUsername(getTelegramBotUsername());
    const unsub = listenRegisteredStudents(setStudents);
    return () => unsub();
  }, []);

  const startLink = botUsername ? `https://t.me/${botUsername}?start=register` : "";

  // ── Filtering helpers ──────────────────────────────────────────────────────
  const byClass = (list) =>
    activeClass === "all" ? list : list.filter((s) => s.studentClass === activeClass);

  const bySearch = (list) =>
    !search.trim()
      ? list
      : list.filter(
          (s) =>
            s.name?.toLowerCase().includes(search.toLowerCase()) ||
            s.rollNumber?.includes(search)
        );

  const filtered     = bySearch(byClass(students));
  const registered   = filtered.filter((s) => s.telegramChatId);
  const unregistered = filtered.filter((s) => !s.telegramChatId);

  // ── Per-class summary stats ────────────────────────────────────────────────
  const classSummary = CLASS_OPTIONS.map((cls) => {
    const clsStudents = students.filter((s) => s.studentClass === cls);
    const reg         = clsStudents.filter((s) => s.telegramChatId).length;
    const total       = clsStudents.length;
    return { cls, total, reg, pending: total - reg, pct: total ? Math.round((reg / total) * 100) : 0 };
  }).filter((c) => c.total > 0); // hide empty classes

  // ── Overall counts ─────────────────────────────────────────────────────────
  const totalAll    = students.length;
  const totalReg    = students.filter((s) => s.telegramChatId).length;
  const totalPend   = totalAll - totalReg;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div>
        <h2 className="text-2xl font-bold text-purple-700">🤖 Bot Registration</h2>
        <p className="text-gray-500 text-sm mt-1">
          Students must register with the Telegram bot before marking attendance via QR.
        </p>
      </div>

      {/* ── Registration QR + steps ── */}
      <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col md:flex-row gap-8 items-center">
        {/* QR */}
        <div className="flex-shrink-0 flex flex-col items-center gap-3">
          {startLink ? (
            <>
              <div className="border-4 border-purple-300 rounded-xl p-3 bg-white">
                <QRCodeSVG value={startLink} size={180} level="H" includeMargin fgColor="#4c1d95" />
              </div>
              <p className="text-xs text-gray-400 text-center">Scan to open bot</p>
            </>
          ) : (
            <div className="w-48 h-48 bg-gray-100 rounded-xl flex items-center justify-center text-xs text-gray-400 text-center p-4">
              Set <code className="mx-1 bg-gray-200 px-1 rounded">TELEGRAM_BOT_USERNAME</code> in
              firebase.js to enable QR
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-800 mb-4">📋 How Students Register</h3>
          <ol className="space-y-3">
            {[
              { n: "1", icon: "📱", title: "Scan the QR code",         desc: "Scan with Telegram or open the link below to launch the bot." },
              { n: "2", icon: "▶️", title: 'Tap "Start" in Telegram', desc: "The bot greets you and asks for your Roll Number." },
              { n: "3", icon: "🔢", title: "Send your Roll Number",    desc: "Type your exact roll number and send it to the bot." },
              { n: "4", icon: "🎓", title: "Send your Class",          desc: 'Type your class (e.g. "Class IX") — bot links your Telegram ID.' },
              { n: "5", icon: "✅", title: "Registration complete",    desc: "You can now mark attendance by scanning the daily class QR." },
            ].map((step) => (
              <li key={step.n} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">
                  {step.n}
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{step.icon} {step.title}</p>
                  <p className="text-xs text-gray-500">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
          {startLink && (
            <a
              href={startLink}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-semibold transition"
            >
              🔗 Open Bot Link
            </a>
          )}
        </div>
      </div>

      {/* ── Overall summary cards ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Students",  value: totalAll,  color: "bg-purple-50 text-purple-700",  icon: "👥" },
          { label: "Registered",      value: totalReg,  color: "bg-green-50  text-green-700",   icon: "✅" },
          { label: "Pending",         value: totalPend, color: "bg-red-50    text-red-700",     icon: "⏳" },
        ].map((c) => (
          <div key={c.label} className={`${c.color} rounded-2xl p-4 text-center shadow-sm`}>
            <div className="text-3xl font-extrabold">{c.value}</div>
            <div className="text-xs font-semibold mt-1 opacity-80">{c.icon} {c.label}</div>
          </div>
        ))}
      </div>

      {/* ── Class-wise summary cards ── */}
      {classSummary.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-5">
          <h3 className="text-base font-bold text-gray-800 mb-4">📊 Registration by Class</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {classSummary.map(({ cls, total, reg, pending, pct }) => (
              <button
                key={cls}
                onClick={() => setActiveClass(activeClass === cls ? "all" : cls)}
                className={`text-left rounded-xl border p-3 transition cursor-pointer hover:shadow ${
                  activeClass === cls
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-200 bg-gray-50 hover:border-purple-300"
                }`}
              >
                <p className="text-xs font-bold text-gray-800 mb-1 truncate">{cls}</p>
                {/* Progress bar */}
                <div className="h-1.5 bg-gray-200 rounded-full mb-2">
                  <div
                    className="h-1.5 bg-purple-500 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-green-600 font-semibold">✅ {reg}</span>
                  <span className="text-red-500 font-semibold">❌ {pending}</span>
                  <span className="text-gray-500">{pct}%</span>
                </div>
              </button>
            ))}
          </div>
          {activeClass !== "all" && (
            <button
              onClick={() => setActiveClass("all")}
              className="mt-3 text-xs text-purple-600 hover:underline font-semibold"
            >
              ✕ Clear class filter
            </button>
          )}
        </div>
      )}

      {/* ── Bot commands reference ── */}
      <div className="bg-white rounded-2xl shadow p-5">
        <h3 className="text-base font-bold text-gray-800 mb-3">💬 Bot Commands</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-purple-100">
                <th className="text-left p-2 rounded-tl-lg font-semibold text-purple-800">Command</th>
                <th className="text-left p-2 rounded-tr-lg font-semibold text-purple-800">What It Does</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["/start",       "Register with the bot (first-time setup)"],
                ["/attendance",  "Check today's attendance status"],
                ["/percentage",  "View your current attendance percentage"],
                ["/download",    "Download attendance report (PDF + XLSX)"],
              ].map(([cmd, desc]) => (
                <tr key={cmd} className="border-t hover:bg-gray-50">
                  <td className="p-2">
                    <code className="bg-gray-100 text-purple-700 px-2 py-0.5 rounded font-mono">{cmd}</code>
                  </td>
                  <td className="p-2 text-gray-600">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Student registration status ── */}
      <div className="bg-white rounded-2xl shadow p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-800">
              👥 Student Registration Status
              {activeClass !== "all" && (
                <span className="ml-2 text-sm text-purple-600 font-normal">— {activeClass}</span>
              )}
            </h3>
          </div>
          <div className="flex gap-3 text-sm flex-wrap">
            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">
              ✅ Registered: {registered.length}
            </span>
            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-semibold">
              ❌ Pending: {unregistered.length}
            </span>
          </div>
        </div>

        {/* Class filter pills (inline) */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={() => setActiveClass("all")}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
              activeClass === "all"
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-purple-400"
            }`}
          >
            All
          </button>
          {CLASS_OPTIONS.map((cls) => {
            const cnt = students.filter((s) => s.studentClass === cls).length;
            if (cnt === 0) return null;
            return (
              <button
                key={cls}
                onClick={() => setActiveClass(cls)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${
                  activeClass === cls
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-purple-400"
                }`}
              >
                {cls} ({cnt})
              </button>
            );
          })}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search by name or roll number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border p-2 rounded-lg mb-4 text-sm outline-none focus:border-purple-400"
        />

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-purple-100">
                {["Roll No", "Name", "Class", "Student Telegram ID", "Parent Telegram ID", "Status"].map((h) => (
                  <th key={h} className="text-left p-2 font-semibold text-purple-800 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-gray-400 italic">
                    No students found
                  </td>
                </tr>
              )}
              {filtered.map((s) => (
                <tr key={s.rollNumber} className="border-t hover:bg-gray-50">
                  <td className="p-2 font-mono text-xs">{s.rollNumber}</td>
                  <td className="p-2 font-medium">{s.name}</td>
                  <td className="p-2">
                    <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                      {s.studentClass}
                    </span>
                  </td>
                  <td className="p-2 font-mono text-xs text-gray-600">
                    {s.telegramChatId || <span className="text-red-400 italic">Not set</span>}
                  </td>
                  <td className="p-2 font-mono text-xs text-gray-600">
                    {s.parentTelegramChatId || <span className="text-gray-400 italic">Not set</span>}
                  </td>
                  <td className="p-2">
                    {s.telegramChatId ? (
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                        ✅ Registered
                      </span>
                    ) : (
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                        ❌ Pending
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Info note ── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        ℹ️ <strong>Admin note:</strong> When a student registers via the bot, their Telegram Chat ID
        is automatically saved to their profile in Firebase. You can also manually add it via{" "}
        <strong>Registered Students</strong> → Edit.
      </div>
    </div>
  );
};

export default BotRegistration;
