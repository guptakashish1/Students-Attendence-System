import React, { useEffect, useState } from "react";
import { listenRegisteredStudents, markAttendance, getTodayDate } from "../firebase";

const MarkAttendance = () => {
  const [students, setStudents] = useState([]);
  const [markedStatus, setMarkedStatus] = useState({});
  const today = getTodayDate();

  useEffect(() => {
    const unsubscribe = listenRegisteredStudents((data) => {
      setStudents(data);
    });
    return () => unsubscribe && unsubscribe();
  }, []);

  const handleMark = async (student, value) => {
    try {
      let mapped = "";
      if (value === "Present") mapped = "IN";
      else if (value === "Checkout") mapped = "CHECKOUT";
      else if (value === "Absent") mapped = "ABSENT";
      else if (value === "Leave") mapped = "LEAVE";

      await markAttendance(student, today, mapped);

      setMarkedStatus((prev) => ({
        ...prev,
        [student.rollNumber]: value,
      }));
    } catch (error) {
      console.error("❌ Error marking attendance:", error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto bg-white shadow-xl p-6 rounded-xl mt-10">
      <h2 className="text-3xl font-bold mb-6 text-center text-purple-700">
        Mark Attendance - {today}
      </h2>

      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-purple-600 text-white">
            <th className="border p-2">Roll No</th>
            <th className="border p-2">Name</th>
            <th className="border p-2">Class</th>
            <th className="border p-2">Actions</th>
            <th className="border p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {students.length > 0 ? (
            students.map((s) => (
              <tr key={s.rollNumber} className="text-center">
                <td className="border p-2">{s.rollNumber}</td>
                <td className="border p-2">{s.name}</td>
                <td className="border p-2">{s.studentClass}</td>
                <td className="border p-2 space-x-2">
                  <button
                    onClick={() => handleMark(s, "Present")}
                    className="bg-green-500 text-white px-3 py-1 rounded"
                  >
                    Present
                  </button>
                  <button
                    onClick={() => handleMark(s, "Checkout")}
                    className="bg-blue-500 text-white px-3 py-1 rounded"
                  >
                    Checkout
                  </button>
                  <button
                    onClick={() => handleMark(s, "Absent")}
                    className="bg-red-500 text-white px-3 py-1 rounded"
                  >
                    Absent
                  </button>
                  <button
                    onClick={() => handleMark(s, "Leave")}
                    className="bg-yellow-500 text-white px-3 py-1 rounded"
                  >
                    Leave
                  </button>
                </td>
                <td className="border p-2">
                  {markedStatus[s.rollNumber] ? (
                    <span className="font-medium text-purple-600">
                      ✅ {markedStatus[s.rollNumber]}
                    </span>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" className="text-center p-4 text-gray-500">
                No registered students found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default MarkAttendance;
