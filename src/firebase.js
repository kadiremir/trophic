import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

// ── Replace these values with your Firebase project config ────────────────────
// Firebase console → Project settings → Your apps → Web app → SDK setup
const firebaseConfig = {
  apiKey: "AIzaSyDjU7GGVS2dkSM3Lj7OIjPUgNJyU1UnYgI",
  authDomain: "trophic.firebaseapp.com",
  projectId: "trophic",
  storageBucket: "trophic.firebasestorage.app",
  messagingSenderId: "907688799149",
  appId: "1:907688799149:web:9c3c253b3a846de7330f24"
};
// ─────────────────────────────────────────────────────────────────────────────

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function signOutUser() {
  return signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// ── Firestore progress helpers ────────────────────────────────────────────────

function progressRef(uid) {
  return doc(db, 'users', uid, 'data', 'progress');
}

export async function loadProgress(uid) {
  const snap = await getDoc(progressRef(uid));
  if (!snap.exists()) return null;
  return snap.data(); // { unlocked, completed }
}

export async function saveProgress(uid, unlocked, completed, version) {
  await setDoc(progressRef(uid), { version, unlocked, completed: [...completed] });
}
