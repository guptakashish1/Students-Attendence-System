import React, { useState, useEffect } from "react";
import { getAttendanceByMonth, listenRegisteredStudents, sendTelegramMessage, listenCollection } from "../../firebase";

const MonthlySummary = ({ userEmail, userRole }) => {
    const [students, setStudents] = useState([]);
    const [channels, setChannels] = useState([]);
    const [month, setMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    const [summaryData, setSummaryData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [groupByClass, setGroupByClass] = useState(true);
    const [selectedClass, setSelectedClass] = useState("all");
    const [selectedSection, setSelectedSection] = useState("all");
    const [search, setSearch] = useState("");

    useEffect(() => {
        const unsubStudents = listenRegisteredStudents((allStudents) => {
            // Filter students for student role - only show their own record
            if (userRole === "student" && userEmail) {
                const myStudents = allStudents.filter(s => 
                    s.studentEmail?.toLowerCase() === userEmail.toLowerCase() || 
                    s.parentEmail?.toLowerCase() === userEmail.toLowerCase()
                );
                setStudents(myStudents);
            } else if (userRole === "warden") {
                // Filter for wardens - only show hostlers
                const hostlerStudents = allStudents.filter(s => s.residenceType === "hostler");
                setStudents(hostlerStudents);
            } else {
                setStudents(allStudents);
            }
        });
        const unsubChannels = listenCollection("telegramChannels", setChannels);
        return () => { unsubStudents(); unsubChannels(); };
    }, [userEmail, userRole]);

    // 🔹 Check for Month-End Auto Trigger
    useEffect(() => {
        const checkAutoTrigger = async () => {
            const today = new Date();
            // If it's the 1st of the month, offer to send last month's summary
            if (today.getDate() === 1) {
                const lastMonthDate = new Date();
                lastMonthDate.setMonth(today.getMonth() - 1);
                const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

                if (window.confirm(`Today is the 1st of the month! Would you like to generate and send the summary for ${lastMonthStr}?`)) {
                    setMonth(lastMonthStr);
                    // Small delay to ensure state updates before generation
                    setTimeout(() => generateSummary(lastMonthStr), 500);
                }
            }
        };
        checkAutoTrigger();
    }, [students]);

    const generateSummary = async (targetMonth = month) => {
        setLoading(true);
        try {
            const records = await getAttendanceByMonth(targetMonth);
            const aggregate = {};

            students.forEach((s) => {
                aggregate[s.rollNumber] = {
                    name: s.name,
                    rollNumber: s.rollNumber,
                    studentClass: s.studentClass,
                    classArm: s.classArm,
                    chatId: s.telegramChatId,
                    present: 0,
                    absent: 0,
                    leave: 0,
                    total: 0,
                };
            });

            records.forEach((rec) => {
                if (aggregate[rec.rollNumber]) {
                    aggregate[rec.rollNumber].total++;
                    if (rec.status === "IN") aggregate[rec.rollNumber].present++;
                    else if (rec.status === "ABSENT") aggregate[rec.rollNumber].absent++;
                    else if (rec.status === "LEAVE") aggregate[rec.rollNumber].leave++;
                }
            });

            setSummaryData(Object.values(aggregate));
        } catch (error) {
            alert("Error fetching monthly data: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const sendSummaryToClassChannels = async () => {
        if (!window.confirm(`Send monthly summary for ${month} to all class Telegram channels?`)) return;

        let sentCount = 0;
        const groupedByClass = {};

        // Group students by class and section
        summaryData.forEach(student => {
            const className = student.studentClass || "Unassigned";
            const section = student.classArm || "";
            const key = section ? `${className}_${section}` : className;
            
            if (!groupedByClass[key]) {
                groupedByClass[key] = {
                    className: className,
                    section: section,
                    students: []
                };
            }
            groupedByClass[key].students.push(student);
        });

        // Send summary to each class channel
        for (const [key, group] of Object.entries(groupedByClass)) {
            // Find the matching Telegram channel
            const channel = channels.find(ch => {
                if (group.section) {
                    // Match both class and section
                    return ch.className === group.className && ch.section === group.section;
                } else {
                    // Match class only (for channels without specific section)
                    return ch.className === group.className && !ch.section;
                }
            });

            if (channel && channel.channelLink) {
                // Extract chat ID from channel link (if it's a bot channel)
                // For now, we'll skip channels without chat IDs
                // You'll need to configure channel chat IDs in the database
                if (channel.chatId) {
                    // Calculate group statistics
                    const totalPresent = group.students.reduce((sum, s) => sum + s.present, 0);
                    const totalAbsent = group.students.reduce((sum, s) => sum + s.absent, 0);
                    const totalLeave = group.students.reduce((sum, s) => sum + s.leave, 0);
                    const avgAttendance = group.students.length > 0 
                        ? ((totalPresent / (totalPresent + totalAbsent + totalLeave)) * 100).toFixed(1)
                        : 0;

                    // Create summary message
                    let msg = `📊 Monthly Attendance Summary - ${month}\n`;
                    msg += `🎓 Class: ${group.className}${group.section ? ` - ${group.section}` : ""}\n`;
                    msg += `👥 Total Students: ${group.students.length}\n\n`;
                    msg += `📈 Overall Statistics:\n`;
                    msg += `✅ Total Present: ${totalPresent}\n`;
                    msg += `❌ Total Absent: ${totalAbsent}\n`;
                    msg += `📌 Total Leave: ${totalLeave}\n`;
                    msg += `📊 Average Attendance: ${avgAttendance}%\n\n`;
                    msg += `📋 Individual Summary:\n`;
                    msg += `━━━━━━━━━━━━━━━━━━━━\n`;

                    // Add top 5 students with best attendance
                    const sortedStudents = [...group.students].sort((a, b) => b.present - a.present);
                    sortedStudents.slice(0, 5).forEach((s, i) => {
                        msg += `${i + 1}. ${s.name} - ✅${s.present} ❌${s.absent}\n`;
                    });

                    if (group.students.length > 5) {
                        msg += `\n... and ${group.students.length - 5} more students\n`;
                    }

                    try {
                        await sendTelegramMessage(channel.chatId, msg);
                        sentCount++;
                    } catch (error) {
                        console.error(`Failed to send to ${group.className}:`, error);
                    }
                } else {
                    console.warn(`Channel for ${group.className}${group.section ? ` - ${group.section}` : ""} has no chat ID configured`);
                }
            }
        }

        if (sentCount > 0) {
            alert(`✅ Successfully sent summaries to ${sentCount} class channels.`);
        } else {
            alert(`⚠️ No summaries sent. Please configure chat IDs for your Telegram channels.\n\nNote: You need to add the bot to each channel and save the channel's chat ID in the database.`);
        }
    };

    // Filter summary data
    const filteredSummary = summaryData.filter((s) => {
        const matchesSearch = search === "" ||
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.rollNumber.toLowerCase().includes(search.toLowerCase());
        const matchesClass = selectedClass === "all" || s.studentClass === selectedClass;
        const matchesSection = selectedSection === "all" || s.classArm === selectedSection;
        return matchesSearch && matchesClass && matchesSection;
    });

    // Group summary by class and section
    const groupedSummary = filteredSummary.reduce((acc, student) => {
        const className = student.studentClass || "Unassigned";
        const section = student.classArm || "No Section";
        const key = `${className} - ${section}`;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(student);
        return acc;
    }, {});

    // Get unique classes and sections
    const uniqueClasses = [...new Set(summaryData.map(s => s.studentClass))].filter(Boolean).sort();
    const uniqueSections = selectedClass === "all" 
        ? [...new Set(summaryData.map(s => s.classArm))].filter(Boolean).sort()
        : [...new Set(summaryData.filter(s => s.studentClass === selectedClass).map(s => s.classArm))].filter(Boolean).sort();

    // Get stats for each group
    const getGroupStats = (groupKey) => {
        const group = groupedSummary[groupKey] || [];
        const totalPresent = group.reduce((sum, s) => sum + s.present, 0);
        const totalAbsent = group.reduce((sum, s) => sum + s.absent, 0);
        const totalLeave = group.reduce((sum, s) => sum + s.leave, 0);
        return { count: group.length, totalPresent, totalAbsent, totalLeave };
    };

    return (
        <div className="p-6 bg-white shadow rounded-lg">
            <h2 className="text-2xl font-bold text-purple-600 mb-6">
                {userRole === "student" ? "My Monthly Attendance Summary" : "Monthly Attendance Summary"}
            </h2>

            <div className="flex flex-wrap items-center gap-4 mb-6 bg-purple-50 p-4 rounded-xl border border-purple-100">
                <div className="flex flex-col">
                    <label className="text-sm text-purple-700 font-medium mb-1">Select Month</label>
                    <input
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="p-2 border rounded shadow-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                </div>
                <button
                    onClick={() => generateSummary()}
                    disabled={loading}
                    className="mt-6 bg-purple-600 text-white px-6 py-2 rounded-lg shadow hover:bg-purple-700 transition disabled:bg-gray-400"
                >
                    {loading ? "Generating..." : "Generate Summary"}
                </button>
                {summaryData.length > 0 && userRole !== "student" && (
                    <button
                        onClick={sendSummaryToClassChannels}
                        className="mt-6 bg-indigo-600 text-white px-6 py-2 rounded-lg shadow hover:bg-indigo-700 transition"
                    >
                        📢 Send to Class Channels
                    </button>
                )}
            </div>

            {/* Filters */}
            {summaryData.length > 0 && userRole !== "student" && (
                <div className="flex flex-wrap gap-4 items-center mb-6">
                    <input
                        type="text"
                        placeholder="🔍 Search by name or roll number..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1 min-w-[200px] p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                    <select
                        value={selectedClass}
                        onChange={(e) => {
                            setSelectedClass(e.target.value);
                            setSelectedSection("all");
                        }}
                        className="p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                        <option value="all">All Classes</option>
                        {uniqueClasses.map(cls => (
                            <option key={cls} value={cls}>{cls}</option>
                        ))}
                    </select>
                    <select
                        value={selectedSection}
                        onChange={(e) => setSelectedSection(e.target.value)}
                        className="p-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                        <option value="all">All Sections</option>
                        {uniqueSections.map(section => (
                            <option key={section} value={section}>{section}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => setGroupByClass(!groupByClass)}
                        className={`px-4 py-2 rounded-lg font-semibold transition ${
                            groupByClass 
                                ? "bg-purple-600 text-white" 
                                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                    >
                        {groupByClass ? "📊 Grouped" : "📋 List"}
                    </button>
                </div>
            )}

            <div className="overflow-x-auto">
                {userRole === "student" ? (
                    // Student View - Simple card-based summary
                    <div className="space-y-4">
                        {filteredSummary.length > 0 ? (
                            filteredSummary.map((s) => {
                                const totalDays = s.present + s.absent + s.leave;
                                const percentage = totalDays > 0 ? ((s.present / totalDays) * 100).toFixed(1) : 0;
                                return (
                                    <div key={s.rollNumber} className="bg-white border-2 rounded-lg p-6 shadow-sm hover:shadow-md transition">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-gray-800">{s.name}</h3>
                                                <p className="text-sm text-gray-600">Roll No: {s.rollNumber} • Class: {s.studentClass}{s.classArm ? ` - ${s.classArm}` : ""}</p>
                                            </div>
                                            <div className={`px-6 py-3 rounded-lg text-center ${
                                                percentage >= 75 ? "bg-green-100" : "bg-red-100"
                                            }`}>
                                                <div className={`text-3xl font-bold ${
                                                    percentage >= 75 ? "text-green-700" : "text-red-700"
                                                }`}>
                                                    {percentage}%
                                                </div>
                                                <div className="text-xs text-gray-600 mt-1">Attendance</div>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t">
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-green-600">{s.present}</div>
                                                <div className="text-xs text-gray-500 mt-1">✅ Present</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-red-600">{s.absent}</div>
                                                <div className="text-xs text-gray-500 mt-1">❌ Absent</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-yellow-600">{s.leave}</div>
                                                <div className="text-xs text-gray-500 mt-1">📌 Leave</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-gray-700">{totalDays}</div>
                                                <div className="text-xs text-gray-500 mt-1">📅 Total Days</div>
                                            </div>
                                        </div>

                                        {percentage < 75 && (
                                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                                <p className="text-sm text-red-700 font-semibold">
                                                    ⚠️ Warning: Your attendance is below 75%. Please attend regularly to meet the minimum requirement.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center p-12 bg-gray-50 rounded-lg">
                                <div className="text-6xl mb-4">📊</div>
                                <p className="text-xl font-semibold text-gray-700 mb-2">No attendance data for this month</p>
                                <p className="text-gray-500">Select a different month or check back later</p>
                            </div>
                        )}
                    </div>
                ) : groupByClass ? (
                    // Grouped View
                    <div className="space-y-6">
                        {Object.keys(groupedSummary).sort().map(groupKey => {
                            const stats = getGroupStats(groupKey);
                            return (
                                <div key={groupKey} className="bg-white rounded-lg shadow overflow-hidden border">
                                    <div className="bg-purple-600 text-white px-4 py-3 flex justify-between items-center">
                                        <h3 className="text-lg font-bold">
                                            {groupKey} ({stats.count} students)
                                        </h3>
                                        <div className="flex gap-4 text-sm">
                                            <span>✅ {stats.totalPresent}</span>
                                            <span>❌ {stats.totalAbsent}</span>
                                            <span>📋 {stats.totalLeave}</span>
                                        </div>
                                    </div>
                                    <table className="min-w-full border text-center table-auto border-collapse">
                                        <thead>
                                            <tr className="bg-purple-100">
                                                <th className="p-3 border">Sr.</th>
                                                <th className="p-3 border">Roll No</th>
                                                <th className="p-3 border">Name</th>
                                                <th className="p-3 border">Present (✅)</th>
                                                <th className="p-3 border">Absent (❌)</th>
                                                <th className="p-3 border">On Leave (📌)</th>
                                                <th className="p-3 border">Total Days</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {groupedSummary[groupKey].map((s, index) => (
                                                <tr key={s.rollNumber} className="hover:bg-purple-50 transition even:bg-gray-50">
                                                    <td className="p-2 border">{index + 1}</td>
                                                    <td className="p-2 border font-mono font-semibold">{s.rollNumber}</td>
                                                    <td className="p-2 border text-left font-medium">{s.name}</td>
                                                    <td className="p-2 border text-green-600 font-bold">{s.present}</td>
                                                    <td className="p-2 border text-red-600 font-bold">{s.absent}</td>
                                                    <td className="p-2 border text-yellow-600 font-bold">{s.leave}</td>
                                                    <td className="p-2 border bg-gray-100">{s.total}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                        {Object.keys(groupedSummary).length === 0 && !loading && (
                            <div className="text-center p-10 text-gray-400 italic bg-gray-50 rounded-lg">
                                No data found matching your filters.
                            </div>
                        )}
                    </div>
                ) : (
                    // List View
                    <table className="min-w-full border text-center table-auto border-collapse">
                        <thead>
                            <tr className="bg-purple-600 text-white">
                                <th className="p-3 border">Sr.</th>
                                <th className="p-3 border">Roll No</th>
                                <th className="p-3 border">Name</th>
                                <th className="p-3 border">Class</th>
                                <th className="p-3 border">Section</th>
                                <th className="p-3 border">Present (✅)</th>
                                <th className="p-3 border">Absent (❌)</th>
                                <th className="p-3 border">On Leave (📌)</th>
                                <th className="p-3 border">Total Days</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSummary.map((s, index) => (
                                <tr key={s.rollNumber} className="hover:bg-purple-50 transition even:bg-gray-50">
                                    <td className="p-2 border">{index + 1}</td>
                                    <td className="p-2 border font-mono font-semibold">{s.rollNumber}</td>
                                    <td className="p-2 border text-left font-medium">{s.name}</td>
                                    <td className="p-2 border">{s.studentClass || "—"}</td>
                                    <td className="p-2 border">{s.classArm || "—"}</td>
                                    <td className="p-2 border text-green-600 font-bold">{s.present}</td>
                                    <td className="p-2 border text-red-600 font-bold">{s.absent}</td>
                                    <td className="p-2 border text-yellow-600 font-bold">{s.leave}</td>
                                    <td className="p-2 border bg-gray-100">{s.total}</td>
                                </tr>
                            ))}
                            {filteredSummary.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="9" className="p-10 text-gray-400 italic bg-gray-50">
                                        {summaryData.length === 0 
                                            ? "Generate a summary by selecting a month above."
                                            : "No data found matching your filters."}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default MonthlySummary;
