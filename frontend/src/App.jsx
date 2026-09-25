import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./context/AuthContext";
import { TourProvider } from "./context/TourContext";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Spotlight from "./components/Spotlight";
import BottomNav from "./components/BottomNav";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Upload from "./pages/Upload";
import Results from "./pages/Results";
import Dashboard from "./pages/Dashboard";
import Review from "./pages/Review";
import Combine from "./pages/Combine";
import SharedNote from "./pages/SharedNote";
import Planner from "./pages/Planner";

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
      <BrowserRouter>
        <TourProvider>
          <Toaster position="top-center" toastOptions={{ style: { fontWeight: 700 } }} />
          <Spotlight />
          <BottomNav />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/shared/:noteId" element={<SharedNote />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/upload"
              element={
                <ProtectedRoute>
                  <Upload />
                </ProtectedRoute>
              }
            />
            <Route
              path="/results"
              element={
                <ProtectedRoute>
                  <Results />
                </ProtectedRoute>
              }
            />
            <Route
              path="/review"
              element={
                <ProtectedRoute>
                  <Review />
                </ProtectedRoute>
              }
            />
            <Route
              path="/combine"
              element={
                <ProtectedRoute>
                  <Combine />
                </ProtectedRoute>
              }
            />
            <Route
              path="/planner"
              element={
                <ProtectedRoute>
                  <Planner />
                </ProtectedRoute>
              }
            />
          </Routes>
        </TourProvider>
      </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}
