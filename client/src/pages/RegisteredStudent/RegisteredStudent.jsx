import React, { useState, useEffect } from "react";
import { listenRegisteredStudents, deleteStudent, updateStudent } from "../../firebase";

const CLASS_OPTIONS = [
  "PlayGroup", "Nursery", "KG",
  "Class I", "Class II", "Class III", "Class IV", "Class V",
  "Class VI", "Class VII", "Class VIII",
  "Class IX", "Class X", "Class XI", "Class XII",
];

const RegisteredStudent = ({ userEmail, userRole }) => {
  const [students, setStudents] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [groupByClass, setGroupByClass] = useState(true);
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedSection, setSelectedSection] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const unsub = listenRegisteredStudents((allStudents) => {
      // Filter students for student role - only show their own record
      if (userRole === "student" && userEmail) {
        const myStudents = allStudents.filter(s => 
          s.studentEmail?.toLowerCase() === userEmail.toLowerCase() || 
          s.parentEmail?.toLowerCase() === userEmail.toLowerCase()
        );
        setStudents(myStudents);
      } else if (userRole === "warden") {
        // Wardens only see hostler students
        const hostlerStudents = allStudents.filter(s => s.residenceType === "hostler");
        setStudents(hostlerStudents);
      } else {
        setStudents(allStudents);
      }
    });
    return () => unsub();
  }, [userEmail, userRole]);

  const handleDelete = async (rollNumber, studentName) => {
    if (!rollNumber) {
      alert("❌ Error: Roll number is missing!");
      console.error("Delete attempted with no roll number for student:", studentName);
      return;
    }
    
    console.log("🔍 Delete request for:", { rollNumber, studentName, type: typeof rollNumber });
    
    if (window.confirm(`Are you sure you want to delete ${studentName}?\n\nRoll Number: ${rollNumber}\n\nThis action cannot be undone.`)) {
      try {
        console.log("✅ User confirmed deletion");
        console.log("📞 Calling deleteStudent with:", rollNumber);
        await deleteStudent(rollNumber);
        console.log("✅ deleteStudent completed successfully");
        alert("✅ Student deleted successfully!");
      } catch (error) {
        console.error("❌ Delete error:", error);
        alert("❌ Error deleting student: " + error.message);
      }
    } else {
      console.log("❌ User cancelled deletion");
    }
  };

  const handleEdit = (student) => {
    setEditForm({ ...student });
    setIsEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await updateStudent(editForm.rollNumber, editForm);
      setIsEditing(false);
      setEditForm(null);
      alert("✅ Student updated successfully!");
    } catch (error) {
      alert("❌ Error updating student: " + error.message);
    }
  };

  const handleChange = (e) => {
    setEditForm({
      ...editForm,
      [e.target.name]: e.target.value,
    });
  };

  // Group students by class and section
  const groupedStudents = students.reduce((acc, student) => {
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
  const uniqueClasses = [...new Set(students.map(s => s.studentClass))].filter(Boolean).sort();
  const uniqueSections = selectedClass === "all" 
    ? [...new Set(students.map(s => s.classArm))].filter(Boolean).sort()
    : [...new Set(students.filter(s => s.studentClass === selectedClass).map(s => s.classArm))].filter(Boolean).sort();

  // Filter students
  const filteredStudents = students.filter(student => {
    const matchesClass = selectedClass === "all" || student.studentClass === selectedClass;
    const matchesSection = selectedSection === "all" || student.classArm === selectedSection;
    const matchesSearch = searchTerm === "" || 
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.fatherName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesClass && matchesSection && matchesSearch;
  });

  // Group filtered students by class and section
  const filteredGrouped = filteredStudents.reduce((acc, student) => {
    const className = student.studentClass || "Unassigned";
    const section = student.classArm || "No Section";
    const key = `${className} - ${section}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(student);
    return acc;
  }, {});

  return (
    <div className="p-6 overflow-x-auto relative">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-purple-600 mb-2">
          {userRole === "student" ? "📚 My Profile" : `📚 Registered Students (${students.length})`}
        </h2>
        <p className="text-gray-500 text-sm">
          {userRole === "student" ? "View your student details" : "View and manage all registered students"}
        </p>
      </div>

      {/* Filters and Controls - Only show for admin/teacher/staff */}
      {userRole !== "student" && (
        <div className="bg-white rounded-lg shadow p-4 mb-4 space-y-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="🔍 Search by name, roll number, or father's name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Class Filter */}
            <div className="min-w-[150px]">
              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setSelectedSection("all"); // Reset section when class changes
                }}
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Classes</option>
                {uniqueClasses.map(className => (
                  <option key={className} value={className}>
                    {className}
                  </option>
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
                  <option key={section} value={section}>
                    {section}
                  </option>
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

          {/* Stats */}
          <div className="flex flex-wrap gap-3">
            <div className="bg-blue-50 px-3 py-1 rounded-full text-sm font-semibold text-blue-700">
              Total: {students.length}
            </div>
            <div className="bg-green-50 px-3 py-1 rounded-full text-sm font-semibold text-green-700">
              Groups: {Object.keys(groupedStudents).length}
            </div>
            <div className="bg-purple-50 px-3 py-1 rounded-full text-sm font-semibold text-purple-700">
              Showing: {filteredStudents.length}
            </div>
          </div>
        </div>
      )}

      {/* Students Display */}
      {userRole === "student" ? (
        // Student Profile Card View
        filteredStudents.length > 0 ? (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden max-w-2xl mx-auto">
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-4">
              <h3 className="text-xl font-bold">My Profile</h3>
            </div>
            <div className="p-6">
              {filteredStudents.map((student) => (
                <div key={student.rollNumber} className="space-y-4">
                  <div className="flex items-center gap-4 pb-4 border-b">
                    <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center text-4xl">
                      👤
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold text-gray-800">{student.name}</h4>
                      <p className="text-gray-600">Roll No: {student.rollNumber}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-xs text-gray-600 font-semibold mb-1">CLASS</p>
                      <p className="text-lg font-bold text-gray-800">
                        {student.studentClass}
                        {student.classArm && ` - ${student.classArm}`}
                      </p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-xs text-gray-600 font-semibold mb-1">RESIDENCE TYPE</p>
                      <p className="text-lg font-bold text-gray-800">
                        {student.residenceType === "hostler" ? "🏨 Hostler" : "🏠 Day Scholar"}
                      </p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-xs text-gray-600 font-semibold mb-1">STUDENT CONTACT</p>
                      <p className="text-lg font-bold text-gray-800">{student.contact || "—"}</p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-xs text-gray-600 font-semibold mb-1">STUDENT EMAIL</p>
                      <p className="text-sm font-semibold text-gray-800 break-all">{student.studentEmail || "—"}</p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-xs text-gray-600 font-semibold mb-1">FATHER'S NAME</p>
                      <p className="text-lg font-bold text-gray-800">{student.fatherName || "—"}</p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-xs text-gray-600 font-semibold mb-1">MOTHER'S NAME</p>
                      <p className="text-lg font-bold text-gray-800">{student.motherName || "—"}</p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-xs text-gray-600 font-semibold mb-1">PARENT EMAIL</p>
                      <p className="text-sm font-semibold text-gray-800 break-all">{student.parentEmail || "—"}</p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-xs text-gray-600 font-semibold mb-1">PARENT CONTACT</p>
                      <p className="text-lg font-bold text-gray-800">{student.parentContact || "—"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            No profile found
          </div>
        )
      ) : groupByClass ? (
        // Grouped by Class & Section View
        <div className="space-y-6">
          {Object.keys(filteredGrouped).sort().map(groupKey => (
            <div key={groupKey} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-purple-600 text-white px-4 py-3 flex justify-between items-center">
                <h3 className="text-lg font-bold">
                  {groupKey} ({filteredGrouped[groupKey].length} students)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-center">
                  <thead>
                    <tr className="bg-purple-100">
                      <th className="p-2 border w-12">Sr.</th>
                      <th className="p-2 border w-24">Roll No</th>
                      <th className="p-2 border w-40">Name</th>
                      <th className="p-2 border w-28">Student Contact</th>
                      <th className="p-2 border w-48">Student Email</th>
                      <th className="p-2 border w-36">Father's Name</th>
                      <th className="p-2 border w-36">Mother's Name</th>
                      <th className="p-2 border w-48">Parent Email</th>
                      <th className="p-2 border w-28">Parent Contact</th>
                      <th className="p-2 border w-28">Type</th>
                      <th className="p-2 border w-32">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGrouped[groupKey].map((student, index) => (
                      <tr key={student.rollNumber} className="hover:bg-gray-50">
                        <td className="p-2 border">{index + 1}</td>
                        <td className="p-2 border font-semibold">{student.rollNumber}</td>
                        <td className="p-2 border text-left">{student.name}</td>
                        <td className="p-2 border">{student.contact}</td>
                        <td className="p-2 border text-left">{student.studentEmail || "N/A"}</td>
                        <td className="p-2 border text-left">{student.fatherName}</td>
                        <td className="p-2 border text-left">{student.motherName}</td>
                        <td className="p-2 border text-left">{student.parentEmail || "N/A"}</td>
                        <td className="p-2 border">{student.parentContact || "N/A"}</td>
                        <td className="p-2 border">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            student.residenceType === "hostler" 
                              ? "bg-orange-100 text-orange-700" 
                              : "bg-blue-100 text-blue-700"
                          }`}>
                            {student.residenceType === "hostler" ? "🏨 Hostler" : "🏠 Day Scholar"}
                          </span>
                        </td>
                        <td className="p-2 border space-x-2">
                          <button
                            onClick={() => handleEdit(student)}
                            className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm"
                          >
                            ✏️ Edit
                          </button>
                          {userRole !== "student" && (
                            <button
                              onClick={() => handleDelete(student.rollNumber, student.name)}
                              className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
                            >
                              🗑️ Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {Object.keys(filteredGrouped).length === 0 && (
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
                <th className="p-2 border w-12">Sr. No.</th>
                <th className="p-2 border w-24">Roll No</th>
                <th className="p-2 border w-40">Name</th>
                <th className="p-2 border w-20">Class</th>
                <th className="p-2 border w-20">Section</th>
                <th className="p-2 border w-28">Student Contact</th>
                <th className="p-2 border w-48">Student Email</th>
                <th className="p-2 border w-36">Father's Name</th>
                <th className="p-2 border w-36">Mother's Name</th>
                <th className="p-2 border w-48">Parent Email</th>
                <th className="p-2 border w-28">Parent Contact</th>
                <th className="p-2 border w-28">Type</th>
                <th className="p-2 border w-32">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="13" className="p-4 text-gray-500 italic">
                    No students found
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, index) => (
                  <tr key={student.rollNumber} className="hover:bg-gray-50">
                    <td className="p-2 border">{index + 1}</td>
                    <td className="p-2 border font-semibold">{student.rollNumber}</td>
                    <td className="p-2 border text-left">{student.name}</td>
                    <td className="p-2 border">{student.studentClass}</td>
                    <td className="p-2 border">{student.classArm || "—"}</td>
                    <td className="p-2 border">{student.contact}</td>
                    <td className="p-2 border text-left">{student.studentEmail || "N/A"}</td>
                    <td className="p-2 border text-left">{student.fatherName}</td>
                    <td className="p-2 border text-left">{student.motherName}</td>
                    <td className="p-2 border text-left">{student.parentEmail || "N/A"}</td>
                    <td className="p-2 border">{student.parentContact || "N/A"}</td>
                    <td className="p-2 border">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        student.residenceType === "hostler" 
                          ? "bg-orange-100 text-orange-700" 
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {student.residenceType === "hostler" ? "🏨 Hostler" : "🏠 Day Scholar"}
                      </span>
                    </td>
                    <td className="p-2 border space-x-2">
                      <button
                        onClick={() => handleEdit(student)}
                        className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm"
                      >
                        ✏️ Edit
                      </button>
                      {userRole !== "student" && (
                        <button
                          onClick={() => handleDelete(student.rollNumber, student.name)}
                          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 🔹 Edit Modal */}
      {isEditing && editForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 text-purple-600">Edit Student Details</h3>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Roll Number (ReadOnly)</label>
                <input
                  type="text"
                  name="rollNumber"
                  value={editForm.rollNumber}
                  readOnly
                  className="w-full p-2 border rounded bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  name="name"
                  value={editForm.name}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Class</label>
                <select
                  name="studentClass"
                  value={editForm.studentClass}
                  onChange={handleChange}
                  className="w-full p-2 border rounded bg-white"
                  required
                >
                  <option value="">-- Select Class --</option>
                  {CLASS_OPTIONS.map((cls) => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Student Contact</label>
                <input
                  type="text"
                  name="contact"
                  value={editForm.contact}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Student Email</label>
                <input
                  type="email"
                  name="studentEmail"
                  value={editForm.studentEmail || ""}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Father's Name</label>
                <input
                  type="text"
                  name="fatherName"
                  value={editForm.fatherName}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Parent Email</label>
                <input
                  type="email"
                  name="parentEmail"
                  value={editForm.parentEmail}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Parent Contact</label>
                <input
                  type="text"
                  name="parentContact"
                  value={editForm.parentContact || ""}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Mother's Name</label>
                <input
                  type="text"
                  name="motherName"
                  value={editForm.motherName}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Residence Type</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="residenceType"
                      value="day-scholar"
                      checked={editForm.residenceType === "day-scholar" || !editForm.residenceType}
                      onChange={handleChange}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="text-sm">🏠 Day Scholar</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="residenceType"
                      value="hostler"
                      checked={editForm.residenceType === "hostler"}
                      onChange={handleChange}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="text-sm">🏨 Hostler</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Student Telegram Chat ID</label>
                <input
                  type="text"
                  name="telegramChatId"
                  value={editForm.telegramChatId || ""}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Parent Telegram Chat ID <span className="text-gray-400 font-normal">(for low attendance alerts)</span></label>
                <input
                  type="text"
                  name="parentTelegramChatId"
                  value={editForm.parentTelegramChatId || ""}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegisteredStudent;
