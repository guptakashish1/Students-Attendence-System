// src/App.js
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth, getUserRole } from "./firebase";

import Navbar, { Sidebar } from "./components/Navbar";
import TelegramBotService from "./components/TelegramBotService";
import { TelegramProvider, useTelegram } from "./context/TelegramContext";

// Pages
import Home from "./pages/Home/Home";
import Services from "./pages/Services/Services";
import Attendance from "./pages/Attendance/Attendance";
import AttendanceTable from "./pages/Attendance/AttendanceTable";
import Registration from "./pages/Registration/Registration";
import RegisteredStudent from "./pages/RegisteredStudent/RegisteredStudent";
import AuthPage from "./pages/Auth/AuthPage";
import PresentToday from "./pages/Attendance/PresentToday";
import MonthlySummary from "./pages/Attendance/MonthlySummary";
import AdminBroadcast from "./pages/Dshboard/AdminBroadcast";
import InformFaculty from "./pages/Attendance/InformFaculty";
import VerifyEmail from "./pages/Auth/VerifyEmail";
import ManageClasses from "./pages/Management/ManageClasses";
import ManageClassArms from "./pages/Management/ManageClassArms";
import ManageFaculty from "./pages/Management/ManageFaculty";
import ManageStaff from "./pages/Management/ManageStaff";
import ManageSessionsTerms from "./pages/Management/ManageSessionsTerms";
import ManageTimetable from "./pages/Management/ManageTimetable";
import ManageTelegramChannels from "./pages/Management/ManageTelegramChannels";
import CommonTelegramChannel from "./pages/Management/CommonTelegramChannel";
import QRAttendance from "./pages/QR/QRAttendance";
import BotRegistration from "./pages/QR/BotRegistration";
import BotLogs from "./pages/Dshboard/BotLogs";
import Analytics from "./pages/Dshboard/Analytics";
import AIAnalysis from "./pages/Dshboard/AIAnalysis";
import TelegramBotAutomation from "./pages/Dshboard/TelegramBotAutomation";
import TelegramBotSetup from "./pages/Dshboard/TelegramBotSetup";
import FaceAttendance from "./pages/Attendance/FaceAttendance";
import FaceRegistration from "./pages/Attendance/FaceRegistration";
import FaceApproval from "./pages/Attendance/FaceApproval";
import GeoAttendance from "./pages/Attendance/GeoAttendance";
import BiometricAttendance from "./pages/Attendance/BiometricAttendance";
import MyHierarchy from "./pages/Students/MyHierarchy";
import AcademicFeedback from "./pages/Feedback/AcademicFeedback";
import SubjectFeedback from "./pages/Feedback/SubjectFeedback";
import SubjectAttendance from "./pages/Attendance/SubjectAttendance";
import HostlerAttendance from "./pages/Attendance/HostlerAttendance";
import LeaveOuting from "./pages/Hostler/LeaveOuting";

// Role-based route access control
const routeAccess = {
  "/": ["admin", "teacher", "staff", "student", "warden"],
  "/services": ["admin", "teacher", "staff", "student", "warden"],
  "/take-attendance": ["admin", "teacher", "staff"],
  "/view-attendance": ["admin", "teacher", "staff", "student", "warden"],
  "/register": ["admin", "teacher", "staff"],
  "/registered-students": ["admin", "teacher", "staff", "student", "warden"],
  "/monthly-summary": ["admin", "teacher", "staff", "student", "warden"],
  "/present-today": ["admin", "teacher", "staff", "warden"],
  "/broadcast": ["admin"],
  "/inform-faculty": ["admin", "teacher", "staff", "student", "warden"],
  "/manage-classes": ["admin"],
  "/manage-class-arms": ["admin"],
  "/manage-faculty": ["admin"],
  "/manage-staff": ["admin"],
  "/manage-timetable": ["admin"],
  "/common-telegram-channel": ["admin", "teacher", "staff", "student", "warden"],
  "/sessions-terms": ["admin"],
  "/telegram-channels": ["admin", "teacher", "staff", "warden"],
  "/qr-attendance": ["admin", "teacher", "staff", "student", "warden"],
  "/bot-registration": ["admin", "teacher", "staff", "student", "warden"],
  "/bot-logs": ["admin"],
  "/analytics": ["admin"],
  "/ai-analysis": ["admin"],
  "/bot-automation": ["admin"],
  "/bot-setup": ["admin", "teacher", "staff", "warden"],
  "/face-attendance": ["admin", "teacher", "staff", "student", "warden"],
  "/face-registration": ["admin", "teacher", "staff", "warden", "student"],
  "/face-approval": ["warden"],
  "/geo-attendance": ["admin", "teacher", "staff", "student", "warden"],
  "/biometric": ["admin", "teacher", "staff", "student", "warden"],
  "/my-hierarchy": ["admin", "teacher", "staff", "student", "warden"],
  "/academic-feedback": ["admin", "teacher", "staff", "student", "warden"],
  "/subject-feedback": ["admin", "teacher", "staff", "student", "warden"],
  "/subject-attendance": ["admin", "teacher", "staff"],
  "/hostler-attendance": ["admin", "teacher", "staff", "warden"],
  "/leave-outing": ["student"],
};

