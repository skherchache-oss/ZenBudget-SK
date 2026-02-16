import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  User
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { getStorage } from "firebase/storage";
// AJOUT : Import pour l'IA Google
import { GoogleGenerativeAI } from "@google/generative-ai";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// AJOUT : Initialisation de l'IA (Utilisée pour ton Dashboard)
const genAIKey = import.meta.env.VITE_GOOGLE_GENAI_API_KEY;
export const genAI = new GoogleGenerativeAI(genAIKey);

// --- Logique de création de document utilisateur ---
const ensureUserDocument = async (user: User) => {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      user: {
        id: user.uid,
        name: user.displayName || 'Utilisateur',
        email: user.email,
        photoURL: user.photoURL || null
      },
      accounts: [],
      categories: [],
      activeAccountId: null,
      createdAt: new Date().toISOString()
    });
  }
};

// --- Fonctions utilitaires exportées ---

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await ensureUserDocument(result.user);
    return result.user;
  } catch (error) {
    console.error("Erreur Google Sign-In:", error);
    throw error;
  }
};

export const registerWithEmail = async (email: string, pass: string, name: string) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(result.user, { displayName: name });
    await ensureUserDocument({ ...result.user, displayName: name } as User);
    return result.user;
  } catch (error) {
    console.error("Erreur Inscription Email:", error);
    throw error;
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Erreur Sign-Out:", error);
  }
};