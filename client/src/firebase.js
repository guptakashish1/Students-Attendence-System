import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  set,
  remove,
  onValue,
  get,
  runTransaction,
} from "firebase/database";
import { getAuth } from "firebase/auth";
import emailjs from "@emailjs/browser";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

// ⚡ Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAOqW7Y8KFGBPXg5Q4dTQVI4Mrj5Uev1lc",
  authDomain: "students-attendence-syst-cdead.firebaseapp.com",
  databaseURL: "https://students-attendence-syst-cdead-default-rtdb.firebaseio.com",
  projectId: "students-attendence-syst-cdead",
  storageBucket: "students-attendence-syst-cdead.appspot.com",
  messagingSenderId: "156707597781",
  appId: "1:156707597781:web:478ddd43192039db1a215c",
};

// ⚡ Replace with your Telegram Bot Token (from @BotFather)
const TELEGRAM_BOT_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN";
const ADMIN_TELEGRAM_CHAT_ID = "YOUR_ADMIN_CHAT_ID"; // Required for escalation alerts
const TELEGRAM_BOT_USERNAME = "YOUR_BOT_USERNAME"; // e.g. MyAttendanceBot (without @)

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// ─── Local Date (Fix UTC Issue) ───
function getTodayDate() {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
}

// ─── STUDENT REGISTRATION ───
async function addStudent(student) {
  if (!student.rollNumber || !student.name || !student.studentClass) {
    throw new Error("Roll number, name and class are required!");
  }
  const studentRef = ref(db, `students/${student.rollNumber}`);
  await set(studentRef, {
    id: student.rollNumber,
    name: student.name,
    rollNumber: student.rollNumber,
    studentClass: student.studentClass,
    fatherName: student.fatherName || "",
    motherName: student.motherName || "",
    contact: student.contact || "",
    parentEmail: student.parentEmail || "",
    telegramChatId: student.telegramChatId || "",
    parentTelegramChatId: student.parentTelegramChatId || "",
  });
}

function listenRegisteredStudents(callback) {
  const studentsRef = ref(db, "students");
  return onValue(studentsRef, (snapshot) => {
    const data = snapshot.val() || {};
    callback(Object.values(data));
  });
}

async function deleteStudent(rollNumber) {
  const studentRef = ref(db, `students/${rollNumber}`);
  await remove(studentRef);
}

async function updateStudent(rollNumber, updatedData) {
  if (!rollNumber) throw new Error("Roll number is required!");
  const studentRef = ref(db, `students/${rollNumber}`);
  await set(studentRef, {
    ...updatedData,
    id: rollNumber,
    rollNumber: rollNumber,
  });
}

