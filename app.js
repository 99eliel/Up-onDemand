// Importações da SDK Modular do Firebase via CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-analytics.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

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

// Inicialização
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();

// Variáveis Globais de Estado
let currentUser = null;
let selectedLogoFile = null;
let selectedKmlFile = null;
let currentOrderData = {}; // Guarda os dados do form antes do checkout

// Elementos da Interface - Telas
const loginScreen = document.getElementById('login-screen');
const profileScreen = document.getElementById('profile-screen');
const requestScreen = document.getElementById('request-screen');
const checkoutScreen = document.getElementById('checkout-screen');

// Elementos - Navegação
const btnBackProfile = document.getElementById('btn-back-profile');
const btnBackRequest = document.getElementById('btn-back-request');
const loadingOverlay = document.getElementById('loading-overlay');

// Elementos - Checkout (Tela 3)
const orderSummaryList = document.getElementById('order-summary-list');
const termsCheckbox = document.getElementById('terms-checkbox');
const btnPayPix = document.getElementById('btn-pay-pix');
const btnPayCard = document.getElementById('btn-pay-card');

// Funções Utilitárias
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    window.scrollTo(0, 0);
}

// ==========================================
// AUTENTICAÇÃO E PERFIL (Tela 1 e 1.5)
// ==========================================
async function loadUserProfile(user) {
    try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        const toggleWhiteLabel = document.getElementById('toggle-white-label');
        const logoUploadArea = document.getElementById('logo-upload-area');
        const logoPreviewContainer = document.getElementById('logo-preview-container');
        const logoPreview = document.getElementById('logo-preview');

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
            await setDoc(docRef, { name: user.displayName, email: user.email, whiteLabelActive: false, logoUrl: "" });
            toggleWhiteLabel.checked = false;
            logoUploadArea.classList.add('hidden');
        }
    } catch (error) { console.error("Erro ao carregar perfil:", error); }
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('user-name').textContent = user.displayName;
        document.getElementById('user-email').textContent = user.email;
        if (user.photoURL) {
            document.getElementById('user-photo').src = user.photoURL;
            document.getElementById('user-photo').style.display = 'inline-block';
        }
        await loadUserProfile(user);
        showScreen('profile-screen');
    } else {
        currentUser = null;
        showScreen('login-screen');
    }
});

document.getElementById('btn-google-login').addEventListener('click', () => signInWithPopup(auth, provider));
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

document.getElementById('btn-save-profile').addEventListener('click', async () => {
    if (!currentUser) return;
    const btnSave = document.getElementById('btn-save-profile');
    const isWhiteLabel = document.getElementById('toggle-white-label').checked;
    const logoPreview = document.getElementById('logo-preview');
    
    btnSave.disabled = true;
    btnSave.textContent = "Salvando...";

    try {
        const userDocRef = doc(db, "users", currentUser.uid);
        let logoUrl = logoPreview.src.startsWith('http') ? logoPreview.src : "";

        if (isWhiteLabel && selectedLogoFile) {
            const storageRef = ref(storage, `logos/${currentUser.uid}_${selectedLogoFile.name}`);
            const snapshot = await uploadBytes(storageRef, selectedLogoFile);
            logoUrl = await getDownloadURL(snapshot.ref);
        }

        await setDoc(userDocRef, {
            name: currentUser.displayName,
            email: currentUser.email,
            whiteLabelActive: isWhiteLabel,
            logoUrl: isWhiteLabel ? logoUrl : ""
        }, { merge: true });

        alert("Configurações salvas!");
        selectedLogoFile = null;
    } catch (error) {
        console.error("Erro:", error);
        alert("Erro ao salvar.");
    } finally {
        btnSave.disabled = false;
        btnSave.textContent = "Salvar Configurações";
    }
});

// Outros controles de interface menores do Perfil (Switch e Preview)
document.getElementById('toggle-white-label').addEventListener('change', (e) => {
    document.getElementById('logo-upload-area').classList.toggle('hidden', !e.target.checked);
});
document.getElementById('logo-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        selectedLogoFile = file;
        const reader = new FileReader();
        reader.onload = (event) => {
            document.getElementById('logo-preview').src = event.target.result;
            document.getElementById('logo-preview-container').classList.remove('hidden');
        }
        reader.readAsDataURL(file);
    }
});

// ==========================================
// TELA 2 (FORMULÁRIO DE SERVIÇO)
// ==========================================
document.getElementById('btn-next-step').addEventListener('click', () => showScreen('request-screen'));
btnBackProfile.addEventListener('click', () => showScreen('profile-screen'));

