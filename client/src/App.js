// src/App.js
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

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
import QRAttendance from "./pages/QR/QRAttendance";
import BotRegistration from "./pages/QR/BotRegistration";
import BotLogs from "./pages/Dshboard/BotLogs";

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

const AppContent = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isMiniApp } = useTelegram();
  const isLoggedIn = !!user && !isMiniApp;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
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
      {/* Top blue header — visible when logged in */}
      {user && <Navbar userEmail={user.email} />}

      {/* Left sidebar — inside BrowserRouter for useLocation */}
      {user && <Sidebar />}

      {/* Main content — offset with simple margins */}
      <div style={user
        ? { marginTop: "56px", marginLeft: "230px", padding: "24px", background: "#f3f4f6", minHeight: "calc(100vh - 56px)" }
        : {}
      }>
        <Routes>
          {/* Public */}
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* Protected */}
          <Route path="/" element={<ProtectedRoute user={user}><Home /></ProtectedRoute>} />
          <Route path="/services" element={<ProtectedRoute user={user}><Services /></ProtectedRoute>} />
          <Route path="/take-attendance" element={<ProtectedRoute user={user}><Attendance /></ProtectedRoute>} />
          <Route path="/view-attendance" element={<ProtectedRoute user={user}><AttendanceTable /></ProtectedRoute>} />
          <Route path="/register" element={<ProtectedRoute user={user}><Registration /></ProtectedRoute>} />
          <Route path="/registered-students" element={<ProtectedRoute user={user}><RegisteredStudent /></ProtectedRoute>} />
          <Route path="/monthly-summary" element={<ProtectedRoute user={user}><MonthlySummary /></ProtectedRoute>} />
          <Route path="/present-today" element={<ProtectedRoute user={user}><PresentToday /></ProtectedRoute>} />
          <Route path="/broadcast" element={<ProtectedRoute user={user}><AdminBroadcast /></ProtectedRoute>} />
          <Route path="/inform-faculty" element={<ProtectedRoute user={user}><InformFaculty /></ProtectedRoute>} />
          <Route path="/manage-classes" element={<ProtectedRoute user={user}><ManageClasses /></ProtectedRoute>} />
          <Route path="/manage-class-arms" element={<ProtectedRoute user={user}><ManageClassArms /></ProtectedRoute>} />
          <Route path="/manage-faculty" element={<ProtectedRoute user={user}><ManageFaculty /></ProtectedRoute>} />
          <Route path="/manage-staff" element={<ProtectedRoute user={user}><ManageStaff /></ProtectedRoute>} />
          <Route path="/sessions-terms" element={<ProtectedRoute user={user}><ManageSessionsTerms /></ProtectedRoute>} />
          <Route path="/qr-attendance" element={<ProtectedRoute user={user}><QRAttendance /></ProtectedRoute>} />
          <Route path="/bot-registration" element={<ProtectedRoute user={user}><BotRegistration /></ProtectedRoute>} />
          <Route path="/bot-logs" element={<ProtectedRoute user={user}><BotLogs /></ProtectedRoute>} />

          <Route path="*" element={<h2 style={{ textAlign: "center", color: "red", marginTop: "80px" }}>404 — Page Not Found</h2>} />
        </Routes>
      </div>

      {/* Background Telegram bot listener */}
      {isLoggedIn && <TelegramBotService />}
    </BrowserRouter>
  );
};

export default function App() {
  return (
    <TelegramProvider>
      <AppContent />
    </TelegramProvider>
  );
}
