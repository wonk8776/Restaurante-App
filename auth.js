/**
 * auth.js
 * Maneja la lógica de autenticación y redirección
 */

// Referencias al DOM
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const errorMessage = document.getElementById('errorMessage');

// Función para mostrar errores en la UI
function showError(message) {
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.classList.add('visible');

        // Ocultar error después de 5 segundos
        setTimeout(() => {
            errorMessage.classList.remove('visible');
        }, 5000);
    }
}

// Función para alternar estado de carga
function setLoading(isLoading) {
    if (loginBtn) {
        if (isLoading) {
            loginBtn.classList.add('loading');
            loginBtn.disabled = true;
        } else {
            loginBtn.classList.remove('loading');
            loginBtn.disabled = false;
        }
    }
}

// Manejar el envío del formulario de login
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const email = emailInput.value;
        const password = passwordInput.value;

        if (!email || !password) {
            showError('Por favor complete todos los campos.');
            return;
        }

        setLoading(true);

        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Login exitoso, obtener rol del usuario
                checkUserRole(userCredential.user.uid);
            })
            .catch((error) => {
                setLoading(false);
                console.error("Error de login:", error);

                let msg = 'Error al iniciar sesión.';
                switch (error.code) {
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                        msg = 'Credenciales incorrectas.';
                        break;
                    case 'auth/invalid-email':
                        msg = 'El correo electrónico no es válido.';
                        break;
                    case 'auth/too-many-requests':
                        msg = 'Demasiados intentos. Intente más tarde.';
                        break;
                }
                showError(msg);
            });
    });
}

// Verificar el rol del usuario en Firestore y redirigir
function checkUserRole(uid) {
    console.log('checkUserRole uid:', uid);
    db.collection('usuarios').get().then(snap => console.log('Total docs en usuarios:', snap.size));
    db.collection('usuarios').doc(uid).get()
        .then((doc) => {
            console.log('doc.exists:', doc.exists, 'data:', doc.data());
            if (doc.exists) {
                const rol = doc.data().rol;
                if (rol === 'admin') {
                    window.location.href = 'index.html';
                } else if (rol === 'mesero') {
                    window.location.href = 'mesero.html';
                } else {
                    setLoading(false);
                    showError('Su usuario no tiene un rol asignado.');
                    auth.signOut();
                }
            } else {
                setLoading(false);
                showError('No se encontró información del usuario.');
                auth.signOut();
            }
        })
        .catch((error) => {
            setLoading(false);
            console.error('Error Firestore:', error);
            showError('Error verificando permisos: ' + error.message);
            auth.signOut();
        });
}

// Listener de estado de autenticación (Opcional, para proteger páginas)
// Nota: Como login.html es la entrada, esto podría usarse en otras páginas para redirigir al login
// Listener de estado de autenticación
auth.onAuthStateChanged((user) => {
    var paginasPublicas = ['login.html', 'cocina.html'];
    var esPublica = paginasPublicas.some(function (p) {
        return window.location.pathname.includes(p);
    });

    // Mantener compatibilidad: login.html detectado por formulario también es pública
    if (document.getElementById('loginForm') !== null) {
        esPublica = true;
    }

    if (user) {
        if (!user.isAnonymous && esPublica && document.getElementById('loginForm') !== null) {
            console.log('Sesión activa detectada en login. Verificando rol...');
            checkUserRole(user.uid);
        }
    } else {
        if (!esPublica) {
            console.log('Sin sesión activa. Redirigiendo a login...');
            window.location.href = 'login.html';
        }
    }
});
