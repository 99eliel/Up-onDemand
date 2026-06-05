import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

// ==========================================
// VARIÁVEIS GLOBAIS E UTILITÁRIOS
// ==========================================
let currentUserData = null; 
let selectedLogoFile = null;
let selectedKmlFile = null;
let currentOrderData = {};
let tempLoginData = {};
let deferredPrompt; 

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    window.scrollTo(0, 0);
}

const showLoading = (msg) => {
    const overlay = document.getElementById('loading-overlay');
    overlay.querySelector('h2').textContent = msg || "Processando...";
    overlay.style.display = 'flex';
};
const hideLoading = () => document.getElementById('loading-overlay').style.display = 'none';

const maskCPF = (val) => val.replace(/\D/g, "").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})/, "$1-$2").replace(/(-\d{2})\d+?$/, "$1");
const maskPhone = (val) => val.replace(/\D/g, "").replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").replace(/(-\d{4})\d+?$/, "$1");

document.getElementById('login-cpf').addEventListener('input', (e) => e.target.value = maskCPF(e.target.value));
document.getElementById('reg-whatsapp').addEventListener('input', (e) => e.target.value = maskPhone(e.target.value));

// ==========================================
// CONFIGURAÇÕES GLOBAIS (LOGO E BANNER)
// ==========================================
async function loadGlobalSettings() {
    try {
        const docSnap = await getDoc(doc(db, "settings", "app"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.bannerUrl) {
                const bannerImg = document.getElementById('app-global-banner');
                bannerImg.src = data.bannerUrl;
                bannerImg.classList.remove('hidden');
            }
            if (data.logoUrl) {
                document.getElementById('main-app-logo').src = data.logoUrl;
                document.getElementById('main-app-logo-reg').src = data.logoUrl;
            }
        }
    } catch (error) { console.error("Erro ao carregar configurações globais", error); }
}

loadGlobalSettings();

// ==========================================
// INSTALAÇÃO PWA
// ==========================================
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('install-banner').classList.remove('hidden');
});

document.getElementById('btn-install-pwa').addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            document.getElementById('install-banner').classList.add('hidden');
        }
        deferredPrompt = null;
    }
});

const isIos = () => /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
const isInStandaloneMode = () => ('standalone' in window.navigator) && (window.navigator.standalone);
if (isIos() && !isInStandaloneMode()) {
    document.getElementById('ios-instruction-banner').classList.remove('hidden');
}
document.getElementById('btn-close-ios').addEventListener('click', () => {
    document.getElementById('ios-instruction-banner').classList.add('hidden');
});

// ==========================================
// LOGIN E CADASTRO
// ==========================================
const savedCpf = localStorage.getItem('upagri_user_cpf');
if (savedCpf) autoLogin(savedCpf);

async function autoLogin(cpf) {
    showLoading('Carregando Perfil...');
    try {
        const docSnap = await getDoc(doc(db, "users", cpf));
        if (docSnap.exists()) {
            currentUserData = docSnap.data();
            currentUserData.cpf = cpf;
            setupProfileScreen();
            showScreen('profile-screen');
        } else {
            localStorage.removeItem('upagri_user_cpf');
            showScreen('login-screen');
        }
    } catch (error) { showScreen('login-screen'); } 
    finally { hideLoading(); }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cpf = document.getElementById('login-cpf').value.replace(/\D/g, "");
    const dob = document.getElementById('login-dob').value;

    if (cpf.length !== 11) return alert("CPF inválido.");
    showLoading('Verificando...');
    try {
        const docSnap = await getDoc(doc(db, "users", cpf));
        if (docSnap.exists()) {
            if (docSnap.data().dob === dob) {
                localStorage.setItem('upagri_user_cpf', cpf);
                currentUserData = docSnap.data();
                currentUserData.cpf = cpf;
                setupProfileScreen();
                showScreen('profile-screen');
            } else { alert("Data de Nascimento incorreta."); }
        } else {
            tempLoginData = { cpf, dob };
            showScreen('register-screen');
        }
    } catch (error) { alert("Erro de conexão: " + error.message); } 
    finally { hideLoading(); }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading('Criando Conta...');
    try {
        const newUser = {
            dob: tempLoginData.dob,
            name: document.getElementById('reg-name').value,
            whatsapp: document.getElementById('reg-whatsapp').value,
            whiteLabelActive: false,
            logoUrl: ""
        };
        await setDoc(doc(db, "users", tempLoginData.cpf), newUser);
        localStorage.setItem('upagri_user_cpf', tempLoginData.cpf);
        currentUserData = newUser;
        currentUserData.cpf = tempLoginData.cpf;
        setupProfileScreen();
        showScreen('profile-screen');
    } catch (error) { alert("Erro no cadastro: " + error.message); } 
    finally { hideLoading(); }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('upagri_user_cpf');
    currentUserData = null;
    document.getElementById('login-form').reset();
    showScreen('login-screen');
});
// ==========================================
// PERFIL (WHITE LABEL)
// ==========================================
function setupProfileScreen() {
    document.getElementById('user-name').textContent = currentUserData.name;
    document.getElementById('user-phone').textContent = currentUserData.whatsapp;
    document.getElementById('user-cpf').textContent = maskCPF(currentUserData.cpf);
    document.getElementById('user-avatar-initials').textContent = currentUserData.name.charAt(0).toUpperCase();

    const toggleWL = document.getElementById('toggle-white-label');
    const uploadArea = document.getElementById('logo-upload-area');
    if (currentUserData.whiteLabelActive) {
        toggleWL.checked = true;
        uploadArea.classList.remove('hidden');
        if (currentUserData.logoUrl) {
            document.getElementById('logo-preview').src = currentUserData.logoUrl;
            document.getElementById('logo-preview-container').classList.remove('hidden');
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
    if (e.target.files[0]) {
        selectedLogoFile = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            document.getElementById('logo-preview').src = ev.target.result;
            document.getElementById('logo-preview-container').classList.remove('hidden');
        }
        reader.readAsDataURL(selectedLogoFile);
    }
});

