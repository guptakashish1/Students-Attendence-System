import React, { useState, useEffect } from "react";
import { listenRegisteredStudents, sendTelegramMessage, saveBroadcast, listenBroadcasts } from "../../firebase";

const CLASS_OPTIONS = [
  "PlayGroup", "Nursery", "KG",
  "Class I", "Class II", "Class III", "Class IV", "Class V",
  "Class VI", "Class VII", "Class VIII",
  "Class IX", "Class X", "Class XI", "Class XII",
];

const AdminBroadcast = () => {
  const [students, setStudents]         = useState([]);
  const [message, setMessage]           = useState("");
  const [loading, setLoading]           = useState(false);
  const [status, setStatus]             = useState("");
  const [history, setHistory]           = useState([]);
  const [target, setTarget]             = useState("all");       // "all" | "class" | "unregistered"
  const [selectedClass, setSelectedClass] = useState("");
  const [sendToParents, setSendToParents] = useState(false);

  useEffect(() => {
    const unsub1 = listenRegisteredStudents(setStudents);
    const unsub2 = listenBroadcasts(setHistory);
    return () => { unsub1(); unsub2(); };
  }, []);

  // ── Compute recipients based on target ───────────────────────────────────
  const getRecipients = () => {
    let pool = [...students];
    if (target === "class" && selectedClass) {
      pool = pool.filter((s) => s.studentClass === selectedClass);
    } else if (target === "unregistered") {
      pool = pool.filter((s) => !s.telegramChatId);
    }
    return pool;
  };

  const recipients    = getRecipients();
  const hasBot        = (s) => !!s.telegramChatId;
  const hasParentBot  = (s) => !!s.parentTelegramChatId;
  const countActive   = recipients.filter(hasBot).length;
  const countParents  = recipients.filter(hasParentBot).length;

  // ── Broadcast handler ────────────────────────────────────────────────────
  const handleBroadcast = async () => {
    if (!message.trim()) return alert("Please enter a message!");
    const label =
      target === "all"
        ? `all ${countActive} students`
        : target === "class"
        ? `${countActive} students in ${selectedClass || "selected class"}`
        : `${countActive} unregistered students`;

    if (!window.confirm(`Send to ${label} via Telegram?`)) return;

    setLoading(true);
    setStatus("🚀 Starting broadcast…");
    let sentCount = 0, failCount = 0;

    for (const student of recipients) {
      // Send to student
      if (student.telegramChatId) {
        try {
          await sendTelegramMessage(
            student.telegramChatId,
            `📢 *OFFICIAL BROADCAST*\n\n${message}`
          );
          sentCount++;
          setStatus(`📤 Sending… (${sentCount}/${countActive})`);
        } catch { failCount++; }
      } else {
        failCount++;
      }

      // Send to parent if enabled
      if (sendToParents && student.parentTelegramChatId) {
        try {
          await sendTelegramMessage(
            student.parentTelegramChatId,
            `👨‍👩‍👦 *SCHOOL NOTICE — re: ${student.name}*\n\n${message}`
          );
        } catch { /* silent */ }
      }
    }

    await saveBroadcast(
      message,
      sentCount,
      target === "class" ? selectedClass : target
    );

    setLoading(false);
    setMessage("");
    setStatus(`✅ Done! Sent: ${sentCount} students${sendToParents ? " + parents" : ""}, Skipped: ${failCount}`);
  };

  // ── Per-class overview ───────────────────────────────────────────────────
  const classCounts = CLASS_OPTIONS.map((cls) => {
    const clsStudents = students.filter((s) => s.studentClass === cls);
    return {
      cls,
      total: clsStudents.length,
      bot: clsStudents.filter((s) => s.telegramChatId).length,
    };
  }); // Show all classes, even if empty

  return (
    <div style={{ maxWidth: "900px" }}>
      <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111827", marginBottom: "4px" }}>
        📢 Admin Broadcast
      </h2>
      <p style={{ color: "#9ca3af", fontSize: "13px", marginBottom: "24px" }}>
        Send official Telegram notifications to students — by class, all at once, or to parents.
      </p>

      {/* ── Target Selector ── */}
      <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: "20px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 700, marginTop: 0, marginBottom: "14px" }}>
          🎯 Select Recipients
        </h3>

        {/* Target type buttons */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
          {[
            { key: "all",          label: "📣 All Students",    desc: `${students.filter((s) => s.telegramChatId).length} with Telegram` },
            { key: "class",        label: "🎓 By Class",        desc: "Pick a specific class" },
            { key: "unregistered", label: "⏳ Not Registered",  desc: "Students without Telegram" },
          ].map(({ key, label, desc }) => (
            <button
              key={key}
              onClick={() => { setTarget(key); setStatus(""); }}
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                border: target === key ? "2px solid #6d28d9" : "2px solid #e5e7eb",
                background: target === key ? "#f5f3ff" : "#fff",
                color: target === key ? "#6d28d9" : "#374151",
                fontWeight: target === key ? 700 : 500,
                fontSize: "13px",
                cursor: "pointer",
                textAlign: "left",
                minWidth: "150px",
              }}
            >
              <div style={{ fontWeight: 700 }}>{label}</div>
              <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>{desc}</div>
            </button>
          ))}
        </div>

        {/* Class picker */}
        {target === "class" && (
          <div>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "#6b7280", marginBottom: "8px" }}>
              Select Class:
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {classCounts.map(({ cls, total, bot }) => (
                <button
                  key={cls}
                  onClick={() => { setSelectedClass(cls); setStatus(""); }}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "99px",
                    border: selectedClass === cls ? "none" : "1px solid #d1d5db",
                    background: selectedClass === cls ? "#6d28d9" : "#f9fafb",
                    color: selectedClass === cls ? "#fff" : "#374151",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {cls}
                  <span style={{
                    marginLeft: "6px",
                    background: selectedClass === cls ? "rgba(255,255,255,0.25)" : "#e5e7eb",
                    color: selectedClass === cls ? "#fff" : "#6b7280",
                    borderRadius: "99px",
                    padding: "1px 7px",
                    fontSize: "11px",
                  }}>
                    {bot}/{total}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Send to parents toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "16px", cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "#374151" }}>
          <input
            type="checkbox"
            checked={sendToParents}
            onChange={(e) => setSendToParents(e.target.checked)}
            style={{ width: "16px", height: "16px", accentColor: "#6d28d9" }}
          />
          👨‍👩‍👦 Also send to Parents ({countParents} parents with Telegram IDs)
        </label>

        {/* Recipient summary */}
        <div style={{ marginTop: "14px", background: "#f5f3ff", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", color: "#5b21b6" }}>
          📊 Will send to <strong>{countActive}</strong> student{countActive !== 1 ? "s" : ""}
          {sendToParents && ` + ${countParents} parent${countParents !== 1 ? "s" : ""}`}
          {target === "class" && selectedClass ? ` in ${selectedClass}` : ""}
        </div>
      </div>

      {/* ── Compose ── */}
      <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: "24px" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 700, marginTop: 0, marginBottom: "14px" }}>
          ✍️ Compose Message
        </h3>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your official announcement here..."
          disabled={loading}
          style={{
            width: "100%", height: "140px", border: "1px solid #e5e7eb",
            borderRadius: "10px", padding: "14px", fontSize: "14px",
            outline: "none", resize: "vertical", boxSizing: "border-box",
            fontFamily: "inherit",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "14px", flexWrap: "wrap", gap: "10px" }}>
          <span style={{ color: "#6d28d9", fontSize: "13px", fontWeight: 600 }}>{status}</span>
          <button
            onClick={handleBroadcast}
            disabled={loading || !message.trim() || (target === "class" && !selectedClass) || countActive === 0}
            style={{
              background: (loading || !message.trim() || (target === "class" && !selectedClass) || countActive === 0)
                ? "#9ca3af" : "#6d28d9",
              color: "#fff", border: "none", borderRadius: "10px",
              padding: "12px 28px", fontWeight: 700, fontSize: "14px",
              cursor: (loading || !message.trim() || (target === "class" && !selectedClass) || countActive === 0)
                ? "not-allowed" : "pointer",
            }}
          >
            {loading
              ? "Sending…"
              : target === "class" && selectedClass
              ? `🚀 Send to ${selectedClass} (${countActive})`
              : `🚀 Broadcast to ${countActive} Students`}
          </button>
        </div>
      </div>

      {/* ── Per-class overview ── */}
      <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: "24px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 14px" }}>
          📊 Telegram Registration by Class
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: "10px" }}>
          {classCounts.map(({ cls, total, bot }) => {
            const pct = total ? Math.round((bot / total) * 100) : 0;
            return (
              <div
                key={cls}
                onClick={() => { setTarget("class"); setSelectedClass(cls); setStatus(""); }}
                style={{
                  border: "1px solid #e5e7eb", borderRadius: "10px", padding: "10px 12px",
                  cursor: "pointer", background: "#fafafa",
                  transition: "box-shadow 0.15s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 2px 8px rgba(109,40,217,0.15)"}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}
              >
                <p style={{ fontSize: "12px", fontWeight: 700, color: "#111827", margin: "0 0 6px" }}>{cls}</p>
                {/* Progress bar */}
                <div style={{ height: "5px", background: "#e5e7eb", borderRadius: "99px", marginBottom: "6px" }}>
                  <div style={{ height: "5px", background: "#6d28d9", borderRadius: "99px", width: `${pct}%`, transition: "width 0.3s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                  <span style={{ color: "#059669", fontWeight: 600 }}>✅ {bot}</span>
                  <span style={{ color: "#dc2626", fontWeight: 600 }}>❌ {total - bot}</span>
                  <span style={{ color: "#9ca3af" }}>{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── History ── */}
      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>📜 Broadcast History</h3>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              {["#", "Message", "Target", "Sent To", "Date & Time"].map((h) => (
                <th
                  key={h}
                  style={{ textAlign: "left", padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>
                  No broadcasts sent yet.
                </td>
              </tr>
            )}
            {history.map((b, i) => (
              <tr key={b.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                <td style={{ padding: "12px 16px", fontSize: "13px", color: "#6b7280" }}>{i + 1}</td>
                <td style={{ padding: "12px 16px", fontSize: "13px", color: "#111827", maxWidth: "320px" }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {b.message}
                  </div>
                </td>
                <td style={{ padding: "12px 16px", fontSize: "12px" }}>
                  <span style={{
                    background: "#ede9fe", color: "#6d28d9",
                    borderRadius: "99px", padding: "2px 10px", fontWeight: 600, fontSize: "11px",
                  }}>
                    {b.targetClass || "All"}
                  </span>
                </td>
                <td style={{ padding: "12px 16px", fontSize: "13px" }}>
                  <span style={{ background: "#d1fae5", color: "#065f46", borderRadius: "99px", padding: "2px 10px", fontWeight: 600, fontSize: "12px" }}>
                    {b.recipientCount} students
                  </span>
                </td>
                <td style={{ padding: "12px 16px", fontSize: "12px", color: "#9ca3af" }}>
                  {new Date(b.timestamp).toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminBroadcast;
