// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebase = {
  apiKey: "AIzaSyDrBWwlpWDKv9cX6KIuVplJuikWxn6QzlE",
  authDomain: "my-first-app-db089.firebaseapp.com",
  projectId: "my-first-app-db089",
  storageBucket: "my-first-app-db089.appspot.com",
  messagingSenderId: "964021791659",
  appId: "1:964021791659:web:c32b78853e47993b5780ee"
};

// Initialize Firebase
const app = initializeApp(firebase);
// Initialize Firestore and Storage
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };