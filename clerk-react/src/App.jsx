// App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import {
  SignUp, SignIn,
  SignedIn, SignedOut,
  ClerkLoaded, ClerkLoading
} from "@clerk/clerk-react";
import Dashboard from "./components/Dashboard";

const Center = ({ children }) => (
  <div
    style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      boxSizing: "border-box",
    }}
  >
    {children}
  </div>
);

export default function App() {
  return (
    <Routes>
      
      <Route
        path="/"
        element={
          <>
            <ClerkLoading>
              <div style={{ padding: 24 }}>Loading auth…</div>
            </ClerkLoading>

            <ClerkLoaded>
              <SignedOut>
                <Center>
                  <SignUp routing="path" path="/" />
                </Center>
              </SignedOut>
              <SignedIn>
                <Navigate to="/dashboard" replace />
              </SignedIn>
            </ClerkLoaded>
          </>
        }
      />

      <Route
        path="/login"
        element={
          <Center>
            <SignIn routing="path" path="/login" />
          </Center>
        }
      />

      <Route
        path="/dashboard"
        element={
          <>
            <ClerkLoading><div style={{ padding: 24 }}>Loading…</div></ClerkLoading>
            <ClerkLoaded>
              <SignedIn><Dashboard /></SignedIn>
              <SignedOut><Navigate to="/" replace /></SignedOut>
            </ClerkLoaded>
          </>
        }
      />
    </Routes>
  );
}
