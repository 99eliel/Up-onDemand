import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    serverTimestamp,
    where
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

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
let referenceMap = null;
let referenceMarkers = [];
let referencePolygon = null;
let selectedMapPoints = [];

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

const hideLoading = () => {
    document.getElementById('loading-overlay').style.display = 'none';
};

const maskCPF = (val) => {
    return val
        .replace(/\D/g, "")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})/, "$1-$2")
        .replace(/(-\d{2})\d+?$/, "$1");
};

const maskPhone = (val) => {
    return val
        .replace(/\D/g, "")
        .replace(/(\d{2})(\d)/, "($1) $2")
        .replace(/(\d{5})(\d)/, "$1-$2")
        .replace(/(-\d{4})\d+?$/, "$1");
};

const maskDate = (val) => {
    return val
        .replace(/\D/g, "")
        .replace(/(\d{2})(\d)/, "$1/$2")
        .replace(/(\d{2})(\d)/, "$1/$2")
        .substring(0, 10);
};

const formatMoney = (value) => {
    if (value === null || value === undefined || value === "") {
        return "Aguardando valor";
    }

    return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
};

const escapeHtml = (value) => {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
};

const copyText = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        alert("Chave PIX copiada!");
    } catch (error) {
        alert("Não foi possível copiar automaticamente. Copie manualmente: " + text);
    }
};

document.getElementById('login-cpf').addEventListener('input', (e) => {
    e.target.value = maskCPF(e.target.value);
});

document.getElementById('reg-whatsapp').addEventListener('input', (e) => {
    e.target.value = maskPhone(e.target.value);
});

document.getElementById('login-dob').addEventListener('input', (e) => {
    e.target.value = maskDate(e.target.value);
});

// ==========================================
// CONFIGURAÇÕES GLOBAIS
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
    } catch (error) {
        console.error("Erro ao carregar configurações globais", error);
    }
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

const isIos = () => {
    return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
};

const isInStandaloneMode = () => {
    return ('standalone' in window.navigator) && window.navigator.standalone;
};

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

if (savedCpf) {
    autoLogin(savedCpf);
}

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
    } catch (error) {
        showScreen('login-screen');
    } finally {
        hideLoading();
    }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const cpf = document.getElementById('login-cpf').value.replace(/\D/g, "");
    const dob = document.getElementById('login-dob').value;

    if (cpf.length !== 11) {
        return alert("CPF inválido.");
    }

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
            } else {
                alert("Data de Nascimento incorreta.");
            }
        } else {
            tempLoginData = { cpf, dob };
            showScreen('register-screen');
        }
    } catch (error) {
        alert("Erro de conexão: " + error.message);
    } finally {
        hideLoading();
    }
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
    } catch (error) {
        alert("Erro no cadastro: " + error.message);
    } finally {
        hideLoading();
    }
});

document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('upagri_user_cpf');
    currentUserData = null;
    document.getElementById('login-form').reset();
    showScreen('login-screen');
});

// ==========================================
// PERFIL WHITE LABEL E PEDIDOS DO CLIENTE
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

    loadUserOrders();
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
        };

        reader.readAsDataURL(selectedLogoFile);
    }
});

document.getElementById('btn-save-profile').addEventListener('click', async () => {
    const isWL = document.getElementById('toggle-white-label').checked;

    showLoading('Salvando...');

    try {
        let logoUrl = document.getElementById('logo-preview').src.startsWith('http')
            ? document.getElementById('logo-preview').src
            : "";

        if (isWL && selectedLogoFile) {
            const snapshot = await uploadBytes(
                ref(storage, `logos/${currentUserData.cpf}_${selectedLogoFile.name}`),
                selectedLogoFile
            );

            logoUrl = await getDownloadURL(snapshot.ref);
        }

        await setDoc(doc(db, "users", currentUserData.cpf), {
            whiteLabelActive: isWL,
            logoUrl: isWL ? logoUrl : ""
        }, { merge: true });

        currentUserData.whiteLabelActive = isWL;
        currentUserData.logoUrl = isWL ? logoUrl : "";

        alert("Salvo!");
    } catch (e) {
        alert("Erro ao salvar.");
    } finally {
        hideLoading();
    }
});

