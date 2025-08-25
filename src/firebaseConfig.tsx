// src/firebaseConfig.ts
import { initializeApp, type FirebaseApp } from "firebase/app"
import { getAuth, type Auth } from "firebase/auth"
import { initializeFirestore, type Firestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
} as const

// Varsayılan app
export const app: FirebaseApp = initializeApp(firebaseConfig)
export const auth: Auth = getAuth(app)

// İkinci app (adı zorunlu)
export const secondaryApp: FirebaseApp = initializeApp(firebaseConfig, "Secondary")
export const secondaryAuth: Auth = getAuth(secondaryApp)

// Firestore — long-polling otomatik algılama açık
export const db: Firestore = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
})

export default app
