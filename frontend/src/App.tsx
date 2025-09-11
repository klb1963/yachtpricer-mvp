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
import "./App.css";

function App() {
  const { whoami, loading } = useWhoami();

  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />

        <Route
          path="/dashboard"
          element={
            <>
              <SignedIn>
                <DashboardPage />
              </SignedIn>
              <SignedOut>
                <RedirectToSignIn />
              </SignedOut>
            </>
          }
        />

        <Route
          path="/yacht/:id"
          element={
            <>
              <SignedIn>
                <YachtDetailsPage />
              </SignedIn>
              <SignedOut>
                <RedirectToSignIn />
              </SignedOut>
            </>
          }
        />

        <Route
          path="/yacht/:id/edit"
          element={
            <>
              <SignedIn>
                <YachtEditPage />
              </SignedIn>
              <SignedOut>
                <RedirectToSignIn />
              </SignedOut>
            </>
          }
        />

        <Route
          path="/yacht/new"
          element={
            <>
              <SignedIn>
                <YachtEditPage />
              </SignedIn>
              <SignedOut>
                <RedirectToSignIn />
              </SignedOut>
            </>
          }
        />

        <Route
          path="/pricing"
          element={
            <>
              <SignedIn>
                <PricingPage />
              </SignedIn>
              <SignedOut>
                <RedirectToSignIn />
              </SignedOut>
            </>
          }
        />

        <Route path="/organization" element={<OrganizationPage />} />

        {/* 🔐 Админка Users */}
        <Route
          path="/admin/users"
          element={!loading && whoami?.role === "ADMIN"
            ? <AdminUsersPage />
            : <Navigate to="/dashboard" replace />
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;