async function loadUserOrders() {
    const container = document.getElementById('user-orders-container');

    if (!currentUserData || !currentUserData.cpf) {
        container.innerHTML = "<p>Entre na conta para visualizar seus pedidos.</p>";
        return;
    }

    container.innerHTML = "<p>Carregando pedidos...</p>";

    try {
        const q = query(
            collection(db, "orders"),
            where("userCpf", "==", currentUserData.cpf),
            orderBy("createdAt", "desc")
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            container.innerHTML = "<p>Você ainda não possui pedidos.</p>";
            return;
        }

        container.innerHTML = "";

        querySnapshot.forEach((docSnap) => {
            const order = docSnap.data();
            const orderId = docSnap.id;

            const status = order.status || "Aguardando valor";
            const dateStr = order.createdAt
                ? new Date(order.createdAt.toDate()).toLocaleDateString('pt-BR')
                : 'Recente';

            let paymentHtml = "";

            if (status === "Aguardando pagamento") {
                paymentHtml = `
                    <div style="margin-top: 15px; padding: 12px; background: #F1F8E9; border-radius: 8px;">
                        <p><strong>Valor:</strong> ${formatMoney(order.price)}</p>
                        <p><strong>Chave PIX:</strong> ${escapeHtml(order.pixKey || "Não informada")}</p>
                        <button class="btn secondary full-width btn-copy-pix" data-pix="${escapeHtml(order.pixKey || "")}">
                            Copiar Chave PIX
                        </button>
                        <button class="btn primary full-width btn-user-payment-done" data-id="${orderId}" style="margin-top: 10px;">
                            Já fiz o pagamento
                        </button>
                    </div>
                `;
            }

            if (status === "Pagamento informado") {
                paymentHtml = `
                    <div style="margin-top: 15px; padding: 12px; background: #FFF3E0; border-radius: 8px;">
                        <p><strong>Pagamento informado.</strong></p>
                        <p>Aguarde a confirmação do administrador para o pedido entrar na fila.</p>
                    </div>
                `;
            }

            if (status === "Concluído" && order.finalFileUrl) {
                paymentHtml = `
                    <a href="${order.finalFileUrl}" target="_blank" class="btn secondary full-width" style="margin-top: 10px;">
                        Baixar Arquivo Final
                    </a>
                `;
            }

            container.innerHTML += `
                <div class="order-card">
                    <p><strong>Data:</strong> ${dateStr}</p>
                    <p><strong>Status:</strong> ${escapeHtml(status)}</p>
                    <p><strong>Fazenda:</strong> ${escapeHtml(order.farmName)}</p>
                    <p><strong>Talhão:</strong> ${escapeHtml(order.fieldName)}</p>
                    <p><strong>Operação:</strong> ${escapeHtml(order.operationType)} (${escapeHtml(order.implementWidth)}m)</p>
                    <p><strong>Monitor:</strong> ${escapeHtml(order.gpsModel)}</p>
                    ${buildMapPointsHtml(order.mapPoints)}
                    <p><strong>Valor:</strong> ${formatMoney(order.price)}</p>
                    ${paymentHtml}
                </div>
            `;
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = "<p>Erro ao carregar seus pedidos. Se o erro aparecer no console pedindo índice do Firestore, clique no link indicado pelo Firebase para criar o índice.</p>";
    }
}

document.getElementById('user-orders-container').addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-copy-pix')) {
        const pixKey = e.target.getAttribute('data-pix');

        if (!pixKey) {
            return alert("Chave PIX não informada.");
        }

        copyText(pixKey);
    }

    if (e.target.classList.contains('btn-user-payment-done')) {
        const orderId = e.target.getAttribute('data-id');

        const confirmacao = confirm("Confirmar que você já realizou o pagamento deste pedido?");

        if (!confirmacao) {
            return;
        }

        showLoading('Informando pagamento...');

        try {
            await setDoc(doc(db, "orders", orderId), {
                status: "Pagamento informado",
                paymentInformed: true,
                paymentInformedAt: serverTimestamp()
            }, { merge: true });

            alert("Pagamento informado! Aguarde a confirmação do administrador.");
            loadUserOrders();
        } catch (error) {
            console.error(error);
            alert("Erro ao informar pagamento.");
        } finally {
            hideLoading();
        }
    }
});


// ==========================================
// MAPA DE REFERÊNCIA DO PEDIDO
// ==========================================

