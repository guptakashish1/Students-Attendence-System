import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { auth, getUserRole, listenRegisteredStudents } from "../firebase";
import { signOut } from "firebase/auth";

// Define which roles can access which menu groups
const roleAccess = {
  student: ["MAIN", "ATTENDANCE_STUDENT", "TELEGRAM_STUDENT", "FEEDBACK_STUDENT"],
  teacher: ["MAIN", "ATTENDANCE", "STUDENTS", "TELEGRAM"],
  staff: ["MAIN", "ATTENDANCE", "STUDENTS", "TELEGRAM"],
  admin: ["MAIN", "ATTENDANCE", "STUDENTS", "ADMIN", "TELEGRAM", "MANAGEMENT"],
  warden: ["MAIN", "ATTENDANCE_WARDEN", "TELEGRAM"],
};

const navGroups = [
  {
    group: "MAIN",
    items: [
      { to: "/", label: "Dashboard", icon: "📊" },
      { to: "/services", label: "Services", icon: "⚙️" },
    ],
  },
  {
    group: "ATTENDANCE_STUDENT",
    items: [
      { to: "/registered-students", label: "My Profile", icon: "👤" },
      { to: "/view-attendance",   label: "My Attendance",      icon: "📋" },
      { to: "/monthly-summary",   label: "Monthly Summary",   icon: "📅" },
      { to: "/leave-outing",      label: "Leave / Outing",    icon: "🚪" },
      { to: "/face-attendance",   label: "Face Recognition",  icon: "📷" },
      { to: "/geo-attendance",    label: "Geo Attendance",    icon: "📍" },
      { to: "/biometric",         label: "Biometric + OTP",   icon: "🔐" },
    ],
  },
  {
    group: "ATTENDANCE",
    items: [
      { to: "/take-attendance",   label: "Take Attendance",   icon: "✏️" },
      { to: "/view-attendance",   label: "View Records",      icon: "📋" },
      { to: "/present-today",     label: "Present Today",     icon: "✅" },
      { to: "/monthly-summary",   label: "Monthly Summary",   icon: "📅" },
      { to: "/subject-attendance", label: "Subject Attendance", icon: "📚" },
      { to: "/hostler-attendance", label: "Hostler Attendance", icon: "🏨" },
      { to: "/face-attendance",   label: "Face Recognition",  icon: "📷" },
      { to: "/face-registration", label: "Face Registration", icon: "➕" },
      { to: "/geo-attendance",    label: "Geo Attendance",    icon: "📍" },
      { to: "/biometric",         label: "Biometric + OTP",   icon: "🔐" },
    ],
  },
  {
    group: "ATTENDANCE_WARDEN",
    items: [
      { to: "/view-attendance",   label: "View Records",      icon: "📋" },
      { to: "/present-today",     label: "Present Today",     icon: "✅" },
      { to: "/monthly-summary",   label: "Monthly Summary",   icon: "📅" },
      { to: "/hostler-attendance", label: "Hostler Attendance", icon: "🏨" },
      { to: "/registered-students", label: "Hostler Students", icon: "👥" },
      { to: "/face-attendance",   label: "Face Recognition",  icon: "📷" },
      { to: "/face-registration", label: "Face Registration", icon: "➕" },
      { to: "/face-approval",     label: "Face Approval",     icon: "✅" },
      { to: "/geo-attendance",    label: "Geo Attendance",    icon: "📍" },
      { to: "/biometric",         label: "Biometric + OTP",   icon: "🔐" },
    ],
  },
  {
    group: "STUDENTS",
    items: [
      { to: "/register", label: "Register Student", icon: "➕" },
      { to: "/registered-students", label: "Registered Students", icon: "👥" },
    ],
  },
  {
    group: "ADMIN",
    items: [
      { to: "/broadcast",       label: "Admin Broadcast",     icon: "📢" },
      { to: "/bot-automation",  label: "Bot Automation",      icon: "🤖" },
      { to: "/bot-logs",        label: "Bot Logs",            icon: "📊" },
      { to: "/analytics",       label: "Analytics Charts",    icon: "📉" },
      { to: "/ai-analysis",     label: "AI Analysis",         icon: "🤖" },
    ],
  },
  {
    group: "TELEGRAM_STUDENT",
    items: [
      { to: "/my-hierarchy", label: "My Teachers", icon: "🗂️" },
      { to: "/qr-attendance",   label: "QR Attendance",   icon: "📸" },
      { to: "/bot-registration", label: "Bot Registration", icon: "🤖" },
      { to: "/common-telegram-channel", label: "Join Channel", icon: "📢" },
    ],
  },
  {
    group: "FEEDBACK_STUDENT",
    items: [
      { to: "/academic-feedback", label: "Academic Feedback", icon: "📢" },
      { to: "/subject-feedback", label: "Subject Feedback", icon: "📚" },
    ],
  },
  {
    group: "TELEGRAM",
    items: [
      { to: "/qr-attendance",   label: "QR Attendance",   icon: "📸" },
      { to: "/bot-registration", label: "Bot Registration", icon: "🤖" },
      { to: "/telegram-channels", label: "Telegram Channels", icon: "📱" },
      { to: "/bot-setup", label: "Advanced Bot Setup", icon: "⚙️" },
    ],
  },
  {
    group: "MANAGEMENT",
    items: [
      { to: "/manage-classes", label: "Manage Classes", icon: "🏫" },
      { to: "/manage-class-arms", label: "Class Arms", icon: "🔀" },
      { to: "/manage-faculty", label: "Manage Faculty", icon: "👨‍🏫" },
      { to: "/manage-staff", label: "Manage Staff", icon: "👷" },
      { to: "/manage-timetable", label: "Timetable", icon: "📅" },
      { to: "/common-telegram-channel", label: "Common Channel QR", icon: "📢" },
      { to: "/sessions-terms", label: "Sessions & Terms", icon: "📆" },
    ],
  },
];

