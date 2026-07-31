import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { useReminders } from "@/contexts/RemindersContext";
import {
  AuthException,
  type AuthTokens,
  refreshIdToken,
  signInWithPassword,
} from "@/utils/sync/authClient";
import { FirestoreClient } from "@/utils/sync/firestoreClient";
import { runSync } from "@/utils/sync/syncEngine";

const SESSION_KEY = "auth:session";
// Refresh a bit before actual expiry so a call made right at the boundary doesn't get
// rejected by Firestore for using a token that expired mid-flight.
const REFRESH_MARGIN_MS = 60_000;

interface StoredSession {
  email: string;
  expiresAt: number;
  idToken: string;
  lastSyncedAt: number | null;
  refreshToken: string;
  uid: string;
}

export type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { email: string; status: "signed-in"; uid: string };

interface AuthContextType {
  authState: AuthState;
  error: string | null;
  isSigningIn: boolean;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  signIn: (email: string, password: string) => void;
  signOut: () => void;
  syncError: string | null;
  syncNow: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};

async function readSession(): Promise<StoredSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

function sessionFromTokens(
  email: string,
  tokens: AuthTokens,
  lastSyncedAt: number | null
): StoredSession {
  return {
    uid: tokens.uid,
    email,
    idToken: tokens.idToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    lastSyncedAt,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { loaded: remindersLoaded, snapshotForSync, applySyncedState } =
    useReminders();
  // undefined = not loaded from AsyncStorage yet, null = signed out
  const [session, setSession] = useState<StoredSession | null | undefined>(
    undefined
  );
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const sessionRef = useRef<StoredSession | null>(null);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    readSession().then((s) => {
      sessionRef.current = s;
      setSession(s);
    });
  }, []);

  const persistSession = useCallback(async (next: StoredSession | null) => {
    sessionRef.current = next;
    setSession(next);
    if (next) {
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next));
    } else {
      await AsyncStorage.removeItem(SESSION_KEY);
    }
  }, []);

  /** A valid ID token for authenticated Firestore calls, refreshing first if the
   *  stored one is expired or about to be. Null if signed out. */
  const validIdToken = useCallback(async (): Promise<string | null> => {
    const current = sessionRef.current;
    if (!current) {
      return null;
    }
    if (Date.now() < current.expiresAt - REFRESH_MARGIN_MS) {
      return current.idToken;
    }
    const tokens = await refreshIdToken(current.refreshToken);
    await persistSession(sessionFromTokens(current.email, tokens, current.lastSyncedAt));
    return tokens.idToken;
  }, [persistSession]);

  const signIn = useCallback(
    (email: string, password: string) => {
      const trimmedEmail = email.trim();
      if (!(trimmedEmail && password) || isSigningIn) {
        return;
      }
      setIsSigningIn(true);
      setError(null);
      signInWithPassword(trimmedEmail, password)
        .then((tokens) =>
          persistSession(sessionFromTokens(trimmedEmail, tokens, null))
        )
        .catch((e) => {
          setError(
            e instanceof AuthException
              ? e.message
              : "Couldn't reach the server, check your connection."
          );
        })
        .finally(() => setIsSigningIn(false));
    },
    [isSigningIn, persistSession]
  );

  const signOut = useCallback(() => {
    persistSession(null);
  }, [persistSession]);

  const syncNow = useCallback(() => {
    const current = sessionRef.current;
    // Guards against syncing before RemindersContext has finished loading its own
    // AsyncStorage-persisted data. Otherwise this would reconcile against the
    // placeholder default state and could clobber the real remote data.
    if (!(current && remindersLoaded) || isSyncingRef.current) {
      return;
    }
    isSyncingRef.current = true;
    setIsSyncing(true);
    setSyncError(null);
    const firestore = new FirestoreClient(validIdToken);
    runSync({
      firestore,
      uid: current.uid,
      snapshotForSync,
      applySyncedState,
    })
      .then(() => {
        const latest = sessionRef.current;
        if (latest) {
          return persistSession({ ...latest, lastSyncedAt: Date.now() });
        }
      })
      .catch((e) => {
        // Surfaced on the Account screen so a persistent failure (e.g. a revoked
        // refresh token) isn't invisible; the next foreground/manual trigger retries.
        setSyncError(e instanceof Error ? e.message : "Sync failed.");
      })
      .finally(() => {
        isSyncingRef.current = false;
        setIsSyncing(false);
      });
  }, [
    remindersLoaded,
    validIdToken,
    snapshotForSync,
    applySyncedState,
    persistSession,
  ]);

  // Always call the latest syncNow: the triggers below only (re)run once, so a stale
  // closure would otherwise keep using whatever RemindersContext looked like at mount.
  const syncNowRef = useRef(syncNow);
  useEffect(() => {
    syncNowRef.current = syncNow;
  }, [syncNow]);

  // Sync whenever the app returns to the foreground (mirrors the native rewrite's
  // on-open poke; this app has no true background-sync equivalent).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        syncNowRef.current();
      }
    });
    return () => sub.remove();
  }, []);

  // Sync once everything has finished loading (covers cold start, since the
  // AppState listener above only fires on a later foreground transition). Waits on
  // both the auth session and RemindersContext's own AsyncStorage load, whichever
  // finishes last.
  const readyToSync = session !== undefined && remindersLoaded;
  useEffect(() => {
    if (readyToSync) {
      syncNowRef.current();
    }
  }, [readyToSync]);

  const authState: AuthState = (() => {
    if (session === undefined) {
      return { status: "loading" };
    }
    if (!session) {
      return { status: "signed-out" };
    }
    return { status: "signed-in", uid: session.uid, email: session.email };
  })();

  return (
    <AuthContext.Provider
      value={{
        authState,
        error,
        isSigningIn,
        isSyncing,
        lastSyncedAt: session?.lastSyncedAt ?? null,
        signIn,
        signOut,
        syncError,
        syncNow,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
