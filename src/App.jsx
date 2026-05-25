import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ShiftProvider } from "./contexts/ShiftContext";
import ProtectedRoute from "./components/routing/ProtectedRoute";
import RoleGuard from "./components/routing/RoleGuard";
import AppShell from "./components/layout/AppShell";
import ErrorBoundary from "./components/shared/ErrorBoundary";

// Pages
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProjectsPage from "./pages/ProjectsPage";
import PeoplePage from "./pages/PeoplePage";
import SalaryPage from "./pages/Salary/SalaryPage";
import LeadsPage from "./pages/Leads/LeadsPage";
import OpportunitiesPage from "./pages/Opportunities/OpportunitiesPage";
import InvoicesPage from "./pages/Invoices/InvoicesPage";
import ComingSoon from "./components/shared/ComingSoon";
import WorkHourSection from "./components/workhours/WorkHourSection";
import FloatingShiftTimer from "./components/global/FloatingShiftTimer";
import HeartbeatConfirmModal from "./components/global/HeartbeatConfirmModal";

const App = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ShiftProvider>
          <FloatingShiftTimer />
          <HeartbeatConfirmModal />
          <Router>
            <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected App Routes */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Routes>
                      <Route path="dashboard" element={<DashboardPage />} />
                      <Route path="work-hours" element={<WorkHourSection />} />
                      <Route path="salary" element={<SalaryPage />} />
                      
                      {/* Admin Only Routes */}
                      <Route 
                        path="invoices" 
                        element={
                          <RoleGuard allowedRoles={["admin", "super_admin"]}>
                            <InvoicesPage />
                          </RoleGuard>
                        } 
                      />
                      <Route 
                        path="leads" 
                        element={
                          <RoleGuard allowedRoles={["admin", "super_admin"]}>
                            <LeadsPage />
                          </RoleGuard>
                        } 
                      />
                      <Route 
                        path="opportunities" 
                        element={
                          <RoleGuard allowedRoles={["admin", "super_admin"]}>
                            <OpportunitiesPage />
                          </RoleGuard>
                        } 
                      />
                      <Route 
                        path="projects" 
                        element={
                          <RoleGuard allowedRoles={["admin", "super_admin"]}>
                            <ProjectsPage />
                          </RoleGuard>
                        } 
                        />
                      <Route 
                        path="people" 
                        element={
                          <RoleGuard allowedRoles={["admin", "super_admin"]}>
                            <PeoplePage />
                          </RoleGuard>
                        } 
                      />

                      {/* Default Redirect */}
                      <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                  </AppShell>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
        </ShiftProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
