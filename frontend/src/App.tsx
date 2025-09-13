// /frontend/src/App.tsx

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";

import Navbar from "./components/Navbar";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import DashboardPage from "./pages/DashboardPage";
import YachtDetailsPage from "./pages/YachtDetailsPage";
import YachtEditPage from "./pages/YachtEditPage";
import PricingPage from "./pages/PricingPage";
import OrganizationPage from "./pages/OrganizationPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";

import { useWhoami } from "./hooks/useWhoami";

// 🔐 Guard для ADMIN
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { whoami, loading } = useWhoami();
  if (loading) return <div className="p-6">Loading…</div>;
  if (whoami?.role === "ADMIN") return <>{children}</>;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />

        <Route
          path="/dashboard"
          element={
            <>
              <SignedIn><DashboardPage /></SignedIn>
              <SignedOut><RedirectToSignIn /></SignedOut>
            </>
          }
        />

        <Route
          path="/yacht/:id"
          element={
            <>
              <SignedIn><YachtDetailsPage /></SignedIn>
              <SignedOut><RedirectToSignIn /></SignedOut>
            </>
          }
        />

        <Route
          path="/yacht/:id/edit"
          element={
            <>
              <SignedIn><YachtEditPage /></SignedIn>
              <SignedOut><RedirectToSignIn /></SignedOut>
            </>
          }
        />

        <Route
          path="/yacht/new"
          element={
            <>
              <SignedIn><YachtEditPage /></SignedIn>
              <SignedOut><RedirectToSignIn /></SignedOut>
            </>
          }
        />

        <Route
          path="/pricing"
          element={
            <>
              <SignedIn><PricingPage /></SignedIn>
              <SignedOut><RedirectToSignIn /></SignedOut>
            </>
          }
        />

        {/* 🎯 раньше было публично — делаем приватным */}
        <Route
          path="/organization"
          element={
            <>
              <SignedIn><OrganizationPage /></SignedIn>
              <SignedOut><RedirectToSignIn /></SignedOut>
            </>
          }
        />

        {/* 🔐 Админка */}
        <Route
          path="/admin/users"
          element={
            <>
              <SignedIn>
                <RequireAdmin>
                  <AdminUsersPage />
                </RequireAdmin>
              </SignedIn>
              <SignedOut><RedirectToSignIn /></SignedOut>
            </>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}