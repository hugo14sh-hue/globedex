// Uppspelning av en resa etapp för etapp (Karta med ?resa=id). Bara etapper med koordinater spelas upp.
// Med reducerad rörelse visas hela resan direkt.
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLegs, type Leg } from '../../lib/trips';
import type { MapRoute } from './MapView';

/** Hur länge varje etapp ritas (ms). */
const LEG_MS = 1800;

export function usePlayback(tripId: string | null) {
  const [legs, setLegs] = useState<Leg[]>([]);
  const [step, setStep] = useState(0);
  const [f, setF] = useState(0);
  const [run, setRun] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    setLegs([]);
    if (!tripId) return;
    let alive = true;
    fetchLegs(tripId)
      .then((l) => alive && setLegs(l.filter((x) => x.from_lat != null && x.from_lon != null && x.to_lat != null && x.to_lon != null)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [tripId]);

  useEffect(() => {
    if (!legs.length) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setStep(legs.length - 1);
      setF(1);
      return;
    }
    // Kort paus så att kartan hinner visa hela resan först.
    const t0 = performance.now() + 700;
    const tick = (now: number) => {
      const el = Math.max(0, now - t0);
      const i = Math.min(legs.length - 1, Math.floor(el / LEG_MS));
      const frac = i === legs.length - 1 && el >= legs.length * LEG_MS ? 1 : (el % LEG_MS) / LEG_MS;
      setStep(i);
      setF(frac);
      if (el < legs.length * LEG_MS) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [legs, run]);

  const replay = useCallback(() => {
    setStep(0);
    setF(0);
    setRun((r) => r + 1);
  }, []);

  const route: MapRoute | null = legs.length
    ? { legs: legs.map((l) => ({ a: { lat: l.from_lat!, lon: l.from_lon! }, b: { lat: l.to_lat!, lon: l.to_lon! } })), step, f }
    : null;
  return { legs, step, route, replay, done: legs.length > 0 && step === legs.length - 1 && f >= 1 };
}
