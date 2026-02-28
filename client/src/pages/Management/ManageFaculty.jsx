import React, { useState, useEffect } from "react";
import { listenCollection, addRecord, deleteRecord, updateRecord } from "../../firebase";

const PATH = "faculty";
const defaultForm = { name: "", subject: "", email: "", phone: "" };

const ManageFaculty = () => {
    const [items, setItems] = useState([]);
    const [form, setForm] = useState(defaultForm);
    const [editId, setEditId] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => listenCollection(PATH, setItems), []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setLoading(true);
        try {
            if (editId) { await updateRecord(PATH, editId, form); setEditId(null); }
            else { await addRecord(PATH, form); }
            setForm(defaultForm);
        } finally { setLoading(false); }
    };

    const handleEdit = (item) => { 
        setEditId(item.id); 
        setForm({ name: item.name, subject: item.subject || "", email: item.email || "", phone: item.phone || "" }); 
    };
    
    const handleDelete = async (id) => { 
        if (window.confirm("Delete this faculty?")) await deleteRecord(PATH, id); 
    };

    return (
        <div style={{ maxWidth: "900px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111827", marginBottom: "4px" }}>
                👨‍🏫 Manage Faculty ({items.length})
            </h2>
            <p style={{ color: "#9ca3af", fontSize: "13px", marginBottom: "24px" }}>
                Add, edit, or remove faculty members.
            </p>

            <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: "24px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, marginTop: 0, marginBottom: "16px" }}>
                    {editId ? "✏️ Edit Faculty" : "➕ Add Faculty"}
                </h3>
                <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <input required placeholder="Full Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
                    <input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} style={inputStyle} />
                    <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
                    <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
                    <div style={{ display: "flex", gap: "10px", gridColumn: "span 2" }}>
                        <button type="submit" disabled={loading} style={btnStyle("#6d28d9")}>
                            {loading ? "Saving..." : editId ? "Update" : "Add Faculty"}
                        </button>
                        {editId && <button type="button" onClick={() => { setEditId(null); setForm(defaultForm); }} style={btnStyle("#6b7280")}>Cancel</button>}
                    </div>
                </form>
            </div>

            <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ background: "#f9fafb" }}>
                            {["#", "Name", "Subject", "Email", "Phone", "Actions"].map(h => (
                                <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>No faculty added yet.</td></tr>}
                        {items.map((item, i) => (
                            <tr key={item.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                                <td style={tdStyle}>{i + 1}</td>
                                <td style={{ ...tdStyle, fontWeight: 600 }}>{item.name}</td>
                                <td style={tdStyle}>{item.subject || "—"}</td>
                                <td style={tdStyle}>{item.email || "—"}</td>
                                <td style={tdStyle}>{item.phone || "—"}</td>
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

const inputStyle = { border: "1px solid #e5e7eb", borderRadius: "8px", padding: "10px 14px", fontSize: "14px", outline: "none" };
const tdStyle = { padding: "12px 16px", fontSize: "13px", color: "#374151" };
const btnStyle = (color, small = false) => ({
    background: color, color: "#fff", border: "none", borderRadius: "7px",
    padding: small ? "6px 14px" : "10px 20px", fontWeight: 600, fontSize: small ? "12px" : "14px", cursor: "pointer",
});

export default ManageFaculty;
