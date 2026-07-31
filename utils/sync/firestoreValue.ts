/**
 * Converts between plain JSON and Firestore REST API's typed "Value" wire format (each
 * field wrapped as `{"stringValue": "..."}`, etc, see
 * https://firebase.google.com/docs/firestore/reference/rest/v1/Value).
 *
 * Only handles the value types reminders-web actually uses (numbers/strings/bools/
 * arrays/maps/null), no timestampValue, referenceValue, geoPointValue, bytesValue.
 */

export type JsonValue =
  | boolean
  | JsonValue[]
  | null
  | number
  | string
  | { [key: string]: JsonValue };

type FirestoreValue = Record<string, unknown>;

/** A plain JSON field map into Firestore's per-field typed wrapper, ready to send as a
 *  document's `fields`. */
export function encodeFields(
  fields: Record<string, JsonValue | undefined>
): Record<string, FirestoreValue> {
  const out: Record<string, FirestoreValue> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = encodeValue(value);
  }
  return out;
}

function encodeValue(value: JsonValue | undefined): FirestoreValue {
  // A field explicitly set to undefined (e.g. an optional Task field like `date`)
  // encodes the same as an absent/null one, Firestore has no "undefined" value type.
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === "object") {
    return { mapValue: { fields: encodeFields(value) } };
  }
  if (typeof value === "boolean") {
    return { booleanValue: value };
  }
  if (typeof value === "number") {
    // Firestore's wire format encodes integerValue as a numeric *string*, unlike every
    // other numeric field type.
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  return { stringValue: value };
}

/** The `fields` map from a Firestore document response back into plain JSON. */
export function decodeFields(
  fields: Record<string, unknown>
): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] = decodeValue(value as FirestoreValue);
  }
  return out;
}

function decodeValue(value: FirestoreValue): JsonValue {
  if (!value) {
    return null;
  }
  if ("stringValue" in value) {
    return value.stringValue as string;
  }
  if ("booleanValue" in value) {
    return value.booleanValue as boolean;
  }
  if ("integerValue" in value) {
    return Number(value.integerValue);
  }
  if ("doubleValue" in value) {
    return value.doubleValue as number;
  }
  if ("arrayValue" in value) {
    const values =
      ((value.arrayValue as { values?: FirestoreValue[] } | undefined)
        ?.values ?? []) as FirestoreValue[];
    return values.map(decodeValue);
  }
  if ("mapValue" in value) {
    const innerFields =
      (value.mapValue as { fields?: Record<string, unknown> } | undefined)
        ?.fields ?? {};
    return decodeFields(innerFields);
  }
  return null; // nullValue, or an unrecognized/absent Value variant.
}