// ─── ATTENDANCE ───
async function markAttendance(student, date, status) {
  if (!student.rollNumber) throw new Error("Invalid student");

  const attendanceRef = ref(db, `attendance/${date}/${student.rollNumber}`);
  const now = new Date();
  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const snapshot = await get(attendanceRef);
  const existing = snapshot.exists() ? snapshot.val() : {};

  let updated = {
    id: student.rollNumber,
    name: student.name,
    rollNumber: student.rollNumber,
    studentClass: student.studentClass,
    status,
    checkInTime: existing.checkInTime || null,
    checkOutTime: existing.checkOutTime || null,
    parentEmail: student.parentEmail || "",
  };

  if (status === "IN") {
    updated.checkInTime = existing.checkInTime || time; // set once
    updated.status = "IN";
  } else if (status === "CHECKOUT") {
    updated.status = "IN"; // Keep as Present (Enter)
    updated.checkOutTime = time;
  } else if (status === "LEAVE") {
    updated.status = "LEAVE";
    updated.checkOutTime = time; // Student is leaving (On Leave)
  } else if (status === "ABSENT") {
    updated.checkInTime = null;
    updated.checkOutTime = null;
  }

  await set(attendanceRef, updated);

  // ✅ Only send notifications if Absent or Leave
  if (status === "ABSENT" || status === "LEAVE") {
    if (student.parentEmail) {
      await sendAbsentEmail(student, status, date);
    }
    if (status === "ABSENT" && student.telegramChatId) {
      const isConsecutive = await checkConsecutiveAbsences(student.rollNumber, date);

      if (isConsecutive) {
        // Build the link to our app for informing faculty
        const currentUrl = window.location.origin;
        const infoLink = `${currentUrl}/inform-faculty?rollNumber=${student.rollNumber}&date=${date}`;
        const smartMsg = `⚠️ Alert: Your child ${student.name} has been absent for 3 days continuously.\n\nWould you like to inform the faculty about the reason?\n\n[Click here to generate & send email](${infoLink})`;
        await sendTelegramMessage(student.telegramChatId, smartMsg);
      } else {
        const message = `🔔 Alert: Your child ${student.name} (Roll No: ${student.rollNumber}) is ABSENT today (${date}).`;
        await sendTelegramMessage(student.telegramChatId, message);
      }
    }

    // 🚨 Low Attendance Auto Escalation (< 75%)
    const percentage = await calculateAttendancePercentage(student.rollNumber);
    if (percentage < 75) {
      const escalationMsg =
        `🚨 *LOW ATTENDANCE WARNING*\n\n` +
        `👤 Student: *${student.name}*\n` +
        `🎓 Class: ${student.studentClass}\n` +
        `🔢 Roll No: ${student.rollNumber}\n` +
        `📉 Current Attendance: *${percentage.toFixed(2)}%*\n\n` +
        `⚠️ This is below the mandatory *75%* requirement.\n` +
        `Please ensure regular attendance to avoid academic consequences.`;

      const parentWarningMsg =
        `👨‍👩‍👦 *Parent Alert — Low Attendance*\n\n` +
        `Dear Parent,\n\n` +
        `Your child *${student.name}* (Roll No: ${student.rollNumber}, Class: ${student.studentClass}) ` +
        `has an attendance of *${percentage.toFixed(2)}%*, which is below the required *75%*.\n\n` +
        `Please contact the school administration immediately.`;

      // Notify Student
      if (student.telegramChatId) await sendTelegramMessage(student.telegramChatId, escalationMsg);
      // Notify Parent separately
      if (student.parentTelegramChatId) await sendTelegramMessage(student.parentTelegramChatId, parentWarningMsg);
      // Notify Admin
      if (ADMIN_TELEGRAM_CHAT_ID && ADMIN_TELEGRAM_CHAT_ID !== "YOUR_ADMIN_CHAT_ID") {
        await sendTelegramMessage(ADMIN_TELEGRAM_CHAT_ID, escalationMsg);
      }
    }
  }
}

async function calculateAttendancePercentage(rollNumber) {
  const attendanceRef = ref(db, "attendance");
  const snapshot = await get(attendanceRef);
  if (!snapshot.exists()) return 0;

  const data = snapshot.val();
  let presentDays = 0;
  let totalDays = 0;

  Object.values(data).forEach((dayRecords) => {
    if (dayRecords[rollNumber]) {
      totalDays++;
      if (dayRecords[rollNumber].status === "IN") {
        presentDays++;
      }
    }
  });

  return totalDays === 0 ? 0 : (presentDays / totalDays) * 100;
}

// ─── SMART ABSENCE ALERT ───
async function checkConsecutiveAbsences(rollNumber, date) {
  const d = new Date(date);
  const dates = [];
  for (let i = 1; i <= 2; i++) {
    const prev = new Date(d);
    prev.setDate(d.getDate() - i);
    dates.push(prev.toLocaleDateString("en-CA"));
  }

  let consecutiveCount = 1; // Today is the 1st
  for (const prevDate of dates) {
    const refPath = ref(db, `attendance/${prevDate}/${rollNumber}`);
    const snap = await get(refPath);
    if (snap.exists() && snap.val().status === "ABSENT") {
      consecutiveCount++;
    } else {
      break;
    }
  }
  return consecutiveCount >= 3;
}

