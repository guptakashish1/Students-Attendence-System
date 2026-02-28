// src/pages/Auth/VerifyEmail.jsx
import React, { useEffect, useState } from "react";
import { auth } from "../../firebase";
import { sendEmailVerification } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const VerifyEmail = () => {
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const checkVerification = async () => {
      const user = auth.currentUser;
      if (user) {
        await user.reload();
        if (user.emailVerified) {
          navigate("/");
        }
      }
    };

    const interval = setInterval(checkVerification, 4000);
    return () => clearInterval(interval);
  }, [navigate]);

  const handleResend = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        await sendEmailVerification(user);
        setMessage("📩 Verification email sent again!");
      }
    } catch (err) {
      setMessage("❌ Error: " + err.message);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="bg-white shadow-lg p-8 rounded-lg w-96 text-center">
        <h2 className="text-2xl font-bold mb-4 text-purple-600">
          Verify Your Email
        </h2>
        <p className="mb-6 text-gray-700">
          We’ve sent a verification link to your email. Please verify to continue.
        </p>
        <button
          onClick={handleResend}
          className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 transition"
        >
          Resend Verification Email
        </button>
        {message && <p className="mt-4 text-sm text-gray-600">{message}</p>}
      </div>
    </div>
  );
};

export default VerifyEmail;
