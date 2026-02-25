import React, { useState, useEffect } from "react";
import { listenRegisteredStudents, sendTelegramMessage, saveBroadcast, listenBroadcasts } from "../../firebase";

const AdminBroadcast = () => {
    const [students, setStudents] = useState([]);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState("");
    const [history, setHistory] = useState([]);

    useEffect(() => {
        const unsub1 = listenRegisteredStudents(setStudents);
        const unsub2 = listenBroadcasts(setHistory);
        return () => { unsub1(); unsub2(); };
    }, []);

    const handleBroadcast = async () => {
        if (!message.trim()) return alert("Please enter a message!");
        if (!window.confirm(`Send to ${students.length} students via Telegram?`)) return;

        setLoading(true);
        setStatus("🚀 Starting broadcast...");
        let sentCount = 0, failCount = 0;

        for (const student of students) {
            if (student.telegramChatId) {
                try {
                    await sendTelegramMessage(student.telegramChatId, `📢 *OFFICIAL BROADCAST*\n\n${message}`);
                    sentCount++;
                    setStatus(`📤 Sending... (${sentCount}/${students.length})`);
                } catch { failCount++; }
            } else { failCount++; }
        }

        // Save to Firebase history
        await saveBroadcast(message, sentCount);
        setLoading(false);
        setMessage("");
        setStatus(`✅ Done! Sent: ${sentCount}, Skipped: ${failCount}`);
    };

    return (
        <div style={{ maxWidth: "860px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111827", marginBottom: "4px" }}>📢 Admin Broadcast</h2>
            <p style={{ color: "#9ca3af", fontSize: "13px", marginBottom: "24px" }}>
                Send official notifications to all {students.length} registered students via Telegram.
            </p>

            {/* Compose */}
            <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: "24px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, marginTop: 0, marginBottom: "14px" }}>✍️ Compose Message</h3>
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your official announcement here..."
                    disabled={loading}
                    style={{ width: "100%", height: "140px", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px", fontSize: "14px", outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "14px" }}>
                    <span style={{ color: "#6d28d9", fontSize: "13px", fontWeight: 600 }}>{status}</span>
                    <button
                        onClick={handleBroadcast}
                        disabled={loading || !message.trim()}
                        style={{ background: loading ? "#9ca3af" : "#6d28d9", color: "#fff", border: "none", borderRadius: "10px", padding: "12px 28px", fontWeight: 700, fontSize: "14px", cursor: loading ? "not-allowed" : "pointer" }}
                    >
                        {loading ? "Sending..." : `🚀 Broadcast to ${students.length} Students`}
                    </button>
                </div>
            </div>

            {/* History */}
            <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6" }}>
                    <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>📜 Broadcast History</h3>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ background: "#f9fafb" }}>
                            {["#", "Message", "Sent To", "Date & Time"].map(h => (
                                <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {history.length === 0 && (
                            <tr><td colSpan={4} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>No broadcasts sent yet.</td></tr>
                        )}
                        {history.map((b, i) => (
                            <tr key={b.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                                <td style={{ padding: "12px 16px", fontSize: "13px", color: "#6b7280" }}>{i + 1}</td>
                                <td style={{ padding: "12px 16px", fontSize: "13px", color: "#111827", maxWidth: "380px" }}>
                                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.message}</div>
                                </td>
                                <td style={{ padding: "12px 16px", fontSize: "13px" }}>
                                    <span style={{ background: "#d1fae5", color: "#065f46", borderRadius: "99px", padding: "2px 10px", fontWeight: 600, fontSize: "12px" }}>{b.recipientCount} students</span>
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
