import React, { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, getUserRole, listenRegisteredStudents, listenCollection } from "../../firebase";

const MyHierarchy = () => {
  const [userEmail, setUserEmail] = useState("");
  const [myStudent, setMyStudent] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userEmail) return;

    const unsubStudents = listenRegisteredStudents((students) => {
      const student = students.find(s => 
        s.studentEmail?.toLowerCase() === userEmail.toLowerCase() || 
        s.parentEmail?.toLowerCase() === userEmail.toLowerCase()
      );
      setMyStudent(student);
    });

    const unsubTeachers = listenCollection("faculty", (facultyList) => {
      setTeachers(facultyList);
    });

    const unsubTimetable = listenCollection("timetable", (timetableList) => {
      setTimetable(timetableList);
      setLoading(false);
    });

    return () => {
      unsubStudents();
      unsubTeachers();
      unsubTimetable();
    };
  }, [userEmail]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-xl text-purple-600">Loading...</div>
      </div>
    );
  }

  if (!myStudent) {
    return (
      <div className="p-6 bg-white shadow rounded-lg max-w-4xl mx-auto mt-10">
        <h2 className="text-2xl font-bold text-red-600 mb-4">⚠️ Student Profile Not Found</h2>
        <p className="text-gray-600">
          Your email ({userEmail}) is not linked to any student profile. 
          Please contact the administrator to register your student details.
        </p>
      </div>
    );
  }

  // Filter timetable entries for this student's class and section
  const myTimetableEntries = timetable.filter(entry => 
    entry.className === myStudent.studentClass && 
    (!entry.section || entry.section === myStudent.classArm)
  );

  // Get unique subjects and their teachers from timetable
  const subjectTeacherMap = {};
  myTimetableEntries.forEach(entry => {
    if (entry.subject && entry.teacher) {
      if (!subjectTeacherMap[entry.subject]) {
        subjectTeacherMap[entry.subject] = new Set();
      }
      subjectTeacherMap[entry.subject].add(entry.teacher);
    }
  });

  // Get class teacher (you can add a field in student or faculty collection for this)
  const classTeacher = teachers.find(t => 
    t.assignedClass === myStudent.studentClass && 
    (!t.assignedSection || t.assignedSection === myStudent.classArm)
  );

  // Get all teachers teaching this student
  const myTeachers = teachers.filter(t => {
    // Check if teacher teaches any subject to this class
    return myTimetableEntries.some(entry => entry.teacher === t.name);
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-purple-600 mb-6">🗂️ My Hierarchy</h1>

      {/* Student Info Card */}
      <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-4xl">
            🎓
          </div>
          <div>
            <h2 className="text-2xl font-bold">{myStudent.name}</h2>
            <p className="text-purple-100">Roll No: {myStudent.rollNumber}</p>
            <p className="text-purple-100">
              Class: {myStudent.studentClass}
              {myStudent.classArm && ` - Section ${myStudent.classArm}`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Class Teacher */}
        {classTeacher && (
          <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-green-500">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">👨‍🏫</span>
              Class Teacher
            </h3>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-lg font-semibold text-gray-800">{classTeacher.name}</p>
              <p className="text-sm text-gray-600 mt-1">📧 {classTeacher.email || "N/A"}</p>
              <p className="text-sm text-gray-600">📞 {classTeacher.contact || "N/A"}</p>
              {classTeacher.subject && (
                <p className="text-sm text-gray-600 mt-2">
                  <span className="font-medium">Main Subject:</span> {classTeacher.subject}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Student Details */}
        <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-2xl">📋</span>
            My Details
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Father's Name:</span>
              <span className="font-semibold">{myStudent.fatherName || "N/A"}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Mother's Name:</span>
              <span className="font-semibold">{myStudent.motherName || "N/A"}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Contact:</span>
              <span className="font-semibold">{myStudent.contact || "N/A"}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-600">Residence Type:</span>
              <span className="font-semibold">
                {myStudent.residenceType === "hostler" ? "🏨 Hostler" : "🏠 Day Scholar"}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Email:</span>
              <span className="font-semibold text-sm">{myStudent.parentEmail || "N/A"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Subject Teachers */}
      <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="text-2xl">📚</span>
          My Subject Teachers
        </h3>
        
        {Object.keys(subjectTeacherMap).length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(subjectTeacherMap).map(([subject, teacherSet]) => (
              <div key={subject} className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">📖</span>
                  <div className="flex-1">
                    <h4 className="font-bold text-purple-700 mb-1">{subject}</h4>
                    {Array.from(teacherSet).map((teacherName, idx) => {
                      const teacher = teachers.find(t => t.name === teacherName);
                      return (
                        <div key={idx} className="text-sm text-gray-700 mt-2">
                          <p className="font-semibold">{teacherName}</p>
                          {teacher && (
                            <>
                              {teacher.email && <p className="text-xs text-gray-600">📧 {teacher.email}</p>}
                              {teacher.contact && <p className="text-xs text-gray-600">📞 {teacher.contact}</p>}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p className="text-lg">📅 No timetable entries found for your class.</p>
            <p className="text-sm mt-2">Please contact your administrator to set up the class timetable.</p>
          </div>
        )}
      </div>

      {/* All Teachers Teaching This Class */}
      {myTeachers.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="text-2xl">👥</span>
            All My Teachers ({myTeachers.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-purple-100">
                  <th className="border p-3 text-left">Sr.</th>
                  <th className="border p-3 text-left">Name</th>
                  <th className="border p-3 text-left">Subject(s)</th>
                  <th className="border p-3 text-left">Email</th>
                  <th className="border p-3 text-left">Contact</th>
                </tr>
              </thead>
              <tbody>
                {myTeachers.map((teacher, index) => {
                  // Find subjects taught by this teacher
                  const teacherSubjects = Object.entries(subjectTeacherMap)
                    .filter(([_, teacherSet]) => teacherSet.has(teacher.name))
                    .map(([subject]) => subject);
                  
                  return (
                    <tr key={teacher.id || index} className="hover:bg-purple-50">
                      <td className="border p-3">{index + 1}</td>
                      <td className="border p-3 font-semibold">{teacher.name}</td>
                      <td className="border p-3">
                        {teacherSubjects.length > 0 ? teacherSubjects.join(", ") : "N/A"}
                      </td>
                      <td className="border p-3 text-sm">{teacher.email || "N/A"}</td>
                      <td className="border p-3">{teacher.contact || "N/A"}</td>
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

export default MyHierarchy;
