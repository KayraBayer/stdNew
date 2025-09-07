import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./pages/context/authContext";
import Login from "./pages/login";
import AdminDashboard from "./pages/adminDashboard";
import UserDashboard from "./pages/userDashboard";
import RequireAuth from "./pages/context/requireAuth";
import OptikForm from "./pages/components/optikForm";
import AdminStudentReports from "./pages/adminStudentReports";
import AdminAssignTests from "./pages/adminAssignTests";
import SolvedTests from "./pages/SolvedTests";

export default function App(): React.ReactElement {
  return (
    <AuthProvider>
      <BrowserRouter>
        <main className="min-h-screen bg-[#0d0d0d]">
          <Suspense fallback={null}>
            <Routes>
              <Route path="/admin/students" element={<AdminStudentReports />} />
              <Route path="/admin/assign" element={<AdminAssignTests />} />
              <Route path="/" element={<Login />} />
              <Route
                path="/admin"
                element={
                  <RequireAuth role="admin">
                    <AdminDashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <RequireAuth role="user">
                    <UserDashboard />
                  </RequireAuth>
                }
              />
              <Route path="/cozdugum-testler" element={<SolvedTests />} />
              <Route path="/optik" element={<OptikForm />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}