document.getElementById('kml-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const display = document.getElementById('kml-filename');
    if (file) {
        selectedKmlFile = file;
        display.textContent = `✔ ${file.name}`;
        display.style.color = 'var(--primary-dark)';
    } else {
        selectedKmlFile = null;
        display.textContent = "Anexar Arquivo .KML ou .SHP (Zip) *";
        display.style.color = 'var(--text-muted)';
    }
});

document.getElementById('compass-slider').addEventListener('input', (e) => {
    document.getElementById('compass-arrow').style.transform = `rotate(${e.target.value}deg)`;
    document.getElementById('compass-value').textContent = `${e.target.value}°`;
});

document.getElementById('service-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!selectedKmlFile) {
        alert("Por favor, anexe o arquivo KML/SHP.");
        return;
    }

    // Guarda os dados preenchidos globalmente para a Tela 3
    currentOrderData = {
        farmName: document.getElementById('farm-name').value,
        fieldName: document.getElementById('field-name').value,
        operationType: document.getElementById('operation-type').value,
        implementWidth: document.getElementById('implement-width').value,
        gpsModel: document.getElementById('gps-model').value,
        compassDegree: document.getElementById('compass-slider').value,
        observations: document.getElementById('observations').value,
        fileName: selectedKmlFile.name
    };

    // Preenche o resumo visual na Tela 3
    orderSummaryList.innerHTML = `
        <li><strong>Fazenda:</strong> ${currentOrderData.farmName}</li>
        <li><strong>Talhão:</strong> ${currentOrderData.fieldName}</li>
        <li><strong>Operação:</strong> ${currentOrderData.operationType}</li>
        <li><strong>Largura:</strong> ${currentOrderData.implementWidth}m</li>
        <li><strong>Monitor:</strong> ${currentOrderData.gpsModel}</li>
        <li><strong>Rumo:</strong> ${currentOrderData.compassDegree}°</li>
        <li><strong>Arquivo:</strong> ${currentOrderData.fileName}</li>
    `;

    // Reseta o checkbox e botões de pagamento da Tela 3
    termsCheckbox.checked = false;
    btnPayPix.disabled = true;
    btnPayCard.disabled = true;

    showScreen('checkout-screen');
});

// ==========================================
// TELA 3 (CHECKOUT E TERMO)
// ==========================================
btnBackRequest.addEventListener('click', () => showScreen('request-screen'));

// Só habilita pagamento se concordar com o termo
termsCheckbox.addEventListener('change', (e) => {
    btnPayPix.disabled = !e.target.checked;
    btnPayCard.disabled = !e.target.checked;
});

// Ação final: Simula pagamento e envia pedido para o Firebase
btnPayPix.addEventListener('click', async () => {
    if (!currentUser || !selectedKmlFile) return;
    
    loadingOverlay.style.display = 'flex'; // Mostra tela de carregamento

    try {
        // 1. Upload do arquivo KML/SHP para o Storage
        const timestamp = new Date().getTime();
        const filePath = `orders_files/${currentUser.uid}/${timestamp}_${selectedKmlFile.name}`;
        const storageRef = ref(storage, filePath);
        const snapshot = await uploadBytes(storageRef, selectedKmlFile);
        const fileUrl = await getDownloadURL(snapshot.ref);

        // 2. Cria o registro do pedido no Firestore
        const orderDoc = {
            userId: currentUser.uid,
            userName: currentUser.displayName,
            userEmail: currentUser.email,
            ...currentOrderData,
            fileUrl: fileUrl,
            status: 'Em Processamento', // Status inicial para a fila do kanban
            createdAt: serverTimestamp(),
            price: 49.90,
            paymentMethod: 'PIX',
            paymentStatus: 'Aprovado' // Simulado
        };

        const ordersCollectionRef = collection(db, "orders");
        await addDoc(ordersCollectionRef, orderDoc);

        // 3. Sucesso e Limpeza
        alert("Pagamento Aprovado e Pedido Enviado com Sucesso!");
        
        // Limpa o formulário e arquivos
        document.getElementById('service-form').reset();
        selectedKmlFile = null;
        document.getElementById('kml-filename').textContent = "Anexar Arquivo .KML ou .SHP (Zip) *";
        document.getElementById('kml-filename').style.color = 'var(--text-muted)';
        document.getElementById('compass-arrow').style.transform = `rotate(0deg)`;
        document.getElementById('compass-value').textContent = `0°`;

        // Volta pra tela de perfil
        showScreen('profile-screen');

    } catch (error) {
        console.error("Erro ao enviar pedido:", error);
        alert("Ocorreu um erro ao processar seu pedido. Tente novamente.");
    } finally {
        loadingOverlay.style.display = 'none'; // Esconde tela de carregamento
    }
});

// ==========================================
// LÓGICA DO SERVICE WORKER (Auto Update)
// ==========================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((registration) => registration.update());
    let refreshing;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });
}
