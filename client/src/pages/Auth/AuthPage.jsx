// src/pages/Auth/AuthPage.jsx
import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { auth, saveUserRole, getUserRole, sendLoginOTPEmail } from "../../firebase";
import { useNavigate } from "react-router-dom";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin", icon: "👨‍💼" },
  { value: "teacher", label: "Teacher", icon: "👨‍🏫" },
  { value: "student", label: "Student", icon: "🎓" },
  { value: "staff", label: "Staff", icon: "👷" },
  { value: "warden", label: "Warden", icon: "🏛️" },
];

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);

  // OTP state
  const [otpStep, setOtpStep] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpExpiry, setOtpExpiry] = useState(null);
  const [otpInput, setOtpInput] = useState("");
  const [otpError, setOtpError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const navigate = useNavigate();

  // Check if current user needs to select a role
  React.useEffect(() => {
    const checkUserRole = async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const roleData = await getUserRole(currentUser.uid);
        if (!roleData || !roleData.role) {
          // User is authenticated but has no role - show modal
          console.log("📝 Authenticated user without role detected");
          setPendingGoogleUser(currentUser);
          setShowRoleModal(true);
        }
      }
    };
    checkUserRole();
  }, []);

  // Prevent navigation away from auth page when role modal is open
  React.useEffect(() => {
    if (showRoleModal) {
      // Block navigation
      const handleBeforeUnload = (e) => {
        e.preventDefault();
        e.returnValue = '';
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [showRoleModal]);

  // 🔹 Register
  const handleRegister = async () => {
    setError("");
    if (!name || !email || !password || !role) {
      setError("Please fill in all fields");
      return;
    }
    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    
    setLoading(true);
    try {
      console.log("📝 Registering user:", email, "Name:", name, "Role:", role);
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      console.log("✅ User created:", userCred.user.uid);
      
      // Update user profile with name
      await updateProfile(userCred.user, {
        displayName: name
      });
      console.log("✅ Profile updated with name:", name);
      
      // Save user role to database
      await saveUserRole(userCred.user.uid, {
        email: email,
        name: name,
        role: role,
        createdAt: new Date().toISOString()
      });
      console.log("✅ User role saved:", role);
      
      await sendEmailVerification(userCred.user);
      console.log("📧 Verification email sent");
      alert(`✅ Welcome ${name}! Registered as ${role}. Please check your email for verification link.`);
      navigate("/verify-email");
    } catch (err) {
      console.error("❌ Registration error:", err);
      console.error("Error code:", err.code);
      console.error("Error message:", err.message);
      
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please login instead.");
      } else if (err.code === "auth/invalid-email") {
        setError("Invalid email address format");
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak. Use at least 6 characters.");
      } else if (err.code === "auth/invalid-login-credentials") {
        setError("Registration failed. Please check your email format and try again.");
      } else if (err.code === "auth/operation-not-allowed") {
        setError("Email/password registration is not enabled. Please contact admin.");
      } else {
        setError("Registration failed: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Step 1 – Send OTP to email
  const handleSendOTP = async () => {
    setError("");
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    setLoading(true);
    try {
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      await sendLoginOTPEmail(email, otp);
      setGeneratedOtp(otp);
      setOtpExpiry(Date.now() + 5 * 60 * 1000); // 5 minutes
      setOtpInput("");
      setOtpError("");
      setOtpStep(true);
      startResendCooldown();
    } catch (err) {
      console.error("❌ OTP send error:", err);
      setError("Failed to send OTP. Check your EmailJS configuration.");
    } finally {
      setLoading(false);
    }
  };

  // Resend cooldown timer (60 s)
  const startResendCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // 🔹 Step 2 – Verify OTP then sign in
  const handleVerifyOTP = async () => {
    setOtpError("");
    if (!otpInput) { setOtpError("Please enter the OTP"); return; }
    if (Date.now() > otpExpiry) { setOtpError("OTP expired. Please resend."); return; }
    if (otpInput.trim() !== generatedOtp) { setOtpError("Incorrect OTP. Try again."); return; }

    setLoading(true);
    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      console.log("✅ Login successful:", userCred.user.uid);
      navigate("/");
    } catch (err) {
      console.error("❌ Login error:", err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        setOtpError("Invalid email or password. Please go back and try again.");
      } else {
        setOtpError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = () => {
    if (resendCooldown > 0) return;
    setOtpStep(false);
    setGeneratedOtp("");
    setOtpInput("");
    setOtpError("");
  };

  // 🔹 Google Login
  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      console.log("🔐 Signing in with Google...");
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      console.log("✅ Google sign-in successful:", result.user.email);
      
      // Check if user role exists in database
      const roleData = await getUserRole(result.user.uid);
      
      if (!roleData || !roleData.role) {
        // New user - need to select role
        console.log("📝 New Google user - showing role selection");
        setPendingGoogleUser(result.user);
        setShowRoleModal(true);
        setRole("student"); // Reset to default
        setLoading(false); // Stop loading to allow role selection
      } else {
        console.log("✅ Existing user with role:", roleData.role);
        navigate("/");
      }
    } catch (err) {
      console.error("❌ Google sign-in error:", err);
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-in cancelled. Please try again.");
      } else if (err.code === "auth/popup-blocked") {
        setError("Popup blocked. Please allow popups for this site.");
      } else {
        setError("Google sign-in failed: " + err.message);
      }
      setLoading(false);
    }
  };

  // 🔹 Complete Google Registration with Role
  const handleCompleteGoogleRegistration = async () => {
    if (!pendingGoogleUser || !role) return;
    
    setLoading(true);
    setError(""); // Clear any previous errors
    try {
      console.log("💾 Saving role for Google user:", pendingGoogleUser.email, "Role:", role);
      await saveUserRole(pendingGoogleUser.uid, {
        email: pendingGoogleUser.email,
        name: pendingGoogleUser.displayName || "User",
        role: role,
        createdAt: new Date().toISOString()
      });
      console.log("✅ Role saved for new Google user:", role);
      setShowRoleModal(false);
      setPendingGoogleUser(null);
      
      // Force reload to trigger auth state change with new role
      window.location.href = "/";
    } catch (err) {
      console.error("❌ Error saving role:", err);
      setError("Failed to save role: " + err.message);
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLogin) {
      handleSendOTP();
    } else {
      handleRegister();
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-purple-100 to-blue-100">
      <div className="bg-white shadow-2xl p-8 rounded-2xl w-full max-w-md">

        {/* ── OTP Step ── */}
        {otpStep ? (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-block p-3 bg-purple-100 rounded-full mb-3">
                <span className="text-4xl">📧</span>
              </div>
              <h2 className="text-2xl font-bold text-purple-600">Check your email</h2>
              <p className="text-gray-500 text-sm mt-2">
                We sent a 6-digit OTP to <span className="font-semibold text-gray-700">{email}</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">Valid for 5 minutes</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enter OTP</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit code"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-center text-2xl tracking-widest font-mono"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                disabled={loading}
                autoFocus
              />
            </div>

            {otpError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm font-medium">❌ {otpError}</p>
              </div>
            )}

            <button
              onClick={handleVerifyOTP}
              disabled={loading || otpInput.length !== 6}
              className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? "Verifying..." : "✅ Verify & Login"}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                onClick={() => { setOtpStep(false); setOtpError(""); setOtpInput(""); }}
                className="text-gray-500 hover:text-gray-700"
                disabled={loading}
              >
                ← Back
              </button>
              <button
                onClick={handleResendOTP}
                disabled={resendCooldown > 0 || loading}
                className="text-purple-600 hover:text-purple-700 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
              </button>
            </div>
          </div>
        ) : (
        <>
        <div className="text-center mb-6">
          <div className="inline-block p-3 bg-purple-100 rounded-full mb-3">
            <span className="text-4xl">🎓</span>
          </div>
          <h2 className="text-3xl font-bold text-purple-600">
            {isLogin ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="text-gray-500 text-sm mt-2">
            {isLogin ? "Sign in to continue" : "Register to get started"}
          </p>

          {/* Mode indicator */}
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
            style={{ background: isLogin ? "#dbeafe" : "#fef3c7", color: isLogin ? "#1e40af" : "#92400e" }}>
            {isLogin ? "🔐 Login Mode" : "📝 Registration Mode"}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                placeholder="Enter your full name"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                required={!isLogin}
                minLength={2}
              />
            </div>
          )}

          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">I am a</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={loading}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition bg-white"
                required
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.icon} {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Select your role - this cannot be changed later</p>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                className="w-full p-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {!isLogin && (
              <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "Please wait..." : (isLogin ? "📨 Send OTP" : "📝 Register")}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or continue with</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div className="text-center mt-6">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
              setName("");
              setRole("student");
            }}
            className="text-purple-600 hover:text-purple-700 font-medium text-sm"
            disabled={loading}
          >
            {isLogin
              ? "Don't have an account? Register here"
              : "Already have an account? Login here"}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm font-medium">❌ {error}</p>
          </div>
        )}
        </>
        )}
      </div>

      {/* Role Selection Modal for Google Sign-in */}
      {showRoleModal && pendingGoogleUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-fadeIn">
            <div className="text-center mb-6">
              <div className="inline-block p-3 bg-purple-100 rounded-full mb-3">
                <span className="text-4xl">👋</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Welcome!</h3>
              <p className="text-gray-600 text-sm">
                Please select your role to complete registration
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {ROLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setRole(option.value)}
                  className={`w-full p-4 rounded-lg border-2 transition text-left flex items-center gap-3 ${
                    role === option.value
                      ? "border-purple-600 bg-purple-50"
                      : "border-gray-300 bg-white hover:border-purple-300"
                  }`}
                >
                  <span className="text-3xl">{option.icon}</span>
                  <div>
                    <div className="font-bold text-gray-800">{option.label}</div>
                    <div className="text-xs text-gray-500">
                      {option.value === "admin" && "Full system access and management"}
                      {option.value === "teacher" && "Manage classes and attendance"}
                      {option.value === "student" && "View your attendance and profile"}
                      {option.value === "staff" && "Support and administrative tasks"}
                      {option.value === "warden" && "Manage hostels and approve face registrations"}
                    </div>
                  </div>
                  {role === option.value && (
                    <span className="ml-auto text-purple-600 text-xl">✓</span>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={handleCompleteGoogleRegistration}
              disabled={loading}
              className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? "Saving..." : "Continue as " + role.charAt(0).toUpperCase() + role.slice(1)}
            </button>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm font-medium">❌ {error}</p>
              </div>
            )}

            <p className="text-xs text-gray-500 text-center mt-4">
              ⚠️ This role cannot be changed later
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthPage;
