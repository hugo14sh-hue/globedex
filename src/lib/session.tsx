import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { APP_NAME, type TravelMode } from '../config';
import { supabase, supabaseConfigured } from './supabase';
import type { Group, Invite, Member, Profile, ProfileSettings } from './types';
import { canInvite, pickActiveGroup } from './groups';
import { useTheme } from '../theme/ThemeProvider';
import { sanitizeTheme } from '../theme/theme';

interface SessionCtx {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  groups: Group[];
  activeGroup: Group | null;
  members: Member[];
  /** Sant när användaren loggades ut utan att själv be om det. */
  sessionEnded: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, 'display_name' | 'travel_mode' | 'active_group_id'>> & { settings?: ProfileSettings }) => Promise<void>;
  setTravelMode: (mode: TravelMode) => Promise<void>;
  createGroup: (name: string) => Promise<void>;
  createInvite: () => Promise<Invite>;
  joinGroup: (code: string) => Promise<Group>;
  leaveGroup: () => Promise<void>;
  addHome: (name: string, lat?: number, lon?: number) => Promise<void>;
  reload: () => Promise<void>;
}

const Ctx = createContext<SessionCtx | null>(null);
const CACHE_KEY = `${APP_NAME.toLowerCase()}.profil`;

interface Cached {
  profile: Profile;
  groups: Group[];
  members: Member[];
}

function readCache(userId: string): Cached | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') as Cached | null;
    return c && c.profile.id === userId ? c : null;
  } catch {
    return null;
  }
}

