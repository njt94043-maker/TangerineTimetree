/**
 * IndexedDB storage for local takes (non-best takes).
 * Best takes are uploaded to Supabase (D-145).
 * Non-best takes stay here for local playback/review.
 */

const DB_NAME = 'tgt-takes';
const DB_VERSION = 1;
const STORE_NAME = 'takes';

export interface LocalTake {
  /** Composite key: `${song_id}:${user_id}:${take_number}` */
  id: string;
  song_id: string;
  user_id: string;
  take_number: number;
  audio_blob: Blob;
  duration_seconds: number;
  label: string; // StemLabel: 'drums', 'bass', etc.
  created_at: string; // ISO string
  /** Video blob if camera was on (D-132, stays local) */
  video_blob?: Blob;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by_song_user', ['song_id', 'user_id'], { unique: false });
        store.createIndex('by_song', 'song_id', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save a take to IndexedDB */
export async function saveTakeLocally(take: LocalTake): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(take);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Get all local takes for a song by the current user */
export async function getUserTakesLocal(songId: string, userId: string): Promise<LocalTake[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const idx = tx.objectStore(STORE_NAME).index('by_song_user');
    const req = idx.getAll([songId, userId]);
    req.onsuccess = () => {
      db.close();
      const takes = req.result as LocalTake[];
      takes.sort((a, b) => a.take_number - b.take_number);
      resolve(takes);
    };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

/** Get next take number for a song/user (max + 1, D-143) */
export async function getNextTakeNumber(songId: string, userId: string): Promise<number> {
  const takes = await getUserTakesLocal(songId, userId);
  if (takes.length === 0) return 1;
  return Math.max(...takes.map(t => t.take_number)) + 1;
}

/** Delete a local take by id */
export async function deleteTakeLocally(takeId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(takeId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Delete all local takes for a song/user */
export async function deleteAllTakesLocally(songId: string, userId: string): Promise<void> {
  const takes = await getUserTakesLocal(songId, userId);
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    for (const take of takes) {
      store.delete(take.id);
    }
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Get the best local take with video for View Mode playback (D-146) */
export async function getBestTakeWithVideo(songId: string, userId: string): Promise<LocalTake | null> {
  const takes = await getUserTakesLocal(songId, userId);
  // Return the most recent take that has a video blob
  const withVideo = takes.filter(t => t.video_blob != null);
  if (withVideo.length === 0) return null;
  return withVideo[withVideo.length - 1]; // last = highest take number
}

/** Build composite key */
export function makeTakeId(songId: string, userId: string, takeNumber: number): string {
  return `${songId}:${userId}:${takeNumber}`;
}
