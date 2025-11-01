import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCc2S--XG8PlVYFwopYOTBU23fg4LL2m1g",
  authDomain: "eduflex-53f92.firebaseapp.com",
  projectId: "eduflex-53f92",
  storageBucket: "eduflex-53f92.firebasestorage.app",
  messagingSenderId: "802519341041",
  appId: "1:802519341041:web:9b0773e818c1e53de1d650",
  measurementId: "G-BHB7FXL9KJ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export default app;
