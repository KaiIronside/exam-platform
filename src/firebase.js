// src/firebase.js
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getFunctions } from 'firebase/functions'

const firebaseConfig = {
  apiKey: "AIzaSyArhalMHmTGJijCbsCzGATRGopaGgGIP-A",
  authDomain: "exam-ai-platform-71c4a.firebaseapp.com",
  projectId: "exam-ai-platform-71c4a",
  storageBucket: "exam-ai-platform-71c4a.firebasestorage.app",
  messagingSenderId: "267205996435",
  appId: "1:267205996435:web:64ba2c47fc4acd4ba68266"
}

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)
export const auth = getAuth(app)
export const functions = getFunctions(app, 'asia-southeast1')

export default app