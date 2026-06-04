import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyCTEmqxiRR6SbzZDcqnn0wMrPvm2IFSDXw",
    authDomain: "upagro-caa98.firebaseapp.com",
    databaseURL: "https://upagro-caa98-default-rtdb.firebaseio.com",
    projectId: "upagro-caa98",
    storageBucket: "upagro-caa98.firebasestorage.app",
    messagingSenderId: "364703805987",
    appId: "1:364703805987:web:8c75b8931a48b3f7c63796"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Variáveis Globais de Estado
let currentUserData = null; // Guardará { cpf, dob, name, whatsapp, etc }
let selectedLogoFile = null;
let selectedKmlFile = null;
let currentOrderData = {};
let tempLoginData = {}; // Guarda CPF e Data temporariamente durante o cadastro

// Utilitários de Interface e Navegação
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    window.scrollTo(0, 0);
}

const showLoading = (msg) => {
    const overlay = document.getElementById('loading-overlay');
    overlay.querySelector('h2').textContent = msg;
    overlay.style.display = 'flex';
};
const hideLoading = () => document.getElementById('loading-overlay').style.display = 'none';

// Máscaras de Input (Formatação automática)
const maskCPF = (val) => val.replace(/\D/g, "").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})/, "$1-$2").replace(/(-\d{2})\d+?$/, "$1");
const maskPhone = (val) => val.replace(/\D/g, "").replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").replace(/(-\d{4})\d+?$/, "$1");

document.getElementById('login-cpf').addEventListener('input', (e) => e.target.value = maskCPF(e.target.value));
document.getElementById('reg-whatsapp').addEventListener('input', (e) => e.target.value = maskPhone(e.target.value));

// ==========================================
// FLUXO DE LOGIN (CPF + DATA)
// ==========================================
// 1. Checa se o usuário já tem sessão salva no celular ao abrir o app
const savedCpf = localStorage.getItem('upagri_user_cpf');
if (savedCpf) {
    autoLogin(savedCpf);
}

// 2. Tenta fazer login automático
async function autoLogin(cpf) {
    showLoading('Carregando Perfil...');
    try {
        const docSnap = await getDoc(doc(db, "users", cpf));
        if (docSnap.exists()) {
            currentUserData = docSnap.data();
            currentUserData.cpf = cpf; // Adiciona o CPF ao objeto
            setupProfileScreen();
            showScreen('profile-screen');
        } else {
            localStorage.removeItem('upagri_user_cpf');
            showScreen('login-screen');
        }
    } catch (error) {
        console.error("Erro no login automático:", error);
        showScreen('login-screen');
    } finally {
        hideLoading();
    }
}

// 3. Ação do Botão de Entrar
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cpf = document.getElementById('login-cpf').value.replace(/\D/g, ""); // Extrai só números
    const dob = document.getElementById('login-dob').value; // Formato YYYY-MM-DD

    if (cpf.length !== 11) {
        alert("Digite um CPF válido.");
        return;
    }

    showLoading('Verificando Acesso...');
    try {
        const docRef = doc(db, "users", cpf);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // Usuário existe, checar a Data de Nascimento
            const data = docSnap.data();
            if (data.dob === dob) {
                // Login Autorizado
                localStorage.setItem('upagri_user_cpf', cpf);
                currentUserData = data;
                currentUserData.cpf = cpf;
                setupProfileScreen();
                showScreen('profile-screen');
            } else {
                alert("Data de Nascimento incorreta para este CPF.");
            }
        } else {
            // Primeiro acesso: ir para Tela de Cadastro
            tempLoginData = { cpf, dob };
            showScreen('register-screen');
        }
    } catch (error) {
        console.error("Erro ao fazer login", error);
        alert("Erro de conexão. Tente novamente.");
    } finally {
        hideLoading();
    }
});

// 4. Ação do Cadastro Complementar
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const whatsapp = document.getElementById('reg-whatsapp').value;

    showLoading('Criando Conta...');
    try {
        const newUser = {
            dob: tempLoginData.dob,
            name: name,
            whatsapp: whatsapp,
            whiteLabelActive: false,
            logoUrl: ""
        };

        // Salva no banco de dados usando o CPF como ID do documento
        await setDoc(doc(db, "users", tempLoginData.cpf), newUser);
        
        // Loga o usuário
        localStorage.setItem('upagri_user_cpf', tempLoginData.cpf);
        currentUserData = newUser;
        currentUserData.cpf = tempLoginData.cpf;
        
        setupProfileScreen();
        showScreen('profile-screen');
    } catch (error) {
        console.error("Erro ao registrar", error);
        alert("Não foi possível concluir o cadastro.");
    } finally {
        hideLoading();
    }
});

// Logout
document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('upagri_user_cpf');
    currentUserData = null;
    document.getElementById('login-form').reset();
    showScreen('login-screen');
});

