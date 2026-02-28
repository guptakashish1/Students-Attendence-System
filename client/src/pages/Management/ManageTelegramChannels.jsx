import React, { useState, useEffect } from "react";
import { listenCollection, addRecord, deleteRecord, updateRecord } from "../../firebase";

const PATH = "telegramChannels";

const ManageTelegramChannels = () => {
    const [items, setItems] = useState([]);
    const [classes, setClasses] = useState([]);
    const [classArms, setClassArms] = useState([]);
    const [form, setForm] = useState({ classId: "", section: "", channelLink: "", channelName: "" });
    const [editId, setEditId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedChannel, setSelectedChannel] = useState(null);

    useEffect(() => {
        const unsub1 = listenCollection(PATH, setItems);
        const unsub2 = listenCollection("classes", setClasses);
        const unsub3 = listenCollection("classArms", setClassArms);
        return () => { unsub1(); unsub2(); unsub3(); };
    }, []);

    // Get sections for selected class
    const getSectionsForClass = (classId) => {
        if (!classId) return [];
        
        // Find the class name from the selected classId
        const selectedClass = classes.find(c => c.id === classId);
        if (!selectedClass) return [];
        
        // Filter classArms by className (since classArms stores className, not classId)
        return classArms.filter(arm => 
            arm.classId === classId || 
            arm.classId === selectedClass.name || 
            arm.className === selectedClass.name
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.channelLink.trim() || !form.classId) return;
        setLoading(true);
        try {
            const classLabel = classes.find(c => c.id === form.classId)?.name || form.classId;
            const payload = { 
                ...form, 
                className: classLabel,
                createdAt: new Date().toISOString()
            };
            if (editId) { 
                await updateRecord(PATH, editId, payload); 
                setEditId(null); 
            } else { 
                await addRecord(PATH, payload); 
            }
            setForm({ classId: "", section: "", channelLink: "", channelName: "" });
        } finally { 
            setLoading(false); 
        }
    };

    const handleEdit = (item) => { 
        setEditId(item.id); 
        setForm({ 
            classId: item.classId || "", 
            section: item.section || "",
            channelLink: item.channelLink || "",
            channelName: item.channelName || ""
        }); 
    };

    const handleDelete = async (id) => { 
        if (window.confirm("Delete this channel?")) await deleteRecord(PATH, id); 
    };

    const generateQRCode = (channelLink) => {
        // Using Google Charts API for QR code generation
        // Ensure the link is properly encoded
        const encodedLink = encodeURIComponent(channelLink);
        return `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encodedLink}&choe=UTF-8`;
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            alert("✅ Link copied to clipboard!");
        }).catch(() => {
            alert("❌ Failed to copy link");
        });
    };

    const downloadQRCode = (channelLink, className) => {
        const qrUrl = generateQRCode(channelLink);
        const link = document.createElement('a');
        link.href = qrUrl;
        link.download = `Telegram_${className}_QR.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div style={{ maxWidth: "1000px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111827", marginBottom: "4px" }}>
                📱 Manage Telegram Channels
            </h2>
            <p style={{ color: "#9ca3af", fontSize: "13px", marginBottom: "24px" }}>
                Create class-specific Telegram channels and generate QR codes for easy joining.
            </p>

            <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", marginBottom: "24px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 700, marginTop: 0, marginBottom: "16px" }}>
                    {editId ? "✏️ Edit Channel" : "➕ Add Telegram Channel"}
                </h3>
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                                Class <span style={{ color: "#ef4444" }}>*</span>
                            </label>
                            <select 
                                required
                                value={form.classId} 
                                onChange={(e) => setForm({ ...form, classId: e.target.value, section: "" })} 
                                style={inputStyle}
                            >
                                <option value="">-- Select a Class --</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                                Section (Optional)
                            </label>
                            <select 
                                value={form.section} 
                                onChange={(e) => setForm({ ...form, section: e.target.value })} 
                                style={inputStyle}
                                disabled={!form.classId}
                            >
                                <option value="">-- All Sections --</option>
                                {form.classId && getSectionsForClass(form.classId).length === 0 && (
                                    <option value="" disabled>No sections found for this class</option>
                                )}
                                {form.classId && getSectionsForClass(form.classId).map(arm => (
                                    <option key={arm.id} value={arm.name}>{arm.name}</option>
                                ))}
                            </select>
                            <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
                                {form.classId && getSectionsForClass(form.classId).length === 0 
                                    ? "⚠️ Add sections in Class Arms first" 
                                    : "💡 Leave empty for class-wide channel"}
                            </p>
                        </div>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                                Channel Name <span style={{ color: "#ef4444" }}>*</span>
                            </label>
                            <input 
                                required 
                                placeholder="e.g. Class X Official" 
                                value={form.channelName}
                                onChange={(e) => setForm({ ...form, channelName: e.target.value })} 
                                style={inputStyle} 
                            />
                        </div>
                    </div>
                    <div>
                        <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                            Telegram Channel Link <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input 
                            required 
                            type="url"
                            placeholder="https://t.me/your_channel" 
                            value={form.channelLink}
                            onChange={(e) => setForm({ ...form, channelLink: e.target.value })} 
                            style={inputStyle} 
                        />
                        <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
                            💡 Tip: Create a public Telegram channel and paste the invite link here
                        </p>
                    </div>
                    <div style={{ display: "flex", gap: "12px" }}>
                        <button type="submit" disabled={loading} style={btnStyle("#6d28d9")}>
                            {loading ? "Saving..." : editId ? "Update Channel" : "Add Channel"}
                        </button>
                        {editId && (
                            <button 
                                type="button" 
                                onClick={() => { setEditId(null); setForm({ classId: "", section: "", channelLink: "", channelName: "" }); }} 
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
                            {["#", "Class", "Section", "Channel Name", "Link", "QR Code", "Actions"].map(h => (
                                <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: "11px", fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.length === 0 && (
                            <tr>
                                <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>
                                    No Telegram channels added yet.
                                </td>
                            </tr>
                        )}
                        {items.map((item, i) => (
                            <tr key={item.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                                <td style={tdStyle}>{i + 1}</td>
                                <td style={{ ...tdStyle, fontWeight: 600 }}>{item.className || "—"}</td>
                                <td style={tdStyle}>{item.section || "All"}</td>
                                <td style={tdStyle}>{item.channelName || "—"}</td>
                                <td style={tdStyle}>
                                    <a 
                                        href={item.channelLink} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        style={{ color: "#6d28d9", textDecoration: "none" }}
                                    >
                                        Open Channel
                                    </a>
                                </td>
                                <td style={tdStyle}>
                                    <button 
                                        onClick={() => setSelectedChannel(item)} 
                                        style={btnStyle("#10b981", true)}
                                    >
                                        View QR
                                    </button>
                                    <button 
                                        onClick={() => downloadQRCode(item.channelLink, item.className)} 
                                        style={{ ...btnStyle("#3b82f6", true), marginLeft: "8px" }}
                                    >
                                        Download
                                    </button>
                                </td>
                                <td style={tdStyle}>
                                    <button onClick={() => handleEdit(item)} style={btnStyle("#6d28d9", true)}>
                                        Edit
                                    </button>
                                    <button onClick={() => handleDelete(item.id)} style={{ ...btnStyle("#ef4444", true), marginLeft: "8px" }}>
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* QR Code Modal */}
            {selectedChannel && (
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
                        zIndex: 1000
                    }}
                    onClick={() => setSelectedChannel(null)}
                >
                    <div 
                        style={{
                            background: "#fff",
                            borderRadius: "12px",
                            padding: "32px",
                            maxWidth: "400px",
                            textAlign: "center"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: "18px", fontWeight: 700 }}>
                            {selectedChannel.className}{selectedChannel.section ? ` - ${selectedChannel.section}` : ""} - {selectedChannel.channelName}
                        </h3>
                        <div style={{ marginBottom: "16px", padding: "12px", background: "#f3f4f6", borderRadius: "8px" }}>
                            <p style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 4px 0" }}>Channel Link:</p>
                            <a 
                                href={selectedChannel.channelLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                style={{ fontSize: "13px", color: "#6d28d9", wordBreak: "break-all" }}
                            >
                                {selectedChannel.channelLink}
                            </a>
                        </div>
                        <img 
                            src={generateQRCode(selectedChannel.channelLink)} 
                            alt="QR Code"
                            style={{ width: "300px", height: "300px", marginBottom: "16px", border: "1px solid #e5e7eb" }}
                            onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'block';
                            }}
                        />
                        <div style={{ display: "none", padding: "20px", background: "#fef3c7", borderRadius: "8px", marginBottom: "16px" }}>
                            <p style={{ fontSize: "13px", color: "#92400e", margin: 0 }}>
                                ⚠️ QR Code failed to load. Please try downloading instead or check your internet connection.
                            </p>
                        </div>
                        <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
                            Scan this QR code to join the Telegram channel
                        </p>
                        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                            <button 
                                onClick={() => downloadQRCode(selectedChannel.channelLink, selectedChannel.className)}
                                style={btnStyle("#3b82f6")}
                            >
                                📥 Download QR
                            </button>
                            <button 
                                onClick={() => copyToClipboard(selectedChannel.channelLink)}
                                style={btnStyle("#10b981")}
                            >
                                📋 Copy Link
                            </button>
                            <button 
                                onClick={() => setSelectedChannel(null)}
                                style={btnStyle("#6b7280")}
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

const inputStyle = { 
    width: "100%",
    border: "1px solid #e5e7eb", 
    borderRadius: "8px", 
    padding: "10px 14px", 
    fontSize: "14px", 
    outline: "none",
    cursor: "pointer"
};

const tdStyle = { 
    padding: "12px 16px", 
    fontSize: "13px", 
    color: "#374151" 
};

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

export default ManageTelegramChannels;
