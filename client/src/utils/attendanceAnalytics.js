/**
 * attendanceAnalytics.js — AI Attendance Pattern Analysis Engine
 *
 * Pure-JS analytics module. No external dependencies.
 * Works directly on Firebase attendance records.
 */

// ─── Risk Score ───────────────────────────────────────────────────────────────
/**
 * Returns a risk score 0–100 for a student based on their attendance records.
 * Weights: overall % (40pts) + recent 7-day % (35pts) + consecutive absences (25pts)
 * @param {Array<{status: string, date: string}>} records
 * @returns {number} 0 = safe, 100 = critical
 */
export function calculateRiskScore(records) {
  if (!records || records.length === 0) return 0;

  const total   = records.length;
  const present = records.filter((r) => r.status === "IN").length;
  const pct     = (present / total) * 100;

  // Recent window (last 7)
  const recent      = records.slice(-7);
  const recentPres  = recent.filter((r) => r.status === "IN").length;
  const recentPct   = (recentPres / recent.length) * 100;

  // Consecutive absences at tail
  let consecutive = 0;
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].status === "ABSENT") consecutive++;
    else break;
  }

  let score = 0;
  // Overall %
  if      (pct < 60) score += 40;
  else if (pct < 75) score += 28;
  else if (pct < 85) score += 12;

  // Recent %
  if      (recentPct < 43) score += 35;
  else if (recentPct < 57) score += 22;
  else if (recentPct < 71) score += 10;

  // Consecutive
  score += Math.min(consecutive * 8, 25);

  return Math.min(Math.round(score), 100);
}

// ─── Risk Label ───────────────────────────────────────────────────────────────
export function riskLabel(score) {
  if (score >= 70) return { label: "Critical",  color: "#ef4444", bg: "#fee2e2" };
  if (score >= 45) return { label: "High",      color: "#f97316", bg: "#ffedd5" };
  if (score >= 20) return { label: "Moderate",  color: "#eab308", bg: "#fef9c3" };
  return              { label: "Safe",       color: "#22c55e", bg: "#dcfce7" };
}

// ─── Trend Detection ──────────────────────────────────────────────────────────
/**
 * Splits records in half, compares attendance rates.
 * @returns {'improving'|'declining'|'stable'|'insufficient'}
 */
export function detectTrend(records) {
  if (!records || records.length < 4) return "insufficient";

  const half  = Math.floor(records.length / 2);
  const first = records.slice(0, half);
  const last  = records.slice(half);

  const firstPct = first.filter((r) => r.status === "IN").length / first.length;
  const lastPct  = last.filter((r)  => r.status === "IN").length / last.length;
  const diff     = lastPct - firstPct;

  if (diff >  0.12) return "improving";
  if (diff < -0.12) return "declining";
  return "stable";
}

export function trendBadge(trend) {
  const map = {
    improving:    { icon: "📈", label: "Improving",   color: "#22c55e" },
    declining:    { icon: "📉", label: "Declining",   color: "#ef4444" },
    stable:       { icon: "➡️",  label: "Stable",      color: "#6366f1" },
    insufficient: { icon: "⏳", label: "Not enough data", color: "#9ca3af" },
  };
  return map[trend] || map.insufficient;
}

// ─── Day-of-week Pattern ──────────────────────────────────────────────────────
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Returns absence rates per weekday.
 * @param {Array<{status:string, date:string}>} records
 * @returns {Array<{day:string, absenceRate:number, total:number}>}
 */
export function getDayPattern(records) {
  const totals   = {};
  const absences = {};

  (records || []).forEach((r) => {
    const d = new Date(r.date);
    if (isNaN(d)) return;
    const day = DAY_NAMES[d.getDay()];
    if (day === "Sun") return;
    totals[day]   = (totals[day]   || 0) + 1;
    if (r.status === "ABSENT") absences[day] = (absences[day] || 0) + 1;
  });

  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => ({
    day,
    total       : totals[day]   || 0,
    absent      : absences[day] || 0,
    absenceRate : totals[day]
      ? Math.round(((absences[day] || 0) / totals[day]) * 100)
      : 0,
  }));
}

// ─── Streak Analysis ──────────────────────────────────────────────────────────
/**
 * @param {Array<{status:string}>} records  sorted oldest→newest
 * @returns {{ current:number, best:number, currentType:'present'|'absent' }}
 */
