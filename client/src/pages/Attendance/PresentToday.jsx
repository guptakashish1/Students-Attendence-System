import React, { useEffect, useState } from "react";
import { listenAttendance, listenRegisteredStudents } from "../../firebase";

const PresentToday = ({ userRole }) => {
  const [presentStudents, setPresentStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [groupByClass, setGroupByClass] = useState(true);
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedSection, setSelectedSection] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];

    const unsubscribe = listenAttendance(today, (attendanceList) => {
      // ✅ Only keep students whose status is "IN"
      let present = attendanceList.filter(
        (record) => record.status === "IN"
      );
      
      // Filter for wardens - only show hostlers
      if (userRole === "warden") {
        present = present.filter(s => s.residenceType === "hostler");
      }
      
      setPresentStudents(present);
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [userRole]);

  // Listen to all registered students for dropdown options
  useEffect(() => {
    const unsubscribe = listenRegisteredStudents((studentList) => {
      // Filter for wardens - only show hostlers
      if (userRole === "warden") {
        const hostlerStudents = studentList.filter(s => s.residenceType === "hostler");
        setAllStudents(hostlerStudents);
      } else {
        setAllStudents(studentList);
      }
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [userRole]);

  // Filter students
  const filteredStudents = presentStudents.filter((s) => {
    const matchesSearch = search === "" ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.rollNumber.toLowerCase().includes(search.toLowerCase());
    const matchesClass = selectedClass === "all" || s.studentClass === selectedClass;
    const matchesSection = selectedSection === "all" || s.classArm === selectedSection;
    return matchesSearch && matchesClass && matchesSection;
  });

  // Group students by class and section
  const groupedStudents = filteredStudents.reduce((acc, student) => {
    const className = student.studentClass || "Unassigned";
    const section = student.classArm || "No Section";
    const key = `${className} - ${section}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(student);
    return acc;
  }, {});

  // Get unique classes and sections from all students (not just present ones)
  const uniqueClasses = [...new Set(allStudents.map(s => s.studentClass))].filter(Boolean).sort();
  const uniqueSections = selectedClass === "all" 
    ? [...new Set(allStudents.map(s => s.classArm))].filter(Boolean).sort()
    : [...new Set(allStudents.filter(s => s.studentClass === selectedClass).map(s => s.classArm))].filter(Boolean).sort();

  return (
    <div className="mt-10 px-6">
      <h1 className="text-2xl font-bold text-purple-600 text-center mb-6">
        ✅ Students Present Today ({filteredStudents.length})
      </h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center justify-center mb-6">
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
      </div>

      {filteredStudents.length === 0 ? (
        <p className="text-center text-gray-600">No students are present today.</p>
      ) : groupByClass ? (
        // Grouped View
        <div className="space-y-6">
          {Object.keys(groupedStudents).sort().map(groupKey => (
            <div key={groupKey} className="bg-white rounded-lg shadow overflow-hidden border">
              <div className="bg-purple-600 text-white px-4 py-3">
                <h3 className="text-lg font-bold">
                  {groupKey} ({groupedStudents[groupKey].length} present)
                </h3>
              </div>
              <table className="w-full border-collapse">
                <thead className="bg-purple-100">
                  <tr>
                    <th className="py-2 px-4 text-left border">Sr.</th>
                    <th className="py-2 px-4 text-left border">Roll No</th>
                    <th className="py-2 px-4 text-left border">Name</th>
                    <th className="py-2 px-4 text-left border">Check-In Time</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedStudents[groupKey].map((student, index) => (
                    <tr key={student.rollNumber} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-4 border">{index + 1}</td>
                      <td className="py-2 px-4 border font-semibold">{student.rollNumber}</td>
                      <td className="py-2 px-4 border">{student.name}</td>
                      <td className="py-2 px-4 border">{student.checkInTime || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : (
        // List View
        <table className="w-full border border-gray-300 shadow-md rounded-lg overflow-hidden">
          <thead className="bg-purple-600 text-white">
            <tr>
              <th className="py-2 px-4 text-left">Sr.</th>
              <th className="py-2 px-4 text-left">Roll No</th>
              <th className="py-2 px-4 text-left">Name</th>
              <th className="py-2 px-4 text-left">Class</th>
              <th className="py-2 px-4 text-left">Section</th>
              <th className="py-2 px-4 text-left">Check-In Time</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((student, index) => (
              <tr key={student.rollNumber} className="border-b hover:bg-gray-100">
                <td className="py-2 px-4">{index + 1}</td>
                <td className="py-2 px-4 font-semibold">{student.rollNumber}</td>
                <td className="py-2 px-4">{student.name}</td>
                <td className="py-2 px-4">{student.studentClass}</td>
                <td className="py-2 px-4">{student.classArm || "-"}</td>
                <td className="py-2 px-4">{student.checkInTime || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PresentToday;
