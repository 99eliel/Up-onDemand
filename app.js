// Importações da SDK Modular do Firebase via CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// Credenciais oficiais do projeto UpAgro
const firebaseConfig = {
    apiKey: "AIzaSyCTEmqxiRR6SbzZDcqnn0wMrPvm2IFSDXw",
    authDomain: "upagro-caa98.firebaseapp.com",
    databaseURL: "https://upagro-caa98-default-rtdb.firebaseio.com",
    projectId: "upagro-caa98",
    storageBucket: "upagro-caa98.firebasestorage.app",
    messagingSenderId: "364703805987",
    appId: "1:364703805987:web:8c75b8931a48b3f7c63796",
    measurementId: "G-GG4CLWL3QB"
};

// Inicialização dos Serviços
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// Variáveis Globais
let currentUser = null;
let selectedFile = null;

// Elementos da Interface
const loginScreen = document.getElementById('login-screen');
const profileScreen = document.getElementById('profile-screen');
const btnGoogleLogin = document.getElementById('btn-google-login');
const btnLogout = document.getElementById('btn-logout');
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const userPhoto = document.getElementById('user-photo');
const toggleWhiteLabel = document.getElementById('toggle-white-label');
const logoUploadArea = document.getElementById('logo-upload-area');
const logoUploadInput = document.getElementById('logo-upload');
const logoPreviewContainer = document.getElementById('logo-preview-container');
const logoPreview = document.getElementById('logo-preview');
const btnSaveProfile = document.getElementById('btn-save-profile');
const btnNextStep = document.getElementById('btn-next-step');

// Função para gerenciar a troca de telas
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Carrega os dados do Firestore
async function loadUserProfile(user) {
    try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.whiteLabelActive) {
                toggleWhiteLabel.checked = true;
                logoUploadArea.classList.remove('hidden');
                if (data.logoUrl) {
                    logoPreview.src = data.logoUrl;
                    logoPreviewContainer.classList.remove('hidden');
                }
            } else {
                toggleWhiteLabel.checked = false;
                logoUploadArea.classList.add('hidden');
            }
        } else {
            await setDoc(docRef, {
                name: user.displayName,
                email: user.email,
                whiteLabelActive: false,
                logoUrl: ""
            });
            toggleWhiteLabel.checked = false;
            logoUploadArea.classList.add('hidden');
        }
    } catch (error) {
        console.error("Erro ao carregar perfil:", error);
    }
}

// Monitor de Sessão
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        userName.textContent = user.displayName;
        userEmail.textContent = user.email;
        if (user.photoURL) {
            userPhoto.src = user.photoURL;
            userPhoto.style.display = 'inline-block';
        }
        await loadUserProfile(user);
        showScreen('profile-screen');
    } else {
        currentUser = null;
        showScreen('login-screen');
    }
});

// Ações de Botões
btnGoogleLogin.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(error => console.error("Erro no login:", error));
});

btnLogout.addEventListener('click', () => {
    signOut(auth).then(() => {
        logoPreviewContainer.classList.add('hidden');
        logoPreview.src = "";
        selectedFile = null;
    });
});

toggleWhiteLabel.addEventListener('change', (e) => {
    if (e.target.checked) {
        logoUploadArea.classList.remove('hidden');
    } else {
        logoUploadArea.classList.add('hidden');
        logoPreviewContainer.classList.add('hidden');
        logoPreview.src = "";
        selectedFile = null;
    }
});

logoUploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = function(event) {
            logoPreview.src = event.target.result;
            logoPreviewContainer.classList.remove('hidden');
        }
        reader.readAsDataURL(file);
    }
});

btnSaveProfile.addEventListener('click', async () => {
    if (!currentUser) return;
    btnSaveProfile.disabled = true;
    btnSaveProfile.textContent = "Salvando...";

    try {
        const userDocRef = doc(db, "users", currentUser.uid);
        let logoUrl = logoPreview.src.startsWith('http') ? logoPreview.src : "";

        if (toggleWhiteLabel.checked && selectedFile) {
            const storageRef = ref(storage, `logos/${currentUser.uid}_${selectedFile.name}`);
            const snapshot = await uploadBytes(storageRef, selectedFile);
            logoUrl = await getDownloadURL(snapshot.ref);
        }

        await setDoc(userDocRef, {
            name: currentUser.displayName,
            email: currentUser.email,
            whiteLabelActive: toggleWhiteLabel.checked,
            logoUrl: toggleWhiteLabel.checked ? logoUrl : ""
        }, { merge: true });

        alert("Configurações salvas!");
        selectedFile = null;
    } catch (error) {
        console.error("Erro ao salvar:", error);
        alert("Erro ao salvar.");
    } finally {
        btnSaveProfile.disabled = false;
        btnSaveProfile.textContent = "Salvar Configurações";
    }
});

btnNextStep.addEventListener('click', () => {
    alert("Próxima etapa em desenvolvimento.");
});

// ==========================================
// LÓGICA DO SERVICE WORKER E AUTO-UPDATE
// ==========================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((registration) => {
        console.log('SW registrado com escopo:', registration.scope);
        
        // Sempre que carregar a página, checa se tem um SW novo no servidor
        registration.update();
    });

    // Se um novo Service Worker assumir o controle (porque o sw.js no GitHub mudou),
    // a página é recarregada automaticamente para pegar o código HTML/JS/CSS novo.
    let refreshing;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });
}
