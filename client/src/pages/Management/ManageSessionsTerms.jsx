import React, { useState, useEffect } from "react";
import { listenCollection, addRecord, deleteRecord, updateRecord } from "../../firebase";

const PATH = "sessions";
const defaultForm = { session: "", term: "", startDate: "", endDate: "", current: false };

const ManageSessionsTerms = () => {
    const [items, setItems] = useState([]);
    const [form, setForm] = useState(defaultForm);
    const [editId, setEditId] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => listenCollection(PATH, setItems), []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.session.trim() || !form.term.trim()) return;
        setLoading(true);
        try {
            if (editId) { await updateRecord(PATH, editId, form); setEditId(null); }
            else { await addRecord(PATH, form); }
            setForm(defaultForm);
        } finally { setLoading(false); }
    };

    const handleEdit = (item) => {
        setEditId(item.id);
        setForm({ session: item.session, term: item.term, startDate: item.startDate || "", endDate: item.endDate || "", current: item.current || false });
    };
    const handleDelete = async (id) => { if (window.confirm("Delete this session?")) await deleteRecord(PATH, id); };

    return (
        <div style={{ maxWidth: "900px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111827", marginBottom: "4px" }}>📆 Sessions & Terms</h2>
            <p style={{ color: "#9ca3af", fontSize: "13px", marginBottom: "24px" }}>Manage academic sessions and terms.</p>

            <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: "24px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, marginTop: 0, marginBottom: "16px" }}>{editId ? "✏️ Edit Session" : "➕ Add Session/Term"}</h3>
                <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <input required placeholder="Session (e.g. 2024-2025)" value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })} style={inputStyle} />
                    <input required placeholder="Term (e.g. First Term)" value={form.term} onChange={(e) => setForm({ ...form, term: e.target.value })} style={inputStyle} />
                    <div>
                        <label style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", marginBottom: "4px", display: "block" }}>Start Date</label>
                        <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} style={{ ...inputStyle, width: "100%" }} />
                    </div>
                    <div>
                        <label style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", marginBottom: "4px", display: "block" }}>End Date</label>
                        <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} style={{ ...inputStyle, width: "100%" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <input type="checkbox" id="current" checked={form.current} onChange={(e) => setForm({ ...form, current: e.target.checked })} />
                        <label htmlFor="current" style={{ fontSize: "13px", fontWeight: 500 }}>Mark as Current Session</label>
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>
                        <button type="submit" disabled={loading} style={btnStyle("#6d28d9")}>{loading ? "Saving..." : editId ? "Update" : "Add Session"}</button>
                        {editId && <button type="button" onClick={() => { setEditId(null); setForm(defaultForm); }} style={btnStyle("#6b7280")}>Cancel</button>}
                    </div>
                </form>
            </div>

            <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ background: "#f9fafb" }}>
                            {["#", "Session", "Term", "Start", "End", "Status", "Actions"].map(h => (
                                <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>No sessions added yet.</td></tr>}
                        {items.map((item, i) => (
                            <tr key={item.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                                <td style={tdStyle}>{i + 1}</td>
                                <td style={{ ...tdStyle, fontWeight: 600 }}>{item.session}</td>
                                <td style={tdStyle}>{item.term}</td>
                                <td style={tdStyle}>{item.startDate || "—"}</td>
                                <td style={tdStyle}>{item.endDate || "—"}</td>
                                <td style={tdStyle}>
                                    {item.current
                                        ? <span style={{ background: "#d1fae5", color: "#065f46", padding: "2px 10px", borderRadius: "99px", fontSize: "12px", fontWeight: 600 }}>Current</span>
                                        : <span style={{ background: "#f3f4f6", color: "#6b7280", padding: "2px 10px", borderRadius: "99px", fontSize: "12px" }}>Past</span>}
                                </td>
                                <td style={tdStyle}>
                                    <button onClick={() => handleEdit(item)} style={btnStyle("#6d28d9", true)}>Edit</button>
                                    <button onClick={() => handleDelete(item.id)} style={{ ...btnStyle("#ef4444", true), marginLeft: "8px" }}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const inputStyle = { border: "1px solid #e5e7eb", borderRadius: "8px", padding: "10px 14px", fontSize: "14px", outline: "none", width: "100%", boxSizing: "border-box" };
const tdStyle = { padding: "12px 16px", fontSize: "13px", color: "#374151" };
const btnStyle = (color, small = false) => ({
    background: color, color: "#fff", border: "none", borderRadius: "7px",
    padding: small ? "6px 14px" : "10px 20px", fontWeight: 600, fontSize: small ? "12px" : "14px", cursor: "pointer",
});

export default ManageSessionsTerms;
