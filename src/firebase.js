import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCHeeWpFaxADs57a2u5K-ol3HJcZh87Dx0",
  authDomain: "smart-door-lock-9b00f.firebaseapp.com",
  databaseURL: "https://smart-door-lock-9b00f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smart-door-lock-9b00f",
  storageBucket: "smart-door-lock-9b00f.firebasestorage.app",
  messagingSenderId: "787759627991",
  appId: "1:787759627991:web:a4e57539e72075bcbb7a92"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);