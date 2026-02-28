import React, { useEffect, useState } from "react";
import { listenRegisteredStudents, markAttendance } from "../../firebase";

const TakeAttendance = ({ userRole }) => {
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [marked, setMarked] = useState({});
  const [groupByClass, setGroupByClass] = useState(true);
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedSection, setSelectedSection] = useState("all");

  useEffect(() => {
    const unsubscribe = listenRegisteredStudents((studentList) => {
      // Wardens only see hostler students
      if (userRole === "warden") {
        const hostlerStudents = studentList.filter(s => s.residenceType === "hostler");
        setStudents(hostlerStudents);
      } else {
        setStudents(studentList);
      }
    });
    return () => typeof unsubscribe === "function" && unsubscribe();
  }, [userRole]);

  const handleAttendance = async (student, status) => {
    const today = new Date().toISOString().split("T")[0];
    try {
      await markAttendance(student, today, status);
      setMarked((prev) => ({
        ...prev,
        [student.rollNumber]: status,
      }));
    } catch (error) {
      console.error("Error marking attendance:", error);
    }
  };

  const filteredStudents = students.filter((student) => {
    // Filter by search query
    if (searchQuery) {
      if (/^\d+$/.test(searchQuery)) {
        if (student.rollNumber !== searchQuery) return false;
      } else {
        if (!student.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      }
    }
    
    // Filter by class
    if (selectedClass !== "all" && student.studentClass !== selectedClass) return false;
    
    // Filter by section
    if (selectedSection !== "all" && student.classArm !== selectedSection) return false;
    
    return true;
  });

  // Group students by class and section
  const groupedStudents = filteredStudents.reduce((acc, student) => {
    const className = student.studentClass || "Unassigned";
    const section = student.classArm || "No Section";
    const key = `${className} - ${section}`;
    
    if (!acc[key]) {
      acc[key] = { className, section, students: [] };
    }
    acc[key].students.push(student);
    return acc;
  }, {});

  // Get unique classes and sections
  const uniqueClasses = [...new Set(students.map(s => s.studentClass))].filter(Boolean).sort();
  const uniqueSections = selectedClass === "all" 
    ? [...new Set(students.map(s => s.classArm))].filter(Boolean).sort()
    : [...new Set(students.filter(s => s.studentClass === selectedClass).map(s => s.classArm))].filter(Boolean).sort();

  // Get stats
  const totalStudents = filteredStudents.length;
  const presentCount = Object.values(marked).filter(status => status === "IN").length;
  const absentCount = Object.values(marked).filter(status => status === "ABSENT").length;
  const leaveCount = Object.values(marked).filter(status => status === "LEAVE").length;
  const notMarked = totalStudents - presentCount - absentCount - leaveCount;

  // Get group stats
  const getGroupStats = (groupKey) => {
    const group = groupedStudents[groupKey];
    if (!group) return { total: 0, present: 0, absent: 0, leave: 0, notMarked: 0 };
    
    const present = group.students.filter(s => marked[s.rollNumber] === 'IN').length;
    const absent = group.students.filter(s => marked[s.rollNumber] === 'ABSENT').length;
    const leave = group.students.filter(s => marked[s.rollNumber] === 'LEAVE').length;
    const notMarked = group.students.length - present - absent - leave;
    
    return { total: group.students.length, present, absent, leave, notMarked };
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-purple-600 mb-2">
          📝 Take Attendance ({totalStudents} students)
        </h2>
        <p className="text-gray-500 text-sm">Mark student attendance for today</p>
      </div>

      {/* Stats Cards */}
      {totalStudents > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-600">
            <div className="text-xs text-gray-600 font-semibold mb-1">TOTAL</div>
            <div className="text-2xl font-bold text-gray-800">{totalStudents}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="text-xs text-gray-600 font-semibold mb-1">PRESENT</div>
            <div className="text-2xl font-bold text-green-600">{presentCount}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <div className="text-xs text-gray-600 font-semibold mb-1">ABSENT</div>
            <div className="text-2xl font-bold text-red-600">{absentCount}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div className="text-xs text-gray-600 font-semibold mb-1">ON LEAVE</div>
            <div className="text-2xl font-bold text-yellow-600">{leaveCount}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-400">
            <div className="text-xs text-gray-600 font-semibold mb-1">NOT MARKED</div>
            <div className="text-2xl font-bold text-gray-600">{notMarked}</div>
          </div>
        </div>
      )}

      {/* Filters and Controls */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="🔍 Search by Name or Roll No."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.trim())}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Class Filter */}
          <div className="min-w-[150px]">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Classes</option>
              {uniqueClasses.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          {/* Section Filter */}
          <div className="min-w-[150px]">
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Sections</option>
              {uniqueSections.map(section => (
                <option key={section} value={section}>{section}</option>
              ))}
            </select>
          </div>

          {/* Group Toggle */}
          <button
            onClick={() => setGroupByClass(!groupByClass)}
            className={`px-4 py-2 rounded-lg font-semibold transition ${
              groupByClass 
                ? "bg-purple-600 text-white" 
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {groupByClass ? "📊 Grouped" : "📋 List View"}
          </button>
        </div>
      </div>

      {/* Students Display */}
      {groupByClass ? (
        // Grouped by Class & Section View
        <div className="space-y-6">
          {Object.keys(groupedStudents).sort().map(groupKey => {
            const group = groupedStudents[groupKey];
            const stats = getGroupStats(groupKey);
            
            return (
              <div key={groupKey} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-purple-600 text-white px-4 py-3 flex justify-between items-center">
                  <h3 className="text-lg font-bold">
                    {groupKey} ({stats.total} students)
                  </h3>
                  <div className="flex gap-4 text-sm">
                    <span>✅ {stats.present}</span>
                    <span>❌ {stats.absent}</span>
                    <span>📋 {stats.leave}</span>
                    <span className="opacity-70">⏳ {stats.notMarked}</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-center">
                    <thead>
                      <tr className="bg-purple-100">
                        <th className="p-2 border w-12">Sr.</th>
                        <th className="p-2 border w-24">Roll No</th>
                        <th className="p-2 border w-40">Name</th>
                        <th className="p-2 border w-32">Status</th>
                        <th className="p-2 border w-60">Mark Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.students.map((student, index) => {
                        const status = marked[student.rollNumber];
                        return (
                          <tr key={student.rollNumber} className="hover:bg-gray-50">
                            <td className="p-2 border">{index + 1}</td>
                            <td className="p-2 border font-semibold">{student.rollNumber}</td>
                            <td className="p-2 border text-left">{student.name}</td>
                            <td className="p-2 border">
                              {status ? (
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                  status === 'IN' ? 'bg-green-100 text-green-700' :
                                  status === 'ABSENT' ? 'bg-red-100 text-red-700' :
                                  status === 'LEAVE' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {status === 'IN' ? '✅ Present' :
                                   status === 'ABSENT' ? '❌ Absent' :
                                   status === 'LEAVE' ? '📋 Leave' : '🚪 Checkout'}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">Not marked</span>
                              )}
                            </td>
                            <td className="p-2 border space-x-2">
                              <button
                                onClick={() => handleAttendance(student, "IN")}
                                disabled={status === "IN"}
                                className={`px-3 py-1 rounded text-white text-sm ${
                                  status === "IN"
                                    ? "bg-green-700 cursor-not-allowed opacity-50"
                                    : "bg-green-500 hover:bg-green-600"
                                }`}
                              >
                                ✅
                              </button>
                              <button
                                onClick={() => handleAttendance(student, "ABSENT")}
                                disabled={status === "ABSENT"}
                                className={`px-3 py-1 rounded text-white text-sm ${
                                  status === "ABSENT"
                                    ? "bg-red-700 cursor-not-allowed opacity-50"
                                    : "bg-red-500 hover:bg-red-600"
                                }`}
                              >
                                ❌
                              </button>
                              <button
                                onClick={() => handleAttendance(student, "LEAVE")}
                                disabled={status === "LEAVE"}
                                className={`px-3 py-1 rounded text-white text-sm ${
                                  status === "LEAVE"
                                    ? "bg-yellow-700 cursor-not-allowed opacity-50"
                                    : "bg-yellow-500 hover:bg-yellow-600"
                                }`}
                              >
                                📋
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {Object.keys(groupedStudents).length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              No students found matching your filters
            </div>
          )}
        </div>
      ) : (
        // List View
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full text-center">
            <thead>
              <tr className="bg-purple-200">
                <th className="p-2 border w-12">Sr.</th>
                <th className="p-2 border w-24">Roll No</th>
                <th className="p-2 border w-40">Name</th>
                <th className="p-2 border w-24">Class</th>
                <th className="p-2 border w-24">Section</th>
                <th className="p-2 border w-32">Status</th>
                <th className="p-2 border w-60">Mark Attendance</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-4 text-gray-500 italic">
                    No students found
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, index) => {
                  const status = marked[student.rollNumber];
                  return (
                    <tr key={student.rollNumber} className="hover:bg-gray-50">
                      <td className="p-2 border">{index + 1}</td>
                      <td className="p-2 border font-semibold">{student.rollNumber}</td>
                      <td className="p-2 border text-left">{student.name}</td>
                      <td className="p-2 border">{student.studentClass}</td>
                      <td className="p-2 border">{student.classArm || "—"}</td>
                      <td className="p-2 border">
                        {status ? (
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            status === 'IN' ? 'bg-green-100 text-green-700' :
                            status === 'ABSENT' ? 'bg-red-100 text-red-700' :
                            status === 'LEAVE' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {status === 'IN' ? '✅ Present' :
                             status === 'ABSENT' ? '❌ Absent' :
                             status === 'LEAVE' ? '📋 Leave' : '🚪 Checkout'}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Not marked</span>
                        )}
                      </td>
                      <td className="p-2 border space-x-2">
                        <button
                          onClick={() => handleAttendance(student, "IN")}
                          disabled={status === "IN"}
                          className={`px-3 py-1 rounded text-white text-sm ${
                            status === "IN"
                              ? "bg-green-700 cursor-not-allowed opacity-50"
                              : "bg-green-500 hover:bg-green-600"
                          }`}
                        >
                          ✅
                        </button>
                        <button
                          onClick={() => handleAttendance(student, "ABSENT")}
                          disabled={status === "ABSENT"}
                          className={`px-3 py-1 rounded text-white text-sm ${
                            status === "ABSENT"
                              ? "bg-red-700 cursor-not-allowed opacity-50"
                              : "bg-red-500 hover:bg-red-600"
                          }`}
                        >
                          ❌
                        </button>
                        <button
                          onClick={() => handleAttendance(student, "LEAVE")}
                          disabled={status === "LEAVE"}
                          className={`px-3 py-1 rounded text-white text-sm ${
                            status === "LEAVE"
                              ? "bg-yellow-700 cursor-not-allowed opacity-50"
                              : "bg-yellow-500 hover:bg-yellow-600"
                          }`}
                        >
                          📋
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TakeAttendance;
