/** Inloggning med e-post och lösenord: kontroll före anropet och översättning av fel till textnycklar. */

export const MIN_PASSWORD = 8;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthMode = 'logga-in' | 'skapa';

/** Textnyckel för första felet, eller null om uppgifterna kan skickas. */
export function validateCredentials(email: string, password: string): string | null {
  if (!EMAIL.test(email.trim())) return 'login.fel-epost';
  if (password.length < MIN_PASSWORD) return 'login.kort-losenord';
  return null;
}

interface AuthErrorLike {
  code?: string;
  status?: number;
  message?: string;
}

/** Översätter ett fel från Supabase Auth till en textnyckel i content/_texter.json. */
export function authErrorKey(error: unknown): string {
  const e = (error && typeof error === 'object' ? error : {}) as AuthErrorLike;
  const code = e.code ?? '';
  if (e.status === 429 || code.startsWith('over_') || code.endsWith('_rate_limit')) return 'login.for-manga';
  if (code === 'invalid_credentials') return 'login.fel-uppgifter';
  if (code === 'user_already_exists' || code === 'email_exists') return 'login.finns-redan';
  if (code === 'weak_password') return 'login.kort-losenord';
  return 'allmant.fel';
}
