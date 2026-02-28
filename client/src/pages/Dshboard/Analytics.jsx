import React, { useEffect, useState } from "react";
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { getAttendanceRangeStats, listenRegisteredStudents, getAllAttendanceRaw } from "../../firebase";
import { analyzeAllStudents } from "../../Utils/attendanceAnalytics";

const daysBack = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
};

const PIE_COLORS = { present: "#22c55e", absent: "#ef4444", leave: "#f59e0b", notMarked: "#9ca3af" };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <p style={{ fontWeight: 700, color: "#374151", marginBottom: 4 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color, margin: "2px 0" }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function Analytics() {
  const [dailyStats,    setDailyStats]    = useState([]);
  const [classStats,    setClassStats]    = useState([]);
  const [todaySummary,  setTodaySummary]  = useState({ present: 0, absent: 0, leave: 0, notMarked: 0 });
  const [riskData,      setRiskData]      = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);

  useEffect(() => {
    const start30 = daysBack(29);
    const today   = daysBack(0);

    getAttendanceRangeStats(start30, today).then(({ perDay, perClassToday }) => {
      setDailyStats(perDay);
      setClassStats(perClassToday);
    });

    const unsub = listenRegisteredStudents((students) => {
      setTotalStudents(students.length);

      getAllAttendanceRaw().then((raw) => {
        const analyzed = analyzeAllStudents(raw, students);

        getAttendanceRangeStats(today, today).then(({ perDay }) => {
          const d      = perDay[0] || {};
          const marked = (d.present || 0) + (d.absent || 0) + (d.leave || 0);
          setTodaySummary({
            present   : d.present  || 0,
            absent    : d.absent   || 0,
            leave     : d.leave    || 0,
            notMarked : Math.max(0, students.length - marked),
          });
        });

        const buckets = [
          { range: "Safe (0–19)",      count: 0, fill: "#22c55e" },
          { range: "Moderate (20–44)", count: 0, fill: "#eab308" },
          { range: "High (45–69)",     count: 0, fill: "#f97316" },
          { range: "Critical (70+)",   count: 0, fill: "#ef4444" },
        ];
        analyzed.forEach(({ risk }) => {
          if      (risk < 20) buckets[0].count++;
          else if (risk < 45) buckets[1].count++;
          else if (risk < 70) buckets[2].count++;
          else                buckets[3].count++;
        });
        setRiskData(buckets);
      });
    });

    return () => unsub();
  }, []); // eslint-disable-line

  const pieData = [
    { name: "Present",    value: todaySummary.present,   color: PIE_COLORS.present   },
    { name: "Absent",     value: todaySummary.absent,    color: PIE_COLORS.absent    },
    { name: "On Leave",   value: todaySummary.leave,     color: PIE_COLORS.leave     },
    { name: "Not Marked", value: todaySummary.notMarked, color: PIE_COLORS.notMarked },
  ].filter((d) => d.value > 0);

  const attendanceRate = totalStudents > 0
    ? Math.round((todaySummary.present / totalStudents) * 100)
    : 0;

  return (
    <div className="space-y-6">

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Present Today",   value: todaySummary.present,  color: "#22c55e", icon: "✅" },
          { label: "Absent Today",    value: todaySummary.absent,   color: "#ef4444", icon: "❌" },
          { label: "On Leave",        value: todaySummary.leave,    color: "#f59e0b", icon: "📌" },
          { label: "Attendance Rate", value: `${attendanceRate}%`,  color: "#8b5cf6", icon: "📈" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl shadow p-4"
            style={{ borderLeft: `4px solid ${c.color}` }}>
            <p className="text-xs text-gray-500 font-medium">{c.label}</p>
            <p className="text-3xl font-black mt-1" style={{ color: c.color }}>{c.icon} {c.value}</p>
          </div>
        ))}
      </div>

      {/* ── 30-day area chart + today pie ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-2xl p-5 shadow">
          <h2 className="text-base font-semibold text-gray-800 mb-4">📈 30-Day Attendance Trend</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyStats}>
                <defs>
                  <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="present" name="Present" stroke="#8b5cf6" fill="url(#gP)" strokeWidth={2} />
                <Area type="monotone" dataKey="absent"  name="Absent"  stroke="#ef4444" fill="url(#gA)" strokeWidth={2} />
                <Area type="monotone" dataKey="leave"   name="Leave"   stroke="#f59e0b" fill="none"       strokeWidth={2} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow">
          <h2 className="text-base font-semibold text-gray-800 mb-4">🍩 Today's Distribution</h2>
          <div className="h-64 flex items-center justify-center">
            {pieData.length === 0 ? (
              <p className="text-gray-400 text-sm text-center">No attendance data yet for today</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    dataKey="value" paddingAngle={3}
                    label={({ name, percent }) => `${name}\n${(percent * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {pieData.map((e) => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Class bar + Risk bar ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 shadow">
          <h2 className="text-base font-semibold text-gray-800 mb-4">🏫 Today — Present by Class</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="class" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="present" name="Present" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent"  name="Absent"  fill="#fca5a5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow">
          <h2 className="text-base font-semibold text-gray-800 mb-4">🤖 AI Risk Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="range" tick={{ fontSize: 9 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                  {riskData.map((e) => <Cell key={e.range} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
