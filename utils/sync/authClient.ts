import { FirebaseConfig } from "./firebaseConfig";

/** Normalized result of any Identity Toolkit auth call: signInWithPassword and the
 *  token-refresh endpoint return differently-shaped, differently-cased JSON, but both
 *  get mapped into this one shape for everything downstream to use. */
export interface AuthTokens {
  expiresAt: number; // epoch millis
  idToken: string;
  refreshToken: string;
  uid: string;
}

export class AuthException extends Error {}

const AUTH_HEADERS = {
  "X-Android-Package": FirebaseConfig.ANDROID_PACKAGE,
  "X-Android-Cert": FirebaseConfig.ANDROID_CERT_SHA1,
  "X-Firebase-gmpid": FirebaseConfig.FIREBASE_APP_ID,
};

// Falls back to a generic message if the error body isn't the shape Identity Toolkit
// normally returns (e.g. a 5xx from an upstream proxy, not Firebase itself).
async function errorMessage(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const body = JSON.parse(text) as { error?: { message?: string } };
    if (body.error?.message) {
      return body.error.message;
    }
  } catch {
    /* not the expected error shape, fall through to a generic message */
  }
  return `Sign-in failed (${response.status})`;
}

/** Talks to Firebase's Identity Toolkit REST API directly, the same way the native
 *  rewrite's AuthClient does: there's no Firebase SDK involved, just the two raw HTTP
 *  calls the app needs. */
export async function signInWithPassword(
  email: string,
  password: string
): Promise<AuthTokens> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(FirebaseConfig.API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...AUTH_HEADERS },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  if (!response.ok) {
    throw new AuthException(await errorMessage(response));
  }
  const body = (await response.json()) as {
    expiresIn: string;
    idToken: string;
    localId: string;
    refreshToken: string;
  };
  return {
    idToken: body.idToken,
    refreshToken: body.refreshToken,
    uid: body.localId,
    expiresAt: Date.now() + Number(body.expiresIn) * 1000,
  };
}

export async function refreshIdToken(refreshToken: string): Promise<AuthTokens> {
  const response = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(FirebaseConfig.API_KEY)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...AUTH_HEADERS,
      },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    }
  );
  if (!response.ok) {
    throw new AuthException(await errorMessage(response));
  }
  const body = (await response.json()) as {
    expires_in: string;
    id_token: string;
    refresh_token: string;
    user_id: string;
  };
  return {
    idToken: body.id_token,
    refreshToken: body.refresh_token,
    uid: body.user_id,
    expiresAt: Date.now() + Number(body.expires_in) * 1000,
  };
}