document.getElementById('btn-save-profile').addEventListener('click', async () => {
    const isWL = document.getElementById('toggle-white-label').checked;
    showLoading('Salvando...');
    try {
        let logoUrl = document.getElementById('logo-preview').src.startsWith('http') ? document.getElementById('logo-preview').src : "";
        if (isWL && selectedLogoFile) {
            const snapshot = await uploadBytes(ref(storage, `logos/${currentUserData.cpf}_${selectedLogoFile.name}`), selectedLogoFile);
            logoUrl = await getDownloadURL(snapshot.ref);
        }
        await setDoc(doc(db, "users", currentUserData.cpf), { whiteLabelActive: isWL, logoUrl: isWL ? logoUrl : "" }, { merge: true });
        currentUserData.whiteLabelActive = isWL;
        currentUserData.logoUrl = isWL ? logoUrl : "";
        alert("Salvo!");
    } catch (e) { alert("Erro ao salvar."); } 
    finally { hideLoading(); }
});

// ==========================================
// SOLICITAÇÃO E CHECKOUT (TELA 2 e 3)
// ==========================================
document.getElementById('btn-next-step').addEventListener('click', () => showScreen('request-screen'));
document.getElementById('btn-back-profile').addEventListener('click', () => showScreen('profile-screen'));
document.getElementById('btn-back-request').addEventListener('click', () => showScreen('request-screen'));

document.getElementById('kml-upload').addEventListener('change', (e) => {
    selectedKmlFile = e.target.files[0];
    document.getElementById('kml-filename').textContent = selectedKmlFile ? `✔ ${selectedKmlFile.name}` : "Anexar Arquivo *";
});

document.getElementById('compass-slider').addEventListener('input', (e) => {
    document.getElementById('compass-arrow').style.transform = `rotate(${e.target.value}deg)`;
    document.getElementById('compass-value').textContent = `${e.target.value}°`;
});

