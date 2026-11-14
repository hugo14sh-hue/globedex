// Kommande resor ska gå att läsa utan uppkoppling, även om man inte har öppnat dem. När appen är
// uppkopplad hämtas därför resan, bokningarna och packlistan för varje kommande resa en gång per besök.
// Svaren sparas av service workern (vite.config.ts), med samma adresser som skärmarna använder.
// Bokningarnas filer (Storage) hämtas inte i förväg.
import { useEffect } from 'react';
import { tripPhase, todayIso, type TripDates } from './tripLogic';
import { fetchBookings, fetchList, fetchTrip, fetchTrips } from './trips';

/** Resor som inte är avslutade. */
export const upcomingTripIds = (trips: (TripDates & { id: string })[], today: string) =>
  trips.filter((t) => tripPhase(t, today) !== 'avslutad').map((t) => t.id);

const warmed = new Set<string>();

export function useOfflineWarmup(groupId: string | null | undefined) {
  useEffect(() => {
    if (!groupId || warmed.has(groupId) || !('serviceWorker' in navigator) || !navigator.onLine) return;
    warmed.add(groupId);
    // Vänta tills appen har ritats klart, så att förvärmningen inte tävlar med det som syns.
    const id = window.setTimeout(async () => {
      try {
        const ids = upcomingTripIds(await fetchTrips(groupId), todayIso());
        await Promise.allSettled(ids.flatMap((tid) => [fetchTrip(tid), fetchBookings(tid), fetchList('packing_items', tid)]));
      } catch {
        warmed.delete(groupId);
      }
    }, 3000);
    return () => window.clearTimeout(id);
  }, [groupId]);
}
