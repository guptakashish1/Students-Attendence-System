import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth, getUserRole, listenRegisteredStudents, listenAttendance, getAttendanceByMonth } from "../../firebase";

const StatCard = ({ icon, label, value, color, onClick }) => (
  <div onClick={onClick}
    style={{
      background: "#fff", borderRadius: "10px", padding: "24px 20px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.07)", display: "flex",
      alignItems: "center", justifyContent: "space-between",
      cursor: onClick ? "pointer" : "default",
      border: "1px solid #f3f4f6", transition: "box-shadow 0.2s",
    }}
    onMouseEnter={(e) => { if (onClick) e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.12)"; }}
    onMouseLeave={(e) => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.07)"}
  >
    <div>
      <p style={{ fontSize: "11px", fontWeight: 700, color: "#9ca3af", letterSpacing: "1px", textTransform: "uppercase", margin: "0 0 8px" }}>{label}</p>
      <p style={{ fontSize: "36px", fontWeight: 800, color: "#111827", margin: 0, lineHeight: 1 }}>{value}</p>
    </div>
    <div style={{ width: "52px", height: "52px", borderRadius: "12px", background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px" }}>
      {icon}
    </div>
  </div>
);

const Home = () => {
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  
  const [userRole, setUserRole] = useState("student");
  const [userEmail, setUserEmail] = useState("");
  const [totalStudents, setTotalStudents] = useState(0);
  const [presentToday, setPresentToday] = useState(0);
  const [absentToday, setAbsentToday] = useState(0);
  const [onLeaveToday, setOnLeaveToday] = useState(0);
  const [recentRecords, setRecentRecords] = useState([]);
  
  // Student-specific stats
  const [myStudent, setMyStudent] = useState(null);
  const [myTodayStatus, setMyTodayStatus] = useState(null);
  const [myMonthlyStats, setMyMonthlyStats] = useState({ present: 0, absent: 0, leave: 0, total: 0 });

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

  useEffect(() => {
    const unsubStudents = listenRegisteredStudents((students) => {
      // Filter for wardens - only count hostlers
      if (userRole === "warden") {
        const hostlerStudents = students.filter(s => s.residenceType === "hostler");
        setTotalStudents(hostlerStudents.length);
      } else {
        setTotalStudents(students.length);
      }
      
      // Find student's own record if they are a student
      if (userRole === "student" && userEmail) {
        const student = students.find(s => 
          s.studentEmail?.toLowerCase() === userEmail.toLowerCase() || 
          s.parentEmail?.toLowerCase() === userEmail.toLowerCase()
        );
        setMyStudent(student);
      }
    });
    
    const unsubAtt = listenAttendance(today, (records) => {
      const arr = Object.values(records || {});
      setPresentToday(arr.filter((r) => r.status === "IN").length);
      setAbsentToday(arr.filter((r) => r.status === "ABSENT").length);
      setOnLeaveToday(arr.filter((r) => r.status === "LEAVE").length);
      setRecentRecords(arr.slice(0, 5));
      
      // Find student's today status
      if (userRole === "student" && myStudent) {
        const myRecord = arr.find(r => r.rollNumber === myStudent.rollNumber);
        setMyTodayStatus(myRecord);
      }
    });
    
    return () => { unsubStudents(); if (unsubAtt) unsubAtt(); };
  }, [today, userRole, userEmail, myStudent]);

  // Load student's monthly stats
  useEffect(() => {
    if (userRole === "student" && myStudent) {
      loadMyMonthlyStats();
    }
  }, [userRole, myStudent, currentMonth]); // eslint-disable-line

  async function loadMyMonthlyStats() {
    if (!myStudent) return;
    try {
      const records = await getAttendanceByMonth(currentMonth);
      const myRecords = records.filter(r => r.rollNumber === myStudent.rollNumber);
      
      const stats = {
        present: myRecords.filter(r => r.status === "IN").length,
        absent: myRecords.filter(r => r.status === "ABSENT").length,
        leave: myRecords.filter(r => r.status === "LEAVE").length,
        total: myRecords.length,
      };
      setMyMonthlyStats(stats);
    } catch (error) {
      console.error("Error loading monthly stats:", error);
    }
  }

  const notMarked = totalStudents - presentToday - absentToday - onLeaveToday;
  const attendanceRate = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0;
  const myAttendanceRate = myMonthlyStats.total > 0 
    ? Math.round((myMonthlyStats.present / myMonthlyStats.total) * 100) 
    : 0;

  // Student Dashboard
  if (userRole === "student") {
    return (
      <div style={{ background: "#f9fafb", minHeight: "100vh", paddingBottom: "40px" }}>
        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "26px", fontWeight: 800, color: "#111827", margin: "0 0 6px" }}>
            👋 Welcome, {myStudent?.name || "Student"}!
          </h1>
          <p style={{ color: "#9ca3af", fontSize: "13px", margin: 0 }}>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>

        {/* Today's Status Card */}
        <div style={{ 
          background: myTodayStatus?.status === "IN" ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" 
            : myTodayStatus?.status === "ABSENT" ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
            : myTodayStatus?.status === "LEAVE" ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
            : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
          borderRadius: "16px", padding: "32px", marginBottom: "24px", color: "#fff", boxShadow: "0 10px 30px rgba(0,0,0,0.15)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: "14px", opacity: 0.9, margin: "0 0 8px" }}>Today's Attendance</p>
              <h2 style={{ fontSize: "42px", fontWeight: 800, margin: "0 0 12px" }}>
                {myTodayStatus?.status === "IN" ? "✅ Present" 
                  : myTodayStatus?.status === "ABSENT" ? "❌ Absent"
                  : myTodayStatus?.status === "LEAVE" ? "📌 On Leave"
                  : "⏳ Not Marked"}
              </h2>
              {myTodayStatus && (
                <p style={{ fontSize: "13px", opacity: 0.85, margin: 0 }}>
                  Check-in: {myTodayStatus.checkInTime || "—"} • Check-out: {myTodayStatus.checkOutTime || "—"}
                </p>
              )}
            </div>
            <div style={{ fontSize: "72px", opacity: 0.2 }}>
              {myTodayStatus?.status === "IN" ? "✅" 
                : myTodayStatus?.status === "ABSENT" ? "❌"
                : myTodayStatus?.status === "LEAVE" ? "📌"
                : "📅"}
            </div>
          </div>
        </div>

        {/* Monthly Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "24px" }}>
          <StatCard icon="📊" label="Attendance Rate" value={`${myAttendanceRate}%`} 
            color={myAttendanceRate >= 75 ? "#10b981" : "#ef4444"} 
            onClick={() => navigate("/monthly-summary")} />
          <StatCard icon="✅" label="Present Days" value={myMonthlyStats.present} color="#10b981" />
          <StatCard icon="❌" label="Absent Days" value={myMonthlyStats.absent} color="#ef4444" />
          <StatCard icon="📌" label="Leave Days" value={myMonthlyStats.leave} color="#f59e0b" />
        </div>

        {/* Student Info Card */}
        {myStudent && (
          <div style={{ background: "#fff", borderRadius: "12px", padding: "24px", marginBottom: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", border: "1px solid #f3f4f6" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#111827", marginTop: 0, marginBottom: "16px", borderBottom: "1px solid #f3f4f6", paddingBottom: "10px" }}>
              👤 My Profile
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "13px" }}>
              <div>
                <p style={{ color: "#9ca3af", margin: "0 0 4px" }}>Roll Number</p>
                <p style={{ fontWeight: 600, color: "#111827", margin: 0 }}>{myStudent.rollNumber}</p>
              </div>
              <div>
                <p style={{ color: "#9ca3af", margin: "0 0 4px" }}>Class</p>
                <p style={{ fontWeight: 600, color: "#111827", margin: 0 }}>
                  {myStudent.studentClass}{myStudent.classArm ? ` - ${myStudent.classArm}` : ""}
                </p>
              </div>
              <div>
                <p style={{ color: "#9ca3af", margin: "0 0 4px" }}>Father's Name</p>
                <p style={{ fontWeight: 600, color: "#111827", margin: 0 }}>{myStudent.fatherName || "—"}</p>
              </div>
              <div>
                <p style={{ color: "#9ca3af", margin: "0 0 4px" }}>Contact</p>
                <p style={{ fontWeight: 600, color: "#111827", margin: 0 }}>{myStudent.contact || "—"}</p>
              </div>
              <div>
                <p style={{ color: "#9ca3af", margin: "0 0 4px" }}>Residence Type</p>
                <p style={{ fontWeight: 600, color: "#111827", margin: 0 }}>
                  {myStudent.residenceType === "hostler" ? "🏨 Hostler" : "🏠 Day Scholar"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", border: "1px solid #f3f4f6" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#111827", marginTop: 0, marginBottom: "16px", borderBottom: "1px solid #f3f4f6", paddingBottom: "10px" }}>
            ⚡ Quick Actions
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
            {[
              { label: "📋 My Attendance", path: "/view-attendance", bg: "#6d28d9", color: "#fff" },
              { label: "📊 Monthly Summary", path: "/monthly-summary", bg: "#f3f0ff", color: "#6d28d9" },
              { label: "👤 My Profile", path: "/registered-students", bg: "#f3f0ff", color: "#6d28d9" },
              { label: "🗂️ My Teachers", path: "/my-hierarchy", bg: "#f3f0ff", color: "#6d28d9" },
              ...(myStudent?.residenceType === "hostler" ? [{ label: "🚪 Leave / Outing", path: "/leave-outing", bg: "#f3f0ff", color: "#6d28d9" }] : []),
              { label: "📷 Mark Attendance", path: "/face-attendance", bg: "#f3f0ff", color: "#6d28d9" },
              { label: "🙂 Register My Face", path: "/face-registration", bg: "#f3f0ff", color: "#6d28d9" },
              { label: "📢 Join Channel", path: "/common-telegram-channel", bg: "#f3f0ff", color: "#6d28d9" },
              { label: "🏫 Academic Feedback", path: "/academic-feedback", bg: "#f3f0ff", color: "#6d28d9" },
              { label: "📖 Subject Feedback", path: "/subject-feedback", bg: "#f3f0ff", color: "#6d28d9" },
            ].map((a) => (
              <button key={a.path} onClick={() => navigate(a.path)}
                style={{
                  background: a.bg, color: a.color, border: "none",
                  padding: "11px 16px", borderRadius: "8px", textAlign: "left",
                  fontWeight: 600, fontSize: "13px", cursor: "pointer", transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.85"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Low Attendance Warning */}
        {myAttendanceRate < 75 && (
          <div style={{ 
            background: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)", 
            borderRadius: "12px", padding: "20px", marginTop: "24px",
            border: "2px solid #ef4444"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ fontSize: "48px" }}>⚠️</div>
              <div>
                <h4 style={{ fontSize: "16px", fontWeight: 700, color: "#dc2626", margin: "0 0 8px" }}>
                  Low Attendance Warning
                </h4>
                <p style={{ fontSize: "13px", color: "#991b1b", margin: 0 }}>
                  Your attendance is {myAttendanceRate}%, which is below the required 75%. 
                  Please attend regularly to meet the minimum requirement.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "12px", marginTop: "32px" }}>
          © {new Date().getFullYear()} Student Attendance Management System
        </p>
      </div>
    );
  }

  // Admin/Teacher/Staff Dashboard
  return (
    <div style={{ background: "#f9fafb", minHeight: "100vh", paddingBottom: "40px" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "26px", fontWeight: 800, color: "#111827", margin: "0 0 6px" }}>📊 Administrator Dashboard</h1>
          <p style={{ color: "#9ca3af", fontSize: "13px", margin: 0 }}>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div style={{ fontSize: "12px", color: "#9ca3af" }}>
          Home <span style={{ color: "#6d28d9" }}>/ Dashboard</span>
        </div>
      </div>

      {/* Stat Grid - Row 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "16px" }}>
        <StatCard icon="👨‍🎓" label="Total Students" value={totalStudents} color="#6366f1" onClick={() => navigate("/registered-students")} />
        <StatCard icon="✅" label="Present Today" value={presentToday} color="#10b981" onClick={() => navigate("/present-today")} />
        <StatCard icon="❌" label="Absent Today" value={absentToday} color="#ef4444" />
        <StatCard icon="📌" label="On Leave" value={onLeaveToday} color="#f59e0b" />
      </div>

      {/* Stat Grid - Row 2 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        <StatCard icon="⏳" label="Not Marked" value={notMarked < 0 ? 0 : notMarked} color="#8b5cf6" />
        <StatCard icon="📈" label="Attendance Rate" value={`${attendanceRate}%`} color="#0ea5e9" onClick={() => navigate("/monthly-summary")} />
        <StatCard icon="📅" label="Today's Date" value={new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} color="#6d28d9" />
        <StatCard icon="📢" label="Broadcast" value="Send Now" color="#ec4899" onClick={() => navigate("/broadcast")} />
      </div>

      {/* Quick Actions + Recent Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {/* Quick Actions */}
        <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", border: "1px solid #f3f4f6" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#111827", marginTop: 0, marginBottom: "16px", borderBottom: "1px solid #f3f4f6", paddingBottom: "10px" }}>⚡ Quick Actions</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { label: "✏️ Take Attendance", path: "/take-attendance", bg: "#6d28d9", color: "#fff" },
              { label: "📚 Subject Attendance", path: "/subject-attendance", bg: "#f3f0ff", color: "#6d28d9" },
              { label: "🏨 Hostler Attendance", path: "/hostler-attendance", bg: "#f3f0ff", color: "#6d28d9" },
              { label: "📋 View Records", path: "/view-attendance", bg: "#f3f0ff", color: "#6d28d9" },
              { label: "➕ Register Student", path: "/register", bg: "#f3f0ff", color: "#6d28d9" },
              { label: "👥 View All Students", path: "/registered-students", bg: "#f3f0ff", color: "#6d28d9" },
            ].map((a) => (
              <button key={a.path} onClick={() => navigate(a.path)}
                style={{
                  background: a.bg, color: a.color, border: "none",
                  padding: "11px 16px", borderRadius: "8px", textAlign: "left",
                  fontWeight: 600, fontSize: "13px", cursor: "pointer", transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.85"}
                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{ background: "#fff", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", border: "1px solid #f3f4f6" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#111827", marginTop: 0, marginBottom: "16px", borderBottom: "1px solid #f3f4f6", paddingBottom: "10px" }}>🕐 Today's Recent Activity</h3>
          {recentRecords.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: "13px", textAlign: "center", marginTop: "30px" }}>No attendance marked yet today.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {recentRecords.map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px", borderRadius: "8px", background: "#f9fafb" }}>
                  <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: r.status === "IN" ? "#d1fae5" : r.status === "ABSENT" ? "#fee2e2" : "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>
                    {r.status === "IN" ? "✅" : r.status === "ABSENT" ? "❌" : "📌"}
                  </div>
                  <div>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "#111827", margin: 0 }}>{r.name || "Student"}</p>
                    <p style={{ fontSize: "11px", color: "#9ca3af", margin: 0 }}>Roll: {r.rollNumber} · {r.status === "IN" ? "Present" : r.status === "ABSENT" ? "Absent" : "On Leave"}</p>
                  </div>
                  <span style={{ marginLeft: "auto", fontSize: "11px", color: "#9ca3af" }}>{r.checkInTime || "-"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "12px", marginTop: "32px" }}>
        © {new Date().getFullYear()} Student Attendance Management System
      </p>
    </div>
  );
};

export default Home;
