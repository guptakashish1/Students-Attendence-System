import React, { useState, useEffect } from "react";
import { listenCollection, addRecord, updateRecord, deleteRecord } from "../../firebase";

const AutoTelegramChannels = () => {
    const [classArms, setClassArms] = useState([]);
    const [channels, setChannels] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [showQR, setShowQR] = useState(null);
    const [editLink, setEditLink] = useState("");

    useEffect(() => {
        const unsub1 = listenCollection("classArms", setClassArms);
        const unsub2 = listenCollection("telegramChannels", setChannels);
        const unsub3 = listenCollection("students", setStudents);
        return () => { unsub1(); unsub2(); unsub3(); };
    }, []);

    // Get all class-section combinations from classArms
    const allClassSections = React.useMemo(() => {
        const combinations = [];
        
        classArms.forEach(arm => {
            const className = arm.className || arm.classId; // Use className label
            const section = arm.name; // Section name is in 'name' field
            if (className && section) {
                combinations.push({
                    id: `${className}_${section}`,
                    className: className,
                    section: section,
                    fullName: `${className} - ${section}`
                });
            }
        });

        return combinations;
    }, [classArms]);

    const generateQRCode = (text) => {
        const encodedText = encodeURIComponent(text);
        return `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encodedText}`;
    };

    const generateChannelLink = (className, section) => {
        const channelName = `${className}_${section}`.replace(/\s+/g, '_').toLowerCase();
        return `https://t.me/+PLACEHOLDER_${channelName}`;
    };

    const createChannelForClassSection = async (classSection) => {
        setLoading(true);
        try {
            const channelLink = generateChannelLink(classSection.className, classSection.section);
            const channelName = `${classSection.className} - ${classSection.section}`;
            
            await addRecord("telegramChannels", {
                className: classSection.className,
                section: classSection.section,
                channelName: channelName,
                channelLink: channelLink,
                createdAt: new Date().toISOString(),
                isActive: true
            });

            alert(`✅ Channel created for ${channelName}!`);
        } catch (error) {
            alert("❌ Error creating channel: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const createAllChannels = async () => {
        const sectionsToCreate = allClassSections.filter(classSection => {
            return !channels.some(ch => 
                ch.className === classSection.className && ch.section === classSection.section
            );
        });

        if (sectionsToCreate.length === 0) {
            alert("ℹ️ All class sections already have channels!");
            return;
        }

        if (!window.confirm(`Create Telegram channels for ${sectionsToCreate.length} class sections?`)) return;
        
        setLoading(true);
        
        try {
            for (const classSection of sectionsToCreate) {
                const channelLink = generateChannelLink(classSection.className, classSection.section);
                const channelName = `${classSection.className} - ${classSection.section}`;
                
                await addRecord("telegramChannels", {
                    className: classSection.className,
                    section: classSection.section,
                    channelName: channelName,
                    channelLink: channelLink,
                    createdAt: new Date().toISOString(),
                    isActive: true
                });
            }

            alert(`✅ Created ${sectionsToCreate.length} channels!`);
        } catch (error) {
            alert("❌ Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const getStudentCount = (className, section) => {
        return students.filter(s => s.studentClass === className && s.classArm === section).length;
    };

    const downloadQRCode = (channelLink, channelName) => {
        const qrUrl = generateQRCode(channelLink);
        const link = document.createElement('a');
        link.href = qrUrl;
        link.download = `Telegram_${channelName}_QR.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const updateChannelLink = async () => {
        if (!editLink.trim()) {
            alert("⚠️ Please enter a valid link!");
            return;
        }
        if (editLink.includes('PLACEHOLDER')) {
            alert("⚠️ Please replace the placeholder with your actual Telegram invite link!");
            return;
        }
        setLoading(true);
        try {
            await updateRecord("telegramChannels", selectedChannel.id, { channelLink: editLink });
            alert("✅ Channel link updated successfully!");
            setSelectedChannel(null);
            setEditLink("");
        } catch (error) {
            alert("❌ Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleChannelStatus = async (channelId, currentStatus) => {
        setLoading(true);
        try {
            await updateRecord("telegramChannels", channelId, { isActive: !currentStatus });
        } finally {
            setLoading(false);
        }
    };

    const deleteChannel = async (channelId, channelName) => {
        if (!window.confirm(`Delete channel for ${channelName}?`)) return;
        setLoading(true);
        try {
            await deleteRecord("telegramChannels", channelId);
            alert("✅ Channel deleted!");
            setSelectedChannel(null);
        } catch (error) {
            alert("❌ Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "20px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 800, color: "#111827", marginBottom: "4px" }}>
                📱 Auto Telegram Channels
            </h2>
            <p style={{ color: "#9ca3af", fontSize: "13px", marginBottom: "24px" }}>
                Create and manage Telegram channels for each class section with QR codes.
            </p>

            {allClassSections.length === 0 && (
                <div style={{
                    background: "#fef3c7",
                    border: "1px solid #fbbf24",
                    borderRadius: "8px",
                    padding: "16px",
                    marginBottom: "24px",
                    fontSize: "14px",
                    color: "#92400e"
                }}>
                    ⚠️ No class sections found! Please add class sections in "Class Arms" first.
                </div>
            )}

            {/* Action Button */}
            <div style={{ marginBottom: "24px" }}>
                <button
                    onClick={createAllChannels}
                    disabled={loading || allClassSections.length === 0}
                    style={{
                        background: "#10b981",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        padding: "12px 24px",
                        fontSize: "14px",
                        fontWeight: 600,
                        cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading ? 0.6 : 1
                    }}
                >
                    {loading ? "Creating..." : `🚀 Create All Channels`}
                </button>
            </div>

            {/* Class Sections Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px", marginBottom: "24px" }}>
                {allClassSections.map(classSection => {
                    const channel = channels.find(ch => ch.className === classSection.className && ch.section === classSection.section);
                    const studentCount = getStudentCount(classSection.className, classSection.section);

                    return (
                        <div
                            key={classSection.id}
                            style={{
                                background: "#fff",
                                borderRadius: "12px",
                                padding: "20px",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                                border: channel ? "2px solid #10b981" : "2px solid #e5e7eb"
                            }}
                        >
                            <div style={{ marginBottom: "12px" }}>
                                <h3 style={{ fontSize: "16px", fontWeight: 700, color: "#111827", margin: 0 }}>
                                    {classSection.fullName}
                                </h3>
                                <p style={{ fontSize: "12px", color: "#6b7280", margin: "4px 0 0 0" }}>
                                    👥 {studentCount} students
                                </p>
                            </div>

                            {channel ? (
                                <div style={{ marginTop: "12px" }}>
                                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                        <button
                                            onClick={() => {
                                                setSelectedChannel(channel);
                                                setEditLink(channel.channelLink);
                                            }}
                                            style={{
                                                background: "#3b82f6",
                                                color: "#fff",
                                                border: "none",
                                                borderRadius: "6px",
                                                padding: "6px 12px",
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                cursor: "pointer",
                                                flex: 1
                                            }}
                                        >
                                            📋 Details
                                        </button>
                                        <button
                                            onClick={() => setShowQR(channel)}
                                            style={{
                                                background: "#8b5cf6",
                                                color: "#fff",
                                                border: "none",
                                                borderRadius: "6px",
                                                padding: "6px 12px",
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                cursor: "pointer",
                                                flex: 1
                                            }}
                                        >
                                            📱 QR
                                        </button>
                                        <button
                                            onClick={() => toggleChannelStatus(channel.id, channel.isActive)}
                                            disabled={loading}
                                            style={{
                                                background: channel.isActive ? "#f59e0b" : "#10b981",
                                                color: "#fff",
                                                border: "none",
                                                borderRadius: "6px",
                                                padding: "6px 12px",
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                cursor: loading ? "not-allowed" : "pointer",
                                                flex: 1
                                            }}
                                        >
                                            {channel.isActive ? "⏸️" : "▶️"}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => createChannelForClassSection(classSection)}
                                    disabled={loading}
                                    style={{
                                        background: "#6d28d9",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: "6px",
                                        padding: "8px 16px",
                                        fontSize: "12px",
                                        fontWeight: 600,
                                        cursor: loading ? "not-allowed" : "pointer",
                                        width: "100%",
                                        marginTop: "12px"
                                    }}
                                >
                                    ➕ Create Channel
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Channel Details Modal */}
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
                            maxWidth: "500px",
                            width: "90%"
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: "18px", fontWeight: 700 }}>
                            {selectedChannel.channelName}
                        </h3>
                        <div style={{ marginBottom: "16px" }}>
                            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "8px", color: "#374151" }}>
                                Telegram Invite Link:
                            </label>
                            <input
                                type="text"
                                value={editLink}
                                onChange={(e) => setEditLink(e.target.value)}
                                placeholder="https://t.me/+YOUR_INVITE_LINK"
                                style={{
                                    width: "100%",
                                    padding: "10px",
                                    border: "1px solid #d1d5db",
                                    borderRadius: "6px",
                                    fontSize: "13px"
                                }}
                            />
                        </div>
                        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                            <button
                                onClick={updateChannelLink}
                                disabled={loading}
                                style={{
                                    background: "#10b981",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "8px",
                                    padding: "10px 20px",
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    cursor: loading ? "not-allowed" : "pointer"
                                }}
                            >
                                💾 Save
                            </button>
                            <button
                                onClick={() => deleteChannel(selectedChannel.id, selectedChannel.channelName)}
                                disabled={loading}
                                style={{
                                    background: "#ef4444",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "8px",
                                    padding: "10px 20px",
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    cursor: loading ? "not-allowed" : "pointer"
                                }}
                            >
                                🗑️ Delete
                            </button>
                            <button
                                onClick={() => {
                                    setSelectedChannel(null);
                                    setEditLink("");
                                }}
                                style={{
                                    background: "#6b7280",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "8px",
                                    padding: "10px 20px",
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

            {/* QR Code Modal */}
            {showQR && (
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
                    onClick={() => setShowQR(null)}
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
                            {showQR.channelName}
                        </h3>
                        <img
                            src={generateQRCode(showQR.channelLink)}
                            alt="QR Code"
                            style={{ width: "300px", height: "300px", marginBottom: "16px" }}
                        />
                        <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
                            Scan to join the Telegram channel
                        </p>
                        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                            <button
                                onClick={() => downloadQRCode(showQR.channelLink, showQR.channelName)}
                                style={{
                                    background: "#3b82f6",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "8px",
                                    padding: "10px 20px",
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    cursor: "pointer"
                                }}
                            >
                                📥 Download
                            </button>
                            <button
                                onClick={() => setShowQR(null)}
                                style={{
                                    background: "#6b7280",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "8px",
                                    padding: "10px 20px",
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

export default AutoTelegramChannels;
