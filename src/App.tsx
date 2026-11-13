import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Loading } from './components/Loading';
import { UpdateBanner } from './components/UpdateBanner';
import { useSession } from './lib/session';
import LoginScreen from './features/login/LoginScreen';
import StartScreen from './features/start/StartScreen';
import KartaScreen from './features/karta/KartaScreen';
import PlaceScreen from './features/karta/PlaceScreen';
import IdagScreen from './features/idag/IdagScreen';
import ListorScreen from './features/listor/ListorScreen';
import ResorScreen from './features/resor/ResorScreen';
import ViScreen from './features/vi/ViScreen';
import AnpassningScreen from './features/vi/AnpassningScreen';
import NotFound from './features/NotFound';

/** Släpper bara in inloggade, och skickar nya användare till starten först. */
function Gate({ children, start = false }: { children: React.ReactNode; start?: boolean }) {
  const { ready, session, profile } = useSession();
  const loc = useLocation();
  if (!ready) return <Loading />;
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  const onboarded = Boolean(profile?.settings?.onboarded);
  if (!start && profile && !onboarded) return <Navigate to="/start" replace />;
  return <>{children}</>;
}

function LoginRoute() {
  const { ready, session } = useSession();
  if (!ready) return <Loading />;
  if (session) return <Navigate to="/karta" replace />;
  return <LoginScreen />;
}

export default function App() {
  return (
    <>
      <UpdateBanner />
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route
          path="/start"
          element={
            <Gate start>
              <div className="app">
                <StartScreen />
              </div>
            </Gate>
          }
        />
        <Route
          element={
            <Gate>
              <AppShell />
            </Gate>
          }
        >
          <Route index element={<Navigate to="/karta" replace />} />
          <Route path="karta" element={<KartaScreen />} />
          <Route path="karta/:id" element={<PlaceScreen />} />
          <Route path="idag" element={<IdagScreen />} />
          <Route path="listor" element={<ListorScreen />} />
          <Route path="resor" element={<ResorScreen />} />
          <Route path="vi" element={<ViScreen />} />
          <Route path="vi/anpassning" element={<AnpassningScreen />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
