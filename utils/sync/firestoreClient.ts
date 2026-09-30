import { FirebaseConfig } from "./firebaseConfig";
import { decodeFields, encodeFields, type JsonValue } from "./firestoreValue";

export class FirestoreException extends Error {}

/** A single Firestore document as this app sees it: its ID plus the field map already
 *  unwrapped from Firestore's typed Value format into plain JSON. */
export interface FirestoreDocument {
  fields: Record<string, JsonValue>;
  id: string;
}

const PAGE_SIZE = 100;

function baseUrl(): string {
  return `https://firestore.googleapis.com/v1/projects/${FirebaseConfig.PROJECT_ID}/databases/(default)/documents`;
}

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
  return `Firestore request failed (${response.status})`;
}

function toFirestoreDocument(document: {
  fields?: Record<string, unknown>;
  name: string;
}): FirestoreDocument {
  const id = document.name.slice(document.name.lastIndexOf("/") + 1);
  return { id, fields: decodeFields(document.fields ?? {}) };
}

/**
 * Talks to Firestore's REST API directly (mirrors the native rewrite's
 * FirestoreClient), a thin client over firestore.googleapis.com, authenticated with a
 * caller-supplied ID token getter (so this module doesn't need to know about auth
 * storage/refresh itself).
 */
export class FirestoreClient {
  private readonly getValidIdToken: () => Promise<null | string>;

  constructor(getValidIdToken: () => Promise<null | string>) {
    this.getValidIdToken = getValidIdToken;
  }

  /** Every document in a user's collection (e.g. "tasks", "lists"). Soft-deleted
   *  (`deleted: true`) documents are included too; filtering those out is the
   *  caller's job. */
  async listDocuments(
    uid: string,
    collection: string
  ): Promise<FirestoreDocument[]> {
    const token = await this.validToken();
    const documents: FirestoreDocument[] = [];
    let pageToken: string | undefined;
    do {
      const params = [`pageSize=${PAGE_SIZE}`];
      if (pageToken) {
        params.push(`pageToken=${encodeURIComponent(pageToken)}`);
      }
      const response = await fetch(
        `${baseUrl()}/users/${uid}/${collection}?${params.join("&")}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) {
        throw new FirestoreException(await errorMessage(response));
      }
      const body = (await response.json()) as {
        documents?: Array<{ fields?: Record<string, unknown>; name: string }>;
        nextPageToken?: string;
      };
      documents.push(...(body.documents ?? []).map(toFirestoreDocument));
      pageToken = body.nextPageToken;
    } while (pageToken);
    return documents;
  }

  /** Documents whose updatedAt is newer than `since`. An empty result still bills
   *  one read. */
  async listChangedSince(
    uid: string,
    collection: string,
    since: number
  ): Promise<FirestoreDocument[]> {
    const token = await this.validToken();
    const query = {
      structuredQuery: {
        from: [{ collectionId: collection }],
        where: {
          fieldFilter: {
            field: { fieldPath: "updatedAt" },
            op: "GREATER_THAN",
            value: { integerValue: String(since) },
          },
        },
      },
    };
    const response = await fetch(`${baseUrl()}/users/${uid}:runQuery`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(query),
    });
    if (!response.ok) {
      throw new FirestoreException(await errorMessage(response));
    }
    const body = (await response.json()) as Array<{
      document?: { fields?: Record<string, unknown>; name: string };
    }>;
    return body
      .filter((entry) => entry.document)
      .map((entry) =>
        toFirestoreDocument(
          entry.document as { fields?: Record<string, unknown>; name: string }
        )
      );
  }

  /** Removes a document for good, not a soft delete. Used only to purge tombstones
   *  already old enough that no other device still needs to see them go. A 404
   *  (some other device purged it first) is not an error. */
  async deleteDocument(
    uid: string,
    collection: string,
    docId: string
  ): Promise<void> {
    const token = await this.validToken();
    const response = await fetch(
      `${baseUrl()}/users/${uid}/${collection}/${docId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (response.status === 404) {
      return;
    }
    if (!response.ok) {
      throw new FirestoreException(await errorMessage(response));
    }
  }

  /** The singleton settings document, or null if the user has never synced settings
   *  before. */
  async getDocument(
    uid: string,
    collection: string,
    docId: string
  ): Promise<FirestoreDocument | null> {
    const token = await this.validToken();
    const response = await fetch(
      `${baseUrl()}/users/${uid}/${collection}/${docId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new FirestoreException(await errorMessage(response));
    }
    return toFirestoreDocument(await response.json());
  }

  /** Full replace-or-create, no updateMask, since sync always writes whole
   *  documents, not per-field patches. */
  async setDocument(
    uid: string,
    collection: string,
    docId: string,
    fields: Record<string, JsonValue>
  ): Promise<void> {
    const token = await this.validToken();
    const response = await fetch(
      `${baseUrl()}/users/${uid}/${collection}/${docId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields: encodeFields(fields) }),
      }
    );
    if (!response.ok) {
      throw new FirestoreException(await errorMessage(response));
    }
  }

  private async validToken(): Promise<string> {
    const token = await this.getValidIdToken();
    if (!token) {
      throw new FirestoreException("Not signed in");
    }
    return token;
  }
}
