// Importações da SDK Modular do Firebase (Carregadas via CDN para não depender de build/Node.js)
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

// Suas credenciais oficiais do projeto UpAgro
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

// Inicialização dos Serviços do Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app); // Analytics ativado conforme sua chave
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// Variável global para armazenar os dados do usuário autenticado
let currentUser = null;
let selectedFile = null;

// Elementos da Interface - Telas
const loginScreen = document.getElementById('login-screen');
const profileScreen = document.getElementById('profile-screen');

// Elementos da Interface - Autenticação
const btnGoogleLogin = document.getElementById('btn-google-login');
const btnLogout = document.getElementById('btn-logout');
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const userPhoto = document.getElementById('user-photo');

// Elementos da Interface - Perfil (White Label)
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

// Carrega os dados de perfil do usuário guardados no Firestore
async function loadUserProfile(user) {
    try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Aplica a configuração do switch White Label
            if (data.whiteLabelActive) {
                toggleWhiteLabel.checked = true;
                logoUploadArea.classList.remove('hidden');
                
                // Se houver uma logo já salva no Storage, exibe na tela
                if (data.logoUrl) {
                    logoPreview.src = data.logoUrl;
                    logoPreviewContainer.classList.remove('hidden');
                }
            } else {
                toggleWhiteLabel.checked = false;
                logoUploadArea.classList.add('hidden');
            }
        } else {
            // Caso seja o primeiro login do usuário, cria um registro inicial limpo
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
        console.error("Erro ao carregar perfil do Firestore:", error);
    }
}

// Monitora o estado de autenticação do usuário (Sessão ativa ou não)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        userName.textContent = user.displayName;
        userEmail.textContent = user.email;
        if (user.photoURL) {
            userPhoto.src = user.photoURL;
            userPhoto.style.display = 'inline-block';
        }
        
        // Busca as configurações do Firestore antes de exibir a tela
        await loadUserProfile(user);
        showScreen('profile-screen');
    } else {
        currentUser = null;
        showScreen('login-screen');
    }
});

// Ação de Login com Google
btnGoogleLogin.addEventListener('click', () => {
    signInWithPopup(auth, provider)
        .then((result) => {
            console.log("Login efetuado com sucesso:", result.user.displayName);
        }).catch((error) => {
            console.error("Erro ao tentar autenticar:", error);
            alert("Erro na autenticação. Verifique sua conexão.");
        });
});

// Ação de Logout
btnLogout.addEventListener('click', () => {
    signOut(auth).then(() => {
        logoPreviewContainer.classList.add('hidden');
        logoPreview.src = "";
        selectedFile = null;
        console.log("Sessão encerrada.");
    }).catch((error) => {
        console.error("Erro ao sair da conta:", error);
    });
});

// Controla a visibilidade da área de upload ao alternar o switch
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

// Captura o arquivo de imagem selecionado e gera o preview local temporário
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

// Salva as configurações de Perfil e faz o upload da logo se necessário
btnSaveProfile.addEventListener('click', async () => {
    if (!currentUser) return;

    btnSaveProfile.disabled = true;
    btnSaveProfile.textContent = "Salvando...";

    try {
        const userDocRef = doc(db, "users", currentUser.uid);
        let logoUrl = logoPreview.src.startsWith('http') ? logoPreview.src : "";

        // Se o White Label está ativo e há um novo arquivo local selecionado para upload
        if (toggleWhiteLabel.checked && selectedFile) {
            // Define a referência do arquivo no Storage usando o UID do usuário para evitar duplicados
            const storageRef = ref(storage, `logos/${currentUser.uid}_${selectedFile.name}`);
            
            // Executa o upload dos bytes da imagem
            const snapshot = await uploadBytes(storageRef, selectedFile);
            // Captura a URL pública gerada pelo Storage
            logoUrl = await getDownloadURL(snapshot.ref);
        }

        // Atualiza as informações no banco de dados Firestore
        await setDoc(userDocRef, {
            name: currentUser.displayName,
            email: currentUser.email,
            whiteLabelActive: toggleWhiteLabel.checked,
            logoUrl: toggleWhiteLabel.checked ? logoUrl : ""
        }, { merge: true });

        alert("Configurações salvas com sucesso!");
        selectedFile = null; // Limpa a seleção temporária após o sucesso
    } catch (error) {
        console.error("Erro ao salvar configurações:", error);
        alert("Ocorreu um erro ao salvar. Tente novamente.");
    } finally {
        btnSaveProfile.disabled = false;
        btnSaveProfile.textContent = "Salvar Configurações";
    }
});

// Avança para a próxima etapa do fluxo
btnNextStep.addEventListener('click', () => {
    alert("Próxima etapa: Tela 2 - Solicitação do Serviço.");
});