function ProtectedRoute({ user, userRole, children, path }) {
  if (!user) return <Navigate to="/auth" replace />;
  
  // If user has no role, redirect to auth page
  if (!userRole) return <Navigate to="/auth" replace />;
  
  // Check if user has access to this route
  const allowedRoles = routeAccess[path] || ["admin"];
  if (!allowedRoles.includes(userRole)) {
    return (
      <div style={{ textAlign: "center", marginTop: "100px" }}>
        <h2 style={{ color: "#dc2626", fontSize: "24px", marginBottom: "10px" }}>🚫 Access Denied</h2>
        <p style={{ color: "#6b7280", fontSize: "16px" }}>You don't have permission to access this page.</p>
        <p style={{ color: "#6b7280", fontSize: "14px", marginTop: "10px" }}>Your role: <strong>{userRole}</strong></p>
      </div>
    );
  }
  
  return children;
}

const AppContent = () => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { isMiniApp } = useTelegram();
  const isLoggedIn = !!user && !isMiniApp;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Fetch user role from database
        const roleData = await getUserRole(u.uid);
        if (!roleData || !roleData.role) {
          // User has no role - they need to complete registration
          console.log("⚠️ User has no role - waiting for role selection");
          setUser(u); // Keep user object for role selection
          setUserRole(null);
          setLoading(false);
          return; // Don't proceed further
        } else {
          setUser(u);
          setUserRole(roleData.role);
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontSize: "18px", color: "#6d28d9" }}>
        Loading...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppRoutes 
        user={user} 
        userRole={userRole} 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen}
        isLoggedIn={isLoggedIn}
      />
    </BrowserRouter>
  );
};

