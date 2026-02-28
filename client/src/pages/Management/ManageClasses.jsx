import React, { useState, useEffect } from "react";
import { listenCollection, addRecord, deleteRecord, updateRecord, listenRegisteredStudents } from "../../firebase";

const PATH = "classes";

const ManageClasses = () => {
    const [items, setItems] = useState([]);
    const [form, setForm] = useState({ name: "", description: "" });
    const [editId, setEditId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [students, setStudents] = useState([]);
    const [selectedClass, setSelectedClass] = useState(null);
    const [showStudentModal, setShowStudentModal] = useState(false);

    const predefinedClasses = [
        "PlayGroup", "Nursery", "KG", "Class I", "Class II", "Class III", 
        "Class IV", "Class V", "Class VI", "Class VII", "Class VIII", 
        "Class IX", "Class X", "Class XI", "Class XII"
    ];

    useEffect(() => {
        const unsubClasses = listenCollection(PATH, setItems);
        const unsubStudents = listenRegisteredStudents(setStudents);
        return () => {
            unsubClasses();
            unsubStudents();
        };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setLoading(true);
        try {
            if (editId) {
                await updateRecord(PATH, editId, form);
                setEditId(null);
            } else {
                await addRecord(PATH, form);
            }
            setForm({ name: "", description: "" });
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (item) => {
        setEditId(item.id);
        setForm({ name: item.name, description: item.description || "" });
    };

    const handleDelete = async (id) => {
        if (window.confirm("Delete this class?")) await deleteRecord(PATH, id);
    };

    const handleViewStudents = (className) => {
        setSelectedClass(className);
        setShowStudentModal(true);
    };

    const getStudentsByClass = (className) => {
        return students.filter(s => s.studentClass === className);
    };

    const getClassStudentCount = (className) => {
        return students.filter(s => s.studentClass === className).length;
    };

    return (
        <div style={{ maxWidth: "800px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111827", marginBottom: "4px" }}>🏫 Manage Classes</h2>
            <p style={{ color: "#9ca3af", fontSize: "13px", marginBottom: "24px" }}>Add, edit, or remove class records.</p>

            <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: "24px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, marginTop: 0, marginBottom: "16px" }}>{editId ? "✏️ Edit Class" : "➕ Add New Class"}</h3>
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                                Class Name <span style={{ color: "#ef4444" }}>*</span>
                            </label>
                            <select 
                                required 
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                style={{
                                    ...inputStyle,
                                    width: "100%",
                                    minWidth: "100%",
                                    cursor: "pointer",
                                    backgroundColor: "#fff"
                                }}
                            >
                                <option value="">-- Select a Class --</option>
                                {predefinedClasses.map(className => (
                                    <option key={className} value={className}>{className}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                                Description (Optional)
                            </label>
                            <input 
                                placeholder="e.g. Primary Section" 
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                style={{ ...inputStyle, width: "100%", minWidth: "100%" }} 
                            />
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: "12px" }}>
                        <button type="submit" disabled={loading} style={btnStyle("#6d28d9")}>
                            {loading ? "Saving..." : editId ? "Update Class" : "Add Class"}
                        </button>
                        {editId && (
                            <button 
                                type="button" 
                                onClick={() => { setEditId(null); setForm({ name: "", description: "" }); }} 
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
                            {["#", "Class Name", "Description", "Students", "Actions"].map(h => (
                                <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 && (
                            <tr><td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>No classes added yet.</td></tr>
                        )}
                        {items.map((item, i) => {
                            const studentCount = getClassStudentCount(item.name);
                            return (
                                <tr
                                    key={item.id}
                                    style={{
                                        borderTop: "1px solid #f3f4f6",
                                        background: editId === item.id ? "#f0f9ff" : "transparent",
                                    }}
                                >
                                    <td style={tdStyle}>{i + 1}</td>
                                    <td style={{ ...tdStyle, fontWeight: 600 }}>{item.name}</td>
                                    <td style={tdStyle}>{item.description || "—"}</td>
                                    <td style={tdStyle}>
                                        <button
                                            onClick={() => handleViewStudents(item.name)}
                                            style={{
                                                background: studentCount > 0 ? "#10b981" : "#9ca3af",
                                                color: "#fff",
                                                border: "none",
                                                borderRadius: "99px",
                                                padding: "4px 12px",
                                                fontSize: "12px",
                                                fontWeight: 600,
                                                cursor: studentCount > 0 ? "pointer" : "default",
                                            }}
                                            disabled={studentCount === 0}
                                        >
                                            👥 {studentCount} {studentCount === 1 ? "Student" : "Students"}
                                        </button>
                                    </td>
                                    <td style={tdStyle}>
                                        <button onClick={() => handleEdit(item)} style={btnStyle("#6d28d9", true)}>Edit</button>
                                        <button onClick={() => handleDelete(item.id)} style={{ ...btnStyle("#ef4444", true), marginLeft: "8px" }}>Delete</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Student Details Modal */}
            {showStudentModal && selectedClass && (
                <div style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: "rgba(0, 0, 0, 0.5)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    zIndex: 1000,
                    padding: "20px"
                }}>
                    <div style={{
                        background: "#fff",
                        borderRadius: "16px",
                        maxWidth: "1000px",
                        width: "100%",
                        maxHeight: "90vh",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            background: "#6d28d9",
                            color: "#fff",
                            padding: "20px 24px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 700 }}>
                                    📚 {selectedClass}
                                </h3>
                                <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.9 }}>
                                    {getStudentsByClass(selectedClass).length} students enrolled
                                </p>
                            </div>
                            <button
                                onClick={() => setShowStudentModal(false)}
                                style={{
                                    background: "rgba(255,255,255,0.2)",
                                    border: "none",
                                    color: "#fff",
                                    fontSize: "24px",
                                    width: "36px",
                                    height: "36px",
                                    borderRadius: "50%",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: 300
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>
                            {getStudentsByClass(selectedClass).length === 0 ? (
                                <div style={{
                                    textAlign: "center",
                                    padding: "60px 20px",
                                    color: "#9ca3af"
                                }}>
                                    <div style={{ fontSize: "48px", marginBottom: "16px" }}>📭</div>
                                    <p style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>No Students Enrolled</p>
                                    <p style={{ fontSize: "14px" }}>There are no students registered in this class yet.</p>
                                </div>
                            ) : (
                                (() => {
                                    // Group students by section
                                    const studentsBySection = getStudentsByClass(selectedClass).reduce((acc, student) => {
                                        const section = student.classArm || "No Section";
                                        if (!acc[section]) {
                                            acc[section] = [];
                                        }
                                        acc[section].push(student);
                                        return acc;
                                    }, {});

                                    return (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                                            {Object.keys(studentsBySection).sort().map(section => (
                                                <div key={section} style={{
                                                    background: "#f9fafb",
                                                    borderRadius: "12px",
                                                    overflow: "hidden",
                                                    border: "1px solid #e5e7eb"
                                                }}>
                                                    <div style={{
                                                        background: "#f3f0ff",
                                                        padding: "12px 16px",
                                                        borderBottom: "1px solid #e5e7eb"
                                                    }}>
                                                        <h4 style={{
                                                            margin: 0,
                                                            fontSize: "14px",
                                                            fontWeight: 700,
                                                            color: "#6d28d9"
                                                        }}>
                                                            Section: {section} ({studentsBySection[section].length} students)
                                                        </h4>
                                                    </div>
                                                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                                        <thead>
                                                            <tr style={{ background: "#fff" }}>
                                                                <th style={modalThStyle}>Sr.</th>
                                                                <th style={modalThStyle}>Roll No</th>
                                                                <th style={modalThStyle}>Name</th>
                                                                <th style={modalThStyle}>Contact</th>
                                                                <th style={modalThStyle}>Father's Name</th>
                                                                <th style={modalThStyle}>Email</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {studentsBySection[section].map((student, index) => (
                                                                <tr key={student.rollNumber} style={{
                                                                    background: "#fff",
                                                                    borderTop: "1px solid #f3f4f6"
                                                                }}>
                                                                    <td style={modalTdStyle}>{index + 1}</td>
                                                                    <td style={{ ...modalTdStyle, fontWeight: 600, fontFamily: "monospace" }}>
                                                                        {student.rollNumber}
                                                                    </td>
                                                                    <td style={{ ...modalTdStyle, fontWeight: 600 }}>
                                                                        {student.name}
                                                                    </td>
                                                                    <td style={modalTdStyle}>{student.contact || "—"}</td>
                                                                    <td style={modalTdStyle}>{student.fatherName || "—"}</td>
                                                                    <td style={{ ...modalTdStyle, fontSize: "12px" }}>
                                                                        {student.parentEmail || "—"}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            borderTop: "1px solid #e5e7eb",
                            padding: "16px 24px",
                            display: "flex",
                            justifyContent: "flex-end",
                            background: "#f9fafb"
                        }}>
                            <button
                                onClick={() => setShowStudentModal(false)}
                                style={{
                                    background: "#6d28d9",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "8px",
                                    padding: "10px 24px",
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    cursor: "pointer"
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const inputStyle = { flex: 1, minWidth: "180px", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "10px 14px", fontSize: "14px", outline: "none" };
const tdStyle = { padding: "12px 16px", fontSize: "13px", color: "#374151" };
const modalThStyle = { textAlign: "left", padding: "10px 12px", fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" };
const modalTdStyle = { padding: "10px 12px", fontSize: "13px", color: "#374151" };
const btnStyle = (color, small = false) => ({
    background: color, color: "#fff", border: "none", borderRadius: "7px",
    padding: small ? "6px 14px" : "10px 20px", fontWeight: 600,
    fontSize: small ? "12px" : "14px", cursor: "pointer",
});

export default ManageClasses;