function updateMapPointsStatus() {
    const statusEl = document.getElementById('map-points-status');

    if (!statusEl) {
        return;
    }

    statusEl.textContent = `${selectedMapPoints.length} de 4 pontos marcados`;

    if (selectedMapPoints.length === 4) {
        statusEl.textContent += " ✔";
        statusEl.style.color = "green";
    } else {
        statusEl.style.color = "var(--primary-dark)";
    }
}

function drawReferencePolygon() {
    if (!referenceMap) {
        return;
    }

    if (referencePolygon) {
        referenceMap.removeLayer(referencePolygon);
        referencePolygon = null;
    }

    if (selectedMapPoints.length >= 3) {
        referencePolygon = L.polygon(
            selectedMapPoints.map(point => [point.lat, point.lng]),
            {
                color: '#2E7D32',
                weight: 2,
                fillOpacity: 0.15
            }
        ).addTo(referenceMap);
    }
}

function clearMapPoints() {
    if (!referenceMap) {
        return;
    }

    referenceMarkers.forEach(marker => {
        referenceMap.removeLayer(marker);
    });

    referenceMarkers = [];
    selectedMapPoints = [];

    if (referencePolygon) {
        referenceMap.removeLayer(referencePolygon);
        referencePolygon = null;
    }

    updateMapPointsStatus();
}

function addReferencePoint(lat, lng) {
    if (!referenceMap) {
        return;
    }

    if (selectedMapPoints.length >= 4) {
        alert("Você já marcou os 4 pontos. Para alterar, clique em Limpar Pontos do Mapa.");
        return;
    }

    const pointNumber = selectedMapPoints.length + 1;
    const point = {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6))
    };

    selectedMapPoints.push(point);

    const marker = L.marker([point.lat, point.lng])
        .addTo(referenceMap)
        .bindPopup(`Ponto ${pointNumber}<br>${point.lat}, ${point.lng}`)
        .openPopup();

    referenceMarkers.push(marker);

    drawReferencePolygon();
    updateMapPointsStatus();
}

function initReferenceMap() {
    const mapEl = document.getElementById('reference-map');

    if (!mapEl || typeof L === "undefined") {
        return;
    }

    if (referenceMap) {
        setTimeout(() => {
            referenceMap.invalidateSize();
        }, 300);
        return;
    }

    referenceMap = L.map('reference-map').setView([-15.7801, -47.9292], 4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap'
    }).addTo(referenceMap);

    referenceMap.on('click', (e) => {
        addReferencePoint(e.latlng.lat, e.latlng.lng);
    });

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                referenceMap.setView([lat, lng], 14);
            },
            () => {
                // Mantém o mapa no Brasil caso o usuário não autorize localização.
            },
            {
                enableHighAccuracy: true,
                timeout: 8000,
                maximumAge: 60000
            }
        );
    }

    setTimeout(() => {
        referenceMap.invalidateSize();
    }, 300);

    updateMapPointsStatus();
}

function getGoogleMapsReferenceLink(points) {
    if (!points || points.length === 0) {
        return "";
    }

    const firstPoint = points[0];

    return `https://www.google.com/maps/search/?api=1&query=${firstPoint.lat},${firstPoint.lng}`;
}

function getGoogleMapsRouteLink(points) {
    if (!points || points.length === 0) {
        return "";
    }

    const path = points
        .map(point => `${point.lat},${point.lng}`)
        .join('/');

    return `https://www.google.com/maps/dir/${path}`;
}

function buildMapPointsHtml(points) {
    if (!points || !Array.isArray(points) || points.length === 0) {
        return `<p><strong>Pontos no mapa:</strong> Não informados</p>`;
    }

    const pointsList = points.map((point, index) => {
        return `<li>Ponto ${index + 1}: ${point.lat}, ${point.lng}</li>`;
    }).join("");

    const searchLink = getGoogleMapsReferenceLink(points);
    const routeLink = getGoogleMapsRouteLink(points);

    return `
        <div style="margin-top: 10px;">
            <p><strong>Pontos de referência no mapa:</strong></p>
            <ol style="margin-left: 20px;">
                ${pointsList}
            </ol>
            <a href="${searchLink}" target="_blank" class="btn-secondary">Abrir Ponto 1 no Google Maps</a>
            <a href="${routeLink}" target="_blank" class="btn-secondary">Ver Rota dos Pontos</a>
        </div>
    `;
}


// ==========================================
// SOLICITAÇÃO E CHECKOUT
// ==========================================

