import React, { useEffect, useState } from "react";
import { markAttendance } from "../firebase"; // ✅ only this is needed

const PresentStudent = ({ student }) => {
  const [status, setStatus] = useState(null);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    // Example: reset when date changes
    setStatus(null);
  }, [today]); // ✅ Added dependency

  const handleMark = async (value) => {
    try {
      await markAttendance(student, today, value);
      setStatus(value);
    } catch (error) {
      console.error("Error marking attendance:", error);
    }
  };

  return (
    <div>
      <p>
        {student.name} ({student.roll})
      </p>
      <button onClick={() => handleMark("Present")}>Present</button>
      <button onClick={() => handleMark("Absent")}>Absent</button>
      {status && <span> ✅ Marked {status}</span>}
    </div>
  );
};

export default PresentStudent;
