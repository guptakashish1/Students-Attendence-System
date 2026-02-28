import React, { useEffect, useState } from "react";
import { listenRegisteredStudents } from "../../firebase";
import { getDatabase, ref, push, set, get } from "firebase/database";

const HostlerAttendance = ({ userRole }) => {
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [marked, setMarked] = useState({});
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedSection, setSelectedSection] = useState("all");
  const [loading, setLoading] = useState(false);
  const [isAllowedTime, setIsAllowedTime] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const currentTime = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });

  // Check if current time is between 9 PM (21:00) and 11 PM (23:00)
  useEffect(() => {
    const checkTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const currentMinutes = hours * 60 + minutes;
      const startTime = 21 * 60; // 9 PM = 21:00
      const endTime = 23 * 60; // 11 PM = 23:00
      
      setIsAllowedTime(currentMinutes >= startTime && currentMinutes <= endTime);
    };

    checkTime();
    // Check every minute
    const interval = setInterval(checkTime, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = listenRegisteredStudents((studentList) => {
      // Filter only hostler students (already filtered for all users including wardens)
      const hostlers = studentList.filter(s => s.residenceType === "hostler");
      setStudents(hostlers);
    });
    return () => typeof unsubscribe === "function" && unsubscribe();
  }, [userRole]);

  // Load existing attendance
  useEffect(() => {
    loadExistingAttendance();
  }, []); // eslint-disable-line

  const loadExistingAttendance = async () => {
    try {
      const db = getDatabase();
      const attendanceRef = ref(db, `hostlerAttendance/${today}/night`);
      const snapshot = await get(attendanceRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const existingMarked = {};
        
        Object.values(data).forEach(record => {
          existingMarked[record.rollNumber] = record.status;
        });
        
        setMarked(existingMarked);
      } else {
        setMarked({});
      }
    } catch (error) {
      console.error("Error loading attendance:", error);
    }
  };

  const handleAttendance = async (student, status) => {
    if (!isAllowedTime) {
      alert("⏰ Hostler attendance can only be marked between 9:00 PM and 11:00 PM!");
      return;
    }

    setLoading(true);
    try {
      const db = getDatabase();
      const attendanceRef = ref(db, `hostlerAttendance/${today}/night`);
      const newAttendanceRef = push(attendanceRef);

      const attendanceData = {
        id: newAttendanceRef.key,
        rollNumber: student.rollNumber,
        name: student.name,
        className: student.studentClass,
        section: student.classArm || "",
        attendanceType: "night",
        status: status,
        date: today,
        time: currentTime,
        markedAt: new Date().toISOString(),
      };

      await set(newAttendanceRef, attendanceData);
      
      setMarked((prev) => ({
        ...prev,
        [student.rollNumber]: status,
      }));
    } catch (error) {
      console.error("Error marking attendance:", error);
      alert("Error marking attendance: " + error.message);
    } finally {
      setLoading(false);
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

  // Get unique classes and sections
  const uniqueClasses = [...new Set(students.map(s => s.studentClass))].filter(Boolean).sort();
  const uniqueSections = selectedClass === "all" 
    ? [...new Set(students.map(s => s.classArm))].filter(Boolean).sort()
    : [...new Set(students.filter(s => s.studentClass === selectedClass).map(s => s.classArm))].filter(Boolean).sort();

  // Get stats
  const totalStudents = filteredStudents.length;
  const presentCount = Object.values(marked).filter(status => status === "present").length;
  const absentCount = Object.values(marked).filter(status => status === "absent").length;
  const notMarked = totalStudents - presentCount - absentCount;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-purple-600 mb-2">
          🏨 Hostler Night Roll Call ({students.length} hostlers)
        </h2>
        <p className="text-gray-500 text-sm">Mark attendance for hostel residents - Available only between 9:00 PM - 11:00 PM</p>
      </div>

      {/* Time Status Banner */}
      <div className={`mb-6 p-4 rounded-lg border-2 ${
        isAllowedTime 
          ? "bg-green-50 border-green-500" 
          : "bg-red-50 border-red-500"
      }`}>
        <div className="flex items-center gap-3">
          <div className="text-3xl">{isAllowedTime ? "✅" : "🔒"}</div>
          <div>
            <h3 className={`text-lg font-bold ${isAllowedTime ? "text-green-700" : "text-red-700"}`}>
              {isAllowedTime ? "Attendance Window Open" : "Attendance Window Closed"}
            </h3>
            <p className={`text-sm ${isAllowedTime ? "text-green-600" : "text-red-600"}`}>
              {isAllowedTime 
                ? "You can mark attendance now. Window closes at 11:00 PM." 
                : "Hostler attendance can only be marked between 9:00 PM and 11:00 PM."}
            </p>
            <p className="text-xs text-gray-600 mt-1">Current time: {new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
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
        </div>
      </div>

      {/* Stats Cards */}
      {totalStudents > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-600">
            <div className="text-xs text-gray-600 font-semibold mb-1">TOTAL HOSTLERS</div>
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
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-400">
            <div className="text-xs text-gray-600 font-semibold mb-1">NOT MARKED</div>
            <div className="text-2xl font-bold text-gray-600">{notMarked}</div>
          </div>
        </div>
      )}

      {/* Students Table */}
      {students.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          <div className="text-6xl mb-4">🏨</div>
          <p className="text-lg font-semibold">No hostler students found</p>
          <p className="text-sm mt-2">Register students with "Hostler" residence type to see them here</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          <div className="text-6xl mb-4">🔍</div>
          <p className="text-lg font-semibold">No students found</p>
          <p className="text-sm mt-2">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-indigo-600 text-white px-4 py-3 flex justify-between items-center">
            <h3 className="text-lg font-bold">
              🌙 Night Roll Call - {today}
            </h3>
            <div className="text-sm opacity-90">9:00 PM - 11:00 PM</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-center">
              <thead>
                <tr className="bg-purple-100">
                  <th className="p-2 border w-12">Sr.</th>
                  <th className="p-2 border w-24">Roll No</th>
                  <th className="p-2 border w-40">Name</th>
                  <th className="p-2 border w-24">Class</th>
                  <th className="p-2 border w-24">Section</th>
                  <th className="p-2 border w-32">Status</th>
                  <th className="p-2 border w-40">Mark Attendance</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student, index) => {
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
                            status === 'present' ? 'bg-green-100 text-green-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {status === 'present' ? '✅ Present' : '❌ Absent'}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Not marked</span>
                        )}
                      </td>
                      <td className="p-2 border space-x-2">
                        <button
                          onClick={() => handleAttendance(student, "present")}
                          disabled={status === "present" || loading || !isAllowedTime}
                          className={`px-4 py-1 rounded text-white text-sm ${
                            status === "present" || !isAllowedTime
                              ? "bg-gray-400 cursor-not-allowed opacity-50"
                              : "bg-green-500 hover:bg-green-600"
                          }`}
                          title={!isAllowedTime ? "Only available between 9 PM - 11 PM" : ""}
                        >
                          ✅ Present
                        </button>
                        <button
                          onClick={() => handleAttendance(student, "absent")}
                          disabled={status === "absent" || loading || !isAllowedTime}
                          className={`px-4 py-1 rounded text-white text-sm ${
                            status === "absent" || !isAllowedTime
                              ? "bg-gray-400 cursor-not-allowed opacity-50"
                              : "bg-red-500 hover:bg-red-600"
                          }`}
                          title={!isAllowedTime ? "Only available between 9 PM - 11 PM" : ""}
                        >
                          ❌ Absent
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default HostlerAttendance;
