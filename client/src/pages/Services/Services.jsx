// src/pages/Services/Services.jsx
import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth, getUserRole } from "../../firebase";

// ✅ Firebase helpers
import { listenRegisteredStudents, listenAttendance } from "../../firebase";

// ✅ Redux action
import { setStudents } from "../../store";

const Services = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { students } = useSelector((state) => state.students);
  const [presentCount, setPresentCount] = useState(0);
  const [userRole, setUserRole] = useState("student");
  const [userEmail, setUserEmail] = useState("");
  const [myAttendancePercentage, setMyAttendancePercentage] = useState(0);
  const today = new Date().toISOString().split("T")[0];

  // Get user role
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email);
        const roleData = await getUserRole(user.uid);
        setUserRole(roleData?.role || "student");
      }
    });
    return () => unsub();
  }, []);

  // ✅ Listen for registered students
  useEffect(() => {
    const unsubscribe = listenRegisteredStudents((studentList) => {
      dispatch(setStudents(studentList));
      
      // Calculate student's attendance percentage if they are a student
      if (userRole === "student" && userEmail) {
        const myStudent = studentList.find(s => 
          s.studentEmail?.toLowerCase() === userEmail.toLowerCase() || 
          s.parentEmail?.toLowerCase() === userEmail.toLowerCase()
        );
        if (myStudent) {
          // This is a placeholder - you can calculate actual percentage from attendance records
          setMyAttendancePercentage(85); // Replace with actual calculation
        }
      }
    });
    return () => typeof unsubscribe === "function" && unsubscribe();
  }, [dispatch, userRole, userEmail]);

  // ✅ Listen for today's attendance
  useEffect(() => {
    const unsubscribe = listenAttendance(today, (attendanceList) => {
      const present = attendanceList.filter(
        (record) => record.status === "IN"
      );
      setPresentCount(present.length);
    });
    return () => typeof unsubscribe === "function" && unsubscribe();
  }, [today]);

  // ✅ Dashboard cards based on role
  const adminServices = [
    {
      title: "Take Attendance",
      link: "/take-attendance",
      button: "Mark",
      icon: "✏️",
    },
    {
      title: "View Attendance",
      link: "/view-attendance",
      button: "View",
      icon: "📋",
    },
    {
      title: "Subject Attendance",
      link: "/subject-attendance",
      button: "Mark",
      icon: "📚",
      description: "Mark attendance by subject and period"
    },
    {
      title: "Hostler Attendance",
      link: "/hostler-attendance",
      button: "Mark",
      icon: "🏨",
      description: "Mark hostel roll call attendance"
    },
    {
      title: "Registered Students",
      link: "/registered-students",
      button: "View",
      icon: "👥",
    },
    {
      title: `Present Today: ${presentCount}`,
      link: "/present-today",
      button: "View",
      icon: "✅",
    },
    {
      title: "Monthly Summary",
      link: "/monthly-summary",
      button: "View",
      icon: "📅",
    },
    {
      title: "Analytics",
      link: "/analytics",
      button: "View",
      icon: "📊",
    },
  ];

  const studentServices = [
    {
      title: "My Profile",
      link: "/registered-students",
      button: "View",
      icon: "👤",
      description: "View and update your personal details"
    },
    {
      title: "My Attendance",
      link: "/view-attendance",
      button: "View",
      icon: "📋",
      description: "Check your attendance records"
    },
    {
      title: "Course Summary",
      link: "/monthly-summary",
      button: "View",
      icon: "📚",
      description: "View your monthly attendance summary"
    },
    {
      title: "My Hierarchy",
      link: "/my-hierarchy",
      button: "View",
      icon: "🗂️",
      description: "View your teachers and class information"
    },
    {
      title: "Mark Attendance",
      link: "/face-attendance",
      button: "Mark",
      icon: "📷",
      description: "Mark your attendance using face recognition"
    },
    {
      title: "Join Channel",
      link: "/common-telegram-channel",
      button: "Join",
      icon: "📢",
      description: "Join the class Telegram channel"
    },
    {
      title: "Academic Feedback",
      link: "/academic-feedback",
      button: "Submit",
      icon: "🏫",
      description: "Report facility and infrastructure issues"
    },
    {
      title: "Subject Feedback",
      link: "/subject-feedback",
      button: "Submit",
      icon: "📖",
      description: "Share feedback about subjects and teaching"
    },
  ];

  const services = userRole === "student" ? studentServices : adminServices;

  return (
    <div className="mt-10 px-6">
      <h1 className="font-bold text-2xl text-center text-purple-600 mb-4">
        {userRole === "student" ? "Student Portal" : "Attendance Dashboard"}
      </h1>
      {userRole === "student" && (
        <p className="text-center text-gray-600 mb-8">
          Welcome to your student portal. Access your attendance, profile, and course information.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {services.map((service, index) => (
          <div
            key={index}
            className="rounded-2xl shadow-xl shadow-purple-300 bg-white hover:shadow-purple-400 transition duration-300 hover:scale-105"
          >
            <div className="px-6 py-6">
              <div className="text-4xl text-center mb-3">{service.icon}</div>
              <div className="font-bold text-lg text-center text-gray-700 mb-2">
                {service.title}
              </div>
              {service.description && (
                <p className="text-sm text-gray-500 text-center">
                  {service.description}
                </p>
              )}
            </div>
            {service.button && (
              <div className="flex justify-center pb-6">
                <button
                  className="bg-transparent hover:bg-purple-500 text-purple-600 font-semibold hover:text-white py-2 px-6 border border-purple-500 hover:border-transparent rounded-lg transition duration-300"
                  onClick={() => service.link && navigate(service.link)}
                >
                  {service.button}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Services;
