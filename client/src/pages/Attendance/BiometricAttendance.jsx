import React, { useState, useEffect } from "react";
import {
  listenRegisteredStudents,
  markAttendance,
  createAndSendOTP,
  verifyAndClearOTP,
  getTodayDate,
} from "../../firebase";

// ─── WebAuthn helpers ─────────────────────────────────────────────────────────
function isWebAuthnSupported() {
  return !!(window.PublicKeyCredential && navigator.credentials);
}

function base64urlToBuffer(b64) {
  const pad   = "=".repeat((4 - (b64.length % 4)) % 4);
  const b64s  = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin   = atob(b64s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0)).buffer;
}

function bufferToBase64url(buf) {
  const bytes = new Uint8Array(buf);
  let str = "";
  bytes.forEach((b) => { str += String.fromCharCode(b); });
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

const RP_NAME = "Attendance System";
const RP_ID   = window.location.hostname;

const STEPS = {
  SELECT     : "select",
  BIOMETRIC  : "biometric",
  OTP        : "otp",
  DONE       : "done",
  ERROR      : "error",
};

const BiometricAttendance = ({ userEmail, userRole }) => {
  const [students,     setStudents]     = useState([]);
  const [selectedRoll, setSelectedRoll] = useState("");
  const [step,         setStep]         = useState(STEPS.SELECT);
  const [msg,          setMsg]          = useState("");
  const [otp,          setOtp]          = useState("");
  const [verifying,    setVerifying]    = useState(false);
  const [marked,       setMarked]       = useState({});
  const [searchMode,   setSearchMode]   = useState("dropdown"); // "dropdown" or "manual"
  const [manualSearch, setManualSearch] = useState("");
  const [filteredStudents, setFilteredStudents] = useState([]);

  const webAuthnOK = isWebAuthnSupported();

  useEffect(() => {
    const unsub = listenRegisteredStudents((allStudents) => {
      // Filter for students - only show their own record
      if (userRole === "student" && userEmail) {
        const myStudents = allStudents.filter(s => 
          s.studentEmail?.toLowerCase() === userEmail.toLowerCase() || 
          s.parentEmail?.toLowerCase() === userEmail.toLowerCase()
        );
        setStudents(myStudents);
        // Auto-select if only one student
        if (myStudents.length === 1) {
          setSelectedRoll(myStudents[0].rollNumber);
        }
      } else {
        setStudents(allStudents);
      }
    });
    return () => unsub();
  }, [userEmail, userRole]);

  useEffect(() => {
    if (searchMode === "manual" && manualSearch.trim()) {
      const search = manualSearch.toLowerCase();
      const filtered = students.filter(s => 
        s.name.toLowerCase().includes(search) ||
        s.rollNumber.toLowerCase().includes(search) ||
        s.studentClass.toLowerCase().includes(search)
      );
      setFilteredStudents(filtered);
    } else {
      setFilteredStudents([]);
    }
  }, [manualSearch, students, searchMode]);

  const student = students.find((s) => s.rollNumber === selectedRoll);

  // ── Step 1: Send OTP directly (skip biometric) ────────────────────────
  async function startBiometric() {
    if (!student) return;
    setMsg("📱 Sending OTP via Telegram…");
    await sendOTP();
  }

  // ── Register a new WebAuthn credential on this device ────────────────
  // REMOVED - Not needed for OTP-only mode

  // ── Send OTP ──────────────────────────────────────────────────────────
  async function sendOTP() {
    if (!student?.telegramChatId) {
      setMsg("❌ Student has no Telegram Chat ID. Add it in the Registered Students page.");
      setStep(STEPS.ERROR);
      return;
    }
    try {
      await createAndSendOTP(student.telegramChatId, student.name);
      setMsg(`📱 OTP sent to ${student.name}'s Telegram. Check the message and enter the code below.`);
      setStep(STEPS.OTP);
    } catch (err) {
      setMsg("Failed to send OTP: " + err.message);
      setStep(STEPS.ERROR);
    }
  }

  // ── Verify OTP + mark attendance ──────────────────────────────────────
  async function handleVerifyOTP() {
    if (!otp || otp.length !== 6) { setMsg("Enter the 6-digit code."); return; }
    setVerifying(true);
    const result = await verifyAndClearOTP(student.telegramChatId, otp);
    if (result.valid) {
      const today = getTodayDate();
      await markAttendance(student, today, "IN");
      setMarked((p) => ({ ...p, [selectedRoll]: true }));
      setStep(STEPS.DONE);
      setMsg(`✅ Attendance confirmed for ${student.name}!`);
    } else {
      setMsg(`❌ ${result.reason}. Try again or resend OTP.`);
    }
    setVerifying(false);
  }

  function resetForm() {
    setStep(STEPS.SELECT);
    setSelectedRoll("");
    setOtp("");
    setMsg("");
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-purple-700">
          📱 {userRole === "student" ? "My Telegram OTP Attendance" : "Telegram OTP Attendance"}
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          {userRole === "student" 
            ? "Mark your attendance using Telegram OTP verification." 
            : "Secure attendance verification using Telegram OTP (One-Time Password)."}
        </p>
      </div>

      {/* WebAuthn availability badge */}
      <div className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full inline-flex items-center gap-2">
        📱 OTP-Based Attendance (Telegram Verification)
      </div>

      {/* Main card */}
      <div className="bg-white rounded-2xl shadow-lg p-6 space-y-5">

        {/* STEP: SELECT */}
        {(step === STEPS.SELECT || step === STEPS.ERROR) && (
          <>
            {userRole !== "student" && (
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => { setSearchMode("dropdown"); setManualSearch(""); setSelectedRoll(""); }}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition ${
                    searchMode === "dropdown" 
                      ? "bg-purple-600 text-white" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  📋 Dropdown
                </button>
                <button
                  onClick={() => { setSearchMode("manual"); setSelectedRoll(""); }}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition ${
                    searchMode === "manual" 
                      ? "bg-purple-600 text-white" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  🔍 Search
                </button>
              </div>
            )}

            {(searchMode === "dropdown" || userRole === "student") ? (
              <>
                <label className="block text-sm font-semibold text-gray-700">Select Student</label>
                <select value={selectedRoll} onChange={(e) => { setSelectedRoll(e.target.value); setMsg(""); }}
                  className="w-full border p-2 rounded-lg text-sm">
                  <option value="">-- Choose your name --</option>
                  {students.map((s) => (
                    <option key={s.rollNumber} value={s.rollNumber} disabled={!!marked[s.rollNumber]}>
                      {marked[s.rollNumber] ? "✅ " : ""}{s.name} — Roll: {s.rollNumber} — Class: {s.studentClass}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label className="block text-sm font-semibold text-gray-700">Search Student</label>
                <input
                  type="text"
                  placeholder="Type name, roll number, or class..."
                  value={manualSearch}
                  onChange={(e) => { setManualSearch(e.target.value); setSelectedRoll(""); }}
                  className="w-full border-2 border-purple-300 focus:border-purple-600 p-3 rounded-lg text-sm outline-none"
                />
                
                {manualSearch.trim() && filteredStudents.length > 0 && (
                  <div className="mt-2 border rounded-lg max-h-60 overflow-y-auto">
                    {filteredStudents.map((s) => (
                      <button
                        key={s.rollNumber}
                        onClick={() => { setSelectedRoll(s.rollNumber); setManualSearch(""); setMsg(""); }}
                        disabled={!!marked[s.rollNumber]}
                        className={`w-full text-left p-3 border-b hover:bg-purple-50 transition text-sm ${
                          marked[s.rollNumber] ? "bg-gray-100 cursor-not-allowed" : ""
                        }`}
                      >
                        <div className="font-semibold text-gray-800">
                          {marked[s.rollNumber] ? "✅ " : ""}{s.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Roll: {s.rollNumber} • Class: {s.studentClass} • Parent: {s.parentName || "N/A"}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {manualSearch.trim() && filteredStudents.length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">No students found matching "{manualSearch}"</p>
                )}

                {selectedRoll && (
                  <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <p className="text-sm font-semibold text-purple-800">Selected:</p>
                    <p className="text-sm text-gray-700 mt-1">
                      {student?.name} — Roll: {student?.rollNumber} — Class: {student?.studentClass}
                    </p>
                  </div>
                )}
              </>
            )}

            {msg && <p className="text-sm text-red-500 mt-2">{msg}</p>}

            <button onClick={startBiometric}
              disabled={!selectedRoll || marked[selectedRoll]}
              className={`w-full py-3 rounded-xl font-bold text-sm transition mt-4 ${
                !selectedRoll || marked[selectedRoll]
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-700 text-white"
              }`}>
              📱 Send OTP & Mark Attendance
            </button>
          </>
        )}

        {/* STEP: BIOMETRIC */}
        {step === STEPS.BIOMETRIC && (
          <div className="text-center py-6 space-y-4">
            <div className="text-6xl animate-pulse">🔐</div>
            <p className="text-purple-700 font-semibold">{msg}</p>
            <p className="text-gray-400 text-sm">Use your device's fingerprint scanner or Face ID.</p>
          </div>
        )}

        {/* STEP: OTP */}
        {step === STEPS.OTP && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-5xl mb-2">📱</div>
              <p className="text-sm text-gray-600">{msg}</p>
            </div>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="w-full border-2 border-purple-300 focus:border-purple-600 p-3 rounded-xl text-center text-2xl font-mono tracking-widest outline-none"
            />

            <button onClick={handleVerifyOTP} disabled={verifying || otp.length !== 6}
              className={`w-full py-3 rounded-xl font-bold text-sm transition ${
                otp.length === 6 && !verifying
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}>
              {verifying ? "Verifying…" : "✅ Verify & Mark Present"}
            </button>

            <button onClick={sendOTP}
              className="w-full text-xs text-purple-600 underline py-1">
              🔄 Resend OTP
            </button>
          </div>
        )}

        {/* STEP: DONE */}
        {step === STEPS.DONE && (
          <div className="text-center py-6 space-y-4">
            <div className="text-6xl">🎉</div>
            <p className="text-green-700 font-bold text-lg">{msg}</p>
            <button onClick={resetForm}
              className="mt-2 px-6 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700">
              Mark Another Student
            </button>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="bg-white rounded-2xl shadow p-5">
        <h3 className="font-bold text-gray-800 mb-3 text-sm">⚙️ How OTP Attendance Works</h3>
        <div className="space-y-2">
          {[
            { icon: "1️⃣", text: "Student selects their name from dropdown or searches by name/roll/class." },
            { icon: "2️⃣", text: "A 6-digit OTP is sent to the student's Telegram Chat ID." },
            { icon: "3️⃣", text: "Student enters the OTP within the time limit." },
            { icon: "4️⃣", text: "Attendance marked + Telegram confirmation sent." },
          ].map((s) => (
            <div key={s.icon} className="flex gap-3 text-sm text-gray-600">
              <span className="flex-shrink-0">{s.icon}</span>
              <span>{s.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        💡 <strong>Tip:</strong> Make sure students have their Telegram Chat ID saved in their profile.
        For face recognition attendance, use the "Face Recognition" page instead.
      </div>
    </div>
  );
};

export default BiometricAttendance;