const AppRoutes = ({ user, userRole, sidebarOpen, setSidebarOpen, isLoggedIn }) => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/auth' || location.pathname === '/verify-email';

  return (
    <>
      {/* Only show navbar/sidebar if user has a role AND not on auth page */}
      {user && userRole && !isAuthPage && (
        <Navbar userEmail={user.email} userRole={userRole} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      )}

      {/* Left sidebar */}
      {user && userRole && !isAuthPage && (
        <Sidebar userRole={userRole} isOpen={sidebarOpen} />
      )}

      {/* Main content */}
      <div style={user && userRole && !isAuthPage
        ? { marginTop: "56px", marginLeft: sidebarOpen ? "230px" : "0", padding: "24px", background: "#f3f4f6", minHeight: "calc(100vh - 56px)", transition: "margin-left 0.3s ease-in-out" }
        : {}
      }>
        <Routes>
          {/* Public */}
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* Protected */}
          <Route path="/" element={<ProtectedRoute user={user} userRole={userRole} path="/"><Home /></ProtectedRoute>} />
          <Route path="/services" element={<ProtectedRoute user={user} userRole={userRole} path="/services"><Services /></ProtectedRoute>} />
          <Route path="/take-attendance" element={<ProtectedRoute user={user} userRole={userRole} path="/take-attendance"><Attendance userRole={userRole} /></ProtectedRoute>} />
          <Route path="/view-attendance" element={<ProtectedRoute user={user} userRole={userRole} path="/view-attendance"><AttendanceTable userEmail={user?.email} userRole={userRole} /></ProtectedRoute>} />
          <Route path="/register" element={<ProtectedRoute user={user} userRole={userRole} path="/register"><Registration /></ProtectedRoute>} />
          <Route path="/registered-students" element={<ProtectedRoute user={user} userRole={userRole} path="/registered-students"><RegisteredStudent userEmail={user?.email} userRole={userRole} /></ProtectedRoute>} />
          <Route path="/monthly-summary" element={<ProtectedRoute user={user} userRole={userRole} path="/monthly-summary"><MonthlySummary userEmail={user?.email} userRole={userRole} /></ProtectedRoute>} />
          <Route path="/present-today" element={<ProtectedRoute user={user} userRole={userRole} path="/present-today"><PresentToday userRole={userRole} /></ProtectedRoute>} />
          <Route path="/broadcast" element={<ProtectedRoute user={user} userRole={userRole} path="/broadcast"><AdminBroadcast /></ProtectedRoute>} />
          <Route path="/inform-faculty" element={<ProtectedRoute user={user} userRole={userRole} path="/inform-faculty"><InformFaculty /></ProtectedRoute>} />
          <Route path="/manage-classes" element={<ProtectedRoute user={user} userRole={userRole} path="/manage-classes"><ManageClasses /></ProtectedRoute>} />
          <Route path="/manage-class-arms" element={<ProtectedRoute user={user} userRole={userRole} path="/manage-class-arms"><ManageClassArms /></ProtectedRoute>} />
          <Route path="/manage-faculty" element={<ProtectedRoute user={user} userRole={userRole} path="/manage-faculty"><ManageFaculty /></ProtectedRoute>} />
          <Route path="/manage-staff" element={<ProtectedRoute user={user} userRole={userRole} path="/manage-staff"><ManageStaff /></ProtectedRoute>} />
          <Route path="/manage-timetable" element={<ProtectedRoute user={user} userRole={userRole} path="/manage-timetable"><ManageTimetable /></ProtectedRoute>} />
          <Route path="/common-telegram-channel" element={<ProtectedRoute user={user} userRole={userRole} path="/common-telegram-channel"><CommonTelegramChannel /></ProtectedRoute>} />
          <Route path="/sessions-terms" element={<ProtectedRoute user={user} userRole={userRole} path="/sessions-terms"><ManageSessionsTerms /></ProtectedRoute>} />
          <Route path="/telegram-channels" element={<ProtectedRoute user={user} userRole={userRole} path="/telegram-channels"><ManageTelegramChannels /></ProtectedRoute>} />
          <Route path="/qr-attendance" element={<ProtectedRoute user={user} userRole={userRole} path="/qr-attendance"><QRAttendance /></ProtectedRoute>} />
          <Route path="/bot-registration" element={<ProtectedRoute user={user} userRole={userRole} path="/bot-registration"><BotRegistration /></ProtectedRoute>} />
          <Route path="/bot-logs"        element={<ProtectedRoute user={user} userRole={userRole} path="/bot-logs"><BotLogs /></ProtectedRoute>} />
          <Route path="/analytics"       element={<ProtectedRoute user={user} userRole={userRole} path="/analytics"><Analytics /></ProtectedRoute>} />
          <Route path="/ai-analysis"     element={<ProtectedRoute user={user} userRole={userRole} path="/ai-analysis"><AIAnalysis /></ProtectedRoute>} />
          <Route path="/bot-automation"  element={<ProtectedRoute user={user} userRole={userRole} path="/bot-automation"><TelegramBotAutomation /></ProtectedRoute>} />
          <Route path="/bot-setup"       element={<ProtectedRoute user={user} userRole={userRole} path="/bot-setup"><TelegramBotSetup /></ProtectedRoute>} />
          <Route path="/face-attendance" element={<ProtectedRoute user={user} userRole={userRole} path="/face-attendance"><FaceAttendance userEmail={user?.email} userRole={userRole} /></ProtectedRoute>} />
          <Route path="/face-registration" element={<ProtectedRoute user={user} userRole={userRole} path="/face-registration"><FaceRegistration userEmail={user?.email} userRole={userRole} /></ProtectedRoute>} />
          <Route path="/face-approval" element={<ProtectedRoute user={user} userRole={userRole} path="/face-approval"><FaceApproval userEmail={user?.email} userRole={userRole} /></ProtectedRoute>} />
          <Route path="/geo-attendance"  element={<ProtectedRoute user={user} userRole={userRole} path="/geo-attendance"><GeoAttendance userEmail={user?.email} userRole={userRole} /></ProtectedRoute>} />
          <Route path="/biometric"       element={<ProtectedRoute user={user} userRole={userRole} path="/biometric"><BiometricAttendance userEmail={user?.email} userRole={userRole} /></ProtectedRoute>} />
          <Route path="/my-hierarchy"    element={<ProtectedRoute user={user} userRole={userRole} path="/my-hierarchy"><MyHierarchy /></ProtectedRoute>} />
          <Route path="/academic-feedback" element={<ProtectedRoute user={user} userRole={userRole} path="/academic-feedback"><AcademicFeedback /></ProtectedRoute>} />
          <Route path="/subject-feedback" element={<ProtectedRoute user={user} userRole={userRole} path="/subject-feedback"><SubjectFeedback /></ProtectedRoute>} />
          <Route path="/subject-attendance" element={<ProtectedRoute user={user} userRole={userRole} path="/subject-attendance"><SubjectAttendance userRole={userRole} /></ProtectedRoute>} />
          <Route path="/hostler-attendance" element={<ProtectedRoute user={user} userRole={userRole} path="/hostler-attendance"><HostlerAttendance userRole={userRole} /></ProtectedRoute>} />
          <Route path="/leave-outing" element={<ProtectedRoute user={user} userRole={userRole} path="/leave-outing"><LeaveOuting /></ProtectedRoute>} />

          <Route path="*" element={<h2 style={{ textAlign: "center", color: "red", marginTop: "80px" }}>404 — Page Not Found</h2>} />
        </Routes>
      </div>

      {/* Background Telegram bot listener */}
      {isLoggedIn && <TelegramBotService />}
    </>
  );
};

export default function App() {
  return (
    <TelegramProvider>
      <AppContent />
    </TelegramProvider>
  );
}
