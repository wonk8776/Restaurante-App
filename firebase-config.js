const firebaseConfig = {
  apiKey: "AIzaSyBG34IMqRZcqnw2eMspqb7tuHEL3Wi5bN4",
  authDomain: "restaurante-app-101ec.firebaseapp.com",
  projectId: "restaurante-app-101ec",
  storageBucket: "restaurante-app-101ec.firebasestorage.app",
  messagingSenderId: "493007993831",
  appId: "1:493007993831:web:add80d9e53a08bafc59b42"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();