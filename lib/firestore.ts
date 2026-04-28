import {
  collection,
  doc,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "./firebase";
import type { EnrichedLead, HistoryEntry } from "./types";

function historyCollectionRef(uid: string) {
  return collection(getFirebaseDb(), "users", uid, "history");
}

/** Save a new history entry for the signed-in user. */
export async function saveHistoryEntryToFirestore(
  uid: string,
  leads: EnrichedLead[],
  label: string
): Promise<void> {
  const ref = historyCollectionRef(uid);
  await addDoc(ref, {
    uid,
    timestamp: serverTimestamp(),
    label,
    leads,
  });
}

/** Load all history entries for the signed-in user, newest first. */
export async function loadHistoryFromFirestore(uid: string): Promise<HistoryEntry[]> {
  const ref = historyCollectionRef(uid);
  const q = query(ref, orderBy("timestamp", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    const ts: number =
      data.timestamp instanceof Timestamp
        ? data.timestamp.toMillis()
        : Date.now();
    return {
      id: d.id,
      sessionId: uid,
      timestamp: ts,
      label: data.label as string,
      leads: data.leads as EnrichedLead[],
    };
  });
}

/** Delete a single history entry. */
export async function deleteHistoryEntry(uid: string, entryId: string): Promise<void> {
  const ref = doc(getFirebaseDb(), "users", uid, "history", entryId);
  await deleteDoc(ref);
}

/** Delete all history for the signed-in user. */
export async function clearFirestoreHistory(uid: string): Promise<void> {
  const ref = historyCollectionRef(uid);
  const snap = await getDocs(ref);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}
