/**
 * ROSMIL LEAGUE — Configuración de Firebase
 * ==========================================
 * Para conectar tu base de datos de Firebase:
 * 1. Entra a la consola de Firebase: https://console.firebase.google.com/
 * 2. Abre tu proyecto.
 * 3. En la vista general del proyecto, haz clic en el ícono de Web (</>) para registrar una app.
 * 4. Ponle un nombre (por ejemplo "ROSMIL Web") y copia el objeto 'firebaseConfig'.
 * 5. Reemplaza los valores de abajo con los de tu proyecto.
 * 6. En el menú izquierdo de Firebase, ve a "Firestore Database" -> "Crear base de datos"
 *    y en Reglas selecciona "Modo de prueba" (o allow read, write: if true;).
 */

const firebaseConfig = {
  apiKey: "AIzaSyBhMYeQGjqqS1EGWh860bMCDOnTZUALKD8",
  authDomain: "rosmilleague-4ba44.firebaseapp.com",
  projectId: "rosmilleague-4ba44",
  storageBucket: "rosmilleague-4ba44.firebasestorage.app",
  messagingSenderId: "526724527400",
  appId: "1:526724527400:web:391d25c535eb062c9acc1d",
  measurementId: "G-Z9WQ4HDCRX"
};

// Variables globales de Firebase
let firebaseInitialized = false;
let firestoreDb = null;

// Inicialización automática
try {
  // Verifica si el usuario ya reemplazó la clave de ejemplo
  const isConfigured =
    firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.includes("PEGA_AQUI") &&
    firebaseConfig.projectId &&
    !firebaseConfig.projectId.includes("PEGA_AQUI");

  if (typeof firebase !== "undefined" && isConfigured) {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    firestoreDb = firebase.firestore();
    firebaseInitialized = true;
    console.log("✅ Conectado exitosamente a Firebase Firestore.");
  } else {
    console.log(
      "ℹ️ ROSMIL LEAGUE funcionando en modo Local (LocalStorage). Para conectar a la nube, completa tus claves en js/firebase-config.js"
    );
  }
} catch (error) {
  console.error("❌ Error al inicializar Firebase:", error);
}
