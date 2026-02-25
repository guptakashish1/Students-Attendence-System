import React, { createContext, useContext, useEffect, useState } from "react";
import { verifyTelegramInitData } from "../firebase";

const TelegramContext = createContext({
  webApp      : null,
  isMiniApp   : false,
  isVerified  : false, // true when initData signature passes HMAC-SHA-256 check
});

export const useTelegram = () => useContext(TelegramContext);

export const TelegramProvider = ({ children }) => {
  const [webApp,     setWebApp]     = useState(null);
  const [isMiniApp,  setIsMiniApp]  = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;

    // Only activate Mini App mode when actually launched inside Telegram
    // (initData is non-empty only when opened from a real Telegram bot button)
    if (tg && tg.initData && tg.initData.length > 0) {
      tg.ready();
      tg.expand();

      // Apply Telegram theme CSS variables
      document.documentElement.style.setProperty("--tg-theme-bg-color",          tg.backgroundColor  || "#ffffff");
      document.documentElement.style.setProperty("--tg-theme-text-color",        tg.textColor        || "#000000");
      document.documentElement.style.setProperty("--tg-theme-button-color",      tg.buttonColor      || "#2481cc");
      document.documentElement.style.setProperty("--tg-theme-button-text-color", tg.buttonTextColor  || "#ffffff");

      setWebApp(tg);
      setIsMiniApp(true);

      // 🔐 Verify initData signature (HMAC-SHA-256)
      verifyTelegramInitData(tg.initData)
        .then((valid) => {
          setIsVerified(valid);
          if (!valid) {
            console.warn("[TelegramContext] ⚠️  initData verification FAILED. Request may be spoofed.");
          } else {
            console.info("[TelegramContext] ✅ initData verified successfully.");
          }
        })
        .catch(() => setIsVerified(false));
    }
    // In regular browser: isMiniApp stays false → full layout with navbar shows
  }, []);

  return (
    <TelegramContext.Provider value={{ webApp, isMiniApp, isVerified }}>
      {children}
    </TelegramContext.Provider>
  );
};