document.getElementById('btn-next-step').addEventListener('click', () => {
    document.getElementById('service-form').reset();
    document.getElementById('gps-other-group').classList.add('hidden');
    document.getElementById('gps-other-model').required = false;
    selectedKmlFile = null;
    document.getElementById('kml-filename').textContent = "Anexar Arquivo .KML ou .SHP (Zip) *";
    clearMapPoints();
    showScreen('request-screen');
    initReferenceMap();
});

document.getElementById('btn-back-profile').addEventListener('click', () => {
    setupProfileScreen();
    showScreen('profile-screen');
});

document.getElementById('btn-back-request').addEventListener('click', () => {
    showScreen('request-screen');
    initReferenceMap();
});
document.getElementById('btn-clear-map-points').addEventListener('click', () => {
    clearMapPoints();
});


document.getElementById('kml-upload').addEventListener('change', (e) => {
    selectedKmlFile = e.target.files[0];

    document.getElementById('kml-filename').textContent = selectedKmlFile
        ? `✔ ${selectedKmlFile.name}`
        : "Anexar Arquivo .KML ou .SHP (Zip) *";
});

document.getElementById('gps-model').addEventListener('change', (e) => {
    const otherGroup = document.getElementById('gps-other-group');
    const otherInput = document.getElementById('gps-other-model');

    if (e.target.value === "Outro") {
        otherGroup.classList.remove('hidden');
        otherInput.required = true;
    } else {
        otherGroup.classList.add('hidden');
        otherInput.required = false;
        otherInput.value = "";
    }
});

document.getElementById('compass-slider').addEventListener('input', (e) => {
    document.getElementById('compass-arrow').style.transform = `rotate(${e.target.value}deg)`;
    document.getElementById('compass-value').textContent = `${e.target.value}°`;
});

document.getElementById('service-form').addEventListener('submit', (e) => {
    e.preventDefault();

    if (!selectedKmlFile) {
        return alert("Anexe o arquivo KML/SHP.");
    }

    if (selectedMapPoints.length !== 4) {
        return alert("Marque os 4 pontos de referência no mapa antes de continuar.");
    }

    const gpsModelSelect = document.getElementById('gps-model').value;
    const gpsOtherModel = document.getElementById('gps-other-model').value.trim();

    if (gpsModelSelect === "Outro" && !gpsOtherModel) {
        return alert("Informe qual é o modelo do monitor.");
    }

    const finalGpsModel = gpsModelSelect === "Outro"
        ? `Outro - ${gpsOtherModel}`
        : gpsModelSelect;

    currentOrderData = {
        farmName: document.getElementById('farm-name').value,
        fieldName: document.getElementById('field-name').value,
        operationType: document.getElementById('operation-type').value,
        implementWidth: document.getElementById('implement-width').value,
        gpsModel: finalGpsModel,
        compassDegree: document.getElementById('compass-slider').value,
        observations: document.getElementById('observations').value,
        mapPoints: selectedMapPoints,
        fileName: selectedKmlFile.name
    };

    document.getElementById('order-summary-list').innerHTML = `
        <li><strong>Fazenda:</strong> ${escapeHtml(currentOrderData.farmName)}</li>
        <li><strong>Talhão:</strong> ${escapeHtml(currentOrderData.fieldName)}</li>
        <li><strong>Operação:</strong> ${escapeHtml(currentOrderData.operationType)}</li>
        <li><strong>Largura:</strong> ${escapeHtml(currentOrderData.implementWidth)}m</li>
        <li><strong>Monitor:</strong> ${escapeHtml(currentOrderData.gpsModel)}</li>
        <li><strong>Pontos no mapa:</strong> 4 pontos marcados</li>
    `;

    document.getElementById('terms-checkbox').checked = false;
    document.getElementById('btn-pay-pix').disabled = true;

    showScreen('checkout-screen');
});

document.getElementById('terms-checkbox').addEventListener('change', (e) => {
    document.getElementById('btn-pay-pix').disabled = !e.target.checked;
});

