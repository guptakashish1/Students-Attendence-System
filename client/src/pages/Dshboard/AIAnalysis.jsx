import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { listenRegisteredStudents, getAllAttendanceRaw } from "../../firebase";
import { analyzeAllStudents, riskLabel, trendBadge } from "../../Utils/attendanceAnalytics";

const TABS = ["overview", "students", "dayPattern", "predictions"];
const TAB_LABELS = {
  overview   : "📊 Risk Overview",
  students   : "👥 Per-Student",
  dayPattern : "📅 Day Pattern",
  predictions: "🔮 Predictions",
};

const AIAnalysis = () => {
  const [profiles,  setProfiles]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [search,    setSearch]    = useState("");

  useEffect(() => {
    let students = [];
    const unsub = listenRegisteredStudents((s) => { students = s; });

    getAllAttendanceRaw().then((raw) => {
      const analyzed = analyzeAllStudents(raw, students);
      setProfiles(analyzed);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const filtered = !search
    ? profiles
    : profiles.filter(
        (p) =>
          p.name?.toLowerCase().includes(search.toLowerCase()) ||
          p.rollNumber?.includes(search)
      );

  // ── Summary counts ──────────────────────────────────────────────────────
  const critical = profiles.filter((p) => p.risk >= 70).length;
  const high     = profiles.filter((p) => p.risk >= 45 && p.risk < 70).length;
  const moderate = profiles.filter((p) => p.risk >= 20 && p.risk < 45).length;
  const safe     = profiles.filter((p) => p.risk < 20).length;
  const belowPct = profiles.filter((p) => p.belowThreshold).length;

  // ── Risk bar chart data ───────────────────────────────────────────────
  const riskChartData = [
    { label: "Critical", count: critical, fill: "#ef4444" },
    { label: "High",     count: high,     fill: "#f97316" },
    { label: "Moderate", count: moderate, fill: "#eab308" },
    { label: "Safe",     count: safe,     fill: "#22c55e" },
  ];

  // ── Day-of-week pattern (aggregate all students) ──────────────────────
  const dayAgg = {};
  profiles.forEach((p) => {
    (p.dayPattern || []).forEach(({ day, absent, total }) => {
      if (!dayAgg[day]) dayAgg[day] = { day, absent: 0, total: 0 };
      dayAgg[day].absent += absent;
      dayAgg[day].total  += total;
    });
  });
  const dayData = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => ({
    day,
    absenceRate: dayAgg[day]?.total
      ? Math.round((dayAgg[day].absent / dayAgg[day].total) * 100)
      : 0,
  }));

  // ── Tomorrow prediction summary ───────────────────────────────────────
  const predCounts = { High: 0, Medium: 0, Low: 0 };
  profiles.forEach((p) => { if (p.prediction?.level) predCounts[p.prediction.level]++; });

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-purple-600 text-lg font-semibold animate-pulse">🤖 Analysing patterns…</p>
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-purple-700">🤖 AI Attendance Pattern Analysis</h2>
        <p className="text-gray-500 text-sm mt-1">
          Risk scoring, trend detection, day-of-week patterns, and next-day absence predictions.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Critical Risk",   value: critical, color: "#ef4444", bg: "#fee2e2", icon: "🚨" },
          { label: "High Risk",       value: high,     color: "#f97316", bg: "#ffedd5", icon: "⚠️" },
          { label: "Moderate Risk",   value: moderate, color: "#eab308", bg: "#fef9c3", icon: "🔶" },
          { label: "Safe",            value: safe,     color: "#22c55e", bg: "#dcfce7", icon: "✅" },
          { label: "Below 75%",       value: belowPct, color: "#8b5cf6", bg: "#ede9fe", icon: "📉" },
        ].map((c) => (
          <div key={c.label} className="rounded-xl p-4 text-center shadow-sm border"
            style={{ background: c.bg, borderColor: c.color + "40" }}>
            <p className="text-2xl">{c.icon}</p>
            <p className="text-2xl font-black" style={{ color: c.color }}>{c.value}</p>
            <p className="text-xs font-semibold text-gray-600 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="flex border-b overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab
                  ? "border-b-2 border-purple-600 text-purple-700 bg-purple-50"
                  : "text-gray-500 hover:text-purple-600"
              }`}>
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
        <div className="p-5">

          {/* ── OVERVIEW TAB ── */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="h-64">
                <p className="text-sm font-semibold text-gray-700 mb-2">Student Risk Distribution</p>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskChartData}>
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {riskChartData.map((entry) => (
                        <rect key={entry.label} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Top at-risk students */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">🚨 Top 5 At-Risk Students</p>
                <div className="space-y-2">
                  {profiles.slice(0, 5).map((p) => {
                    const { label, color, bg } = riskLabel(p.risk);
                    return (
                      <div key={p.rollNumber}
                        className="flex items-center justify-between p-3 rounded-xl border"
                        style={{ background: bg, borderColor: color + "40" }}>
                        <div>
                          <p className="text-sm font-bold" style={{ color }}>{p.name}</p>
                          <p className="text-xs text-gray-500">Roll {p.rollNumber} · {p.klass} · {p.percentage}% attendance</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold px-2 py-1 rounded-full"
                            style={{ background: color, color: "#fff" }}>
                            {label} ({p.risk})
                          </span>
                          <p className="text-xs text-gray-400 mt-1">{trendBadge(p.trend).icon} {trendBadge(p.trend).label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── STUDENTS TAB ── */}
          {activeTab === "students" && (
            <div className="space-y-4">
              <input type="text" placeholder="Search student…" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border p-2 rounded-lg text-sm" />
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-purple-50">
                      {["Name", "Roll", "Class", "%", "Risk", "Trend", "Streak", "Prediction"].map((h) => (
                        <th key={h} className="text-left p-2 text-xs font-bold text-purple-800">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr><td colSpan={8} className="p-4 text-center text-gray-400 italic">No students found.</td></tr>
                    )}
                    {filtered.map((p) => {
                      const ri = riskLabel(p.risk);
                      const ti = trendBadge(p.trend);
                      const pred = p.prediction;
                      return (
                        <tr key={p.rollNumber} className="border-t hover:bg-gray-50">
                          <td className="p-2 font-medium">{p.name}</td>
                          <td className="p-2 font-mono text-xs">{p.rollNumber}</td>
                          <td className="p-2 text-gray-600">{p.klass}</td>
                          <td className="p-2 font-bold" style={{ color: p.percentage < 75 ? "#ef4444" : "#22c55e" }}>
                            {p.percentage}%
                          </td>
                          <td className="p-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                              style={{ background: ri.bg, color: ri.color }}>
                              {ri.label} ({p.risk})
                            </span>
                          </td>
                          <td className="p-2 text-sm" style={{ color: ti.color }}>
                            {ti.icon} {ti.label}
                          </td>
                          <td className="p-2 text-xs text-gray-600">
                            {p.streaks.currentType === "present" ? "🟢" : "🔴"} {p.streaks.current}d
                          </td>
                          <td className="p-2">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{
                                background: pred?.level === "High" ? "#fee2e2" : pred?.level === "Medium" ? "#ffedd5" : "#dcfce7",
                                color      : pred?.color || "#22c55e",
                              }}>
                              {pred?.level || "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── DAY PATTERN TAB ── */}
          {activeTab === "dayPattern" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Aggregate absence rate per day-of-week across all students. Identifies which day students tend to be absent most.
              </p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dayData}>
                    <XAxis dataKey="day" tick={{ fontSize: 13 }} />
                    <YAxis unit="%" tick={{ fontSize: 12 }} domain={[0, 100]} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Bar dataKey="absenceRate" name="Absence Rate" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-center">
                  <thead>
                    <tr className="bg-purple-50">
                      {["Day", "Absence Rate", "Risk Indicator"].map((h) => (
                        <th key={h} className="p-2 text-xs font-bold text-purple-800">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dayData.map((d) => (
                      <tr key={d.day} className="border-t">
                        <td className="p-2 font-semibold">{d.day}</td>
                        <td className="p-2 font-bold" style={{ color: d.absenceRate > 30 ? "#ef4444" : d.absenceRate > 15 ? "#f97316" : "#22c55e" }}>
                          {d.absenceRate}%
                        </td>
                        <td className="p-2">
                          <div className="w-full bg-gray-100 rounded-full h-3 max-w-xs mx-auto">
                            <div className="h-3 rounded-full" style={{
                              width: `${Math.min(d.absenceRate, 100)}%`,
                              background: d.absenceRate > 30 ? "#ef4444" : d.absenceRate > 15 ? "#f97316" : "#22c55e",
                            }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── PREDICTIONS TAB ── */}
          {activeTab === "predictions" && (
            <div className="space-y-5">
              <p className="text-sm text-gray-500">
                Tomorrow absence probability per student — based on risk score, recent trend, and day-of-week patterns.
              </p>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 text-center">
                {[
                  { level: "High",   color: "#ef4444", bg: "#fee2e2", count: predCounts.High   },
                  { level: "Medium", color: "#f97316", bg: "#ffedd5", count: predCounts.Medium },
                  { level: "Low",    color: "#22c55e", bg: "#dcfce7", count: predCounts.Low    },
                ].map((c) => (
                  <div key={c.level} className="rounded-xl p-4 border"
                    style={{ background: c.bg, borderColor: c.color + "40" }}>
                    <p className="text-2xl font-black" style={{ color: c.color }}>{c.count}</p>
                    <p className="text-xs font-semibold text-gray-600">{c.level} Risk Tomorrow</p>
                  </div>
                ))}
              </div>

              {/* Prediction list */}
              <div className="space-y-2">
                {profiles
                  .filter((p) => p.prediction?.level !== "Low")
                  .slice(0, 15)
                  .map((p) => {
                    const pred = p.prediction;
                    return (
                      <div key={p.rollNumber}
                        className="flex items-center justify-between p-3 rounded-xl border bg-white shadow-sm">
                        <div>
                          <p className="text-sm font-bold text-gray-800">{p.name}</p>
                          <p className="text-xs text-gray-500">Roll {p.rollNumber} · {p.klass} · {p.percentage}% overall</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold px-3 py-1 rounded-full"
                            style={{ background: pred.color + "20", color: pred.color }}>
                            {pred.level} Risk {pred.day}
                          </span>
                          <p className="text-xs text-gray-400 mt-1">{trendBadge(p.trend).icon} {trendBadge(p.trend).label}</p>
                        </div>
                      </div>
                    );
                  })}
                {profiles.filter((p) => p.prediction?.level !== "Low").length === 0 && (
                  <p className="text-center text-green-600 font-semibold py-6">🎉 All students predicted safe for tomorrow!</p>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        🤖 <strong>Algorithm:</strong> Risk scores use a weighted model — overall attendance % (40%), recent 7-day % (35%), consecutive absences (25%).
        Trends use split-half comparison. Day patterns use historical weekday absence frequencies. All analysis runs client-side in real-time.
      </div>
    </div>
  );
};

export default AIAnalysis;
