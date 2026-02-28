import React, { useEffect, useState } from "react";
import { listenRegisteredStudents, listenCollection } from "../../firebase";
import { getDatabase, ref, push, set, get } from "firebase/database";

const SubjectAttendance = ({ userRole }) => {
  const [students, setStudents] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [marked, setMarked] = useState({});
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const currentTime = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    const unsubStudents = listenRegisteredStudents((studentList) => {
      // Filter for wardens - only show hostlers
      if (userRole === "warden") {
        const hostlerStudents = studentList.filter(s => s.residenceType === "hostler");
        setStudents(hostlerStudents);
      } else {
        setStudents(studentList);
      }
    });

    const unsubTimetable = listenCollection("timetable", (timetableList) => {
      setTimetable(timetableList);
      // Extract unique subjects
      const uniqueSubjects = [...new Set(timetableList.map(t => t.subject))].filter(Boolean);
      setSubjects(uniqueSubjects);
    });

    return () => {
      unsubStudents();
      unsubTimetable();
    };
  }, [userRole]);

  // Load existing attendance for selected subject
  useEffect(() => {
    if (selectedClass && selectedSubject) {
      loadExistingAttendance();
    }
  }, [selectedClass, selectedSection, selectedSubject, selectedPeriod]); // eslint-disable-line

  const loadExistingAttendance = async () => {
    try {
      const db = getDatabase();
      const attendanceRef = ref(db, `subjectAttendance/${today}`);
      const snapshot = await get(attendanceRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const existingMarked = {};
        
        Object.values(data).forEach(record => {
          if (
            record.className === selectedClass &&
            record.subject === selectedSubject &&
            (!selectedSection || record.section === selectedSection) &&
            (!selectedPeriod || record.period === selectedPeriod)
          ) {
            existingMarked[record.rollNumber] = record.status;
          }
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
    if (!selectedSubject) {
      alert("Please select a subject first!");
      return;
    }

    setLoading(true);
    try {
      const db = getDatabase();
      const attendanceRef = ref(db, `subjectAttendance/${today}`);
      const newAttendanceRef = push(attendanceRef);

      const attendanceData = {
        id: newAttendanceRef.key,
        rollNumber: student.rollNumber,
        name: student.name,
        className: student.studentClass,
        section: student.classArm || "",
        subject: selectedSubject,
        period: selectedPeriod || "N/A",
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

  // Get unique classes and sections
  const uniqueClasses = [...new Set(students.map(s => s.studentClass))].filter(Boolean).sort();
  const uniqueSections = selectedClass 
    ? [...new Set(students.filter(s => s.studentClass === selectedClass).map(s => s.classArm))].filter(Boolean).sort()
    : [];

  // Get periods for selected class and subject
  const periods = timetable
    .filter(t => 
      t.className === selectedClass && 
      t.subject === selectedSubject &&
      (!selectedSection || t.section === selectedSection)
    )
    .map(t => t.period || t.time)
    .filter(Boolean);

  // Filter students
  const filteredStudents = students.filter((student) => {
    if (!selectedClass) return false;
    if (student.studentClass !== selectedClass) return false;
    if (selectedSection && student.classArm !== selectedSection) return false;
    
    if (searchQuery) {
      if (/^\d+$/.test(searchQuery)) {
        if (student.rollNumber !== searchQuery) return false;
      } else {
        if (!student.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      }
    }
    
    return true;
  });

  // Get stats
  const totalStudents = filteredStudents.length;
  const presentCount = Object.values(marked).filter(status => status === "present").length;
  const absentCount = Object.values(marked).filter(status => status === "absent").length;
  const notMarked = totalStudents - presentCount - absentCount;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-purple-600 mb-2">
          📚 Subject-wise Attendance
        </h2>
        <p className="text-gray-500 text-sm">Mark attendance for specific subjects and periods</p>
      </div>

      {/* Selection Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Class Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Class *</label>
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedSection("");
                setSelectedSubject("");
                setSelectedPeriod("");
                setMarked({});
              }}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Select Class</option>
              {uniqueClasses.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          {/* Section Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Section</label>
            <select
              value={selectedSection}
              onChange={(e) => {
                setSelectedSection(e.target.value);
                setMarked({});
              }}
              disabled={!selectedClass}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
            >
              <option value="">All Sections</option>
              {uniqueSections.map(section => (
                <option key={section} value={section}>{section}</option>
              ))}
            </select>
          </div>

          {/* Subject Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Subject *</label>
            <select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setSelectedPeriod("");
                setMarked({});
              }}
              disabled={!selectedClass}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
            >
              <option value="">Select Subject</option>
              {subjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>

          {/* Period Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Period</label>
            <select
              value={selectedPeriod}
              onChange={(e) => {
                setSelectedPeriod(e.target.value);
                setMarked({});
              }}
              disabled={!selectedSubject}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
            >
              <option value="">Select Period</option>
              {periods.map((period, idx) => (
                <option key={idx} value={period}>{period}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Name or Roll No."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value.trim())}
              className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {selectedClass && selectedSubject && totalStudents > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-400">
            <div className="text-xs text-gray-600 font-semibold mb-1">NOT MARKED</div>
            <div className="text-2xl font-bold text-gray-600">{notMarked}</div>
          </div>
        </div>
      )}

      {/* Students Table */}
      {!selectedClass || !selectedSubject ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          <div className="text-6xl mb-4">📚</div>
          <p className="text-lg font-semibold">Please select Class and Subject to start</p>
          <p className="text-sm mt-2">Choose a class and subject from the filters above</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          <div className="text-6xl mb-4">👥</div>
          <p className="text-lg font-semibold">No students found</p>
          <p className="text-sm mt-2">No students registered in the selected class</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-purple-600 text-white px-4 py-3">
            <h3 className="text-lg font-bold">
              {selectedClass} {selectedSection && `- ${selectedSection}`} • {selectedSubject}
              {selectedPeriod && ` • Period: ${selectedPeriod}`}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-center">
              <thead>
                <tr className="bg-purple-100">
                  <th className="p-2 border w-12">Sr.</th>
                  <th className="p-2 border w-24">Roll No</th>
                  <th className="p-2 border w-40">Name</th>
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
                          disabled={status === "present" || loading}
                          className={`px-4 py-1 rounded text-white text-sm ${
                            status === "present"
                              ? "bg-green-700 cursor-not-allowed opacity-50"
                              : "bg-green-500 hover:bg-green-600"
                          }`}
                        >
                          ✅ Present
                        </button>
                        <button
                          onClick={() => handleAttendance(student, "absent")}
                          disabled={status === "absent" || loading}
                          className={`px-4 py-1 rounded text-white text-sm ${
                            status === "absent"
                              ? "bg-red-700 cursor-not-allowed opacity-50"
                              : "bg-red-500 hover:bg-red-600"
                          }`}
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

export default SubjectAttendance;
