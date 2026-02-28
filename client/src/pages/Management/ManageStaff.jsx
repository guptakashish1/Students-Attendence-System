import React, { useState, useEffect } from "react";
import { listenCollection, addRecord, deleteRecord, updateRecord } from "../../firebase";

const PATH = "staff";
const ATTENDANCE_PATH = "staffAttendance";
const ROLES = ["Teacher", "Administrator", "Accountant", "Security", "Cleaner", "Lab Assistant", "Librarian", "Other"];
const defaultForm = { name: "", role: "", email: "", phone: "" };

const ManageStaff = () => {
    const [items, setItems] = useState([]);
    const [attendance, setAttendance] = useState({});
    const [form, setForm] = useState(defaultForm);
    const [editId, setEditId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showAttendance, setShowAttendance] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [groupByRole, setGroupByRole] = useState(true);
    const [selectedRole, setSelectedRole] = useState("all");

    useEffect(() => {
        const unsub1 = listenCollection(PATH, setItems);
        return () => unsub1();
    }, []);

    useEffect(() => {
        const unsub = listenCollection(`${ATTENDANCE_PATH}/${selectedDate}`, (data) => {
            const attMap = {};
            data.forEach(record => {
                attMap[record.staffId] = record.status;
            });
            setAttendance(attMap);
        });
        return () => unsub();
    }, [selectedDate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setLoading(true);
        try {
            if (editId) { 
                await updateRecord(PATH, editId, form); 
                setEditId(null); 
            } else { 
                await addRecord(PATH, { ...form, joinedDate: new Date().toISOString() }); 
            }
            setForm(defaultForm);
        } finally { 
            setLoading(false); 
        }
    };

    const handleEdit = (item) => { 
        setEditId(item.id); 
        setForm({ 
            name: item.name, 
            role: item.role || "", 
            email: item.email || "", 
            phone: item.phone || "" 
        }); 
    };

    const handleDelete = async (id) => { 
        if (window.confirm("Delete this staff member?")) {
            await deleteRecord(PATH, id);
        }
    };

    const markAttendance = async (staffId, status) => {
        setLoading(true);
        try {
            const attRecord = {
                staffId: staffId,
                status: status,
                markedAt: new Date().toISOString(),
                date: selectedDate
            };
            
            // Check if attendance already exists for this staff on this date
            const existingAtt = Object.values(attendance).find(att => att === status);
            
            await addRecord(`${ATTENDANCE_PATH}/${selectedDate}`, attRecord);
            
            // Update local state
            setAttendance(prev => ({ ...prev, [staffId]: status }));
        } finally {
            setLoading(false);
        }
    };

    const getTodayStats = () => {
        const today = new Date().toISOString().split('T')[0];
        if (selectedDate !== today) return null;
        
        const present = Object.values(attendance).filter(status => status === 'PRESENT').length;
        const absent = Object.values(attendance).filter(status => status === 'ABSENT').length;
        const leave = Object.values(attendance).filter(status => status === 'LEAVE').length;
        const notMarked = items.length - present - absent - leave;
        
        return { present, absent, leave, notMarked, total: items.length };
    };

    const stats = getTodayStats();
    const isToday = selectedDate === new Date().toISOString().split('T')[0];

    // Group staff by role
    const groupedStaff = items.reduce((acc, staff) => {
        const role = staff.role || "Unassigned";
        if (!acc[role]) {
            acc[role] = [];
        }
        acc[role].push(staff);
        return acc;
    }, {});

    // Get unique roles
    const uniqueRoles = Object.keys(groupedStaff).sort();

    // Filter staff by selected role
    const filteredStaff = selectedRole === "all" 
        ? items 
        : items.filter(staff => staff.role === selectedRole);

    // Get role-wise stats
    const getRoleStats = (role) => {
        const roleStaff = groupedStaff[role] || [];
        const present = roleStaff.filter(s => attendance[s.id] === 'PRESENT').length;
        const absent = roleStaff.filter(s => attendance[s.id] === 'ABSENT').length;
        const leave = roleStaff.filter(s => attendance[s.id] === 'LEAVE').length;
        const notMarked = roleStaff.length - present - absent - leave;
        return { total: roleStaff.length, present, absent, leave, notMarked };
    };

    return (
        <div style={{ maxWidth: "1200px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "24px" }}>
                <div>
                    <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111827", marginBottom: "4px" }}>
                        👷 Manage Staff ({items.length})
                    </h2>
                    <p style={{ color: "#9ca3af", fontSize: "13px", margin: 0 }}>
                        Add, edit, or remove staff members and track daily attendance.
                    </p>
                </div>
                <button
                    onClick={() => setShowAttendance(!showAttendance)}
                    style={{
                        background: showAttendance ? "#6d28d9" : "#fff",
                        color: showAttendance ? "#fff" : "#6d28d9",
                        border: "2px solid #6d28d9",
                        borderRadius: "8px",
                        padding: "10px 20px",
                        fontSize: "14px",
                        fontWeight: 600,
                        cursor: "pointer"
                    }}
                >
                    {showAttendance ? "📋 View Staff List" : "✅ Mark Attendance"}
                </button>
            </div>

            {/* Stats Cards */}
            {isToday && stats && (
                <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
                    gap: "16px", 
                    marginBottom: "24px" 
                }}>
                    <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", borderLeft: "4px solid #6d28d9" }}>
                        <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 600, marginBottom: "8px" }}>TOTAL STAFF</div>
                        <div style={{ fontSize: "28px", fontWeight: 800, color: "#111827" }}>{stats.total}</div>
                    </div>
                    <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", borderLeft: "4px solid #10b981" }}>
                        <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 600, marginBottom: "8px" }}>PRESENT</div>
                        <div style={{ fontSize: "28px", fontWeight: 800, color: "#10b981" }}>{stats.present}</div>
                    </div>
                    <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", borderLeft: "4px solid #ef4444" }}>
                        <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 600, marginBottom: "8px" }}>ABSENT</div>
                        <div style={{ fontSize: "28px", fontWeight: 800, color: "#ef4444" }}>{stats.absent}</div>
                    </div>
                    <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", borderLeft: "4px solid #f59e0b" }}>
                        <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 600, marginBottom: "8px" }}>ON LEAVE</div>
                        <div style={{ fontSize: "28px", fontWeight: 800, color: "#f59e0b" }}>{stats.leave}</div>
                    </div>
                    <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", borderLeft: "4px solid #9ca3af" }}>
                        <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 600, marginBottom: "8px" }}>NOT MARKED</div>
                        <div style={{ fontSize: "28px", fontWeight: 800, color: "#9ca3af" }}>{stats.notMarked}</div>
                    </div>
                </div>
            )}

            {showAttendance ? (
                // Attendance View
                <div>
                    <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: "24px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                                📅 Staff Attendance
                            </h3>
                            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                                <button
                                    onClick={() => setGroupByRole(!groupByRole)}
                                    style={{
                                        background: groupByRole ? "#6d28d9" : "#fff",
                                        color: groupByRole ? "#fff" : "#6d28d9",
                                        border: "2px solid #6d28d9",
                                        borderRadius: "8px",
                                        padding: "8px 16px",
                                        fontSize: "13px",
                                        fontWeight: 600,
                                        cursor: "pointer"
                                    }}
                                >
                                    {groupByRole ? "📊 Grouped by Role" : "📋 List View"}
                                </button>
                                <select
                                    value={selectedRole}
                                    onChange={(e) => setSelectedRole(e.target.value)}
                                    style={{
                                        border: "1px solid #e5e7eb",
                                        borderRadius: "8px",
                                        padding: "8px 12px",
                                        fontSize: "14px"
                                    }}
                                >
                                    <option value="all">All Roles ({items.length})</option>
                                    {uniqueRoles.map(role => {
                                        const roleStats = getRoleStats(role);
                                        return (
                                            <option key={role} value={role}>
                                                {role} ({roleStats.total})
                                            </option>
                                        );
                                    })}
                                </select>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    max={new Date().toISOString().split('T')[0]}
                                    style={{
                                        border: "1px solid #e5e7eb",
                                        borderRadius: "8px",
                                        padding: "8px 12px",
                                        fontSize: "14px"
                                    }}
                                />
                            </div>
                        </div>
                        {!isToday && (
                            <div style={{ 
                                background: "#fef3c7", 
                                border: "1px solid #fbbf24", 
                                borderRadius: "8px", 
                                padding: "12px",
                                fontSize: "13px",
                                color: "#92400e",
                                marginBottom: "16px"
                            }}>
                                ℹ️ Viewing attendance for {selectedDate}. You can only mark attendance for today.
                            </div>
                        )}
                    </div>

                    <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                        {groupByRole ? (
                            // Grouped by Role View
                            <div>
                                {Object.keys(groupedStaff).sort().filter(role => 
                                    selectedRole === "all" || role === selectedRole
                                ).map(role => {
                                    const roleStaff = groupedStaff[role];
                                    const roleStats = getRoleStats(role);
                                    
                                    return (
                                        <div key={role} style={{ marginBottom: "0" }}>
                                            <div style={{ 
                                                background: "#6d28d9", 
                                                color: "#fff", 
                                                padding: "16px 20px",
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                borderTop: "1px solid #e5e7eb"
                                            }}>
                                                <h4 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>
                                                    {role} ({roleStats.total})
                                                </h4>
                                                {isToday && (
                                                    <div style={{ display: "flex", gap: "16px", fontSize: "13px" }}>
                                                        <span>✅ {roleStats.present}</span>
                                                        <span>❌ {roleStats.absent}</span>
                                                        <span>📋 {roleStats.leave}</span>
                                                        <span style={{ opacity: 0.7 }}>⏳ {roleStats.notMarked}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                                <thead>
                                                    <tr style={{ background: "#f9fafb" }}>
                                                        {["#", "Name", "Email", "Phone", "Status", isToday ? "Mark Attendance" : "Status"].map(h => (
                                                            <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {roleStaff.map((item, i) => {
                                                        const status = attendance[item.id];
                                                        return (
                                                            <tr key={item.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                                                                <td style={tdStyle}>{i + 1}</td>
                                                                <td style={{ ...tdStyle, fontWeight: 600 }}>{item.name}</td>
                                                                <td style={tdStyle}>{item.email || "—"}</td>
                                                                <td style={tdStyle}>{item.phone || "—"}</td>
                                                                <td style={tdStyle}>
                                                                    {status ? (
                                                                        <span style={{
                                                                            background: status === 'PRESENT' ? "#d1fae5" : status === 'ABSENT' ? "#fee2e2" : "#fef3c7",
                                                                            color: status === 'PRESENT' ? "#065f46" : status === 'ABSENT' ? "#991b1b" : "#92400e",
                                                                            padding: "4px 12px",
                                                                            borderRadius: "99px",
                                                                            fontSize: "12px",
                                                                            fontWeight: 600
                                                                        }}>
                                                                            {status === 'PRESENT' ? "✅ Present" : status === 'ABSENT' ? "❌ Absent" : "📋 Leave"}
                                                                        </span>
                                                                    ) : (
                                                                        <span style={{ color: "#9ca3af", fontSize: "12px" }}>Not marked</span>
                                                                    )}
                                                                </td>
                                                                <td style={tdStyle}>
                                                                    {isToday ? (
                                                                        <div style={{ display: "flex", gap: "6px" }}>
                                                                            <button
                                                                                onClick={() => markAttendance(item.id, 'PRESENT')}
                                                                                disabled={loading || status === 'PRESENT'}
                                                                                style={{
                                                                                    ...btnStyle("#10b981", true),
                                                                                    opacity: status === 'PRESENT' ? 0.5 : 1,
                                                                                    cursor: status === 'PRESENT' ? "not-allowed" : "pointer"
                                                                                }}
                                                                            >
                                                                                ✅
                                                                            </button>
                                                                            <button
                                                                                onClick={() => markAttendance(item.id, 'ABSENT')}
                                                                                disabled={loading || status === 'ABSENT'}
                                                                                style={{
                                                                                    ...btnStyle("#ef4444", true),
                                                                                    opacity: status === 'ABSENT' ? 0.5 : 1,
                                                                                    cursor: status === 'ABSENT' ? "not-allowed" : "pointer"
                                                                                }}
                                                                            >
                                                                                ❌
                                                                            </button>
                                                                            <button
                                                                                onClick={() => markAttendance(item.id, 'LEAVE')}
                                                                                disabled={loading || status === 'LEAVE'}
                                                                                style={{
                                                                                    ...btnStyle("#f59e0b", true),
                                                                                    opacity: status === 'LEAVE' ? 0.5 : 1,
                                                                                    cursor: status === 'LEAVE' ? "not-allowed" : "pointer"
                                                                                }}
                                                                            >
                                                                                📋
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <span style={{ color: "#9ca3af", fontSize: "12px" }}>—</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            // List View
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ background: "#f9fafb" }}>
                                        {["#", "Name", "Role", "Status", isToday ? "Mark Attendance" : "Status"].map(h => (
                                            <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStaff.length === 0 && (
                                        <tr><td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>No staff members found.</td></tr>
                                    )}
                                    {filteredStaff.map((item, i) => {
                                        const status = attendance[item.id];
                                        return (
                                            <tr key={item.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                                                <td style={tdStyle}>{i + 1}</td>
                                                <td style={{ ...tdStyle, fontWeight: 600 }}>{item.name}</td>
                                                <td style={tdStyle}>
                                                    <span style={{ background: "#f3f0ff", color: "#6d28d9", padding: "2px 10px", borderRadius: "99px", fontSize: "12px", fontWeight: 600 }}>
                                                        {item.role || "—"}
                                                    </span>
                                                </td>
                                                <td style={tdStyle}>
                                                    {status ? (
                                                        <span style={{
                                                            background: status === 'PRESENT' ? "#d1fae5" : status === 'ABSENT' ? "#fee2e2" : "#fef3c7",
                                                            color: status === 'PRESENT' ? "#065f46" : status === 'ABSENT' ? "#991b1b" : "#92400e",
                                                            padding: "4px 12px",
                                                            borderRadius: "99px",
                                                            fontSize: "12px",
                                                            fontWeight: 600
                                                        }}>
                                                            {status === 'PRESENT' ? "✅ Present" : status === 'ABSENT' ? "❌ Absent" : "📋 Leave"}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: "#9ca3af", fontSize: "12px" }}>Not marked</span>
                                                    )}
                                                </td>
                                                <td style={tdStyle}>
                                                    {isToday ? (
                                                        <div style={{ display: "flex", gap: "6px" }}>
                                                            <button
                                                                onClick={() => markAttendance(item.id, 'PRESENT')}
                                                                disabled={loading || status === 'PRESENT'}
                                                                style={{
                                                                    ...btnStyle("#10b981", true),
                                                                    opacity: status === 'PRESENT' ? 0.5 : 1,
                                                                    cursor: status === 'PRESENT' ? "not-allowed" : "pointer"
                                                                }}
                                                            >
                                                                ✅
                                                            </button>
                                                            <button
                                                                onClick={() => markAttendance(item.id, 'ABSENT')}
                                                                disabled={loading || status === 'ABSENT'}
                                                                style={{
                                                                    ...btnStyle("#ef4444", true),
                                                                    opacity: status === 'ABSENT' ? 0.5 : 1,
                                                                    cursor: status === 'ABSENT' ? "not-allowed" : "pointer"
                                                                }}
                                                            >
                                                                ❌
                                                            </button>
                                                            <button
                                                                onClick={() => markAttendance(item.id, 'LEAVE')}
                                                                disabled={loading || status === 'LEAVE'}
                                                                style={{
                                                                    ...btnStyle("#f59e0b", true),
                                                                    opacity: status === 'LEAVE' ? 0.5 : 1,
                                                                    cursor: status === 'LEAVE' ? "not-allowed" : "pointer"
                                                                }}
                                                            >
                                                                📋
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: "#9ca3af", fontSize: "12px" }}>—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            ) : (
                // Staff Management View
                <>
                    <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: "24px" }}>
                        <h3 style={{ fontSize: "15px", fontWeight: 700, marginTop: 0, marginBottom: "16px" }}>
                            {editId ? "✏️ Edit Staff" : "➕ Add Staff"}
                        </h3>
                        <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                            <input 
                                required 
                                placeholder="Full Name *" 
                                value={form.name} 
                                onChange={(e) => setForm({ ...form, name: e.target.value })} 
                                style={inputStyle} 
                            />
                            <select 
                                value={form.role} 
                                onChange={(e) => setForm({ ...form, role: e.target.value })} 
                                style={inputStyle}
                            >
                                <option value="">Select Role</option>
                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <input 
                                placeholder="Email" 
                                type="email" 
                                value={form.email} 
                                onChange={(e) => setForm({ ...form, email: e.target.value })} 
                                style={inputStyle} 
                            />
                            <input 
                                placeholder="Phone" 
                                value={form.phone} 
                                onChange={(e) => setForm({ ...form, phone: e.target.value })} 
                                style={inputStyle} 
                            />
                            <div style={{ display: "flex", gap: "10px", gridColumn: "span 2" }}>
                                <button type="submit" disabled={loading} style={btnStyle("#6d28d9")}>
                                    {loading ? "Saving..." : editId ? "Update" : "Add Staff"}
                                </button>
                                {editId && (
                                    <button 
                                        type="button" 
                                        onClick={() => { setEditId(null); setForm(defaultForm); }} 
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
                                    {["#", "Name", "Role", "Email", "Phone", "Actions"].map(h => (
                                        <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {items.length === 0 && (
                                    <tr><td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>No staff added yet.</td></tr>
                                )}
                                {items.map((item, i) => (
                                    <tr key={item.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                                        <td style={tdStyle}>{i + 1}</td>
                                        <td style={{ ...tdStyle, fontWeight: 600 }}>{item.name}</td>
                                        <td style={tdStyle}>
                                            <span style={{ background: "#f3f0ff", color: "#6d28d9", padding: "2px 10px", borderRadius: "99px", fontSize: "12px", fontWeight: 600 }}>
                                                {item.role || "—"}
                                            </span>
                                        </td>
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
                </>
            )}
        </div>
    );
};

const inputStyle = { border: "1px solid #e5e7eb", borderRadius: "8px", padding: "10px 14px", fontSize: "14px", outline: "none" };
const tdStyle = { padding: "12px 16px", fontSize: "13px", color: "#374151" };
const btnStyle = (color, small = false) => ({
    background: color, 
    color: "#fff", 
    border: "none", 
    borderRadius: "7px",
    padding: small ? "6px 14px" : "10px 20px", 
    fontWeight: 600, 
    fontSize: small ? "12px" : "14px", 
    cursor: "pointer",
});

export default ManageStaff;