document.getElementById('service-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!selectedKmlFile) return alert("Anexe o arquivo KML/SHP.");

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
    `;
    document.getElementById('terms-checkbox').checked = false;
    document.getElementById('btn-pay-pix').disabled = true;
    showScreen('checkout-screen');
});

document.getElementById('terms-checkbox').addEventListener('change', (e) => {
    document.getElementById('btn-pay-pix').disabled = !e.target.checked;
});

document.getElementById('btn-pay-pix').addEventListener('click', async () => {
    showLoading('Enviando...');
    try {
        const filePath = `orders_files/${currentUserData.cpf}/${new Date().getTime()}_${selectedKmlFile.name}`;
        const snapshot = await uploadBytes(ref(storage, filePath), selectedKmlFile);
        const fileUrl = await getDownloadURL(snapshot.ref);

        await addDoc(collection(db, "orders"), {
            ...currentOrderData,
            userCpf: currentUserData.cpf,
            userName: currentUserData.name,
            userWhatsapp: currentUserData.whatsapp,
            fileUrl: fileUrl,
            status: 'Pendente',
            createdAt: serverTimestamp(),
            price: 49.90
        });

        alert("Pedido Enviado!");
        document.getElementById('service-form').reset();
        selectedKmlFile = null;
        document.getElementById('kml-filename').textContent = "Anexar Arquivo *";
        showScreen('profile-screen');
    } catch (e) { alert("Erro ao enviar pedido."); } finally { hideLoading(); }
});
// ==========================================
// PAINEL ADMINISTRATIVO E SENHAS
// ==========================================
const adminModal = document.getElementById('admin-login-modal');
const adminSettingsModal = document.getElementById('admin-settings-modal');

document.getElementById('btn-admin-panel').addEventListener('click', () => {
    document.getElementById('admin-password-input').value = "";
    adminModal.classList.remove('hidden');
});
document.getElementById('btn-cancel-admin-login').addEventListener('click', () => adminModal.classList.add('hidden'));

async function getAdminPasswords() {
    const docRef = doc(db, "settings", "admin");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) return docSnap.data();
    await setDoc(docRef, { senha1: "0000", senha2: "0000" });
    return { senha1: "0000", senha2: "0000" };
}

document.getElementById('btn-confirm-admin-login').addEventListener('click', async () => {
    const inputPass = document.getElementById('admin-password-input').value;
    showLoading('Autenticando...');
    try {
        const senhas = await getAdminPasswords();
        if (inputPass === senhas.senha1 || inputPass === senhas.senha2) {
            adminModal.classList.add('hidden');
            showScreen('admin-screen');
            loadAdminOrders();
        } else { alert("Senha incorreta!"); }
    } catch (e) { alert("Erro ao verificar senha."); } finally { hideLoading(); }
});

document.getElementById('btn-back-admin').addEventListener('click', () => showScreen('login-screen'));

document.getElementById('btn-admin-settings').addEventListener('click', async () => {
    showLoading('');
    try {
        const senhas = await getAdminPasswords();
        document.getElementById('admin-pass-1').value = senhas.senha1;
        document.getElementById('admin-pass-2').value = senhas.senha2;
        adminSettingsModal.classList.remove('hidden');
    } catch (e) {} finally { hideLoading(); }
});

document.getElementById('btn-cancel-admin-settings').addEventListener('click', () => adminSettingsModal.classList.add('hidden'));

document.getElementById('btn-save-admin-settings').addEventListener('click', async () => {
    const s1 = document.getElementById('admin-pass-1').value;
    const s2 = document.getElementById('admin-pass-2').value;
    showLoading('Salvando...');
    try {
        await setDoc(doc(db, "settings", "admin"), { senha1: s1, senha2: s2 });
        alert("Senhas alteradas!");
        adminSettingsModal.classList.add('hidden');
    } catch (e) { alert("Erro ao salvar."); } finally { hideLoading(); }
});

// ==========================================
// UPLOAD DO BANNER E LOGO GLOBAL (ADMIN)
// ==========================================
let adminSelectedBanner = null;
let adminSelectedLogo = null;

document.getElementById('admin-banner-upload').addEventListener('change', (e) => {
    if (e.target.files[0]) {
        adminSelectedBanner = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            const preview = document.getElementById('admin-banner-preview');
            preview.src = ev.target.result;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(adminSelectedBanner);
    }
});

document.getElementById('btn-save-global-banner').addEventListener('click', async () => {
    if (!adminSelectedBanner) return alert("Selecione um banner primeiro.");
    showLoading('Salvando Banner...');
    try {
        const snapshot = await uploadBytes(ref(storage, `app_assets/global_banner_${new Date().getTime()}`), adminSelectedBanner);
        const bannerUrl = await getDownloadURL(snapshot.ref);
        await setDoc(doc(db, "settings", "app"), { bannerUrl: bannerUrl }, { merge: true });
        alert("Banner global atualizado!");
        document.getElementById('app-global-banner').src = bannerUrl;
        document.getElementById('app-global-banner').classList.remove('hidden');
    } catch (error) { alert("Erro ao salvar banner."); } finally { hideLoading(); }
});

document.getElementById('admin-logo-upload').addEventListener('change', (e) => {
    if (e.target.files[0]) {
        adminSelectedLogo = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            const preview = document.getElementById('admin-logo-preview');
            preview.src = ev.target.result;
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(adminSelectedLogo);
    }
});

document.getElementById('btn-save-global-logo').addEventListener('click', async () => {
    if (!adminSelectedLogo) return alert("Selecione uma logo primeiro.");
    showLoading('Salvando Logo...');
    try {
        const snapshot = await uploadBytes(ref(storage, `app_assets/global_logo_${new Date().getTime()}`), adminSelectedLogo);
        const logoUrl = await getDownloadURL(snapshot.ref);
        await setDoc(doc(db, "settings", "app"), { logoUrl: logoUrl }, { merge: true });
        alert("Logo principal atualizada!");
        document.getElementById('main-app-logo').src = logoUrl;
        document.getElementById('main-app-logo-reg').src = logoUrl;
    } catch (error) { alert("Erro ao salvar logo."); } finally { hideLoading(); }
});

// ==========================================
// FILA DE PEDIDOS DO ADMIN E ENTREGA
// ==========================================
async function loadAdminOrders() {
    const container = document.getElementById('admin-orders-container');
    container.innerHTML = "<p>Buscando pedidos...</p>";
    try {
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            container.innerHTML = "<p>Nenhum pedido encontrado.</p>";
            return;
        }

        container.innerHTML = "";
        querySnapshot.forEach((docSnap) => {
            const order = docSnap.data();
            const orderId = docSnap.id;
            const dateStr = order.createdAt ? new Date(order.createdAt.toDate()).toLocaleDateString('pt-BR') : 'Recente';
            const zapNumber = order.userWhatsapp ? order.userWhatsapp.replace(/\D/g, "") : "";
            const msg = encodeURIComponent(`Olá ${order.userName}, seu projeto do talhão ${order.fieldName} está pronto!`);
            const zapLink = zapNumber ? `https://wa.me/55${zapNumber}?text=${msg}` : '#';

            let adminActionHtml = '';
            if (order.status !== 'Concluído') {
                adminActionHtml = `
                    <div style="margin-top: 15px; padding: 15px; background: #F9FBE7; border-radius: 8px; border: 1px dashed #C0CA33;">
                        <label style="font-size: 0.85rem; font-weight: bold; color: var(--primary-dark);">Anexar Arquivo Final (ZIP/PDF):</label>
                        <input type="file" id="upload-final-${orderId}" style="width: 100%; margin: 8px 0; font-size: 0.85rem;" accept=".zip,.pdf">
                        <button data-id="${orderId}" data-cpf="${order.userCpf}" class="btn success full-width btn-complete-order" style="padding: 10px; margin-top: 5px;">Concluir e Enviar para Cliente</button>
                    </div>
                `;
            } else {
                adminActionHtml = `
                    <div style="margin-top: 15px; padding: 10px; background: #E8F5E9; border-radius: 8px; color: #2E7D32; font-weight: bold; text-align: center;">
                        ✔ Pedido Concluído (Arquivo Enviado)
                    </div>
                `;
            }

            const cardHtml = `
                <div class="card order-card">
                    <div class="order-header">
                        <span>Data: <strong>${dateStr}</strong></span>
                        <span style="color: ${order.status === 'Concluído' ? '#2E7D32' : '#E65100'}; font-weight: bold;">${order.status}</span>
                    </div>
                    <div class="order-details">
                        <p><strong>Cliente:</strong> ${order.userName}</p>
                        <p><strong>Fazenda:</strong> ${order.farmName} | <strong>Talhão:</strong> ${order.fieldName}</p>
                        <p><strong>Operação:</strong> ${order.operationType} (${order.implementWidth}m)</p>
                    </div>
                    <div style="margin-top: 15px; display: flex; gap: 10px;">
                        <a href="${order.fileUrl}" target="_blank" class="btn secondary" style="flex:1; padding: 10px; text-decoration: none; text-align: center;">Baixar KML</a>
                        <a href="${zapLink}" target="_blank" class="btn-whatsapp" style="flex:1; text-align: center;">📱 Avisar</a>
                    </div>
                    ${adminActionHtml}
                </div>
            `;
            container.innerHTML += cardHtml;
        });
    } catch (error) { container.innerHTML = "<p>Erro ao carregar a fila.</p>"; }
}

document.getElementById('admin-orders-container').addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-complete-order')) {
        const orderId = e.target.getAttribute('data-id');
        const userCpf = e.target.getAttribute('data-cpf');
        const fileInput = document.getElementById(`upload-final-${orderId}`);
        const file = fileInput.files[0];

        if (!file) return alert("Selecione o arquivo final (.zip ou .pdf).");

        showLoading('Enviando Arquivo Final...');
        try {
            const filePath = `completed_orders/${userCpf}/${new Date().getTime()}_${file.name}`;
            const snapshot = await uploadBytes(ref(storage, filePath), file);
            const finalFileUrl = await getDownloadURL(snapshot.ref);

            await setDoc(doc(db, "orders", orderId), {
                status: 'Concluído',
                finalFileUrl: finalFileUrl,
                completedAt: serverTimestamp()
            }, { merge: true });

            alert("Pedido concluído!");
            loadAdminOrders();
        } catch (error) { alert("Erro ao enviar arquivo final."); } finally { hideLoading(); }
    }
});

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((reg) => reg.update());
    let refreshing;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });
}
