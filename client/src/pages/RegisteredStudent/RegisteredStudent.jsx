import React, { useState, useEffect } from "react";
import { listenRegisteredStudents, deleteStudent, updateStudent } from "../../firebase";

const CLASS_OPTIONS = [
  "PlayGroup", "Nursery", "KG",
  "Class I", "Class II", "Class III", "Class IV", "Class V",
  "Class VI", "Class VII", "Class VIII",
  "Class IX", "Class X", "Class XI", "Class XII",
];

const RegisteredStudent = () => {
  const [students, setStudents] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);

  useEffect(() => {
    const unsub = listenRegisteredStudents(setStudents);
    return () => unsub();
  }, []);

  const handleDelete = async (rollNumber) => {
    if (window.confirm("Are you sure to delete this student?")) {
      await deleteStudent(rollNumber);
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

  return (
    <div className="p-6 overflow-x-auto relative">
      <h2 className="text-xl font-bold text-purple-600 mb-4">
        Registered Students
      </h2>
      <table className="min-w-full border text-center bg-white shadow rounded table-auto">
        <thead>
          <tr className="bg-purple-200">
            <th className="p-2 border w-12">Sr. No.</th>
            <th className="p-2 border w-24">Roll No</th>
            <th className="p-2 border w-40">Name</th>
            <th className="p-2 border w-20">Class</th>
            <th className="p-2 border w-28">Contact</th>
            <th className="p-2 border w-36">Father’s Name</th>
            <th className="p-2 border w-48">Father’s Email</th>
            <th className="p-2 border w-36">Mother’s Name</th>
            <th className="p-2 border w-32">Action</th>
          </tr>
        </thead>
        <tbody>
          {students.length === 0 ? (
            <tr>
              <td colSpan="9" className="p-4 text-gray-500 italic">
                No students registered yet
              </td>
            </tr>
          ) : (
            students.map((student, index) => (
              <tr key={student.rollNumber} className="hover:bg-gray-50">
                <td className="p-2 border">{index + 1}</td>
                <td className="p-2 border">{student.rollNumber}</td>
                <td className="p-2 border text-left">{student.name}</td>
                <td className="p-2 border">{student.studentClass}</td>
                <td className="p-2 border">{student.contact}</td>
                <td className="p-2 border text-left">{student.fatherName}</td>
                <td className="p-2 border text-left">{student.parentEmail || "N/A"}</td>
                <td className="p-2 border text-left">{student.motherName}</td>
                <td className="p-2 border space-x-2">
                  <button
                    onClick={() => handleEdit(student)}
                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(student.rollNumber)}
                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* 🔹 Edit Modal */}
      {isEditing && editForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
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
                <label className="block text-sm font-medium text-gray-700">Contact</label>
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
                <label className="block text-sm font-medium text-gray-700">Father's Email</label>
                <input
                  type="email"
                  name="parentEmail"
                  value={editForm.parentEmail}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
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