document.getElementById('btn-pay-pix').addEventListener('click', async () => {
    showLoading('Enviando pedido...');

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
            status: 'Aguardando valor',
            paymentConfirmed: false,
            paymentInformed: false,
            archived: false,
            createdAt: serverTimestamp(),
            price: null,
            pixKey: ""
        });

        alert("Pedido enviado! Aguarde o administrador inserir o valor e a chave PIX.");

        document.getElementById('service-form').reset();
        document.getElementById('gps-other-group').classList.add('hidden');
        document.getElementById('gps-other-model').required = false;
        clearMapPoints();
        selectedKmlFile = null;
        document.getElementById('kml-filename').textContent = "Anexar Arquivo .KML ou .SHP (Zip) *";

        setupProfileScreen();
        showScreen('profile-screen');
    } catch (e) {
        console.error(e);
        alert("Erro ao enviar pedido.");
    } finally {
        hideLoading();
    }
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

document.getElementById('btn-cancel-admin-login').addEventListener('click', () => {
    adminModal.classList.add('hidden');
});

async function getAdminPasswords() {
    const docRef = doc(db, "settings", "admin");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        return docSnap.data();
    }

    await setDoc(docRef, {
        senha1: "0000",
        senha2: "0000"
    });

    return {
        senha1: "0000",
        senha2: "0000"
    };
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
        } else {
            alert("Senha incorreta!");
        }
    } catch (e) {
        alert("Erro ao verificar senha.");
    } finally {
        hideLoading();
    }
});

document.getElementById('btn-back-admin').addEventListener('click', () => {
    showScreen('login-screen');
});

document.getElementById('btn-admin-settings').addEventListener('click', async () => {
    showLoading('');

    try {
        const senhas = await getAdminPasswords();

        document.getElementById('admin-pass-1').value = senhas.senha1;
        document.getElementById('admin-pass-2').value = senhas.senha2;

        adminSettingsModal.classList.remove('hidden');
    } catch (e) {
        console.error(e);
    } finally {
        hideLoading();
    }
});

document.getElementById('btn-cancel-admin-settings').addEventListener('click', () => {
    adminSettingsModal.classList.add('hidden');
});

document.getElementById('btn-save-admin-settings').addEventListener('click', async () => {
    const s1 = document.getElementById('admin-pass-1').value;
    const s2 = document.getElementById('admin-pass-2').value;

    showLoading('Salvando...');

    try {
        await setDoc(doc(db, "settings", "admin"), {
            senha1: s1,
            senha2: s2
        });

        alert("Senhas alteradas!");
        adminSettingsModal.classList.add('hidden');
    } catch (e) {
        alert("Erro ao salvar.");
    } finally {
        hideLoading();
    }
});

// ==========================================
// UPLOAD DO BANNER E LOGO GLOBAL
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
    if (!adminSelectedBanner) {
        return alert("Selecione um banner primeiro.");
    }

    showLoading('Salvando Banner...');

    try {
        const snapshot = await uploadBytes(
            ref(storage, `app_assets/global_banner_${new Date().getTime()}`),
            adminSelectedBanner
        );

        const bannerUrl = await getDownloadURL(snapshot.ref);

        await setDoc(doc(db, "settings", "app"), {
            bannerUrl: bannerUrl
        }, { merge: true });

        alert("Banner global atualizado!");

        document.getElementById('app-global-banner').src = bannerUrl;
        document.getElementById('app-global-banner').classList.remove('hidden');
    } catch (error) {
        alert("Erro ao salvar banner.");
    } finally {
        hideLoading();
    }
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
    if (!adminSelectedLogo) {
        return alert("Selecione uma logo primeiro.");
    }

    showLoading('Salvando Logo...');

    try {
        const snapshot = await uploadBytes(
            ref(storage, `app_assets/global_logo_${new Date().getTime()}`),
            adminSelectedLogo
        );

        const logoUrl = await getDownloadURL(snapshot.ref);

        await setDoc(doc(db, "settings", "app"), {
            logoUrl: logoUrl
        }, { merge: true });

        alert("Logo principal atualizada!");

        document.getElementById('main-app-logo').src = logoUrl;
        document.getElementById('main-app-logo-reg').src = logoUrl;
    } catch (error) {
        alert("Erro ao salvar logo.");
    } finally {
        hideLoading();
    }
});

// ==========================================
// ADMIN: VALOR, PIX, FILA, CONCLUSÃO E ARQUIVO
// ==========================================

