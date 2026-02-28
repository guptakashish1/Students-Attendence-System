import React, { useEffect, useState } from "react";
import { listenAttendance } from "../../firebase";

const AttendanceTable = ({ userEmail, userRole }) => {
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [groupByClass, setGroupByClass] = useState(true);
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedSection, setSelectedSection] = useState("all");

  useEffect(() => {
    const unsubscribe = listenAttendance(date, (data) => {
      // Filter data for students - only show their own records
      if (userRole === "student" && userEmail) {
        const studentRecords = data.filter(record => 
          record.studentEmail?.toLowerCase() === userEmail.toLowerCase() || 
          record.parentEmail?.toLowerCase() === userEmail.toLowerCase()
        );
        setRecords(studentRecords);
      } else if (userRole === "warden") {
        // Wardens only see hostler students
        const hostlerRecords = data.filter(record => record.residenceType === "hostler");
        setRecords(hostlerRecords);
      } else {
        setRecords(data);
      }
    });
    return () => unsubscribe && unsubscribe();
  }, [date, userEmail, userRole]);

  const filteredRecords = records.filter((s) => {
    const matchesSearch = search === "" ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.rollNumber.toLowerCase().includes(search.toLowerCase());
    const matchesClass = selectedClass === "all" || s.studentClass === selectedClass;
    const matchesSection = selectedSection === "all" || s.classArm === selectedSection;
    return matchesSearch && matchesClass && matchesSection;
  });

  // Group records by class and section
  const groupedRecords = filteredRecords.reduce((acc, record) => {
    const className = record.studentClass || "Unassigned";
    const section = record.classArm || "No Section";
    const key = `${className} - ${section}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(record);
    return acc;
  }, {});

  // Get unique classes and sections
  const uniqueClasses = [...new Set(records.map(s => s.studentClass))].filter(Boolean).sort();
  const uniqueSections = selectedClass === "all" 
    ? [...new Set(records.map(s => s.classArm))].filter(Boolean).sort()
    : [...new Set(records.filter(s => s.studentClass === selectedClass).map(s => s.classArm))].filter(Boolean).sort();

  // Get stats for each group
  const getGroupStats = (groupKey) => {
    const group = groupedRecords[groupKey] || [];
    const present = group.filter(s => s.status === 'IN').length;
    const absent = group.filter(s => s.status === 'ABSENT').length;
    const leave = group.filter(s => s.status === 'LEAVE').length;
    return { total: group.length, present, absent, leave };
  };

  return (
    <div className="max-w-6xl mx-auto bg-white shadow-lg p-6 rounded-xl mt-10">
      <h2 className="text-2xl font-bold mb-4 text-purple-700 text-center">
        📋 {userRole === "student" ? "My Attendance Records" : "Attendance Records"} - {date}
      </h2>

      <div className="flex flex-col md:flex-row justify-center items-center gap-4 mb-6">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border p-2 rounded"
        />
        {userRole !== "student" && (
          <>
            <input
              type="text"
              placeholder="🔍 Search by name or roll number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border p-2 rounded w-72"
            />
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedSection("all");
              }}
              className="border p-2 rounded"
            >
              <option value="all">All Classes</option>
              {uniqueClasses.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="border p-2 rounded"
            >
              <option value="all">All Sections</option>
              {uniqueSections.map(section => (
                <option key={section} value={section}>{section}</option>
              ))}
            </select>
            <button
              onClick={() => setGroupByClass(!groupByClass)}
              className={`px-4 py-2 rounded font-semibold transition ${
                groupByClass 
                  ? "bg-purple-600 text-white" 
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {groupByClass ? "📊 Grouped" : "📋 List"}
            </button>
          </>
        )}
      </div>

      {userRole === "student" ? (
        // Student View - Simple attendance display
        <div className="space-y-4">
          {filteredRecords.length > 0 ? (
            filteredRecords.map((record) => (
              <div key={record.rollNumber} className="bg-white border-2 rounded-lg p-4 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800">{record.name}</h3>
                    <p className="text-sm text-gray-600">Roll No: {record.rollNumber} • Class: {record.studentClass}{record.classArm ? ` - ${record.classArm}` : ""}</p>
                  </div>
                  <div className={`px-6 py-3 rounded-lg font-bold text-lg ${
                    record.status === "IN" 
                      ? "bg-green-100 text-green-700" 
                      : record.status === "ABSENT" 
                        ? "bg-red-100 text-red-700" 
                        : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {record.status === "IN"
                      ? "✅ Present"
                      : record.status === "ABSENT"
                        ? "❌ Absent"
                        : "📌 On Leave"}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Check-In:</span>
                    <span className="ml-2 font-semibold text-gray-800">{record.checkInTime || "—"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Check-Out:</span>
                    <span className="ml-2 font-semibold text-gray-800">{record.checkOutTime || "—"}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center p-12 bg-gray-50 rounded-lg">
              <div className="text-6xl mb-4">📅</div>
              <p className="text-xl font-semibold text-gray-700 mb-2">No attendance record for this date</p>
              <p className="text-gray-500">Select a different date to view your attendance</p>
            </div>
          )}
        </div>
      ) : groupByClass ? (
        // Grouped View
        <div className="space-y-6">
          {Object.keys(groupedRecords).sort().map(groupKey => {
            const stats = getGroupStats(groupKey);
            return (
              <div key={groupKey} className="bg-white rounded-lg shadow overflow-hidden border">
                <div className="bg-purple-600 text-white px-4 py-3 flex justify-between items-center">
                  <h3 className="text-lg font-bold">
                    {groupKey} ({stats.total} records)
                  </h3>
                  <div className="flex gap-4 text-sm">
                    <span>✅ {stats.present}</span>
                    <span>❌ {stats.absent}</span>
                    <span>📋 {stats.leave}</span>
                  </div>
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-purple-100 text-sm">
                      <th className="border p-2">Sr.</th>
                      <th className="border p-2">Roll No</th>
                      <th className="border p-2">Name</th>
                      <th className="border p-2">Check-In</th>
                      <th className="border p-2">Check-Out</th>
                      <th className="border p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedRecords[groupKey].map((s, index) => (
                      <tr key={s.rollNumber} className="text-center text-sm hover:bg-gray-50">
                        <td className="border p-2">{index + 1}</td>
                        <td className="border p-2 font-semibold">{s.rollNumber}</td>
                        <td className="border p-2 text-left">{s.name}</td>
                        <td className="border p-2">{s.checkInTime || "-"}</td>
                        <td className="border p-2">{s.checkOutTime || "-"}</td>
                        <td className="border p-2 font-medium">
                          {s.status === "IN"
                            ? "✅ Entered"
                            : s.status === "ABSENT"
                              ? "❌ Absent"
                              : s.status === "LEAVE"
                                ? "📌 On Leave"
                                : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          {Object.keys(groupedRecords).length === 0 && (
            <div className="text-center p-8 text-gray-500">
              No records found
            </div>
          )}
        </div>
      ) : (
        // List View
        <table className="w-full border-collapse border">
          <thead>
            <tr className="bg-purple-600 text-white text-sm">
              <th className="border p-2">Sr.</th>
              <th className="border p-2">Roll No</th>
              <th className="border p-2">Name</th>
              <th className="border p-2">Class</th>
              <th className="border p-2">Section</th>
              <th className="border p-2">Check-In</th>
              <th className="border p-2">Check-Out</th>
              <th className="border p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length > 0 ? (
              filteredRecords.map((s, index) => (
                <tr key={s.rollNumber} className="text-center text-sm hover:bg-gray-50">
                  <td className="border p-2">{index + 1}</td>
                  <td className="border p-2 font-semibold">{s.rollNumber}</td>
                  <td className="border p-2 text-left">{s.name}</td>
                  <td className="border p-2">{s.studentClass}</td>
                  <td className="border p-2">{s.classArm || "-"}</td>
                  <td className="border p-2">{s.checkInTime || "-"}</td>
                  <td className="border p-2">{s.checkOutTime || "-"}</td>
                  <td className="border p-2 font-medium">
                    {s.status === "IN"
                      ? "✅ Entered"
                      : s.status === "ABSENT"
                        ? "❌ Absent"
                        : s.status === "LEAVE"
                          ? "📌 On Leave"
                          : "-"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center p-4 text-gray-500">
                  No records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default AttendanceTable;
