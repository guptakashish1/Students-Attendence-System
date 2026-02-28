import React, { useState, useEffect } from "react";
import { listenCollection, addRecord, deleteRecord, updateRecord } from "../../firebase";

const PATH = "classArms";

const ManageClassArms = () => {
    const [items, setItems] = useState([]);
    const [classes, setClasses] = useState([]);
    const [form, setForm] = useState({ name: "", classId: "" });
    const [editId, setEditId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showAddClass, setShowAddClass] = useState(false);
    const [newClassName, setNewClassName] = useState("");
    const [addingClass, setAddingClass] = useState(false);

    const predefinedClasses = [
        "PlayGroup", "Nursery", "KG", "Class I", "Class II", "Class III", 
        "Class IV", "Class V", "Class VI", "Class VII", "Class VIII", 
        "Class IX", "Class X", "Class XI", "Class XII"
    ];

    useEffect(() => {
        const unsub1 = listenCollection(PATH, setItems);
        const unsub2 = listenCollection("classes", setClasses);
        return () => { unsub1(); unsub2(); };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setLoading(true);
        try {
            const classLabel = classes.find(c => c.id === form.classId)?.name || form.classId;
            const payload = { ...form, className: classLabel };
            if (editId) { await updateRecord(PATH, editId, payload); setEditId(null); }
            else { await addRecord(PATH, payload); }
            setForm({ name: "", classId: "" });
        } finally { setLoading(false); }
    };

    const handleEdit = (item) => { setEditId(item.id); setForm({ name: item.name, classId: item.classId || "" }); };
    const handleDelete = async (id) => { if (window.confirm("Delete this arm?")) await deleteRecord(PATH, id); };

    const handleAddClass = async (e) => {
        e.preventDefault();
        if (!newClassName) return;
        setAddingClass(true);
        try {
            await addRecord("classes", { name: newClassName, description: "" });
            setNewClassName("");
            setShowAddClass(false);
        } finally {
            setAddingClass(false);
        }
    };

    const handleAddAllClasses = async () => {
        if (!window.confirm("Add all predefined classes (PlayGroup to Class XII)? This will skip classes that already exist.")) return;
        setAddingClass(true);
        try {
            const existingClassNames = classes.map(c => c.name);
            let addedCount = 0;
            
            for (const className of predefinedClasses) {
                if (!existingClassNames.includes(className)) {
                    await addRecord("classes", { name: className, description: "" });
                    addedCount++;
                }
            }
            
            alert(`✅ Successfully added ${addedCount} classes!`);
            setShowAddClass(false);
        } catch (error) {
            alert("❌ Error adding classes: " + error.message);
        } finally {
            setAddingClass(false);
        }
    };

    return (
        <div style={{ maxWidth: "800px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111827", marginBottom: "4px" }}>🔀 Manage Class Arms</h2>
            <p style={{ color: "#9ca3af", fontSize: "13px", marginBottom: "24px" }}>Add sections/arms to your classes.</p>

            <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: "24px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, marginTop: 0, marginBottom: "16px" }}>{editId ? "✏️ Edit Arm" : "➕ Add Class Arm"}</h3>
                
                {/* Quick Add Class Section */}
                {!showAddClass ? (
                    <div style={{ marginBottom: "16px", padding: "12px", background: "#f0f9ff", borderRadius: "8px", border: "1px solid #bfdbfe" }}>
                        <p style={{ margin: 0, fontSize: "13px", color: "#1e40af", display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>💡</span>
                            <span>Don't see your class in the dropdown?</span>
                            <button 
                                type="button"
                                onClick={() => setShowAddClass(true)}
                                style={{ 
                                    background: "#3b82f6", 
                                    color: "#fff", 
                                    border: "none", 
                                    borderRadius: "6px", 
                                    padding: "4px 12px", 
                                    fontSize: "12px", 
                                    fontWeight: 600, 
                                    cursor: "pointer",
                                    marginLeft: "auto"
                                }}
                            >
                                + Add Class
                            </button>
                            <button 
                                type="button"
                                onClick={handleAddAllClasses}
                                disabled={addingClass}
                                style={{ 
                                    background: "#10b981", 
                                    color: "#fff", 
                                    border: "none", 
                                    borderRadius: "6px", 
                                    padding: "4px 12px", 
                                    fontSize: "12px", 
                                    fontWeight: 600, 
                                    cursor: "pointer"
                                }}
                            >
                                {addingClass ? "Adding..." : "+ Add All Classes"}
                            </button>
                        </p>
                    </div>
                ) : (
                    <div style={{ marginBottom: "16px", padding: "16px", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #86efac" }}>
                        <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 700, color: "#166534" }}>
                            ➕ Quick Add Class
                        </h4>
                        <form onSubmit={handleAddClass} style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                                    Select Class <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <select
                                    required
                                    value={newClassName}
                                    onChange={(e) => setNewClassName(e.target.value)}
                                    style={{
                                        width: "100%",
                                        border: "1px solid #d1d5db",
                                        borderRadius: "6px",
                                        padding: "8px 12px",
                                        fontSize: "13px",
                                        outline: "none",
                                        cursor: "pointer"
                                    }}
                                >
                                    <option value="">-- Select a Class --</option>
                                    {predefinedClasses.map(className => (
                                        <option key={className} value={className}>{className}</option>
                                    ))}
                                </select>
                            </div>
                            <button 
                                type="submit" 
                                disabled={addingClass}
                                style={{ 
                                    background: "#10b981", 
                                    color: "#fff", 
                                    border: "none", 
                                    borderRadius: "6px", 
                                    padding: "8px 16px", 
                                    fontSize: "13px", 
                                    fontWeight: 600, 
                                    cursor: "pointer"
                                }}
                            >
                                {addingClass ? "Adding..." : "Add"}
                            </button>
                            <button 
                                type="button"
                                onClick={() => { setShowAddClass(false); setNewClassName(""); }}
                                style={{ 
                                    background: "#6b7280", 
                                    color: "#fff", 
                                    border: "none", 
                                    borderRadius: "6px", 
                                    padding: "8px 16px", 
                                    fontSize: "13px", 
                                    fontWeight: 600, 
                                    cursor: "pointer"
                                }}
                            >
                                Cancel
                            </button>
                        </form>
                    </div>
                )}

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                                Class <span style={{ color: "#ef4444" }}>*</span>
                            </label>
                            <select 
                                required
                                value={form.classId} 
                                onChange={(e) => setForm({ ...form, classId: e.target.value })} 
                                style={{
                                    ...inputStyle,
                                    width: "100%",
                                    minWidth: "100%",
                                    cursor: "pointer",
                                    backgroundColor: "#fff"
                                }}
                            >
                                <option value="">-- Select a Class --</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            {classes.length === 0 && (
                                <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "4px" }}>
                                    ⚠️ No classes available. Please add classes first.
                                </p>
                            )}
                        </div>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                                Arm Name <span style={{ color: "#ef4444" }}>*</span>
                            </label>
                            <input 
                                required 
                                placeholder="e.g. Section A, Arm B" 
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })} 
                                style={{ ...inputStyle, width: "100%", minWidth: "100%" }} 
                            />
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: "12px" }}>
                        <button type="submit" disabled={loading} style={btnStyle("#6d28d9")}>
                            {loading ? "Saving..." : editId ? "Update Arm" : "Add Arm"}
                        </button>
                        {editId && (
                            <button 
                                type="button" 
                                onClick={() => { setEditId(null); setForm({ name: "", classId: "" }); }} 
                                style={btnStyle("#6b7280")}
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            </div>

            <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ background: "#f9fafb" }}>
                            {["#", "Arm Name", "Class", "Actions"].map(h => (
                                <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>No arms added yet.</td></tr>}
                        {items.map((item, i) => (
                            <tr key={item.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                                <td style={tdStyle}>{i + 1}</td>
                                <td style={{ ...tdStyle, fontWeight: 600 }}>{item.name}</td>
                                <td style={tdStyle}>{item.className || "—"}</td>
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

const inputStyle = { flex: 1, minWidth: "180px", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "10px 14px", fontSize: "14px", outline: "none" };
const tdStyle = { padding: "12px 16px", fontSize: "13px", color: "#374151" };
const btnStyle = (color, small = false) => ({
    background: color, color: "#fff", border: "none", borderRadius: "7px",
    padding: small ? "6px 14px" : "10px 20px", fontWeight: 600, fontSize: small ? "12px" : "14px", cursor: "pointer",
});

export default ManageClassArms;