export function getStreaks(records) {
  if (!records || records.length === 0) return { current: 0, best: 0, currentType: "present" };

  let best    = 0;
  let current = 0;
  let prev    = null;

  records.forEach((r) => {
    const isPresent = r.status === "IN";
    if (prev === null || isPresent === prev) {
      current++;
    } else {
      best    = Math.max(best, current);
      current = 1;
    }
    prev = isPresent;
  });

  best = Math.max(best, current);

  const lastStatus  = records[records.length - 1]?.status;
  const currentType = lastStatus === "IN" ? "present" : "absent";

  return { current, best, currentType };
}

// ─── Tomorrow Absence Prediction ─────────────────────────────────────────────
/**
 * Predicts 'High' | 'Medium' | 'Low' chance of absence tomorrow.
 * Uses risk score + trend + today's day-of-week pattern.
 */
export function predictAbsenceProbability(records) {
  const risk  = calculateRiskScore(records);
  const trend = detectTrend(records);

  const tomorrow  = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDay = DAY_NAMES[tomorrow.getDay()];

  const dayPat = getDayPattern(records);
  const dayInfo = dayPat.find((d) => d.day === tomorrowDay);
  const dayRate = dayInfo?.absenceRate || 0;

  let score = 0;
  score += risk * 0.5;
  if (trend === "declining")  score += 20;
  if (trend === "improving")  score -= 10;
  score += dayRate * 0.3;

  if (score >= 55) return { level: "High",   color: "#ef4444", day: tomorrowDay };
  if (score >= 30) return { level: "Medium", color: "#f97316", day: tomorrowDay };
  return              { level: "Low",    color: "#22c55e", day: tomorrowDay };
}

// ─── Full Student Analysis ────────────────────────────────────────────────────
/**
 * Builds a complete analysis profile for one student.
 * @param {string} rollNumber
 * @param {Array}  allDayRecords  - flat array of all attendance records for this student
 *                                  each: { date, status }
 */
export function analyzeStudent(rollNumber, allDayRecords) {
  const sorted = [...allDayRecords].sort((a, b) => a.date.localeCompare(b.date));

  const total   = sorted.length;
  const present = sorted.filter((r) => r.status === "IN").length;
  const absent  = sorted.filter((r) => r.status === "ABSENT").length;
  const leave   = sorted.filter((r) => r.status === "LEAVE").length;
  const pct     = total > 0 ? (present / total) * 100 : 0;

  const risk       = calculateRiskScore(sorted);
  const trend      = detectTrend(sorted);
  const streaks    = getStreaks(sorted);
  const dayPattern = getDayPattern(sorted);
  const prediction = predictAbsenceProbability(sorted);

  return {
    rollNumber,
    total, present, absent, leave,
    percentage : parseFloat(pct.toFixed(1)),
    risk,
    riskInfo   : riskLabel(risk),
    trend,
    trendInfo  : trendBadge(trend),
    streaks,
    dayPattern,
    prediction,
    belowThreshold: pct < 75,
  };
}

// ─── Batch Analysis ───────────────────────────────────────────────────────────
/**
 * Runs analyzeStudent for every student.
 * @param {Object} allAttendance  - Firebase attendance node: { date: { rollNo: record } }
 * @param {Array}  students       - Array of student objects { rollNumber, name, studentClass }
 * @returns {Array<AnalysisProfile>}
 */
export function analyzeAllStudents(allAttendance, students) {
  const studentMap = {};
  students.forEach((s) => { studentMap[s.rollNumber] = s; });

  // Reshape: group records by rollNumber
  const byStudent = {};
  Object.entries(allAttendance || {}).forEach(([date, dayRecords]) => {
    Object.entries(dayRecords || {}).forEach(([roll, rec]) => {
      if (!byStudent[roll]) byStudent[roll] = [];
      byStudent[roll].push({ date, status: rec.status });
    });
  });

  return students.map((s) => {
    const records = byStudent[s.rollNumber] || [];
    const analysis = analyzeStudent(s.rollNumber, records);
    return {
      ...analysis,
      name  : s.name,
      klass : s.studentClass,
    };
  }).sort((a, b) => b.risk - a.risk); // Most at-risk first
}
