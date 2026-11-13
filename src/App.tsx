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
import PlanScreen from './features/resor/PlanScreen';
import ImportScreen from './features/resor/ImportScreen';
import TripScreen from './features/resor/TripScreen';
import KassaScreen from './features/resor/KassaScreen';
import PackScreen from './features/resor/PackScreen';
import InnanScreen from './features/resor/InnanScreen';
import BokningarScreen from './features/resor/BokningarScreen';
import InkopScreen from './features/resor/InkopScreen';
import ViScreen from './features/vi/ViScreen';
import AnpassningScreen from './features/vi/AnpassningScreen';
import ValvetScreen from './features/vi/ValvetScreen';
import GuideScreen from './features/vi/GuideScreen';
import ExportScreen from './features/vi/ExportScreen';
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
          <Route path="resor/planera" element={<PlanScreen />} />
          <Route path="resor/importera" element={<ImportScreen />} />
          <Route path="resor/:id" element={<TripScreen />} />
          <Route path="resor/:id/kassa" element={<KassaScreen />} />
          <Route path="resor/:id/pack" element={<PackScreen />} />
          <Route path="resor/:id/innan" element={<InnanScreen />} />
          <Route path="resor/:id/bokningar" element={<BokningarScreen />} />
          <Route path="resor/:id/inkop" element={<InkopScreen />} />
          <Route path="vi" element={<ViScreen />} />
          <Route path="vi/anpassning" element={<AnpassningScreen />} />
          <Route path="vi/valvet" element={<ValvetScreen />} />
          <Route path="vi/guide" element={<GuideScreen />} />
          <Route path="vi/export" element={<ExportScreen />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
