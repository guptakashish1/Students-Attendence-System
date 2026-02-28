import React, { useState, useEffect } from "react";
import { listenCollection, addRecord, updateRecord, deleteRecord } from "../../firebase";

const TelegramBotAutomation = () => {
    const [automations, setAutomations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [form, setForm] = useState({
        name: "",
        type: "attendance_notification",
        enabled: true,
        schedule: "daily",
        time: "09:00",
        target: "students",
        message: ""
    });

    const automationTypes = [
        { 
            value: "attendance_notification", 
            label: "📢 Attendance Notification",
            description: "Notify students when attendance is marked"
        },
        { 
            value: "daily_summary", 
            label: "📊 Daily Summary",
            description: "Send daily attendance summary to students/parents"
        },
        { 
            value: "weekly_report", 
            label: "📅 Weekly Report",
            description: "Send weekly attendance report"
        },
        { 
            value: "low_attendance_alert", 
            label: "⚠️ Low Attendance Alert",
            description: "Alert when attendance falls below threshold"
        },
        { 
            value: "ai_insights", 
            label: "🤖 AI Insights",
            description: "Send AI-generated attendance analytics"
        },
        { 
            value: "parent_report", 
            label: "👨‍👩‍👦 Parent Report",
            description: "Automated reports to parents"
        }
    ];

    useEffect(() => {
        const unsub = listenCollection("telegramAutomations", setAutomations);
        return () => unsub();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await addRecord("telegramAutomations", {
                ...form,
                createdAt: new Date().toISOString(),
                lastRun: null,
                runCount: 0
            });
            setShowAddModal(false);
            setForm({
                name: "",
                type: "attendance_notification",
                enabled: true,
                schedule: "daily",
                time: "09:00",
                target: "students",
                message: ""
            });
            alert("✅ Automation created successfully!");
        } catch (error) {
            alert("❌ Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleAutomation = async (id, currentStatus) => {
        setLoading(true);
        try {
            await updateRecord("telegramAutomations", id, { enabled: !currentStatus });
        } finally {
            setLoading(false);
        }
    };

    const deleteAutomation = async (id, name) => {
        if (!window.confirm(`Delete automation "${name}"?`)) return;
        setLoading(true);
        try {
            await deleteRecord("telegramAutomations", id);
            alert("✅ Automation deleted!");
        } finally {
            setLoading(false);
        }
    };

    const getTypeInfo = (type) => {
        return automationTypes.find(t => t.value === type) || automationTypes[0];
    };

    return (
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111827", marginBottom: "4px" }}>
                🤖 Telegram Bot Automation
            </h2>
            <p style={{ color: "#9ca3af", fontSize: "13px", marginBottom: "24px" }}>
                Automate notifications, reports, and AI-powered insights via Telegram
            </p>

            {/* Features Overview */}
            <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", 
                gap: "16px", 
                marginBottom: "24px" 
            }}>
                {[
                    { icon: "📢", title: "Auto Notifications", desc: "Instant attendance updates" },
                    { icon: "📊", title: "Daily Summaries", desc: "Automated attendance reports" },
                    { icon: "🔍", title: "Student Queries", desc: "Check attendance via bot" },
                    { icon: "👨‍👩‍👦", title: "Parent Reports", desc: "Weekly/monthly updates" },
                    { icon: "🤖", title: "AI Analytics", desc: "Smart insights & predictions" },
                    { icon: "⚠️", title: "Smart Alerts", desc: "Low attendance warnings" }
                ].map((feature, i) => (
                    <div
                        key={i}
                        style={{
                            background: "#fff",
                            borderRadius: "12px",
                            padding: "20px",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                            textAlign: "center"
                        }}
                    >
                        <div style={{ fontSize: "32px", marginBottom: "8px" }}>{feature.icon}</div>
                        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#111827", margin: "0 0 4px 0" }}>
                            {feature.title}
                        </h3>
                        <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>
                            {feature.desc}
                        </p>
                    </div>
                ))}
            </div>

            {/* Add Automation Button */}
            <div style={{ marginBottom: "24px" }}>
                <button
                    onClick={() => setShowAddModal(true)}
                    style={{
                        background: "#6d28d9",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        padding: "12px 24px",
                        fontSize: "14px",
                        fontWeight: 600,
                        cursor: "pointer"
                    }}
                >
                    ➕ Add New Automation
                </button>
            </div>

            {/* Active Automations */}
            <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                <div style={{ padding: "20px", borderBottom: "1px solid #f3f4f6" }}>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
                        ⚙️ Active Automations ({automations.filter(a => a.enabled).length}/{automations.length})
                    </h3>
                </div>

                {automations.length === 0 ? (
                    <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af" }}>
                        No automations configured yet. Click "Add New Automation" to get started.
                    </div>
                ) : (
                    <div style={{ padding: "20px" }}>
                        <div style={{ display: "grid", gap: "16px" }}>
                            {automations.map(automation => {
                                const typeInfo = getTypeInfo(automation.type);
                                return (
                                    <div
                                        key={automation.id}
                                        style={{
                                            border: "1px solid #e5e7eb",
                                            borderRadius: "12px",
                                            padding: "20px",
                                            background: automation.enabled ? "#fff" : "#f9fafb"
                                        }}
                                    >
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "12px" }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                                                    <h4 style={{ fontSize: "16px", fontWeight: 700, color: "#111827", margin: 0 }}>
                                                        {automation.name}
                                                    </h4>
                                                    <span style={{
                                                        background: automation.enabled ? "#d1fae5" : "#fee2e2",
                                                        color: automation.enabled ? "#065f46" : "#991b1b",
                                                        fontSize: "10px",
                                                        fontWeight: 700,
                                                        padding: "4px 8px",
                                                        borderRadius: "6px"
                                                    }}>
                                                        {automation.enabled ? "ACTIVE" : "PAUSED"}
                                                    </span>
                                                </div>
                                                <p style={{ fontSize: "13px", color: "#6b7280", margin: "0 0 8px 0" }}>
                                                    {typeInfo.label} - {typeInfo.description}
                                                </p>
                                                <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "#9ca3af" }}>
                                                    <span>📅 {automation.schedule}</span>
                                                    <span>🕐 {automation.time}</span>
                                                    <span>👥 {automation.target}</span>
                                                    {automation.lastRun && (
                                                        <span>✅ Last run: {new Date(automation.lastRun).toLocaleString()}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: "flex", gap: "8px" }}>
                                                <button
                                                    onClick={() => toggleAutomation(automation.id, automation.enabled)}
                                                    disabled={loading}
                                                    style={{
                                                        background: automation.enabled ? "#f59e0b" : "#10b981",
                                                        color: "#fff",
                                                        border: "none",
                                                        borderRadius: "6px",
                                                        padding: "6px 12px",
                                                        fontSize: "12px",
                                                        fontWeight: 600,
                                                        cursor: loading ? "not-allowed" : "pointer"
                                                    }}
                                                >
                                                    {automation.enabled ? "⏸️ Pause" : "▶️ Resume"}
                                                </button>
                                                <button
                                                    onClick={() => deleteAutomation(automation.id, automation.name)}
                                                    disabled={loading}
                                                    style={{
                                                        background: "#ef4444",
                                                        color: "#fff",
                                                        border: "none",
                                                        borderRadius: "6px",
                                                        padding: "6px 12px",
                                                        fontSize: "12px",
                                                        fontWeight: 600,
                                                        cursor: loading ? "not-allowed" : "pointer"
                                                    }}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                        {automation.message && (
                                            <div style={{ 
                                                marginTop: "12px", 
                                                padding: "12px", 
                                                background: "#f9fafb", 
                                                borderRadius: "8px",
                                                fontSize: "12px",
                                                color: "#374151"
                                            }}>
                                                <strong>Message Template:</strong> {automation.message}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Bot Commands Reference */}
            <div style={{ 
                background: "#fff", 
                borderRadius: "12px", 
                padding: "24px", 
                boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                marginTop: "24px"
            }}>
                <h3 style={{ fontSize: "16px", fontWeight: 700, marginTop: 0, marginBottom: "16px" }}>
                    💬 Available Bot Commands
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "12px" }}>
                    {[
                        { cmd: "/attendance", desc: "Check today's attendance status" },
                        { cmd: "/percentage", desc: "View overall attendance percentage" },
                        { cmd: "/report", desc: "Get detailed attendance report" },
                        { cmd: "/summary", desc: "Weekly/monthly summary" },
                        { cmd: "/alerts", desc: "View low attendance alerts" },
                        { cmd: "/help", desc: "Show all available commands" }
                    ].map(item => (
                        <div
                            key={item.cmd}
                            style={{
                                padding: "12px",
                                border: "1px solid #e5e7eb",
                                borderRadius: "8px",
                                background: "#fafafa"
                            }}
                        >
                            <code style={{ 
                                fontSize: "13px", 
                                fontWeight: 700, 
                                color: "#6d28d9",
                                background: "#f5f3ff",
                                padding: "2px 8px",
                                borderRadius: "4px"
                            }}>
                                {item.cmd}
                            </code>
                            <p style={{ fontSize: "12px", color: "#6b7280", margin: "8px 0 0 0" }}>
                                {item.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add Automation Modal */}
            {showAddModal && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: "rgba(0,0,0,0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 1000,
                        padding: "20px"
                    }}
                    onClick={() => setShowAddModal(false)}
                >
                    <div
                        style={{
                            background: "#fff",
                            borderRadius: "12px",
                            padding: "32px",
                            maxWidth: "600px",
                            width: "100%",
                            maxHeight: "90vh",
                            overflowY: "auto"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ marginTop: 0, marginBottom: "24px", fontSize: "20px", fontWeight: 700 }}>
                            ➕ Add New Automation
                        </h3>

                        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <div>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                                    Automation Name <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="e.g., Daily Attendance Notification"
                                    style={{
                                        width: "100%",
                                        border: "1px solid #e5e7eb",
                                        borderRadius: "6px",
                                        padding: "10px 12px",
                                        fontSize: "14px"
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                                    Automation Type <span style={{ color: "#ef4444" }}>*</span>
                                </label>
                                <select
                                    required
                                    value={form.type}
                                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                                    style={{
                                        width: "100%",
                                        border: "1px solid #e5e7eb",
                                        borderRadius: "6px",
                                        padding: "10px 12px",
                                        fontSize: "14px"
                                    }}
                                >
                                    {automationTypes.map(type => (
                                        <option key={type.value} value={type.value}>
                                            {type.label} - {type.description}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                <div>
                                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                                        Schedule
                                    </label>
                                    <select
                                        value={form.schedule}
                                        onChange={(e) => setForm({ ...form, schedule: e.target.value })}
                                        style={{
                                            width: "100%",
                                            border: "1px solid #e5e7eb",
                                            borderRadius: "6px",
                                            padding: "10px 12px",
                                            fontSize: "14px"
                                        }}
                                    >
                                        <option value="instant">Instant (on event)</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                                        Time
                                    </label>
                                    <input
                                        type="time"
                                        value={form.time}
                                        onChange={(e) => setForm({ ...form, time: e.target.value })}
                                        style={{
                                            width: "100%",
                                            border: "1px solid #e5e7eb",
                                            borderRadius: "6px",
                                            padding: "10px 12px",
                                            fontSize: "14px"
                                        }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                                    Target Audience
                                </label>
                                <select
                                    value={form.target}
                                    onChange={(e) => setForm({ ...form, target: e.target.value })}
                                    style={{
                                        width: "100%",
                                        border: "1px solid #e5e7eb",
                                        borderRadius: "6px",
                                        padding: "10px 12px",
                                        fontSize: "14px"
                                    }}
                                >
                                    <option value="students">Students</option>
                                    <option value="parents">Parents</option>
                                    <option value="both">Both Students & Parents</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                                    Message Template (Optional)
                                </label>
                                <textarea
                                    value={form.message}
                                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                                    placeholder="Custom message template..."
                                    rows={3}
                                    style={{
                                        width: "100%",
                                        border: "1px solid #e5e7eb",
                                        borderRadius: "6px",
                                        padding: "10px 12px",
                                        fontSize: "14px",
                                        fontFamily: "inherit",
                                        resize: "vertical"
                                    }}
                                />
                            </div>

                            <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    style={{
                                        flex: 1,
                                        background: "#6d28d9",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: "8px",
                                        padding: "12px",
                                        fontSize: "14px",
                                        fontWeight: 600,
                                        cursor: loading ? "not-allowed" : "pointer"
                                    }}
                                >
                                    {loading ? "Creating..." : "Create Automation"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    style={{
                                        background: "#6b7280",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: "8px",
                                        padding: "12px 24px",
                                        fontSize: "14px",
                                        fontWeight: 600,
                                        cursor: "pointer"
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TelegramBotAutomation;
