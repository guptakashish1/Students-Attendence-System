# 📘 Student Attendance System  

A **React + Firebase** based web application for managing student registration and attendance.  
It provides faculty with features like student registration, attendance marking, real-time tracking of present students, and secure authentication.  

🔗 **GitHub Repository:** [https://github.com/guptakashish1/Student-Attendence-App.git](https://github.com/guptakashish1)  

---

## 🚀 Features  

- 🔐 **Authentication** – Login & Signup with Email/Password & Google  
- 🔑 **Password Reset** – Send reset password link to registered email  
- 📝 **Student Registration** – Register and manage students  
- ✅ **Attendance Management** – Mark daily attendance with check-in/out  
- 📊 **Dashboard** – View total students, daily attendance, and present students count  
- 🔄 **Real-time Updates** – Firebase Realtime Database integration  

---

## 🛠️ Tech Stack  

- **Frontend:** React, Redux, Tailwind CSS  
- **Backend:** Firebase Authentication, Firebase Realtime Database  
 
---

## 📂 Project Structure  

src/
│── components/ # Navbar, buttons, etc.
│── pages/ # App pages (Auth, Services, Attendance, etc.)
│── store/ # Redux store & slices
│── firebase.js # Firebase configuration & helpers
│── App.js # Main app routes


---

## ⚡ Getting Started  

 1. Clone the Repository  

```bash
git clone https://github.com/guptakashish1/student-attendance-system.git
cd student-attendance-system

2. Install Dependencies
npm install

3. Setup Firebase

Go to Firebase Console
Create a new project
Enable Authentication → Email/Password + Google
Enable Realtime Database
Copy Firebase config and replace inside src/firebase.js

👉 Open http://localhost:3000 
 in your browser.

4.  📸 Screenshots
 🔑 Faculty Login