function buildAdminOrderBaseHtml(order, orderId) {
    const status = order.status || "Aguardando valor";

    const dateStr = order.createdAt
        ? new Date(order.createdAt.toDate()).toLocaleDateString('pt-BR')
        : 'Recente';

    return `
        <div class="order-card">
            <p><strong>Data:</strong> ${dateStr}</p>
            <p><strong>Status:</strong> ${escapeHtml(status)}</p>
            <p><strong>Cliente:</strong> ${escapeHtml(order.userName || "Não informado")}</p>
            <p><strong>WhatsApp:</strong> ${escapeHtml(order.userWhatsapp || "Não informado")}</p>
            <p><strong>CPF:</strong> ${escapeHtml(order.userCpf || "Não informado")}</p>
            <p><strong>Fazenda:</strong> ${escapeHtml(order.farmName || "Não informado")}</p>
            <p><strong>Talhão:</strong> ${escapeHtml(order.fieldName || "Não informado")}</p>
            <p><strong>Operação:</strong> ${escapeHtml(order.operationType || "Não informado")} (${escapeHtml(order.implementWidth || "0")}m)</p>
            <p><strong>Monitor GNSS:</strong> ${escapeHtml(order.gpsModel || "Não informado")}</p>
            <p><strong>Sentido:</strong> ${escapeHtml(order.compassDegree || "0")}°</p>
            <p><strong>Observações:</strong> ${escapeHtml(order.observations || "Nenhuma")}</p>
            ${buildMapPointsHtml(order.mapPoints)}
            <p><strong>Valor:</strong> ${formatMoney(order.price)}</p>
            <p><strong>Chave PIX:</strong> ${escapeHtml(order.pixKey || "Não informada")}</p>
            ${order.fileUrl ? `<a href="${order.fileUrl}" target="_blank" class="btn-secondary">Baixar KML/SHP</a>` : ''}
            <input type="hidden" value="${escapeHtml(orderId)}">
    `;
}