// ==========================================
// PERFIL E WHITE LABEL
// ==========================================
function setupProfileScreen() {
    document.getElementById('user-name').textContent = currentUserData.name;
    document.getElementById('user-phone').textContent = currentUserData.whatsapp;
    
    // Mostra o CPF formatado
    document.getElementById('user-cpf').textContent = maskCPF(currentUserData.cpf);
    
    // Cria a bolinha com a inicial do nome
    const initial = currentUserData.name.charAt(0).toUpperCase();
    document.getElementById('user-avatar-initials').textContent = initial;

    const toggleWL = document.getElementById('toggle-white-label');
    const uploadArea = document.getElementById('logo-upload-area');
    const previewContainer = document.getElementById('logo-preview-container');

    if (currentUserData.whiteLabelActive) {
        toggleWL.checked = true;
        uploadArea.classList.remove('hidden');
        if (currentUserData.logoUrl) {
            document.getElementById('logo-preview').src = currentUserData.logoUrl;
            previewContainer.classList.remove('hidden');
        }
    } else {
        toggleWL.checked = false;
        uploadArea.classList.add('hidden');
    }
}

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

document.getElementById('btn-save-profile').addEventListener('click', async () => {
    const btnSave = document.getElementById('btn-save-profile');
    const isWhiteLabel = document.getElementById('toggle-white-label').checked;
    
    btnSave.disabled = true;
    btnSave.textContent = "Salvando...";

    try {
        let logoUrl = document.getElementById('logo-preview').src.startsWith('http') ? document.getElementById('logo-preview').src : "";

        if (isWhiteLabel && selectedLogoFile) {
            const storageRef = ref(storage, `logos/${currentUserData.cpf}_${selectedLogoFile.name}`);
            const snapshot = await uploadBytes(storageRef, selectedLogoFile);
            logoUrl = await getDownloadURL(snapshot.ref);
        }

        const updates = {
            whiteLabelActive: isWhiteLabel,
            logoUrl: isWhiteLabel ? logoUrl : ""
        };

        await setDoc(doc(db, "users", currentUserData.cpf), updates, { merge: true });
        
        currentUserData.whiteLabelActive = updates.whiteLabelActive;
        currentUserData.logoUrl = updates.logoUrl;
        
        alert("Configurações salvas!");
        selectedLogoFile = null;
    } catch (error) {
        console.error("Erro ao salvar perfil:", error);
        alert("Erro ao salvar.");
    } finally {
        btnSave.disabled = false;
        btnSave.textContent = "Salvar Configurações";
    }
});

// ==========================================
// TELA 2 (FORMULÁRIO DE SERVIÇO)
// ==========================================
document.getElementById('btn-next-step').addEventListener('click', () => showScreen('request-screen'));
document.getElementById('btn-back-profile').addEventListener('click', () => showScreen('profile-screen'));

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

    document.getElementById('order-summary-list').innerHTML = `
        <li><strong>Fazenda:</strong> ${currentOrderData.farmName}</li>
        <li><strong>Talhão:</strong> ${currentOrderData.fieldName}</li>
        <li><strong>Operação:</strong> ${currentOrderData.operationType}</li>
        <li><strong>Largura:</strong> ${currentOrderData.implementWidth}m</li>
        <li><strong>Monitor:</strong> ${currentOrderData.gpsModel}</li>
        <li><strong>Rumo:</strong> ${currentOrderData.compassDegree}°</li>
        <li><strong>Arquivo:</strong> ${currentOrderData.fileName}</li>
    `;

    document.getElementById('terms-checkbox').checked = false;
    document.getElementById('btn-pay-pix').disabled = true;
    document.getElementById('btn-pay-card').disabled = true;

    showScreen('checkout-screen');
});

// ==========================================
// TELA 3 (CHECKOUT E TERMO)
// ==========================================
document.getElementById('btn-back-request').addEventListener('click', () => showScreen('request-screen'));

document.getElementById('terms-checkbox').addEventListener('change', (e) => {
    document.getElementById('btn-pay-pix').disabled = !e.target.checked;
    document.getElementById('btn-pay-card').disabled = !e.target.checked;
});

document.getElementById('btn-pay-pix').addEventListener('click', async () => {
    if (!currentUserData || !selectedKmlFile) return;
    showLoading('Enviando Pedido...');

    try {
        const timestamp = new Date().getTime();
        const filePath = `orders_files/${currentUserData.cpf}/${timestamp}_${selectedKmlFile.name}`;
        const storageRef = ref(storage, filePath);
        const snapshot = await uploadBytes(storageRef, selectedKmlFile);
        const fileUrl = await getDownloadURL(snapshot.ref);

        const orderDoc = {
            userCpf: currentUserData.cpf,
            userName: currentUserData.name,
            userWhatsapp: currentUserData.whatsapp,
            ...currentOrderData,
            fileUrl: fileUrl,
            status: 'Em Processamento',
            createdAt: serverTimestamp(),
            price: 49.90,
            paymentMethod: 'PIX'
        };

        await addDoc(collection(db, "orders"), orderDoc);

        alert("Pagamento Aprovado e Pedido Enviado com Sucesso!");
        
        document.getElementById('service-form').reset();
        selectedKmlFile = null;
        document.getElementById('kml-filename').textContent = "Anexar Arquivo .KML ou .SHP (Zip) *";
        document.getElementById('kml-filename').style.color = 'var(--text-muted)';
        document.getElementById('compass-arrow').style.transform = `rotate(0deg)`;
        document.getElementById('compass-value').textContent = `0°`;

        showScreen('profile-screen');
    } catch (error) {
        console.error("Erro ao enviar pedido:", error);
        alert("Ocorreu um erro ao processar seu pedido. Tente novamente.");
    } finally {
        hideLoading();
    }
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((reg) => reg.update());
    let refreshing;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });
}
