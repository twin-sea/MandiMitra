import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from './i18n';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import FarmerDashboard from './pages/FarmerDashboard';
import { FindMandi } from './pages/FindMandi';
import { MyBookings } from './pages/MyBookings';
import { TrackQueue } from './pages/TrackQueue';
import { Profile } from './pages/Profile';
import { HelpPage } from './pages/HelpPage';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Admin } from './pages/Admin';
import { ChatWidget } from './components/chat/ChatWidget';

function Layout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // The active language now always comes straight from i18next itself,
  // instead of separate local state - so when a farmer's saved language
  // preference is applied on login (see AuthContext), the Navbar picks it
  // up automatically instead of staying stuck on a stale default.
  const { i18n: i18nInstance } = useTranslation();
  const language = i18nInstance.language;
  const setLanguage = (lng) => i18nInstance.changeLanguage(lng);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="min-h-screen bg-background font-sans antialiased text-foreground">
      <Navbar
        toggleSidebar={toggleSidebar}
        language={language}
        setLanguage={setLanguage}
      />

      <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
        <Sidebar isOpen={isSidebarOpen} />

        <main className="flex-1 overflow-y-auto bg-muted/20 p-4 sm:p-6 md:p-8">
          {children}
        </main>
      </div>

      <ChatWidget />
    </div>
  );
}

// Gate everything except /login and /register behind a real, logged-in
// farmer. This is what makes login/register the actual entry point into
// the app rather than an optional page.
function RequireAuth({ children }) {
  const { farmer, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!farmer) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Mandi-staff console - separate from the farmer-facing app, gated
          by its own admin key (see Admin.jsx), not a farmer login. */}
      <Route path="/admin" element={<Admin />} />

      {/* Default redirect to dashboard */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <FarmerDashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/find-mandi"
        element={
          <RequireAuth>
            <FindMandi />
          </RequireAuth>
        }
      />
      <Route
        path="/my-bookings"
        element={
          <RequireAuth>
            <MyBookings />
          </RequireAuth>
        }
      />
      <Route
        path="/track-queue"
        element={
          <RequireAuth>
            <TrackQueue />
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <Profile />
          </RequireAuth>
        }
      />
      <Route
        path="/help"
        element={
          <RequireAuth>
            <HelpPage />
          </RequireAuth>
        }
      />

      {/* Catch-all for undefined routes */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

// Expose i18n for global access
window._i18n = i18n;
window.__i18n_lng = 'hi';

console.log('MandiMitra v2.0 - Multilingual Edition Loaded');
