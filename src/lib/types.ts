import type { ThemeSettings, TravelMode } from '../config';

export interface ProfileSettings {
  theme?: Partial<ThemeSettings>;
  /** Sant när användaren har gått igenom starten. */
  onboarded?: boolean;
  [key: string]: unknown;
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  travel_mode: TravelMode;
  active_group_id: string | null;
  settings: ProfileSettings;
}

export interface Group {
  id: string;
  name: string;
  kind: TravelMode;
  created_by: string;
  created_at: string;
}

export interface Member {
  user_id: string;
  role: 'owner' | 'member';
  display_name: string;
}

export interface Invite {
  code: string;
  group_id: string;
  expires_at: string;
}
