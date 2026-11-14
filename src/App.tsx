import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Loading } from './components/Loading';
import { UpdateBanner } from './components/UpdateBanner';
import { useScrollMemory } from './lib/navMemory';
import { useSession } from './lib/session';
import LoginScreen from './features/login/LoginScreen';
import StartScreen from './features/start/StartScreen';
import KartaScreen from './features/karta/KartaScreen';
const PlaceScreen = lazy(() => import('./features/karta/PlaceScreen'));
const IdagScreen = lazy(() => import('./features/idag/IdagScreen'));
const ListorScreen = lazy(() => import('./features/listor/ListorScreen'));
const ResorScreen = lazy(() => import('./features/resor/ResorScreen'));
const PlanScreen = lazy(() => import('./features/resor/PlanScreen'));
const ImportScreen = lazy(() => import('./features/resor/ImportScreen'));
const TripScreen = lazy(() => import('./features/resor/TripScreen'));
const KassaScreen = lazy(() => import('./features/resor/KassaScreen'));
const PackScreen = lazy(() => import('./features/resor/PackScreen'));
const InnanScreen = lazy(() => import('./features/resor/InnanScreen'));
const BokningarScreen = lazy(() => import('./features/resor/BokningarScreen'));
const InkopScreen = lazy(() => import('./features/resor/InkopScreen'));
const ViScreen = lazy(() => import('./features/vi/ViScreen'));
const AnpassningScreen = lazy(() => import('./features/vi/AnpassningScreen'));
const ValvetScreen = lazy(() => import('./features/vi/ValvetScreen'));
const GuideScreen = lazy(() => import('./features/vi/GuideScreen'));
const ExportScreen = lazy(() => import('./features/vi/ExportScreen'));
import NotFound from './features/NotFound';

// Varje flik och undersida är en egen del av bygget och laddas när den öppnas. Inloggning, start och
// Karta (de första skärmarna) laddas direkt, så att första visningen inte väntar på en extra fil.
// Kartmotorn laddas först när kartan visas (MapView i KartaScreen).

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
  // Tillbaka till samma ställe: scrollpositionen sparas per historikpost.
  useScrollMemory();
  return (
    <>
      <UpdateBanner />
      <Suspense fallback={<Loading />}>
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
      </Suspense>
    </>
  );
}