async function loadAdminOrders() {
    const pricingContainer = document.getElementById('admin-pricing-container');
    const pendingContainer = document.getElementById('admin-pending-payments-container');
    const queueContainer = document.getElementById('admin-orders-container');
    const completedContainer = document.getElementById('admin-completed-container');
    const archivedContainer = document.getElementById('admin-archived-container');

    pricingContainer.innerHTML = "<p>Buscando pedidos aguardando valor...</p>";
    pendingContainer.innerHTML = "<p>Buscando pagamentos pendentes...</p>";
    queueContainer.innerHTML = "<p>Buscando fila de pedidos...</p>";
    completedContainer.innerHTML = "<p>Buscando concluídos...</p>";
    archivedContainer.innerHTML = "<p>Buscando arquivados...</p>";

    try {
        const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        pricingContainer.innerHTML = "";
        pendingContainer.innerHTML = "";
        queueContainer.innerHTML = "";
        completedContainer.innerHTML = "";
        archivedContainer.innerHTML = "";

        let hasPricing = false;
        let hasPending = false;
        let hasQueue = false;
        let hasCompleted = false;
        let hasArchived = false;

        if (querySnapshot.empty) {
            pricingContainer.innerHTML = "<p>Nenhum pedido aguardando valor.</p>";
            pendingContainer.innerHTML = "<p>Nenhum pagamento aguardando confirmação.</p>";
            queueContainer.innerHTML = "<p>Nenhum pedido na fila.</p>";
            completedContainer.innerHTML = "<p>Nenhum pedido concluído.</p>";
            archivedContainer.innerHTML = "<p>Nenhum pedido arquivado.</p>";
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const order = docSnap.data();
            const orderId = docSnap.id;
            const status = order.status || "Aguardando valor";
            const isArchived = order.archived === true;

            const zapNumber = order.userWhatsapp
                ? order.userWhatsapp.replace(/\D/g, "")
                : "";

            const msg = encodeURIComponent(
                `Olá ${order.userName}, seu projeto do talhão ${order.fieldName} está pronto!`
            );

            const zapLink = zapNumber
                ? `https://wa.me/55${zapNumber}?text=${msg}`
                : '#';

            const baseInfoHtml = buildAdminOrderBaseHtml(order, orderId);

            if (isArchived) {
                hasArchived = true;

                archivedContainer.innerHTML += `
                    ${baseInfoHtml}
                        ${order.finalFileUrl ? `<a href="${order.finalFileUrl}" target="_blank" class="btn-secondary">Baixar Arquivo Final</a>` : ''}
                        <button class="btn secondary full-width btn-unarchive-order" data-id="${orderId}" style="margin-top: 10px;">
                            Desarquivar Pedido
                        </button>
                    </div>
                `;
                return;
            }

            if (status === "Aguardando valor" || status === "Pendente") {
                hasPricing = true;

                pricingContainer.innerHTML += `
                    ${baseInfoHtml}
                        <div style="margin-top: 15px;">
                            <label>Valor do Pedido (R$)</label>
                            <input 
                                type="number" 
                                step="0.01" 
                                min="0" 
                                class="form-control admin-price-input" 
                                id="admin-price-${orderId}" 
                                placeholder="Ex: 49.90"
                                value="${order.price ? Number(order.price).toFixed(2) : ""}"
                            >

                            <label style="margin-top: 10px;">Chave PIX</label>
                            <input 
                                type="text" 
                                class="form-control admin-pix-input" 
                                id="admin-pix-${orderId}" 
                                placeholder="Digite a chave PIX"
                                value="${escapeHtml(order.pixKey || "")}"
                            >

                            <button class="btn primary full-width btn-set-price-pix" data-id="${orderId}" style="margin-top: 10px;">
                                Salvar Valor e Enviar Cobrança ao Cliente
                            </button>
                        </div>
                    </div>
                `;
                return;
            }

            if (status === "Aguardando pagamento" || status === "Pagamento informado") {
                hasPending = true;

                pendingContainer.innerHTML += `
                    ${baseInfoHtml}
                        <div style="margin-top: 15px;">
                            <p><strong>Situação:</strong> ${
                                status === "Pagamento informado"
                                    ? "Cliente informou que já pagou."
                                    : "Cliente ainda não informou pagamento."
                            }</p>

                            <button class="btn primary full-width btn-confirm-payment" data-id="${orderId}">
                                Confirmar Pagamento e Enviar para Fila
                            </button>
                        </div>
                    </div>
                `;
                return;
            }

            if (status === "Na fila" || status === "Em produção") {
                hasQueue = true;

                queueContainer.innerHTML += `
                    ${baseInfoHtml}
                        <a href="${zapLink}" target="_blank" class="btn-secondary">Avisar Cliente</a>

                        <div style="margin-top: 15px;">
                            <label>Anexar Arquivo Final (ZIP/PDF/KML/KMZ):</label>
                            <input 
                                type="file" 
                                id="upload-final-${orderId}" 
                                class="form-control"
                                accept=".zip,.pdf,.kml,.kmz"
                            >
                            <button 
                                class="btn primary full-width btn-complete-order" 
                                data-id="${orderId}" 
                                data-cpf="${escapeHtml(order.userCpf || "")}">
                                Concluir e Enviar para Cliente
                            </button>
                        </div>
                    </div>
                `;
                return;
            }

            if (status === "Concluído") {
                hasCompleted = true;

                completedContainer.innerHTML += `
                    ${baseInfoHtml}
                        <p style="color: green; font-weight: bold;">✔ Pedido Concluído</p>
                        ${order.finalFileUrl ? `<a href="${order.finalFileUrl}" target="_blank" class="btn-secondary">Baixar Arquivo Final</a>` : ''}
                        <button class="btn secondary full-width btn-archive-order" data-id="${orderId}" style="margin-top: 10px;">
                            Arquivar Pedido
                        </button>
                    </div>
                `;
            }
        });

        if (!hasPricing) {
            pricingContainer.innerHTML = "<p>Nenhum pedido aguardando valor.</p>";
        }

        if (!hasPending) {
            pendingContainer.innerHTML = "<p>Nenhum pagamento aguardando confirmação.</p>";
        }

        if (!hasQueue) {
            queueContainer.innerHTML = "<p>Nenhum pedido na fila.</p>";
        }

        if (!hasCompleted) {
            completedContainer.innerHTML = "<p>Nenhum pedido concluído.</p>";
        }

        if (!hasArchived) {
            archivedContainer.innerHTML = "<p>Nenhum pedido arquivado.</p>";
        }

    } catch (error) {
        console.error(error);
        pricingContainer.innerHTML = "<p>Erro ao carregar pedidos aguardando valor.</p>";
        pendingContainer.innerHTML = "<p>Erro ao carregar pagamentos pendentes.</p>";
        queueContainer.innerHTML = "<p>Erro ao carregar a fila.</p>";
        completedContainer.innerHTML = "<p>Erro ao carregar pedidos concluídos.</p>";
        archivedContainer.innerHTML = "<p>Erro ao carregar pedidos arquivados.</p>";
    }
}