// ─── REPORT GENERATION ───
async function generateAttendanceReport(student, type = "pdf") {
  const attendanceRef = ref(db, "attendance");
  const snapshot = await get(attendanceRef);
  if (!snapshot.exists()) return null;

  const data = snapshot.val();
  const records = [];
  Object.keys(data).forEach((date) => {
    if (data[date][student.rollNumber]) {
      records.push({
        date,
        status: data[date][student.rollNumber].status,
        checkIn: data[date][student.rollNumber].checkInTime || "-",
        checkOut: data[date][student.rollNumber].checkOutTime || "-",
      });
    }
  });

  // Sort by date
  records.sort((a, b) => new Date(a.date) - new Date(b.date));

  if (type === "pdf") {
    const doc = new jsPDF();
    doc.text(`Attendance Report: ${student.name} (${student.rollNumber})`, 14, 15);
    doc.autoTable({
      startY: 20,
      head: [["Date", "Status", "Check-In", "Check-Out"]],
      body: records.map((r) => [
        r.date,
        r.status === "IN" ? "Present" : r.status === "ABSENT" ? "Absent" : "On Leave",
        r.checkIn,
        r.checkOut,
      ]),
    });
    return doc.output("blob");
  } else {
    const ws = XLSX.utils.json_to_sheet(records);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
}

async function sendTelegramDocument(chatId, blob, filename) {
  if (!chatId || !TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === "YOUR_TELEGRAM_BOT_TOKEN") return;
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`;

  const formData = new FormData();
  formData.append("chat_id", chatId);
  formData.append("document", blob, filename);

  try {
    await fetch(url, {
      method: "POST",
      body: formData,
    });
  } catch (error) {
    console.error("Telegram Document API Error:", error);
  }
}

// ─── TELEGRAM BOT INTERACTION ───
let lastUpdateId = 0;

// The polling based Telegram command handling has been deprecated in favor of a webhook server.
// Retained for reference; no longer invoked.
// async function processTelegramCommands() {
//   if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === "YOUR_TELEGRAM_BOT_TOKEN") return;
//   const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}`;
//   try {
//     const response = await fetch(url);
//     const data = await response.json();
//     if (data.ok && data.result.length > 0) {
//       for (const update of data.result) {
//         lastUpdateId = update.update_id;
//         const msg = update.message;
//         if (!msg || !msg.text) continue;
//         const chatId = msg.chat.id.toString();
//         const text = msg.text.trim();
//         // Find student by Chat ID
//         const studentsRef = ref(db, "students");
//         const studentSnap = await get(studentsRef);
//         if (studentSnap.exists()) {
//           const students = Object.values(studentSnap.val());
//           const student = students.find((s) => s.telegramChatId === chatId);
//           if (student) {
//             if (text === "/attendance") {
//               const today = new Date().toLocaleDateString("en-CA");
//               const attRef = ref(db, `attendance/${today}/${student.rollNumber}`);
//               const attSnap = await get(attRef);
//               const status = attSnap.exists() ? attSnap.val().status : "Not marked yet";
//               await sendTelegramMessage(chatId, `📅 Today's Attendance (${today}):\nStatus: ${status === "IN" ? "✅ Entered" : status === "ABSENT" ? "❌ Absent" : "📌 On Leave"}`);
//             } else if (text === "/percentage") {
//               const perc = await calculateAttendancePercentage(student.rollNumber);
//               await sendTelegramMessage(chatId, `📊 Your Current Attendance: ${perc.toFixed(2)}%`);
//             } else if (text === "/download") {
//               await sendTelegramMessage(chatId, "⏳ Generating your reports... Please wait.");
//               const pdfBlob = await generateAttendanceReport(student, "pdf");
//               const xlsxBlob = await generateAttendanceReport(student, "xlsx");
//               if (pdfBlob) await sendTelegramDocument(chatId, pdfBlob, `Attendance_${student.rollNumber}.pdf`);
//               if (xlsxBlob) await sendTelegramDocument(chatId, xlsxBlob, `Attendance_${student.rollNumber}.xlsx`);
//             }
//           }
//         }
//       }
//     }
//   } catch (error) {
//     console.error("Telegram Command Error:", error);
//   }
// }
// if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === "YOUR_TELEGRAM_BOT_TOKEN") return;
// const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?offset=${lastUpdateId + 1}`;
// 
// try {
//   const response = await fetch(url);
//   const data = await response.json();
// 
//   if (data.ok && data.result.length > 0) {
//     for (const update of data.result) {
//       lastUpdateId = update.update_id;
//       const msg = update.message;
//       if (!msg || !msg.text) continue;
// 
//       const chatId = msg.chat.id.toString();
//       const text = msg.text.trim();
// 
//       // Find student by Chat ID
//       const studentsRef = ref(db, "students");
//       const studentSnap = await get(studentsRef);
//       if (studentSnap.exists()) {
//         const students = Object.values(studentSnap.val());
//         const student = students.find((s) => s.telegramChatId === chatId);
// 
//         if (student) {
//           if (text === "/attendance") {
//             const today = new Date().toLocaleDateString("en-CA");
//             const attRef = ref(db, `attendance/${today}/${student.rollNumber}`);
//             const attSnap = await get(attRef);
//             const status = attSnap.exists() ? attSnap.val().status : "Not marked yet";
//             await sendTelegramMessage(chatId, `📅 Today's Attendance (${today}):\nStatus: ${status === "IN" ? "✅ Entered" : status === "ABSENT" ? "❌ Absent" : "📌 On Leave"}`);
//           } else if (text === "/percentage") {
//             const perc = await calculateAttendancePercentage(student.rollNumber);
//             await sendTelegramMessage(chatId, `📊 Your Current Attendance: ${perc.toFixed(2)}%`);
//           } else if (text === "/download") {
//             await sendTelegramMessage(chatId, "⏳ Generating your reports... Please wait.");
//             const pdfBlob = await generateAttendanceReport(student, "pdf");
//             const xlsxBlob = await generateAttendanceReport(student, "xlsx");
// 
//             if (pdfBlob) await sendTelegramDocument(chatId, pdfBlob, `Attendance_${student.rollNumber}.pdf`);
//             if (xlsxBlob) await sendTelegramDocument(chatId, xlsxBlob, `Attendance_${student.rollNumber}.xlsx`);
//           }
//         }
//       }
//     }
//   }
// } catch (error) {
//   console.error("Telegram Command Error:", error);
// }
// }

// ─── RATE LIMITER (localStorage sliding window) ───────────────────────────
const _RL_WINDOW_MS = 60_000; // 1 minute
const _RL_MAX       = 5;      // max messages per chatId per window

function _checkAndUpdateRateLimit(chatId) {
  const key = `tg_rl_${chatId}`;
  const now = Date.now();
  let data;
  try { data = JSON.parse(localStorage.getItem(key)) || { ts: [] }; }
  catch { data = { ts: [] }; }

  const recent = data.ts.filter((t) => now - t < _RL_WINDOW_MS);
  if (recent.length >= _RL_MAX) return false; // blocked

  recent.push(now);
  try { localStorage.setItem(key, JSON.stringify({ ts: recent })); } catch {}
  return true; // allowed
}

// ─── BOT LOGGER (Firebase) ────────────────────────────────────────────────
async function _logFailedMessage({ chatId, message, error }) {
  try {
    await set(ref(db, `botLogs/errors/${Date.now()}`), {
      chatId,
      message: String(message).substring(0, 200),
      error: String(error).substring(0, 500),
      timestamp: new Date().toISOString(),
    });
  } catch { /* never throw from logger */ }
}

async function logBotInteraction({ chatId, command, rollNumber = null, result = "ok", note = null }) {
  try {
    await set(ref(db, `botLogs/interactions/${Date.now()}`), {
      chatId, command, rollNumber, result, note,
      timestamp: new Date().toISOString(),
    });
    // Increment command usage counter (atomic)
    const statKey = command.replace(/\//g, "_").replace(/^_/, "");
    await runTransaction(ref(db, `botLogs/commandStats/${statKey}`), (cur) =>
      cur === null
        ? { count: 1, lastUsed: new Date().toISOString() }
        : { count: (cur.count || 0) + 1, lastUsed: new Date().toISOString() }
    );
  } catch { /* never throw from logger */ }
}

function listenBotLogs(type, callback) {
  return onValue(ref(db, `botLogs/${type}`), (snap) => {
    if (snap.exists()) {
      const data = snap.val();
      callback(
        Object.entries(data)
          .map(([id, v]) => ({ id, ...v }))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      );
    } else {
      callback([]);
    }
  });
}

async function getCommandStats() {
  const snap = await get(ref(db, "botLogs/commandStats"));
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([cmd, v]) => ({ cmd, ...v }));
}

// ─── TELEGRAM initData SIGNATURE VERIFICATION ─────────────────────────────
async function verifyTelegramInitData(initDataString) {
  if (!initDataString || TELEGRAM_BOT_TOKEN === "YOUR_TELEGRAM_BOT_TOKEN") return true;
  try {
    const params = new URLSearchParams(initDataString);
    const hash   = params.get("hash");
    if (!hash) return false;

    params.delete("hash");
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const enc = new TextEncoder();
    const secretKey = await crypto.subtle.importKey(
      "raw", enc.encode("WebAppData"),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const secretBuf = await crypto.subtle.sign("HMAC", secretKey, enc.encode(TELEGRAM_BOT_TOKEN));

    const verifyKey = await crypto.subtle.importKey(
      "raw", secretBuf,
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const sigBuf = await crypto.subtle.sign("HMAC", verifyKey, enc.encode(dataCheckString));
    const computed = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const valid = computed === hash;
    if (!valid) console.warn("[Telegram] ❌ initData signature invalid — possible spoofed request.");
    return valid;
  } catch (err) {
    console.error("[Telegram] Verification error:", err);
    return false;
  }
}

// ─── SEND TELEGRAM MESSAGE (with rate limit + logging) ────────────────────
async function sendTelegramMessage(chatId, text) {
  if (!chatId || !TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN === "YOUR_TELEGRAM_BOT_TOKEN") return;

  // 🚦 Rate limit check
  if (!_checkAndUpdateRateLimit(chatId)) {
    console.warn(`[RateLimit] 🚫 Blocked message to ${chatId} — 5/min limit reached`);
    await _logFailedMessage({ chatId, message: text, error: "Rate limit exceeded (5 msg/min)" });
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      await _logFailedMessage({ chatId, message: text, error: `HTTP ${res.status}: ${JSON.stringify(errData)}` });
    }
  } catch (error) {
    console.error("Telegram API Error:", error);
    await _logFailedMessage({ chatId, message: text, error: error.message });
  }
}

// ─── QR ATTENDANCE TOKEN ───
function generateTokenString() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let i = 0; i < 8; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

async function generateDailyToken(date) {
  const tokenRef = ref(db, `qrTokens/${date}`);
  const snap = await get(tokenRef);
  if (snap.exists()) return snap.val().token; // Reuse today's token if already generated
  const token = generateTokenString();
  await set(tokenRef, { token, date, createdAt: new Date().toISOString() });
  return token;
}

async function getDailyToken(date) {
  const tokenRef = ref(db, `qrTokens/${date}`);
  const snap = await get(tokenRef);
  return snap.exists() ? snap.val().token : null;
}

async function verifyDailyToken(date, token) {
  const stored = await getDailyToken(date);
  return stored && stored === token;
}

function getTelegramBotUsername() {
  return TELEGRAM_BOT_USERNAME;
}

// ─── EMAIL NOTIFICATION ───
function sendAbsentEmail(student, status, date) {
  return emailjs.send(
    "your_service_id", // ⚡ replace
    "your_template_id", // ⚡ replace
    {
      to_email: student.parentEmail,
      student_name: student.name,
      roll_number: student.rollNumber,
      student_class: student.studentClass,
      status: status,
      date: date,
    },
    "your_public_key" // ⚡ replace
  );
}

async function getAttendanceByMonth(month) {
  const attendanceRef = ref(db, "attendance");
  const snapshot = await get(attendanceRef);
  if (!snapshot.exists()) return [];

  const data = snapshot.val();
  const allRecords = [];

  // Filter keys (dates) that start with the requested month prefix
  Object.keys(data).forEach((date) => {
    if (date.startsWith(month)) {
      Object.keys(data[date]).forEach((roll) => {
        allRecords.push({
          ...data[date][roll],
          date,
          rollNumber: roll,
        });
      });
    }
  });

  return allRecords;
}

// ─── ATTENDANCE LISTENER ───
function listenAttendance(date, callback) {
  const attendanceRef = ref(db, `attendance/${date}`);
  return onValue(attendanceRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const records = Object.keys(data).map((roll) => ({
        ...data[roll],
        rollNumber: roll,
      }));
      callback(records);
    } else {
      callback([]);
    }
  });
}

// ─── BROADCAST HISTORY ───
async function saveBroadcast(message, recipientCount) {
  const timestamp = new Date().toISOString();
  const broadcastRef = ref(db, `broadcasts/${Date.now()}`);
  await set(broadcastRef, { message, recipientCount, timestamp });
}

function listenBroadcasts(callback) {
  const broadcastRef = ref(db, "broadcasts");
  return onValue(broadcastRef, (snap) => {
    if (snap.exists()) {
      const data = snap.val();
      const list = Object.entries(data).map(([id, v]) => ({ id, ...v })).reverse();
      callback(list);
    } else {
      callback([]);
    }
  });
}

// ─── GENERIC CRUD HELPERS ───
async function addRecord(path, data) {
  const newRef = ref(db, `${path}/${Date.now()}`);
  await set(newRef, data);
}

async function deleteRecord(path, id) {
  await remove(ref(db, `${path}/${id}`));
}

async function updateRecord(path, id, data) {
  await set(ref(db, `${path}/${id}`), data);
}

function listenCollection(path, callback) {
  return onValue(ref(db, path), (snap) => {
    if (snap.exists()) {
      const data = snap.val();
      callback(Object.entries(data).map(([id, v]) => ({ id, ...v })));
    } else {
      callback([]);
    }
  });
}

// ─── EXPORTS ───
export {
  db,
  auth,
  getTodayDate,
  addStudent,
  listenRegisteredStudents,
  deleteStudent,
  updateStudent,
  markAttendance,
  listenAttendance,
  getAttendanceByMonth,
  calculateAttendancePercentage,
  sendTelegramMessage,
  sendTelegramDocument,
  saveBroadcast,
  listenBroadcasts,
  addRecord,
  deleteRecord,
  updateRecord,
  listenCollection,
  generateDailyToken,
  getDailyToken,
  verifyDailyToken,
  getTelegramBotUsername,
  verifyTelegramInitData,
  logBotInteraction,
  listenBotLogs,
  getCommandStats,
};