export const Sidebar = ({ userRole, isOpen }) => {
  const location = useLocation();
  const [studentResidenceType, setStudentResidenceType] = React.useState(null);
  
  // Get student residence type for filtering
  React.useEffect(() => {
    if (userRole === "student") {
      const fetchStudentData = async () => {
        const user = auth.currentUser;
        if (user) {
          const unsubStudents = listenRegisteredStudents((students) => {
            const student = students.find(s => 
              s.studentEmail?.toLowerCase() === user.email.toLowerCase() || 
              s.parentEmail?.toLowerCase() === user.email.toLowerCase()
            );
            setStudentResidenceType(student?.residenceType || null);
          });
          return () => unsubStudents();
        }
      };
      fetchStudentData();
    }
  }, [userRole]);
  
  // Filter nav groups based on user role
  const allowedGroups = roleAccess[userRole] || roleAccess.student;
  let filteredNavGroups = navGroups.filter(g => allowedGroups.includes(g.group));
  
  // Filter out Leave/Outing for day scholars
  if (userRole === "student" && studentResidenceType === "dayscholar") {
    filteredNavGroups = filteredNavGroups.map(group => {
      if (group.group === "ATTENDANCE_STUDENT") {
        return {
          ...group,
          items: group.items.filter(item => item.to !== "/leave-outing")
        };
      }
      return group;
    });
  }

  const linkStyle = (to) => ({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 20px",
    textDecoration: "none",
    fontSize: "13.5px",
    fontWeight: location.pathname === to ? 700 : 400,
    color: location.pathname === to ? "#6d28d9" : "#374151",
    background: location.pathname === to ? "#ede9fe" : "transparent",
    borderLeft: location.pathname === to ? "3px solid #6d28d9" : "3px solid transparent",
    cursor: "pointer",
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  });

  return (
    <aside style={{
      position: "fixed",
      top: "56px",
      left: isOpen ? 0 : "-230px",
      width: "230px",
      height: "calc(100vh - 56px)",
      background: "#fff",
      borderRight: "1px solid #e5e7eb",
      overflowY: "auto",
      zIndex: 100,
      paddingTop: "12px",
      paddingBottom: "24px",
      transition: "left 0.3s ease-in-out",
    }}>
      {filteredNavGroups.map((g) => (
        <div key={g.group} style={{ marginBottom: "8px" }}>
          <p style={{
            fontSize: "10px", fontWeight: 700, color: "#9ca3af",
            letterSpacing: "1.5px", textTransform: "uppercase",
            padding: "6px 20px 4px", margin: 0,
          }}>
            {g.group.replace("_STUDENT", "")}
          </p>
          {g.items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              style={linkStyle(item.to)}
              onMouseEnter={(e) => {
                if (location.pathname !== item.to) {
                  e.currentTarget.style.background = "#f5f3ff";
                  e.currentTarget.style.color = "#6d28d9";
                }
              }}
              onMouseLeave={(e) => {
                if (location.pathname !== item.to) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#374151";
                }
              }}
            >
              <span style={{ fontSize: "16px", flexShrink: 0 }}>{item.icon}</span>
              <span>{item.label}</span>
              <span style={{ marginLeft: "auto", color: "#d1d5db", fontSize: "13px" }}>›</span>
            </Link>
          ))}
        </div>
      ))}
    </aside>
  );
};

const Navbar = ({ userEmail, userRole, sidebarOpen, setSidebarOpen }) => {
  const handleLogout = async () => {
    try { await signOut(auth); } catch (e) { console.error(e); }
  };
  
  // Role badge colors
  const roleColors = {
    admin: { bg: "#dc2626", text: "#fff" },
    teacher: { bg: "#2563eb", text: "#fff" },
    student: { bg: "#16a34a", text: "#fff" },
    staff: { bg: "#ea580c", text: "#fff" },
    warden: { bg: "#7c3aed", text: "#fff" },
  };
  
  const roleColor = roleColors[userRole] || roleColors.student;

  return (
    <>
      {/* Top Header */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "56px",
        background: "linear-gradient(90deg,#3b3fd8,#5b21b6)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px", zIndex: 200, boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
      }}>
        {/* Left - Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background: "none", border: "none", color: "#fff", fontSize: "20px", cursor: "pointer", padding: "4px" }}>
            ☰
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "30px", height: "30px", background: "rgba(255,255,255,0.2)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>🎓</div>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: "17px", letterSpacing: "0.5px" }}>AMS</span>
          </div>
        </div>

        {/* Right - Search + User */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.15)", borderRadius: "8px", padding: "6px 12px", gap: "8px" }}>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "14px" }}>🔍</span>
            <input placeholder="Search..." style={{ background: "none", border: "none", outline: "none", color: "#fff", fontSize: "13px", width: "120px" }}
              onFocus={(e) => e.target.style.width = "180px"}
              onBlur={(e) => e.target.style.width = "120px"}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Role Badge */}
            <div style={{ 
              background: roleColor.bg, 
              color: roleColor.text, 
              padding: "4px 10px", 
              borderRadius: "12px", 
              fontSize: "11px", 
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}>
              {userRole || "Student"}
            </div>
            
            <div style={{ cursor: "pointer" }} onClick={handleLogout} title="Logout">
              <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#fff", fontSize: "14px" }}>
                {userEmail?.[0]?.toUpperCase() || "A"}
              </div>
            </div>
            <span style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>
              {userEmail?.split("@")[0] || "User"}
            </span>
          </div>
        </div>
      </header>
    </>
  );
};

export default Navbar;
