import React, { useState, useEffect } from "react";
import { addStudent, listenCollection } from "../../firebase"; // ✅ your firebase.js function

const CLASS_OPTIONS = [
  "PlayGroup", "Nursery", "KG",
  "Class I", "Class II", "Class III", "Class IV", "Class V",
  "Class VI", "Class VII", "Class VIII",
  "Class IX", "Class X", "Class XI", "Class XII",
];

const SECTION_OPTIONS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
  "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T",
  "U", "V", "W", "X", "Y", "Z"
];

const Registration = () => {
  const [form, setForm] = useState({
    name: "",
    rollNumber: "",
    studentClass: "",
    classArm: "",
    contact: "",
    studentEmail: "",
    permanentAddress: "",
    fatherName: "",
    motherName: "",
    parentEmail: "",
    parentContact: "",
    telegramChatId: "",
    parentTelegramChatId: "",
    residenceType: "day-scholar", // hostler or day-scholar
  });

  const [classArms, setClassArms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Load class arms from Firebase
  useEffect(() => {
    const unsub = listenCollection("classArms", setClassArms);
    return () => unsub();
  }, []);

  // Get sections for selected class
  const getSectionsForClass = (className) => {
    if (!className) return [];
    return classArms.filter(arm => 
      arm.className === className || 
      arm.classId === className
    );
  };

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
        classArm: "",
        contact: "",
        studentEmail: "",
        permanentAddress: "",
        fatherName: "",
        motherName: "",
        parentEmail: "",
        parentContact: "",
        telegramChatId: "",
        parentTelegramChatId: "",
        residenceType: "day-scholar",
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
            onChange={(e) => {
              setForm({
                ...form,
                studentClass: e.target.value,
                classArm: "" // Reset section when class changes
              });
            }}
            className="w-full p-2 border rounded bg-white"
            required
          >
            <option value="">-- Select Class --</option>
            {CLASS_OPTIONS.map((cls) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>

          <select
            name="classArm"
            value={form.classArm}
            onChange={handleChange}
            className="w-full p-2 border rounded bg-white"
            disabled={!form.studentClass}
          >
            <option value="">-- Select Section (Optional) --</option>
            {SECTION_OPTIONS.map((section) => (
              <option key={section} value={section}>Section {section}</option>
            ))}
          </select>
          {!form.studentClass && (
            <p className="text-xs text-gray-500 -mt-2">
              💡 Select a class first to choose a section
            </p>
          )}

          <input
            type="tel"
            name="contact"
            value={form.contact}
            onChange={(e) => {
              // Only allow numeric input
              const value = e.target.value.replace(/[^0-9]/g, '');
              setForm({ ...form, contact: value });
            }}
            placeholder="Contact (10 digits)"
            className="w-full p-2 border rounded"
            maxLength={10}
            pattern="[0-9]{10}"
            title="Please enter exactly 10 digits"
          />

          <input
            type="email"
            name="studentEmail"
            value={form.studentEmail}
            onChange={handleChange}
            placeholder="Student Email"
            className="w-full p-2 border rounded"
            required
          />

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Student Permanent Address *
            </label>
            <textarea
              name="permanentAddress"
              value={form.permanentAddress}
              onChange={handleChange}
              placeholder="Enter complete permanent address"
              className="w-full p-2 border rounded resize-none"
              rows={3}
              minLength={10}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {form.permanentAddress.length} characters (minimum 10 required)
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Residence Type *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="residenceType"
                  value="day-scholar"
                  checked={form.residenceType === "day-scholar"}
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
                  checked={form.residenceType === "hostler"}
                  onChange={handleChange}
                  className="w-4 h-4 text-purple-600"
                />
                <span className="text-sm">🏨 Hostler</span>
              </label>
            </div>
          </div>

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
            type="tel"
            name="parentContact"
            value={form.parentContact}
            onChange={(e) => {
              // Only allow numeric input
              const value = e.target.value.replace(/[^0-9]/g, '');
              setForm({ ...form, parentContact: value });
            }}
            placeholder="Parent Contact Number (10 digits)"
            className="w-full p-2 border rounded"
            maxLength={10}
            pattern="[0-9]{10}"
            title="Please enter exactly 10 digits"
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