document.getElementById('admin-pricing-container').addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-set-price-pix')) {
        const orderId = e.target.getAttribute('data-id');

        const priceInput = document.getElementById(`admin-price-${orderId}`);
        const pixInput = document.getElementById(`admin-pix-${orderId}`);

        const price = Number(priceInput.value);
        const pixKey = pixInput.value.trim();

        if (!price || price <= 0) {
            return alert("Informe um valor válido para o pedido.");
        }

        if (!pixKey) {
            return alert("Informe a chave PIX.");
        }

        showLoading('Salvando cobrança...');

        try {
            await setDoc(doc(db, "orders", orderId), {
                price: price,
                pixKey: pixKey,
                status: "Aguardando pagamento",
                pricedAt: serverTimestamp()
            }, { merge: true });

            alert("Valor e PIX salvos! A cobrança já aparece no perfil do cliente.");
            loadAdminOrders();
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar valor e PIX.");
        } finally {
            hideLoading();
        }
    }
});

document.getElementById('admin-pending-payments-container').addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-confirm-payment')) {
        const orderId = e.target.getAttribute('data-id');

        const confirmacao = confirm("Confirmar pagamento deste pedido e enviar para a fila?");

        if (!confirmacao) {
            return;
        }

        showLoading('Confirmando pagamento...');

        try {
            await setDoc(doc(db, "orders", orderId), {
                status: "Na fila",
                paymentConfirmed: true,
                paymentConfirmedAt: serverTimestamp()
            }, { merge: true });

            alert("Pagamento confirmado! Pedido enviado para a fila.");
            loadAdminOrders();
        } catch (error) {
            console.error(error);
            alert("Erro ao confirmar pagamento.");
        } finally {
            hideLoading();
        }
    }
});

document.getElementById('admin-orders-container').addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-complete-order')) {
        const orderId = e.target.getAttribute('data-id');
        const userCpf = e.target.getAttribute('data-cpf');

        const fileInput = document.getElementById(`upload-final-${orderId}`);
        const file = fileInput.files[0];

        if (!file) {
            return alert("Selecione o arquivo final.");
        }

        showLoading('Enviando Arquivo Final...');

        try {
            const filePath = `completed_orders/${userCpf}/${new Date().getTime()}_${file.name}`;
            const snapshot = await uploadBytes(ref(storage, filePath), file);
            const finalFileUrl = await getDownloadURL(snapshot.ref);

            await setDoc(doc(db, "orders", orderId), {
                status: 'Concluído',
                finalFileUrl: finalFileUrl,
                completedAt: serverTimestamp(),
                archived: false
            }, { merge: true });

            alert("Pedido concluído!");
            loadAdminOrders();
        } catch (error) {
            console.error(error);
            alert("Erro ao enviar arquivo final.");
        } finally {
            hideLoading();
        }
    }
});

document.getElementById('admin-completed-container').addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-archive-order')) {
        const orderId = e.target.getAttribute('data-id');

        const confirmacao = confirm("Arquivar este pedido concluído?");

        if (!confirmacao) {
            return;
        }

        showLoading('Arquivando pedido...');

        try {
            await setDoc(doc(db, "orders", orderId), {
                archived: true,
                archivedAt: serverTimestamp()
            }, { merge: true });

            alert("Pedido arquivado!");
            loadAdminOrders();
        } catch (error) {
            console.error(error);
            alert("Erro ao arquivar pedido.");
        } finally {
            hideLoading();
        }
    }
});

document.getElementById('admin-archived-container').addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-unarchive-order')) {
        const orderId = e.target.getAttribute('data-id');

        showLoading('Desarquivando pedido...');

        try {
            await setDoc(doc(db, "orders", orderId), {
                archived: false,
                unarchivedAt: serverTimestamp()
            }, { merge: true });

            alert("Pedido desarquivado!");
            loadAdminOrders();
        } catch (error) {
            console.error(error);
            alert("Erro ao desarquivar pedido.");
        } finally {
            hideLoading();
        }
    }
});

// ==========================================
// SERVICE WORKER
// ==========================================

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((reg) => {
        reg.update();
    });

    let refreshing;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) {
            return;
        }

        refreshing = true;
        window.location.reload();
    });
}
