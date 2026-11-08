import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ScrollToTop from "./components/ScrollToTop";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import RouteFallback from "./components/RouteFallback";
import { AuthProvider } from "./context/AuthContext";
import { AdminAuthProvider } from "./admin/AdminAuthContext";
import AdminProtectedRoute from "./admin/AdminProtectedRoute";
import AdminSuperRoute from "./admin/AdminSuperRoute";
import Home from "./pages/Home";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import LoginSelect from "./pages/LoginSelect";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AdminLogin from "./admin/pages/AdminLogin";
import AdminForgotPassword from "./admin/pages/AdminForgotPassword";
import AdminResetPassword from "./admin/pages/AdminResetPassword";
import AdminAcceptInvite from "./admin/pages/AdminAcceptInvite";
import "./App.css";
import "./admin/admin.css";

const AdminLayout = lazy(() => import("./admin/AdminLayout"));
const AdminOverview = lazy(() => import("./admin/pages/AdminOverview"));
const AdminStudents = lazy(() => import("./admin/pages/AdminStudents"));
const AdminStudentDetail = lazy(() => import("./admin/pages/AdminStudentDetail"));
const AdminCourses = lazy(() => import("./admin/pages/AdminCourses"));
const AdminNotes = lazy(() => import("./admin/pages/AdminNotes"));
const AdminPastQuestions = lazy(() => import("./admin/pages/AdminPastQuestions"));
const AdminSubmissions = lazy(() => import("./admin/pages/AdminSubmissions"));
const AdminMaterials = lazy(() => import("./admin/pages/AdminMaterials"));
const AdminActivity = lazy(() => import("./admin/pages/AdminActivity"));
const AdminDataManagement = lazy(() => import("./admin/pages/AdminDataManagement"));
const AdminAdministrators = lazy(() => import("./admin/pages/AdminAdministrators"));
const AdminProfile = lazy(() => import("./admin/pages/AdminProfile"));
const AdminCommunity = lazy(() => import("./admin/pages/AdminCommunity"));

const DashboardLayout = lazy(() => import("./dashboard/DashboardLayout"));
const DashboardEntry = lazy(() => import("./dashboard/DashboardEntry"));
const LevelGate = lazy(() => import("./dashboard/LevelGate"));
const Overview = lazy(() => import("./dashboard/pages/Overview"));
const Courses = lazy(() => import("./dashboard/pages/Courses"));
const CourseDetail = lazy(() => import("./dashboard/pages/CourseDetail"));
const Notes = lazy(() => import("./dashboard/pages/Notes"));
const PastQuestions = lazy(() => import("./dashboard/pages/PastQuestions"));
const Quizzes = lazy(() => import("./dashboard/pages/Quizzes"));
const AIAssistant = lazy(() => import("./dashboard/pages/AIAssistant"));
const Progress = lazy(() => import("./dashboard/pages/Progress"));
const Profile = lazy(() => import("./dashboard/pages/Profile"));
const Community = lazy(() => import("./dashboard/pages/Community"));
const Support = lazy(() => import("./dashboard/pages/Support"));

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AdminAuthProvider>
          <BrowserRouter>
            <ScrollToTop />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/signin" element={<LoginSelect />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />
                <Route path="/admin/reset-password" element={<AdminResetPassword />} />
                <Route path="/admin/accept-invite" element={<AdminAcceptInvite />} />
                <Route
                  path="/admin"
                  element={
                    <AdminProtectedRoute>
                      <AdminLayout />
                    </AdminProtectedRoute>
                  }
                >
                  <Route index element={<AdminOverview />} />
                  <Route path="students" element={<AdminStudents />} />
                  <Route path="students/:id" element={<AdminStudentDetail />} />
                  <Route path="courses" element={<AdminCourses />} />
                  <Route path="notes" element={<AdminNotes />} />
                  <Route path="past-questions" element={<AdminPastQuestions />} />
                  <Route path="submissions" element={<AdminSubmissions />} />
                  <Route path="materials" element={<AdminMaterials />} />
                  <Route path="activity" element={<AdminActivity />} />
                  <Route
                    path="administrators"
                    element={
                      <AdminSuperRoute>
                        <AdminAdministrators />
                      </AdminSuperRoute>
                    }
                  />
                  <Route
                    path="data-management"
                    element={
                      <AdminSuperRoute>
                        <AdminDataManagement />
                      </AdminSuperRoute>
                    }
                  />
                  <Route path="community" element={<AdminCommunity />} />
                  <Route path="profile" element={<AdminProfile />} />
                </Route>

                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardEntry />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/dashboard/:level"
                  element={
                    <ProtectedRoute>
                      <LevelGate>
                        <DashboardLayout />
                      </LevelGate>
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Overview />} />
                  <Route path="courses" element={<Courses />} />
                  <Route path="courses/:code" element={<CourseDetail />} />
                  <Route path="notes" element={<Notes />} />
                  <Route path="past-questions" element={<PastQuestions />} />
                  <Route path="quizzes" element={<Quizzes />} />
                  <Route path="ai-assistant" element={<AIAssistant />} />
                  <Route path="progress" element={<Progress />} />
                  <Route path="community" element={<Community />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="support" element={<Support />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AdminAuthProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
