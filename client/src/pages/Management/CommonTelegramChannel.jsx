import React, { useState } from "react";

const CommonTelegramChannel = () => {
  const telegramLink = "https://t.me/+YWx4RCBSb4I4NGI1";
  
  // Using Google Charts API for QR code generation (no package needed)
  const qrCodeUrl = `https://chart.googleapis.com/chart?cht=qr&chl=${encodeURIComponent(telegramLink)}&chs=300x300&choe=UTF-8`;

  const downloadQRCode = async () => {
    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Common_Telegram_Channel_QR.png";
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading QR code:", error);
      alert("❌ Error downloading QR code. Please try again.");
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(telegramLink);
    alert("✅ Link copied to clipboard!");
  };

  const printQRCode = () => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Common Telegram Channel QR Code</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: Arial, sans-serif;
              padding: 20px;
            }
            .container {
              text-align: center;
              border: 3px solid #6d28d9;
              padding: 30px;
              border-radius: 20px;
              background: white;
            }
            h1 {
              color: #6d28d9;
              margin-bottom: 10px;
              font-size: 28px;
            }
            .subtitle {
              color: #666;
              margin-bottom: 20px;
              font-size: 16px;
            }
            img {
              margin: 20px 0;
              border: 2px solid #e5e7eb;
              border-radius: 10px;
              padding: 10px;
            }
            .link {
              color: #6d28d9;
              font-weight: bold;
              word-break: break-all;
              margin-top: 15px;
              font-size: 14px;
            }
            .instructions {
              margin-top: 20px;
              padding: 15px;
              background: #f3f0ff;
              border-radius: 10px;
              text-align: left;
              max-width: 400px;
            }
            .instructions h3 {
              color: #6d28d9;
              margin-top: 0;
              font-size: 18px;
            }
            .instructions ol {
              margin: 10px 0;
              padding-left: 20px;
            }
            .instructions li {
              margin: 8px 0;
              font-size: 14px;
            }
            @media print {
              body {
                background: white;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>📢 Join Our Common Telegram Channel</h1>
            <p class="subtitle">Scan this QR code to join</p>
            <img src="${qrCodeUrl}" alt="QR Code" />
            <div class="link">${telegramLink}</div>
            <div class="instructions">
              <h3>How to Join:</h3>
              <ol>
                <li>Open Telegram app on your phone</li>
                <li>Tap the scan icon (📷) in the search bar</li>
                <li>Scan this QR code</li>
                <li>Tap "Join Channel"</li>
              </ol>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "24px", fontWeight: 800, color: "#111827", marginBottom: "4px" }}>
          📢 Common Telegram Channel
        </h2>
        <p style={{ color: "#9ca3af", fontSize: "13px" }}>
          QR code for all students to join the common Telegram channel
        </p>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: "24px"
      }}>
        {/* QR Code Card */}
        <div style={{
          background: "#fff",
          borderRadius: "16px",
          padding: "32px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          textAlign: "center",
          border: "3px solid #6d28d9"
        }}>
          <h3 style={{
            fontSize: "20px",
            fontWeight: 700,
            color: "#6d28d9",
            marginBottom: "8px"
          }}>
            Scan to Join
          </h3>
          <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "24px" }}>
            Use Telegram app to scan this QR code
          </p>

          {qrCodeUrl && (
            <div style={{
              display: "inline-block",
              padding: "20px",
              background: "#f9fafb",
              borderRadius: "12px",
              marginBottom: "20px"
            }}>
              <img
                src={qrCodeUrl}
                alt="Telegram Channel QR Code"
                style={{
                  width: "300px",
                  height: "300px",
                  display: "block"
                }}
              />
            </div>
          )}

          <div style={{
            background: "#f3f0ff",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "20px",
            wordBreak: "break-all"
          }}>
            <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>
              Channel Link:
            </div>
            <a
              href={telegramLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#6d28d9",
                fontWeight: 600,
                fontSize: "13px",
                textDecoration: "none"
              }}
            >
              {telegramLink}
            </a>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button
              onClick={downloadQRCode}
              style={{
                background: "#6d28d9",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "12px 20px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px"
              }}
            >
              📥 Download QR Code
            </button>

            <button
              onClick={printQRCode}
              style={{
                background: "#10b981",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "12px 20px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px"
              }}
            >
              🖨️ Print QR Code
            </button>

            <button
              onClick={copyLink}
              style={{
                background: "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "12px 20px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px"
              }}
            >
              📋 Copy Link
            </button>

            <a
              href={telegramLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "#0088cc",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "12px 20px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                textDecoration: "none"
              }}
            >
              ✈️ Open in Telegram
            </a>
          </div>
        </div>

        {/* Instructions Card */}
        <div style={{
          background: "#fff",
          borderRadius: "16px",
          padding: "32px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
        }}>
          <h3 style={{
            fontSize: "18px",
            fontWeight: 700,
            color: "#111827",
            marginBottom: "16px"
          }}>
            📱 How to Join
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{
              display: "flex",
              gap: "12px",
              padding: "12px",
              background: "#f9fafb",
              borderRadius: "8px"
            }}>
              <div style={{
                background: "#6d28d9",
                color: "#fff",
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: 700,
                flexShrink: 0
              }}>
                1
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: "4px", fontSize: "14px" }}>
                  Open Telegram App
                </div>
                <div style={{ fontSize: "13px", color: "#6b7280" }}>
                  Launch the Telegram application on your mobile device
                </div>
              </div>
            </div>

            <div style={{
              display: "flex",
              gap: "12px",
              padding: "12px",
              background: "#f9fafb",
              borderRadius: "8px"
            }}>
              <div style={{
                background: "#6d28d9",
                color: "#fff",
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: 700,
                flexShrink: 0
              }}>
                2
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: "4px", fontSize: "14px" }}>
                  Tap Scan Icon
                </div>
                <div style={{ fontSize: "13px", color: "#6b7280" }}>
                  Find and tap the QR code scanner icon (📷) in the search bar
                </div>
              </div>
            </div>

            <div style={{
              display: "flex",
              gap: "12px",
              padding: "12px",
              background: "#f9fafb",
              borderRadius: "8px"
            }}>
              <div style={{
                background: "#6d28d9",
                color: "#fff",
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: 700,
                flexShrink: 0
              }}>
                3
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: "4px", fontSize: "14px" }}>
                  Scan QR Code
                </div>
                <div style={{ fontSize: "13px", color: "#6b7280" }}>
                  Point your camera at the QR code displayed above
                </div>
              </div>
            </div>

            <div style={{
              display: "flex",
              gap: "12px",
              padding: "12px",
              background: "#f9fafb",
              borderRadius: "8px"
            }}>
              <div style={{
                background: "#6d28d9",
                color: "#fff",
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: 700,
                flexShrink: 0
              }}>
                4
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: "4px", fontSize: "14px" }}>
                  Join Channel
                </div>
                <div style={{ fontSize: "13px", color: "#6b7280" }}>
                  Tap "Join Channel" button to complete the process
                </div>
              </div>
            </div>
          </div>

          <div style={{
            marginTop: "24px",
            padding: "16px",
            background: "#fef3c7",
            borderRadius: "8px",
            border: "1px solid #fbbf24"
          }}>
            <div style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#92400e",
              marginBottom: "8px"
            }}>
              ℹ️ Note for Students
            </div>
            <div style={{ fontSize: "13px", color: "#92400e" }}>
              This is a common channel for all classes. You'll receive important announcements, updates, and information about school activities.
            </div>
          </div>

          <div style={{
            marginTop: "16px",
            padding: "16px",
            background: "#dbeafe",
            borderRadius: "8px",
            border: "1px solid #3b82f6"
          }}>
            <div style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#1e40af",
              marginBottom: "8px"
            }}>
              💡 Alternative Method
            </div>
            <div style={{ fontSize: "13px", color: "#1e40af" }}>
              You can also click the "Copy Link" button above and paste it directly in Telegram to join the channel.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommonTelegramChannel;
