import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import TemplatesPage from './pages/TemplatesPage';
import WorkoutDetail from './pages/WorkoutDetail';
import FocusWorkout from './components/FocusWorkout';
import CreateTemplate from './pages/CreateTemplate';
import AuthPage from './pages/AuthPage';
import AccountPage from './pages/AccountPage'; // ⚙️ Import the new Account Page
import ScheduleSettings from './pages/ScheduleSettings';

// 🛡️ Security Bouncer for Frontend Routes
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  
  if (!token) {
    // If no JWT token is found, redirect straight to login
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 🔑 Public Auth Route */}
        <Route path="/login" element={<AuthPage />} />

        {/* 🔒 Protected Routes (Require active session) */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/templates" 
          element={
            <ProtectedRoute>
              <TemplatesPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/workouts/:id" 
          element={
            <ProtectedRoute>
              <WorkoutDetail />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/focus/:routineId" 
          element={
            <ProtectedRoute>
              <FocusWorkout />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/create-template" 
          element={
            <ProtectedRoute>
              <CreateTemplate />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/edit-template/:id" 
          element={
            <ProtectedRoute>
              <CreateTemplate />
            </ProtectedRoute>
          } 
        />
        
        {/* ⚙️ Account Route */}
        <Route 
          path="/account" 
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          } 
        />

        {/* 🗓️ Schedule Settings Route */}
        <Route 
          path="/schedule-settings" 
          element={
            <ProtectedRoute>
              <ScheduleSettings />
            </ProtectedRoute>
          } 
        />

        {/* ↪️ Catch-all: redirect any unknown URL back home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;