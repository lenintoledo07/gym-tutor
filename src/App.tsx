import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./lib/auth";
import { Spinner } from "./components/ui";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Home from "./pages/Home";
import Coach from "./pages/Coach";
import RoutinePage from "./pages/Routine";
import Workout from "./pages/Workout";
import Progress from "./pages/Progress";
import Exercises from "./pages/Exercises";
import ProfilePage from "./pages/Profile";

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();
  if (loading || (session && !profile)) return <Spinner label="Cargando..." />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile?.onboarded && location.pathname !== "/bienvenida") return <Navigate to="/bienvenida" replace />;
  return <>{children}</>;
}

export default function App() {
  const { session, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={!loading && session ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/bienvenida" element={<RequireAuth><Onboarding /></RequireAuth>} />
      <Route path="/entreno/:sessionId" element={<RequireAuth><Workout /></RequireAuth>} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Home />} />
        <Route path="coach" element={<Coach />} />
        <Route path="rutina/:id" element={<RoutinePage />} />
        <Route path="progreso" element={<Progress />} />
        <Route path="ejercicios" element={<Exercises />} />
        <Route path="perfil" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