function writeCache(c: Cached | null) {
  try {
    if (c) localStorage.setItem(CACHE_KEY, JSON.stringify(c));
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    // Lagringen är inte tillgänglig. Appen fungerar ändå uppkopplad.
  }
}

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { theme, setTheme, update: updateTheme } = useTheme();
  const [ready, setReady] = useState(!supabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [sessionEnded, setSessionEnded] = useState(false);
  const signingOut = useRef(false);
  const savedTheme = useRef<string>('');
  const userId = session?.user.id ?? null;

  const load = useCallback(
    async (uid: string) => {
      try {
        const p = must(await supabase.from('profiles').select('*').eq('id', uid).single()) as Profile;
        const rows = must(
          await supabase.from('group_members').select('role, groups(id, name, kind, created_by, created_at)').eq('user_id', uid),
        ) as unknown as { groups: Group | null }[];
        const gs = rows.map((r) => r.groups).filter((g): g is Group => Boolean(g));
        // Bara grupper man är medlem i kan vara aktiva. Pekar profilen på en annan grupp
        // (till exempel efter att man lämnat den på en annan enhet) används sologruppen.
        const activeId = pickActiveGroup(gs, p.active_group_id, uid);
        if (activeId !== p.active_group_id) {
          const fixed = must(
            await supabase.from('profiles').update({ active_group_id: activeId }).eq('id', uid).select('*').single(),
          ) as Profile;
          Object.assign(p, fixed);
        }
        let ms: Member[] = [];
        if (p.active_group_id) {
          const mrows = must(
            await supabase.from('group_members').select('user_id, role').eq('group_id', p.active_group_id),
          ) as { user_id: string; role: Member['role'] }[];
          const names = must(
            await supabase.from('profiles').select('id, display_name').in('id', mrows.map((m) => m.user_id)),
          ) as { id: string; display_name: string }[];
          ms = mrows.map((m) => ({ ...m, display_name: names.find((n) => n.id === m.user_id)?.display_name ?? '' }));
        }
        setProfile(p);
        setGroups(gs);
        setMembers(ms);
        writeCache({ profile: p, groups: gs, members: ms });
        if (p.settings?.theme) {
          const th = sanitizeTheme(p.settings.theme);
          savedTheme.current = JSON.stringify(th);
          setTheme(th);
        }
      } catch (e) {
        // Offline eller nätverksfel: visa det senast hämtade.
        const c = readCache(uid);
        if (c) {
          setProfile(c.profile);
          setGroups(c.groups);
          setMembers(c.members);
        } else {
          throw e;
        }
      }
    },
    [setTheme],
  );

  // Sessionen
  useEffect(() => {
    if (!supabaseConfigured) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSession(data.session);
      if (!data.session && alive) setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT') {
        if (!signingOut.current) setSessionEnded(true);
        signingOut.current = false;
        setProfile(null);
        setGroups([]);
        setMembers([]);
        writeCache(null);
      }
      if (event === 'SIGNED_IN') setSessionEnded(false);
      setSession(s);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Profilen när användaren är inloggad
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setReady(false);
    load(userId)
      .catch(() => undefined)
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [userId, load]);

  // Spara temat i profilen när det ändras (med kort fördröjning medan man drar i reglage)
  useEffect(() => {
    if (!profile) return;
    const json = JSON.stringify(theme);
    if (json === savedTheme.current) return;
    const id = window.setTimeout(async () => {
      const settings: ProfileSettings = { ...profile.settings, theme };
      const { error } = await supabase.from('profiles').update({ settings }).eq('id', profile.id);
      if (!error) {
        savedTheme.current = json;
        setProfile((p) => (p ? { ...p, settings } : p));
      }
    }, 600);
    return () => window.clearTimeout(id);
  }, [theme, profile]);

  // Romantisk språkstil finns bara i reseläget par
  const mode = profile?.travel_mode;
  useEffect(() => {
    if (mode && mode !== 'par' && theme.tone === 'romantisk') updateTheme({ tone: 'neutral' });
  }, [mode, theme.tone, updateTheme]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  // Confirm email är avstängt i Supabase, så signUp ger en session direkt.
  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    // Utan session väntar Supabase på en bekräftelse som aldrig skickas: visa det som fel.
    if (!data.session) throw new Error('Ingen session efter signUp. Är Confirm email påslaget i Supabase?');
  }, []);

  const signOut = useCallback(async () => {
    signingOut.current = true;
    await supabase.auth.signOut();
  }, []);

  const updateProfile = useCallback<SessionCtx['updateProfile']>(
    async (patch) => {
      if (!profile) return;
      if (patch.active_group_id && !groups.some((g) => g.id === patch.active_group_id)) {
        // Grupper som just skapats eller gått med i finns inte i listan än: kontrollera medlemskapet.
        const { data } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('group_id', patch.active_group_id)
          .eq('user_id', profile.id)
          .maybeSingle();
        if (!data) throw new Error('Inte medlem i gruppen');
      }
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', profile.id).select('*').single();
      if (error) throw error;
      setProfile(data as Profile);
      writeCache({ profile: data as Profile, groups, members });
    },
    [profile, groups, members],
  );

  const soloGroup = useMemo(
    () => groups.find((g) => g.kind === 'solo' && g.created_by === userId) ?? null,
    [groups, userId],
  );

  const setTravelMode = useCallback(
    async (m: TravelMode) => {
      if (!profile) return;
      const current = groups.find((g) => g.id === profile.active_group_id);
      const target = current?.kind === m ? current : groups.find((g) => g.kind === m) ?? soloGroup ?? current;
      await updateProfile({ travel_mode: m, active_group_id: target?.id ?? profile.active_group_id });
      if (userId && target?.id !== profile.active_group_id) await load(userId);
    },
    [profile, groups, soloGroup, updateProfile, load, userId],
  );

  const createGroup = useCallback(
    async (name: string) => {
      if (!profile || !userId) return;
      const kind = profile.travel_mode === 'solo' ? 'par' : profile.travel_mode;
      const gid = must(await supabase.rpc('create_group', { group_name: name, group_kind: kind })) as string;
      await updateProfile({ active_group_id: gid, travel_mode: kind });
      await load(userId);
    },
    [profile, userId, updateProfile, load],
  );

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === profile?.active_group_id) ?? null,
    [groups, profile?.active_group_id],
  );

  // Inbjudan finns bara för par och grupp, aldrig för en sologrupp.
  const createInvite = useCallback(async () => {
    if (!activeGroup || !canInvite(activeGroup) || !userId) throw new Error('Ingen par- eller gruppyta');
    return must(
      await supabase
        .from('group_invites')
        .insert({ group_id: activeGroup.id, created_by: userId })
        .select('code, group_id, expires_at')
        .single(),
    ) as Invite;
  }, [activeGroup, userId]);

  const joinGroup = useCallback(
    async (code: string) => {
      if (!userId) throw new Error('Inte inloggad');
      const gid = must(await supabase.rpc('join_group', { invite_code: code })) as string;
      const g = must(await supabase.from('groups').select('*').eq('id', gid).single()) as Group;
      await updateProfile({ active_group_id: gid, travel_mode: g.kind });
      await load(userId);
      return g;
    },
    [userId, updateProfile, load],
  );

  const leaveGroup = useCallback(async () => {
    if (!profile?.active_group_id || !userId || !canInvite(activeGroup)) return;
    const gid = profile.active_group_id;
    const { error } = await supabase.from('group_members').delete().eq('group_id', gid).eq('user_id', userId);
    if (error) throw error;
    await updateProfile({ active_group_id: soloGroup?.id ?? null, travel_mode: 'solo' });
    await load(userId);
  }, [profile, userId, activeGroup, soloGroup, updateProfile, load]);

  const addHome = useCallback(
    async (name: string, lat?: number, lon?: number) => {
      if (!userId) return;
      await supabase.from('saved_locations').update({ is_home: false }).eq('user_id', userId).eq('is_home', true);
      const { error } = await supabase
        .from('saved_locations')
        .insert({ user_id: userId, name, lat: lat ?? null, lon: lon ?? null, is_home: true });
      if (error) throw error;
    },
    [userId],
  );

  const reload = useCallback(async () => {
    if (userId) await load(userId);
  }, [userId, load]);

  const value = useMemo<SessionCtx>(
    () => ({
      ready,
      session,
      profile,
      groups,
      activeGroup,
      members,
      sessionEnded,
      signIn,
      signUp,
      signOut,
      updateProfile,
      setTravelMode,
      createGroup,
      createInvite,
      joinGroup,
      leaveGroup,
      addHome,
      reload,
    }),
    [ready, session, profile, groups, activeGroup, members, sessionEnded, signIn, signUp, signOut, updateProfile, setTravelMode, createGroup, createInvite, joinGroup, leaveGroup, addHome, reload],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSession används utanför SessionProvider');
  return c;
}

/** Reseläget, solo om profilen inte har laddats. */
export function useTravelMode(): TravelMode {
  return useSession().profile?.travel_mode ?? 'solo';
}

