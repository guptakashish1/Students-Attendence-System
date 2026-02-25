import React, { useState } from "react";
import { addStudent } from "../../firebase"; // ✅ your firebase.js function

const CLASS_OPTIONS = [
  "PlayGroup", "Nursery", "KG",
  "Class I", "Class II", "Class III", "Class IV", "Class V",
  "Class VI", "Class VII", "Class VIII",
  "Class IX", "Class X", "Class XI", "Class XII",
];

const Registration = () => {
  const [form, setForm] = useState({
    name: "",
    rollNumber: "",
    studentClass: "",
    contact: "",
    fatherName: "",
    motherName: "",
    parentEmail: "",
    telegramChatId: "",
    parentTelegramChatId: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // 🔹 Handle input changes
  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  // 🔹 Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      await addStudent(form); // ✅ save in Firebase Realtime DB
      setMessage("✅ Student registered successfully!");
      setForm({
        name: "",
        rollNumber: "",
        studentClass: "",
        contact: "",
        fatherName: "",
        motherName: "",
        parentEmail: "",
        telegramChatId: "",
        parentTelegramChatId: "",
      }); // reset form
    } catch (error) {
      setMessage("❌ Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="bg-white shadow-lg p-8 rounded-lg w-full max-w-lg">
        <h2 className="text-2xl font-bold mb-6 text-center text-purple-600">
          Student Registration
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Student Name"
            className="w-full p-2 border rounded"
            required
          />

          <input
            name="rollNumber"
            value={form.rollNumber}
            onChange={handleChange}
            placeholder="Roll Number"
            className="w-full p-2 border rounded"
            required
          />

          <select
            name="studentClass"
            value={form.studentClass}
            onChange={handleChange}
            className="w-full p-2 border rounded bg-white"
            required
          >
            <option value="">-- Select Class --</option>
            {CLASS_OPTIONS.map((cls) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>

          <input
            name="contact"
            value={form.contact}
            onChange={handleChange}
            placeholder="Contact (10 digits)"
            className="w-full p-2 border rounded"
            maxLength={10}
          />

          <input
            name="fatherName"
            value={form.fatherName}
            onChange={handleChange}
            placeholder="Father's Name"
            className="w-full p-2 border rounded"
          />

          <input
            name="motherName"
            value={form.motherName}
            onChange={handleChange}
            placeholder="Mother's Name"
            className="w-full p-2 border rounded"
          />

          <input
            type="email"
            name="parentEmail"
            value={form.parentEmail}
            onChange={handleChange}
            placeholder="Father's Email"
            className="w-full p-2 border rounded"
            required
          />

          <input
            name="telegramChatId"
            value={form.telegramChatId}
            onChange={handleChange}
            placeholder="Student Telegram Chat ID (Optional)"
            className="w-full p-2 border rounded"
          />

          <input
            name="parentTelegramChatId"
            value={form.parentTelegramChatId}
            onChange={handleChange}
            placeholder="Parent Telegram Chat ID (Optional — for low attendance alerts)"
            className="w-full p-2 border rounded"
          />

          <button
            type="submit"
            disabled={loading}
            className={`w-full text-white py-2 rounded ${loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-purple-600 hover:bg-purple-700"
              }`}
          >
            {loading ? "Registering..." : "Register"}
          </button>
        </form>
        {message && (
          <p className="mt-4 text-center text-sm text-gray-700">{message}</p>
        )}
      </div>
    </div>
  );
};

export default Registration;
