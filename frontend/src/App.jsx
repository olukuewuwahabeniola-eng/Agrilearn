import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ScrollToTop from "./components/ScrollToTop";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { AdminAuthProvider } from "./admin/AdminAuthContext";
import AdminProtectedRoute from "./admin/AdminProtectedRoute";
import AdminLayout from "./admin/AdminLayout";
import AdminLogin from "./admin/pages/AdminLogin";
import AdminOverview from "./admin/pages/AdminOverview";
import AdminStudents from "./admin/pages/AdminStudents";
import AdminStudentDetail from "./admin/pages/AdminStudentDetail";
import AdminCourses from "./admin/pages/AdminCourses";
import AdminNotes from "./admin/pages/AdminNotes";
import AdminPastQuestions from "./admin/pages/AdminPastQuestions";
import AdminSubmissions from "./admin/pages/AdminSubmissions";
import AdminMaterials from "./admin/pages/AdminMaterials";
import AdminActivity from "./admin/pages/AdminActivity";
import AdminDataManagement from "./admin/pages/AdminDataManagement";
import AdminAdministrators from "./admin/pages/AdminAdministrators";
import AdminAcceptInvite from "./admin/pages/AdminAcceptInvite";
import AdminSuperRoute from "./admin/AdminSuperRoute";
import AdminProfile from "./admin/pages/AdminProfile";
import Home from "./pages/Home";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import DashboardLayout from "./dashboard/DashboardLayout";
import DashboardEntry from "./dashboard/DashboardEntry";
import LevelGate from "./dashboard/LevelGate";
import Overview from "./dashboard/pages/Overview";
import Courses from "./dashboard/pages/Courses";
import CourseDetail from "./dashboard/pages/CourseDetail";
import Notes from "./dashboard/pages/Notes";
import PastQuestions from "./dashboard/pages/PastQuestions";
import Quizzes from "./dashboard/pages/Quizzes";
import AIAssistant from "./dashboard/pages/AIAssistant";
import Progress from "./dashboard/pages/Progress";
import Profile from "./dashboard/pages/Profile";
import Support from "./dashboard/pages/Support";
import "./App.css";
import "./admin/admin.css";

function App() {
  return (
    <AuthProvider>
      <AdminAuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/login" element={<Login />} />

            <Route path="/admin/login" element={<AdminLogin />} />
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
              <Route path="profile" element={<Profile />} />
              <Route path="support" element={<Support />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AdminAuthProvider>
    </AuthProvider>
  );
}

export default App;
