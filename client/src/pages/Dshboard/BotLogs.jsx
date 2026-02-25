import React, { useEffect, useState } from "react";
import { listenBotLogs, getCommandStats } from "../../firebase";

const TABS = ["interactions", "errors", "commandStats"];
const TAB_LABELS = {
  interactions : "🤖 Interactions",
  errors       : "❌ Failed Messages",
  commandStats : "📊 Command Stats",
};

const BotLogs = () => {
  const [activeTab,    setActiveTab]    = useState("interactions");
  const [interactions, setInteractions] = useState([]);
  const [errors,       setErrors]       = useState([]);
  const [cmdStats,     setCmdStats]     = useState([]);
  const [search,       setSearch]       = useState("");

  useEffect(() => {
    const unsubInter = listenBotLogs("interactions", setInteractions);
    const unsubErr   = listenBotLogs("errors",       setErrors);

    getCommandStats().then(setCmdStats).catch(() => setCmdStats([]));

    return () => { unsubInter(); unsubErr(); };
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────
  const fmt = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  const filterBySearch = (rows, keys) =>
    !search
      ? rows
      : rows.filter((r) =>
          keys.some((k) => String(r[k] || "").toLowerCase().includes(search.toLowerCase()))
        );

  const filteredInteractions = filterBySearch(interactions, ["chatId", "command", "rollNumber", "result"]);
  const filteredErrors       = filterBySearch(errors,       ["chatId", "error", "message"]);

  // ── Summary cards ────────────────────────────────────────────────────────
  const totalCommands = interactions.length;
  const totalErrors   = errors.length;
  const successRate   = totalCommands
    ? (((totalCommands - totalErrors) / totalCommands) * 100).toFixed(1)
    : "—";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div>
        <h2 className="text-2xl font-bold text-purple-700">📊 Bot Logs</h2>
        <p className="text-gray-500 text-sm mt-1">
          Monitor all Telegram bot interactions, failed messages, and command usage.
        </p>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Interactions", value: totalCommands, color: "purple", icon: "🤖" },
          { label: "Failed Messages",    value: totalErrors,   color: "red",    icon: "❌" },
          { label: "Success Rate",       value: `${successRate}%`, color: "green", icon: "✅" },
          { label: "Commands Tracked",   value: cmdStats.length, color: "blue", icon: "💬" },
        ].map((c) => (
          <div key={c.label} className={`bg-white rounded-xl shadow p-4 border-l-4 border-${c.color}-500`}>
            <p className="text-xs text-gray-500 font-medium">{c.label}</p>
            <p className={`text-2xl font-bold text-${c.color}-600 mt-1`}>{c.icon} {c.value}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="flex border-b">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-semibold transition ${
                activeTab === tab
                  ? "border-b-2 border-purple-600 text-purple-700 bg-purple-50"
                  : "text-gray-500 hover:text-purple-600"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Search bar (interactions & errors) */}
          {activeTab !== "commandStats" && (
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border p-2 rounded-lg text-sm mb-4"
            />
          )}

          {/* ── INTERACTIONS TAB ── */}
          {activeTab === "interactions" && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-purple-50">
                    {["Timestamp", "Chat ID", "Command", "Roll No", "Result", "Note"].map((h) => (
                      <th key={h} className="text-left p-2 font-semibold text-purple-800">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredInteractions.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-gray-400 italic">No interactions logged yet.</td></tr>
                  )}
                  {filteredInteractions.map((row) => (
                    <tr key={row.id} className="border-t hover:bg-gray-50">
                      <td className="p-2 text-xs text-gray-500 whitespace-nowrap">{fmt(row.timestamp)}</td>
                      <td className="p-2 font-mono text-xs">{row.chatId}</td>
                      <td className="p-2">
                        <code className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs">{row.command}</code>
                      </td>
                      <td className="p-2 text-gray-600">{row.rollNumber || "—"}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          row.result === "ok" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {row.result}
                        </span>
                      </td>
                      <td className="p-2 text-gray-500 text-xs max-w-xs truncate">{row.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── ERRORS TAB ── */}
          {activeTab === "errors" && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-red-50">
                    {["Timestamp", "Chat ID", "Error", "Message Preview"].map((h) => (
                      <th key={h} className="text-left p-2 font-semibold text-red-700">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredErrors.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-gray-400 italic">No failed messages. 🎉</td></tr>
                  )}
                  {filteredErrors.map((row) => (
                    <tr key={row.id} className="border-t hover:bg-red-50">
                      <td className="p-2 text-xs text-gray-500 whitespace-nowrap">{fmt(row.timestamp)}</td>
                      <td className="p-2 font-mono text-xs">{row.chatId}</td>
                      <td className="p-2 text-red-600 text-xs max-w-xs">
                        <span className="bg-red-100 px-2 py-0.5 rounded">{row.error}</span>
                      </td>
                      <td className="p-2 text-gray-500 text-xs max-w-xs truncate">{row.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── COMMAND STATS TAB ── */}
          {activeTab === "commandStats" && (
            <div className="space-y-3">
              {cmdStats.length === 0 && (
                <p className="text-center text-gray-400 italic py-8">No command stats yet.</p>
              )}
              {cmdStats
                .sort((a, b) => (b.count || 0) - (a.count || 0))
                .map((stat) => {
                  const maxCount = Math.max(...cmdStats.map((s) => s.count || 0), 1);
                  const pct      = Math.round(((stat.count || 0) / maxCount) * 100);
                  return (
                    <div key={stat.cmd} className="flex items-center gap-4">
                      <code className="w-32 text-sm font-mono bg-purple-100 text-purple-800 px-2 py-1 rounded flex-shrink-0">
                        /{stat.cmd}
                      </code>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                        <div
                          className="h-5 bg-purple-500 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-16 text-right text-sm font-bold text-purple-700">
                        {stat.count || 0}×
                      </span>
                      <span className="w-32 text-right text-xs text-gray-400 hidden md:block">
                        Last: {fmt(stat.lastUsed)}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* ── Security note ── */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        🔐 <strong>Rate Limiting:</strong> Max 5 Telegram messages per user per minute. Blocked attempts are
        logged in the Failed Messages tab. &nbsp;
        🧵 <strong>Message Queue:</strong> All outgoing messages are processed sequentially with 3× retry
        and exponential backoff (1s → 2s → 4s).
      </div>
    </div>
  );
};

export default BotLogs;
