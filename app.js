import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
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
    where,
    deleteDoc
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
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ==========================================
// VARIÁVEIS GLOBAIS E UTILITÁRIOS
// ==========================================

let currentUser = null;
let currentUserData = null;
let currentUserIsAdmin = false;
let currentUserAdminRole = "";
let currentUserIsMainAdmin = false;
let adminPaymentSettings = {
    fixedPixKey: "",
    lockedPixEnabled: true
};
let selectedLogoFile = null;
let selectedKmlFile = null;
let selectedOrientationFile = null;
let currentOrderData = {};
let deferredPrompt;

let referenceMap = null;
let referenceMarkers = [];
let referencePolygon = null;
let currentLocationMarker = null;
let selectedMapPoints = [];
let compassDegree = 0;
let isDraggingCompass = false;
let adminReportsCache = null;

const MAX_MAP_POINTS = 12;

const systemModels = {
    "Monitores ISO11783": ["TaskData"],
    "Fendt": ["Shapefile"],
    "Topcon": ["Shapefile"],
    "Stara": ["Dados"],
    "CNH Industrial": [".CN1", "Shapefile"],
    "Trimble": ["AgGPS", "AgData"],
    "John Deere": ["GS2 1800", "GS3 2630", "GEN4 4600"]
};

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    window.scrollTo(0, 0);

    if (screenId === 'request-screen') {
        setTimeout(() => {
            initReferenceMap();
        }, 300);
    }
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


const formatNameTitle = (name) => {
    return String(name || "")
        .toLowerCase()
        .split(" ")
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
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

function getAuthErrorMessage(error) {
    const code = error?.code || "";

    if (code.includes("auth/email-already-in-use")) {
        return "Este e-mail já está cadastrado.";
    }

    if (code.includes("auth/invalid-email")) {
        return "E-mail inválido.";
    }

    if (code.includes("auth/weak-password")) {
        return "A senha precisa ter pelo menos 6 caracteres.";
    }

    if (code.includes("auth/user-not-found") || code.includes("auth/wrong-password") || code.includes("auth/invalid-credential")) {
        return "E-mail ou senha incorretos.";
    }

    return error.message || "Erro de autenticação.";
}

function getStatusClass(status, archived = false) {
    if (archived) return "status-archived";
    if (status === "Aguardando valor" || status === "Pendente") return "status-waiting-price";
    if (status === "Aguardando pagamento") return "status-waiting-payment";
    if (status === "Pagamento informado") return "status-payment-informed";
    if (status === "Na fila" || status === "Em produção") return "status-queue";
    if (status === "Concluído") return "status-done";
    return "status-waiting-price";
}

function getStatusText(status, archived = false) {
    if (archived) return "Arquivado";
    return status || "Aguardando valor";
}

document.getElementById('reg-cpf').addEventListener('input', (e) => {
    e.target.value = maskCPF(e.target.value);
});

document.getElementById('reg-whatsapp').addEventListener('input', (e) => {
    e.target.value = maskPhone(e.target.value);
});

document.getElementById('reg-dob').addEventListener('input', (e) => {
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
    document.getElementById('install-banner').style.display = 'flex';
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
// AUTH, LOGIN E CADASTRO
// ==========================================

onAuthStateChanged(auth, async (user) => {
    currentUser = user;

    if (!user) {
        currentUserData = null;
        currentUserIsAdmin = false;
        document.getElementById('btn-admin-panel').classList.add('hidden-by-state');
        hideLoading();
        showScreen('login-screen');
        return;
    }

    showLoading('Carregando perfil...');

    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (userDoc.exists()) {
            currentUserData = userDoc.data();
            currentUserData.uid = user.uid;

            await trackUserVisit();

            const adminDoc = await getDoc(doc(db, "admins", user.uid));
            const adminData = adminDoc.exists() ? adminDoc.data() : null;
            currentUserIsAdmin = adminDoc.exists() && adminData.active !== false;
            currentUserAdminRole = currentUserIsAdmin ? (adminData.role || "principal") : "";
            currentUserIsMainAdmin = currentUserIsAdmin && currentUserAdminRole !== "collaborator";

            setupProfileScreen();
            showScreen('profile-screen');
        } else {
            showScreen('complete-profile-screen');
        }
    } catch (error) {
        console.error(error);
        alert("Erro ao carregar perfil. Verifique as regras do Firebase.");
    } finally {
        hideLoading();
    }
});

document.getElementById('btn-go-create-account').addEventListener('click', () => {
    document.getElementById('create-account-form').reset();
    showScreen('create-account-screen');
});

document.getElementById('btn-back-login-create').addEventListener('click', () => {
    showScreen('login-screen');
});

document.getElementById('create-account-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('create-email').value.trim();
    const password = document.getElementById('create-password').value;

    showLoading('Criando acesso...');

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        document.getElementById('complete-profile-form').reset();
        showScreen('complete-profile-screen');
    } catch (error) {
        alert(getAuthErrorMessage(error));
    } finally {
        hideLoading();
    }
});

document.getElementById('complete-profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!auth.currentUser) {
        return alert("Crie seu acesso primeiro.");
    }

    const cpf = document.getElementById('reg-cpf').value.replace(/\D/g, "");

    if (cpf.length !== 11) {
        return alert("CPF inválido.");
    }

    showLoading('Salvando cadastro...');

    try {
        const userProfile = {
            name: document.getElementById('reg-name').value.trim(),
            cpf: cpf,
            dob: document.getElementById('reg-dob').value,
            whatsapp: document.getElementById('reg-whatsapp').value,
            email: auth.currentUser.email,
            whiteLabelActive: false,
            logoUrl: "",
            createdAt: serverTimestamp()
        };

        await setDoc(doc(db, "users", auth.currentUser.uid), userProfile);

        alert("Cadastro concluído! Agora faça login com seu e-mail e senha.");

        await signOut(auth);

        document.getElementById('login-form').reset();
        showScreen('login-screen');
    } catch (error) {
        console.error(error);
        alert("Erro ao salvar cadastro.");
    } finally {
        hideLoading();
    }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    showLoading('Entrando...');

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert(getAuthErrorMessage(error));
    } finally {
        hideLoading();
    }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
    await signOut(auth);
    document.getElementById('login-form').reset();
    showScreen('login-screen');
});


async function trackUserVisit() {
    if (!currentUser) return;

    try {
        await setDoc(doc(db, "users", currentUser.uid), {
            lastVisitAt: serverTimestamp(),
            lastVisitUserAgent: navigator.userAgent || "",
            lastVisitPage: window.location.href || ""
        }, { merge: true });
    } catch (error) {
        console.warn("Não foi possível registrar acesso do usuário:", error);
    }
}

// ==========================================
// PERFIL, WHITE LABEL E PEDIDOS DO CLIENTE
// ==========================================

function setupProfileScreen() {
    document.getElementById('user-name').textContent = formatNameTitle(currentUserData.name || "Usuário");
    document.getElementById('user-phone').textContent = currentUserData.whatsapp || "";
    document.getElementById('user-email').textContent = currentUserData.email || "";
    document.getElementById('user-cpf').textContent = currentUserData.cpf ? maskCPF(currentUserData.cpf) : "";
    document.getElementById('user-avatar-initials').textContent = (currentUserData.name || "U").trim().charAt(0).toUpperCase();
    const welcomeName = document.getElementById('client-welcome-name');
    if (welcomeName) {
        welcomeName.textContent = formatNameTitle(currentUserData.name || "cliente").split(" ")[0];
    }

    const adminButton = document.getElementById('btn-admin-panel');

    if (currentUserIsAdmin) {
        adminButton.classList.remove('hidden-by-state');
    } else {
        adminButton.classList.add('hidden-by-state');
    }

    const aerofotoLink = document.getElementById('btn-aerofoto-email');
    const subject = encodeURIComponent("Solicitar aerofotolevantamento de área");
    const body = encodeURIComponent(
        `Olá, equipe UP AGRO.\n\nGostaria de solicitar aerofotolevantamento de minha área.\n\nNome: ${currentUserData.name || ""}\nWhatsApp: ${currentUserData.whatsapp || ""}\nCPF: ${currentUserData.cpf || ""}\n\nDescrição da área/demanda:\n`
    );
    aerofotoLink.href = `mailto:atendimento@upagritechnology.com.br?subject=${subject}&body=${body}`;

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
                ref(storage, `logos/${currentUser.uid}/${Date.now()}_${selectedLogoFile.name}`),
                selectedLogoFile
            );

            logoUrl = await getDownloadURL(snapshot.ref);
        }

        await setDoc(doc(db, "users", currentUser.uid), {
            whiteLabelActive: isWL,
            logoUrl: isWL ? logoUrl : ""
        }, { merge: true });

        currentUserData.whiteLabelActive = isWL;
        currentUserData.logoUrl = isWL ? logoUrl : "";

        alert("Salvo!");
    } catch (e) {
        console.error(e);
        alert("Erro ao salvar.");
    } finally {
        hideLoading();
    }
});

async function loadUserOrders() {
    const container = document.getElementById('user-orders-container');

    if (!currentUser) {
        container.innerHTML = "<p>Entre na conta para visualizar seus pedidos.</p>";
        return;
    }

    container.innerHTML = "<p>Carregando pedidos...</p>";

    try {
        const q = query(
            collection(db, "orders"),
            where("userId", "==", currentUser.uid)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            container.innerHTML = "<p>Você ainda não possui pedidos.</p>";
            return;
        }

        const userOrders = [];

        querySnapshot.forEach((docSnap) => {
            userOrders.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        userOrders.sort((a, b) => {
            const dateA = a.createdAt ? a.createdAt.toMillis() : 0;
            const dateB = b.createdAt ? b.createdAt.toMillis() : 0;
            return dateB - dateA;
        });

        container.innerHTML = `<div class="orders-list" id="user-orders-list"></div>`;
        const ordersList = document.getElementById('user-orders-list');

        userOrders.forEach((order) => {
            const orderId = order.id;
            const status = order.status || "Aguardando valor";
            const dateStr = order.createdAt
                ? new Date(order.createdAt.toDate()).toLocaleDateString('pt-BR')
                : 'Recente';

            let paymentHtml = "";

            if (status === "Aguardando valor" || status === "Pendente") {
                paymentHtml = `
                    <div class="payment-box warning">
                        <p><strong>Aguardando orçamento</strong></p>
                        <p>O administrador ainda vai inserir o valor e a chave PIX deste pedido.</p>
                    </div>
                `;
            }

            if (status === "Aguardando pagamento") {
                paymentHtml = `
                    <div class="payment-box">
                        <p><strong>Pagamento liberado</strong></p>
                        <p>Copie a chave PIX abaixo e informe quando finalizar.</p>
                        <div class="pix-key-box">${escapeHtml(order.pixKey || "Não informada")}</div>
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
                    <div class="payment-box info">
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

            const statusClass = getStatusClass(status, order.archived === true);
            const statusText = getStatusText(status, order.archived === true);

            ordersList.innerHTML += `
                <div class="user-order-card">
                    <div class="order-card-header">
                        <div>
                            <h4 class="order-title">${escapeHtml(order.fieldName || "Pedido sem talhão")}</h4>
                            <p class="order-subtitle">${escapeHtml(order.farmName || "Fazenda não informada")} • ${dateStr}</p>
                        </div>
                        <span class="status-badge ${statusClass}">${escapeHtml(statusText)}</span>
                    </div>

                    <div class="info-grid">
                        <div class="info-box">
                            <span class="info-label">Valor</span>
                            <span class="info-value">${formatMoney(order.price)}</span>
                        </div>
                        <div class="info-box">
                            <span class="info-label">Operação</span>
                            <span class="info-value">${escapeHtml(order.operationType || "—")}</span>
                        </div>
                        <div class="info-box">
                            <span class="info-label">Largura</span>
                            <span class="info-value">${escapeHtml(order.implementWidth || "—")}m</span>
                        </div>
                        <div class="info-box">
                            <span class="info-label">Sistema</span>
                            <span class="info-value">${escapeHtml(order.gpsModel || "—")}</span>
                        </div>
                    </div>

                    ${paymentHtml}

                    <details class="order-details">
                        <summary>Ver detalhes do pedido</summary>
                        <div style="margin-top: 10px;">
                            <p><strong>Fazenda:</strong> ${escapeHtml(order.farmName)}</p>
                            <p><strong>Talhão:</strong> ${escapeHtml(order.fieldName)}</p>
                            <p><strong>Sistema:</strong> ${escapeHtml(order.systemBrand || "")} ${escapeHtml(order.systemModel || "")}</p>
                            <p><strong>Direcionamento:</strong> ${escapeHtml(order.directionLabel || "Definido pela UP Agritechnology")}</p>
                            ${order.directionMode === "user_defined" ? `<p><strong>Forma de definição:</strong> ${escapeHtml(order.angleDefinitionLabel || "")}</p>` : ""}
                            ${order.presetDirectionLabel ? `<p><strong>Sentido escolhido:</strong> ${escapeHtml(order.presetDirectionLabel)}</p>` : ""}
                            ${order.directionMode === "user_defined" ? `<p><strong>Ângulo:</strong> ${escapeHtml(order.compassDegree || "0")}°</p>` : ""}
                            ${order.orientationFileUrl ? `<p><strong>Arquivo/croqui de orientação:</strong> <a href="${order.orientationFileUrl}" target="_blank">Abrir arquivo</a></p>` : ""}
                            <p><strong>Demanda de modificação:</strong> ${order.modificationRequested ? "Sim" : "Não"}</p>
                            ${order.modificationRequested ? `<p><strong>Descrição:</strong> ${escapeHtml(order.modificationDescription || "")}</p>` : ""}
                            <p><strong>Observações:</strong> ${escapeHtml(order.observations || "Nenhuma")}</p>
                            ${buildMapPointsHtml(order.mapPoints)}
                        </div>
                    </details>
                </div>
            `;
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = "<p>Erro ao carregar seus pedidos. Atualize a página e tente novamente.</p>";
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


function ensureCardinalMarkers() {
    const wrapper = document.querySelector('.map-wrapper');
    if (!wrapper) return;

    const markers = [
        ["up-cardinal-n", "N"],
        ["up-cardinal-s", "S"],
        ["up-cardinal-e", "L"],
        ["up-cardinal-w", "O"]
    ];

    markers.forEach(([className, letter]) => {
        if (!wrapper.querySelector(`.${className}`)) {
            const marker = document.createElement('div');
            marker.className = `up-cardinal ${className}`;
            marker.textContent = letter;
            wrapper.appendChild(marker);
        }
    });
}

// ==========================================
// MAPA DE REFERÊNCIA E ROSA DOS VENTOS
// ==========================================

function updateMapPointsStatus() {
    const statusEl = document.getElementById('map-points-status');

    if (!statusEl) return;

    statusEl.textContent = `${selectedMapPoints.length} de ${MAX_MAP_POINTS} pontos marcados`;

    if (selectedMapPoints.length >= 1) {
        statusEl.textContent += " ✔";
        statusEl.style.color = "green";
    } else {
        statusEl.style.color = "var(--primary-dark)";
    }
}

function drawReferencePolygon() {
    if (!referenceMap) return;

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
    if (referenceMap) {
        referenceMarkers.forEach(marker => {
            referenceMap.removeLayer(marker);
        });

        if (referencePolygon) {
            referenceMap.removeLayer(referencePolygon);
            referencePolygon = null;
        }
    }

    referenceMarkers = [];
    selectedMapPoints = [];

    updateMapPointsStatus();
}

function centerMapOnCurrentLocation() {
    if (!referenceMap) {
        initReferenceMap();
    }

    if (!navigator.geolocation) {
        alert("Seu navegador não permite acessar a localização atual.");
        return;
    }

    showLoading("Buscando sua localização...");

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            referenceMap.setView([lat, lng], 17);

            if (currentLocationMarker) {
                referenceMap.removeLayer(currentLocationMarker);
            }

            currentLocationMarker = L.circleMarker([lat, lng], {
                radius: 8,
                color: '#1565C0',
                weight: 3,
                fillOpacity: 0.7
            })
                .addTo(referenceMap)
                .bindPopup("Sua localização atual")
                .openPopup();

            setTimeout(() => {
                referenceMap.invalidateSize();
            }, 300);

            hideLoading();
        },
        (error) => {
            console.error(error);
            hideLoading();

            if (error.code === 1) {
                alert("Permissão de localização negada. Autorize a localização no navegador para usar esta função.");
            } else if (error.code === 2) {
                alert("Não foi possível identificar sua localização atual.");
            } else {
                alert("Tempo esgotado ao buscar localização. Tente novamente.");
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0
        }
    );
}

function addReferencePoint(lat, lng) {
    if (!referenceMap) return;

    if (selectedMapPoints.length >= MAX_MAP_POINTS) {
        alert(`Você já marcou o limite de ${MAX_MAP_POINTS} pontos. Para alterar, clique em Limpar Pontos do Mapa.`);
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
    ensureCardinalMarkers();
    const mapEl = document.getElementById('reference-map');

    if (!mapEl || typeof L === "undefined") return;

    if (referenceMap) {
        setTimeout(() => {
            referenceMap.invalidateSize();
            ensureCardinalMarkers();
        }, 300);
        return;
    }

    referenceMap = L.map('reference-map').setView([-15.7801, -47.9292], 4);

    const normalMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 20,
        attribution: '&copy; OpenStreetMap'
    });

    const satelliteMap = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
            maxZoom: 19,
            attribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics and the GIS User Community'
        }
    );

    const satelliteLabels = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
            maxZoom: 19,
            pane: 'overlayPane',
            attribution: 'Labels &copy; Esri'
        }
    );

    const roadsLabels = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
        {
            maxZoom: 19,
            pane: 'overlayPane',
            attribution: 'Roads &copy; Esri'
        }
    );

    const satelliteWithLabels = L.layerGroup([
        satelliteMap,
        satelliteLabels,
        roadsLabels
    ]);

    const reliefMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap'
    });

    satelliteWithLabels.addTo(referenceMap);

    L.control.layers({
        "Satélite com nomes": satelliteWithLabels,
        "Satélite sem nomes": satelliteMap,
        "Mapa normal": normalMap,
        "Relevo / Topográfico": reliefMap
    }).addTo(referenceMap);

    referenceMap.on('click', (e) => {
        addReferencePoint(e.latlng.lat, e.latlng.lng);
    });

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                referenceMap.setView([lat, lng], 15);

                if (currentLocationMarker) {
                    referenceMap.removeLayer(currentLocationMarker);
                }

                currentLocationMarker = L.circleMarker([lat, lng], {
                    radius: 8,
                    color: '#1565C0',
                    weight: 3,
                    fillOpacity: 0.7
                })
                    .addTo(referenceMap)
                    .bindPopup("Sua localização atual");
            },
            () => {},
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
    updateCompassVisual();
}

function getGoogleMapsReferenceLink(points) {
    if (!points || points.length === 0) return "";
    const firstPoint = points[0];
    return `https://www.google.com/maps/search/?api=1&query=${firstPoint.lat},${firstPoint.lng}`;
}

function getGoogleMapsRouteLink(points) {
    if (!points || points.length === 0) return "";
    const path = points.map(point => `${point.lat},${point.lng}`).join('/');
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
            <p><strong>Pontos de referência:</strong> ${points.length} ponto(s) marcado(s)</p>
            <ol class="map-points-list">
                ${pointsList}
            </ol>
            <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                <a href="${searchLink}" target="_blank" class="btn-secondary">Abrir Ponto 1 no Google Maps</a>
                <a href="${routeLink}" target="_blank" class="btn-secondary">Ver Rota dos Pontos</a>
            </div>
        </div>
    `;
}

function updateCompassVisual() {
    const compass = document.getElementById('compass-overlay');
    const value = document.getElementById('compass-value');

    if (compass) {
        compass.style.transform = `rotate(${compassDegree}deg)`;
    }

    if (value) {
        value.textContent = `${Math.round(compassDegree)}°`;
    }
}


function setCompassDegree(value) {
    let parsed = Number(value);

    if (Number.isNaN(parsed)) {
        parsed = 0;
    }

    parsed = Math.round(parsed) % 360;

    if (parsed < 0) {
        parsed += 360;
    }

    compassDegree = parsed;

    const manualInput = document.getElementById('manual-angle-input');
    if (manualInput) {
        manualInput.value = String(compassDegree);
    }

    updateCompassVisual();
}

function updateCompassFromPointer(clientX, clientY) {
    const compass = document.getElementById('compass-overlay');

    if (!compass) return;

    const rect = compass.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const radians = Math.atan2(clientX - centerX, centerY - clientY);
    let degrees = radians * (180 / Math.PI);

    if (degrees < 0) degrees += 360;

    setCompassDegree(degrees);
}

const compassEl = document.getElementById('compass-overlay');

compassEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingCompass = true;
    compassEl.setPointerCapture(e.pointerId);
    updateCompassFromPointer(e.clientX, e.clientY);
});

compassEl.addEventListener('pointermove', (e) => {
    if (!isDraggingCompass) return;
    e.preventDefault();
    e.stopPropagation();
    updateCompassFromPointer(e.clientX, e.clientY);
});

compassEl.addEventListener('pointerup', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingCompass = false;
    compassEl.releasePointerCapture(e.pointerId);
});

compassEl.addEventListener('pointercancel', () => {
    isDraggingCompass = false;
});



function isKmlRequiredForCurrentRequest() {
    const modificationRequested = document.getElementById('modification-requested')?.checked === true;
    const directionMode = getSelectedDirectionMode();

    if (modificationRequested) {
        return true;
    }

    if (directionMode === "user_defined" || directionMode === "orientation_file") {
        return false;
    }

    return true;
}

function updateKmlRequiredUI() {
    const kmlInput = document.getElementById('kml-upload');
    const kmlFilename = document.getElementById('kml-filename');
    const hint = document.getElementById('kml-required-hint');

    if (!kmlInput || !kmlFilename) return;

    const required = isKmlRequiredForCurrentRequest();

    kmlInput.required = required;

    if (required) {
        kmlFilename.textContent = selectedKmlFile
            ? `✔ ${selectedKmlFile.name}`
            : "Anexar Arquivo KML/KMZ/SHP em ZIP *";

        if (hint) {
            hint.textContent = "Arquivo obrigatório quando a UP for interpretar o arquivo da área.";
        }
    } else {
        kmlFilename.textContent = selectedKmlFile
            ? `✔ ${selectedKmlFile.name}`
            : "Anexar Arquivo KML/KMZ/SHP em ZIP (opcional)";

        if (hint) {
            if (getSelectedDirectionMode() === "orientation_file") {
                hint.textContent = "Como você vai enviar um arquivo/croqui de orientação específica, o arquivo da área de cima fica opcional.";
            } else {
                hint.textContent = "Como você vai informar o sentido desejado, o arquivo é opcional. Se tiver arquivo da área, pode anexar para ajudar a equipe.";
            }
        }
    }
}

function getSelectedDirectionMode() {
    const selected = document.querySelector('input[name="line-direction-mode"]:checked');
    return selected ? selected.value : "up_defined";
}

function getSelectedDirectionLabel() {
    const mode = getSelectedDirectionMode();

    if (mode === "user_defined") {
        return "Informarei o sentido desejado";
    }

    if (mode === "orientation_file") {
        return "Enviar arquivo ou croqui com orientação específica";
    }

    return "Definido pela UP Agritechnology (recomendado)";
}


function getAngleDefinitionMode() {
    const selected = document.querySelector('input[name="angle-definition-mode"]:checked');
    return selected ? selected.value : "custom_angle";
}

function getPresetDirectionLabel() {
    const preset = document.getElementById('preset-direction-select');
    if (!preset || preset.value === "") {
        return "";
    }

    return preset.options[preset.selectedIndex].textContent;
}

function updateAngleDefinitionUI() {
    const mode = getAngleDefinitionMode();
    const customFields = document.getElementById('custom-angle-fields');
    const presetFields = document.getElementById('preset-direction-fields');
    const compass = document.getElementById('compass-overlay');
    const angleBox = document.getElementById('compass-angle-box');
    const directionMode = getSelectedDirectionMode();

    if (!customFields || !presetFields) return;

    if (mode === "custom_angle") {
        customFields.classList.remove('hidden');
        presetFields.classList.add('hidden');

        const presetSelect = document.getElementById('preset-direction-select');
        if (presetSelect) {
            presetSelect.value = "";
        }

        if (directionMode === "user_defined") {
            compass.classList.remove('hidden');
            angleBox.classList.remove('hidden');
        }
    } else {
        customFields.classList.add('hidden');
        presetFields.classList.remove('hidden');

        if (directionMode === "user_defined") {
            compass.classList.add('hidden');
            angleBox.classList.add('hidden');
        }
    }
}

function updateDirectionUI() {
    const mode = getSelectedDirectionMode();
    const compass = document.getElementById('compass-overlay');
    const angleBox = document.getElementById('compass-angle-box');
    const orientationGroup = document.getElementById('orientation-file-group');
    const orientationFileInput = document.getElementById('orientation-file-upload');

    const angleControlGroup = document.getElementById('angle-control-group');

    if (mode === "user_defined") {
        if (angleControlGroup) angleControlGroup.classList.remove('hidden');
        updateAngleDefinitionUI();
    } else {
        compass.classList.add('hidden');
        angleBox.classList.add('hidden');
        if (angleControlGroup) angleControlGroup.classList.add('hidden');
    }

    if (mode === "orientation_file") {
        orientationGroup.classList.remove('hidden');
        orientationFileInput.required = true;
    } else {
        orientationGroup.classList.add('hidden');
        orientationFileInput.required = false;
        orientationFileInput.value = "";
        selectedOrientationFile = null;
        const filename = document.getElementById('orientation-filename');
        if (filename) filename.textContent = "Nenhum arquivo selecionado";
    }

    updateKmlRequiredUI();
}

function setElementDisabledBySelector(selector, disabled) {
    document.querySelectorAll(selector).forEach((el) => {
        el.disabled = disabled;
        if (disabled) {
            el.setAttribute('data-was-disabled-by-modification', 'true');
        } else if (el.getAttribute('data-was-disabled-by-modification') === 'true') {
            el.removeAttribute('data-was-disabled-by-modification');
        }
    });
}

function updateModificationOnlyMode() {
    const isModificationOnly = document.getElementById('modification-requested').checked;
    const alertBox = document.getElementById('modification-only-alert');
    const descriptionGroup = document.getElementById('modification-description-group');
    const description = document.getElementById('modification-description');

    const mapSection = document.getElementById('map-reference-section');
    const directionSection = document.getElementById('direction-section');

    if (isModificationOnly) {
        alertBox.classList.remove('hidden');
        descriptionGroup.classList.remove('hidden');
        description.required = true;

        mapSection.classList.add('disabled-section');
        directionSection.classList.add('disabled-section');

        setElementDisabledBySelector('#operation-type, #operation-other-detail, #implement-width, #system-brand, #system-model, #system-other-name, #orientation-file-upload', true);
        document.querySelectorAll('input[name="line-direction-mode"]').forEach(radio => radio.disabled = true);
    } else {
        alertBox.classList.add('hidden');
        descriptionGroup.classList.add('hidden');
        description.required = false;

        mapSection.classList.remove('disabled-section');
        directionSection.classList.remove('disabled-section');

        setElementDisabledBySelector('#operation-type, #operation-other-detail, #implement-width, #system-brand, #system-model, #system-other-name, #orientation-file-upload', false);
        document.querySelectorAll('input[name="line-direction-mode"]').forEach(radio => radio.disabled = false);
        updateDirectionUI();
    }

    updateKmlRequiredUI();
}

// ==========================================
// SOLICITAÇÃO E CHECKOUT
// ==========================================

document.getElementById('btn-next-step').addEventListener('click', () => {
    document.getElementById('service-form').reset();
    document.getElementById('system-other-group').classList.add('hidden');
    document.getElementById('system-other-name').required = false;
    document.getElementById('operation-other-group').classList.add('hidden');
    document.getElementById('operation-other-detail').required = false;
    document.getElementById('modification-description-group').classList.add('hidden');
    document.getElementById('modification-only-alert').classList.add('hidden');
    document.getElementById('modification-description').required = false;
    document.querySelector('input[name="line-direction-mode"][value="up_defined"]').checked = true;
    updateDirectionUI();
    updateModificationOnlyMode();
    selectedKmlFile = null;
    selectedOrientationFile = null;
    compassDegree = 0;
    setCompassDegree(0);
    const presetDirectionSelect = document.getElementById('preset-direction-select');
    if (presetDirectionSelect) presetDirectionSelect.value = "";
    const angleCustomRadio = document.querySelector('input[name="angle-definition-mode"][value="custom_angle"]');
    if (angleCustomRadio) angleCustomRadio.checked = true;
    updateAngleDefinitionUI();
    updateCompassVisual();
    document.getElementById('system-model').innerHTML = `<option value="">Selecione primeiro a marca/sistema...</option>`;
    updateKmlRequiredUI();
    const orientationName = document.getElementById('orientation-filename');
    if (orientationName) orientationName.textContent = "Nenhum arquivo selecionado";
    clearMapPoints();
    showScreen('request-screen');
});

document.getElementById('btn-back-profile').addEventListener('click', () => {
    setupProfileScreen();
    showScreen('profile-screen');
});

document.getElementById('btn-back-request').addEventListener('click', () => {
    showScreen('request-screen');
});

document.getElementById('btn-clear-map-points').addEventListener('click', () => {
    clearMapPoints();
});

document.getElementById('btn-current-location').addEventListener('click', () => {
    centerMapOnCurrentLocation();
});

document.getElementById('kml-upload').addEventListener('change', (e) => {
    selectedKmlFile = e.target.files[0] || null;
    updateKmlRequiredUI();
});


document.getElementById('operation-type').addEventListener('change', (e) => {
    const otherGroup = document.getElementById('operation-other-group');
    const otherInput = document.getElementById('operation-other-detail');

    if (e.target.value === "Outro") {
        otherGroup.classList.remove('hidden');
        otherInput.required = true;
    } else {
        otherGroup.classList.add('hidden');
        otherInput.required = false;
        otherInput.value = "";
    }
});

document.getElementById('system-brand').addEventListener('change', (e) => {
    const brand = e.target.value;
    const modelSelect = document.getElementById('system-model');
    const otherGroup = document.getElementById('system-other-group');
    const otherInput = document.getElementById('system-other-name');

    modelSelect.innerHTML = `<option value="">Selecione...</option>`;

    if (brand === "Outro sistema") {
        otherGroup.classList.remove('hidden');
        otherInput.required = true;
        modelSelect.required = false;
        modelSelect.disabled = true;
        modelSelect.innerHTML = `<option value="Outro">Outro</option>`;
        return;
    }

    otherGroup.classList.add('hidden');
    otherInput.required = false;
    otherInput.value = "";
    modelSelect.required = true;
    modelSelect.disabled = false;

    if (systemModels[brand]) {
        systemModels[brand].forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            modelSelect.appendChild(option);
        });
    }
});

document.querySelectorAll('input[name="line-direction-mode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
        updateDirectionUI();
    });
});

document.querySelectorAll('input[name="angle-definition-mode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
        updateAngleDefinitionUI();
    });
});

document.getElementById('manual-angle-input').addEventListener('input', (e) => {
    setCompassDegree(e.target.value);
});

document.getElementById('preset-direction-select').addEventListener('change', (e) => {
    if (e.target.value !== "") {
        setCompassDegree(e.target.value);
    }
});

document.getElementById('orientation-file-upload').addEventListener('change', (e) => {
    selectedOrientationFile = e.target.files[0] || null;
    document.getElementById('orientation-filename').textContent = selectedOrientationFile
        ? `✔ ${selectedOrientationFile.name}`
        : "Nenhum arquivo selecionado";
});

document.getElementById('modification-requested').addEventListener('change', () => {
    if (!document.getElementById('modification-requested').checked) {
        document.getElementById('modification-description').value = "";
    }

    updateModificationOnlyMode();
});

document.getElementById('service-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const kmlRequired = isKmlRequiredForCurrentRequest();

    if (kmlRequired && !selectedKmlFile) {
        return alert("Anexe o arquivo KML/KMZ/SHP em ZIP.");
    }

    const modificationRequested = document.getElementById('modification-requested').checked;
    const modificationDescription = document.getElementById('modification-description').value.trim();

    if (modificationRequested && !modificationDescription) {
        return alert("Explique o que deseja modificar no arquivo.");
    }

    const directionMode = getSelectedDirectionMode();
    const directionLabel = getSelectedDirectionLabel();
    const angleDefinitionMode = getAngleDefinitionMode();
    const presetDirectionLabel = getPresetDirectionLabel();

    if (!modificationRequested && directionMode === "user_defined" && angleDefinitionMode === "preset_direction" && !presetDirectionLabel) {
        return alert("Escolha um sentido predefinido.");
    }

    let systemBrand = "";
    let systemModel = "";
    let gpsModel = "Demanda de modificação de arquivo";
    let operationTypeValue = "Modificação de arquivo";

    if (!modificationRequested) {
        if (selectedMapPoints.length < 1) {
            return alert("Marque pelo menos 1 ponto de referência no mapa.");
        }

        if (selectedMapPoints.length > MAX_MAP_POINTS) {
            return alert(`Marque no máximo ${MAX_MAP_POINTS} pontos.`);
        }

        if (directionMode === "orientation_file" && !selectedOrientationFile) {
            return alert("Anexe o arquivo ou croqui com a orientação específica.");
        }

        operationTypeValue = document.getElementById('operation-type').value;

        if (operationTypeValue === "Outro") {
            const operationOtherDetail = document.getElementById('operation-other-detail').value.trim();

            if (!operationOtherDetail) {
                return alert("Descreva o objetivo da operação.");
            }

            operationTypeValue = `Outro - ${operationOtherDetail}`;
        }

        systemBrand = document.getElementById('system-brand').value;
        systemModel = document.getElementById('system-model').value;

        if (systemBrand === "Outro sistema") {
            const otherName = document.getElementById('system-other-name').value.trim();

            if (!otherName) {
                return alert("Informe o nome do sistema.");
            }

            systemModel = otherName;
        }

        gpsModel = systemBrand === "Outro sistema"
            ? `Outro sistema - ${systemModel}`
            : `${systemBrand} - ${systemModel}`;
    }

    currentOrderData = {
        farmName: document.getElementById('farm-name').value.trim(),
        fieldName: document.getElementById('field-name').value.trim(),
        operationType: modificationRequested ? "Modificação de arquivo" : operationTypeValue,
        implementWidth: modificationRequested ? "" : document.getElementById('implement-width').value,
        systemBrand: systemBrand,
        systemModel: systemModel,
        gpsModel: gpsModel,
        directionMode: modificationRequested ? "modification_only" : directionMode,
        directionLabel: modificationRequested ? "Demanda de modificação de arquivo" : directionLabel,
        angleDefinitionMode: (!modificationRequested && directionMode === "user_defined") ? angleDefinitionMode : "",
        angleDefinitionLabel: (!modificationRequested && directionMode === "user_defined")
            ? (angleDefinitionMode === "preset_direction" ? "Sentido predefinido" : "Seta/ângulo manual")
            : "",
        presetDirectionLabel: (!modificationRequested && directionMode === "user_defined" && angleDefinitionMode === "preset_direction") ? presetDirectionLabel : "",
        compassDegree: (!modificationRequested && directionMode === "user_defined") ? compassDegree : null,
        observations: document.getElementById('observations').value.trim(),
        modificationRequested: modificationRequested,
        modificationDescription: modificationDescription,
        mapPoints: modificationRequested ? [] : selectedMapPoints,
        fileName: selectedKmlFile ? selectedKmlFile.name : ""
    };

    document.getElementById('order-summary-list').innerHTML = modificationRequested
        ? `
            <li><strong>Fazenda:</strong> ${escapeHtml(currentOrderData.farmName)}</li>
            <li><strong>Talhão:</strong> ${escapeHtml(currentOrderData.fieldName)}</li>
            <li><strong>Tipo:</strong> Demanda de modificação de arquivo</li>
            <li><strong>Arquivo:</strong> ${currentOrderData.fileName ? escapeHtml(currentOrderData.fileName) : "Não anexado"}</li>
            <li><strong>Descrição:</strong> ${escapeHtml(currentOrderData.modificationDescription)}</li>
        `
        : `
            <li><strong>Fazenda:</strong> ${escapeHtml(currentOrderData.farmName)}</li>
            <li><strong>Talhão:</strong> ${escapeHtml(currentOrderData.fieldName)}</li>
            <li><strong>Operação:</strong> ${escapeHtml(currentOrderData.operationType)}</li>
            <li><strong>Largura:</strong> ${escapeHtml(currentOrderData.implementWidth)}m</li>
            <li><strong>Sistema:</strong> ${escapeHtml(currentOrderData.gpsModel)}</li>
            <li><strong>Direcionamento:</strong> ${escapeHtml(currentOrderData.directionLabel)}</li>
            ${currentOrderData.directionMode === "user_defined" ? `<li><strong>Forma de definição:</strong> ${escapeHtml(currentOrderData.angleDefinitionLabel || "")}</li>` : ""}
            ${currentOrderData.presetDirectionLabel ? `<li><strong>Sentido escolhido:</strong> ${escapeHtml(currentOrderData.presetDirectionLabel)}</li>` : ""}
            ${currentOrderData.directionMode === "user_defined" ? `<li><strong>Ângulo:</strong> ${escapeHtml(currentOrderData.compassDegree)}°</li>` : ""}
            <li><strong>Pontos no mapa:</strong> ${selectedMapPoints.length} ponto(s)</li>
            <li><strong>Modificação de arquivo:</strong> Não</li>
        `;

    document.getElementById('terms-checkbox').checked = false;
    document.getElementById('btn-pay-pix').disabled = true;

    showScreen('checkout-screen');
});

document.getElementById('terms-checkbox').addEventListener('change', (e) => {
    document.getElementById('btn-pay-pix').disabled = !e.target.checked;
});

document.getElementById('btn-pay-pix').addEventListener('click', async () => {
    if (!currentUser || !currentUserData) {
        return alert("Faça login antes de enviar o pedido.");
    }

    showLoading('Enviando pedido...');

    try {
        let fileUrl = "";

        if (selectedKmlFile) {
            const filePath = `orders_files/${currentUser.uid}/${Date.now()}_${selectedKmlFile.name}`;
            const snapshot = await uploadBytes(ref(storage, filePath), selectedKmlFile);
            fileUrl = await getDownloadURL(snapshot.ref);
        }

        let orientationFileUrl = "";
        let orientationFileName = "";

        if (selectedOrientationFile && currentOrderData.directionMode === "orientation_file") {
            const orientationPath = `orientation_files/${currentUser.uid}/${Date.now()}_${selectedOrientationFile.name}`;
            const orientationSnapshot = await uploadBytes(ref(storage, orientationPath), selectedOrientationFile);
            orientationFileUrl = await getDownloadURL(orientationSnapshot.ref);
            orientationFileName = selectedOrientationFile.name;
        }

        await addDoc(collection(db, "orders"), {
            ...currentOrderData,
            userId: currentUser.uid,
            userCpf: currentUserData.cpf,
            userName: currentUserData.name,
            userWhatsapp: currentUserData.whatsapp,
            userEmail: currentUserData.email,
            fileUrl: fileUrl,
            orientationFileUrl: orientationFileUrl,
            orientationFileName: orientationFileName,
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
        document.getElementById('system-other-group').classList.add('hidden');
        document.getElementById('system-other-name').required = false;
        document.getElementById('modification-description-group').classList.add('hidden');
        document.getElementById('modification-description').required = false;
        selectedKmlFile = null;
        selectedOrientationFile = null;
        compassDegree = 0;
        updateCompassVisual();
        clearMapPoints();
        updateKmlRequiredUI();

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
// PAINEL ADMINISTRATIVO
// ==========================================


function applyAdminRoleUI() {
    const roleLabel = currentUserIsMainAdmin ? "Administrador principal" : "Colaborador ADM";

    document.querySelectorAll('[data-principal-only="true"]').forEach((el) => {
        if (currentUserIsMainAdmin) {
            el.classList.remove('hidden-by-role');
        } else {
            el.classList.add('hidden-by-role');
        }
    });

    const adminHeader = document.querySelector('#admin-screen .app-header h2');

    if (adminHeader) {
        adminHeader.innerHTML = `Painel ADM <span class="admin-role-badge">${roleLabel}</span>`;
    }
}

async function loadAdminPaymentSettings() {
    try {
        const settingsDoc = await getDoc(doc(db, "settings", "payment"));

        if (settingsDoc.exists()) {
            adminPaymentSettings = {
                fixedPixKey: settingsDoc.data().fixedPixKey || "",
                lockedPixEnabled: settingsDoc.data().lockedPixEnabled !== false
            };
        }

        const fixedPixInput = document.getElementById('fixed-pix-key');
        const fixedPixLocked = document.getElementById('fixed-pix-locked');

        if (fixedPixInput) fixedPixInput.value = adminPaymentSettings.fixedPixKey || "";
        if (fixedPixLocked) fixedPixLocked.checked = adminPaymentSettings.lockedPixEnabled !== false;
    } catch (error) {
        console.warn("Não foi possível carregar a configuração de PIX:", error);
    }
}

async function saveAdminPaymentSettings() {
    if (!currentUserIsMainAdmin) {
        return alert("Apenas o administrador principal pode alterar a chave PIX travada.");
    }

    const fixedPixInput = document.getElementById('fixed-pix-key');
    const fixedPixLocked = document.getElementById('fixed-pix-locked');

    const fixedPixKey = fixedPixInput.value.trim();
    const lockedPixEnabled = fixedPixLocked.checked;

    if (lockedPixEnabled && !fixedPixKey) {
        return alert("Informe a chave PIX oficial antes de travar para colaboradores.");
    }

    showLoading("Salvando chave PIX...");

    try {
        await setDoc(doc(db, "settings", "payment"), {
            fixedPixKey,
            lockedPixEnabled,
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.uid
        }, { merge: true });

        adminPaymentSettings = {
            fixedPixKey,
            lockedPixEnabled
        };

        alert("Chave PIX salva com sucesso.");
        loadAdminOrders();
    } catch (error) {
        console.error(error);
        alert("Erro ao salvar a chave PIX. Verifique as regras do Firestore.");
    } finally {
        hideLoading();
    }
}

const adminSettingsModal = document.getElementById('admin-settings-modal');

document.getElementById('btn-admin-panel').addEventListener('click', () => {
    if (!currentUserIsAdmin) {
        return alert("Seu usuário não tem permissão de administrador.");
    }

    showScreen('admin-screen');
    applyAdminRoleUI();
    loadAdminPaymentSettings();
    loadAdminOrders();
});

document.getElementById('btn-back-admin').addEventListener('click', () => {
    setupProfileScreen();
    showScreen('profile-screen');
});

document.getElementById('btn-admin-settings').addEventListener('click', () => {
    adminSettingsModal.classList.remove('hidden');
});

document.getElementById('btn-cancel-admin-settings').addEventListener('click', () => {
    adminSettingsModal.classList.add('hidden');
});

document.getElementById('btn-save-payment-settings').addEventListener('click', saveAdminPaymentSettings);

document.getElementById('btn-make-admin').addEventListener('click', async () => {
    if (!currentUserIsMainAdmin) {
        return alert("Apenas o administrador principal pode liberar novos administradores ou colaboradores.");
    }

    const email = document.getElementById('new-admin-email').value.trim().toLowerCase();
    const role = document.getElementById('new-admin-role').value;
    const roleLabel = role === "collaborator" ? "colaborador ADM" : "administrador principal";

    if (!email) {
        return alert("Informe o e-mail do usuário.");
    }

    const confirmacao = confirm(`Liberar ${email} como ${roleLabel}?`);

    if (!confirmacao) return;

    showLoading('Liberando administrador...');

    try {
        const q = query(
            collection(db, "users"),
            where("email", "==", email)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert("Usuário não encontrado. Ele precisa criar uma conta normal primeiro.");
            return;
        }

        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data();

        await setDoc(doc(db, "admins", userDoc.id), {
            name: userData.name || "Administrador",
            email: userData.email || email,
            role: role,
            active: true,
            createdAt: serverTimestamp(),
            createdBy: currentUser.uid
        }, { merge: true });

        alert(`${roleLabel} liberado com sucesso!`);
        document.getElementById('new-admin-email').value = "";
    } catch (error) {
        console.error(error);
        alert("Erro ao liberar administrador. Verifique as regras do Firestore.");
    } finally {
        hideLoading();
    }
});


// ==========================================
// RELATÓRIOS ADMINISTRATIVOS
// ==========================================

function timestampToDate(value) {
    if (!value) return null;

    if (typeof value.toDate === "function") {
        return value.toDate();
    }

    if (value instanceof Date) {
        return value;
    }

    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
        return parsed;
    }

    return null;
}

function formatDateTime(value) {
    const date = timestampToDate(value);

    if (!date) {
        return "—";
    }

    return date.toLocaleString('pt-BR');
}

function isDateWithinLastDays(value, days) {
    const date = timestampToDate(value);

    if (!date) {
        return false;
    }

    const now = new Date();
    const limit = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

    return date >= limit;
}

function normalizeCsvValue(value) {
    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value?.toDate === "function") {
        return value.toDate().toLocaleString('pt-BR');
    }

    if (Array.isArray(value)) {
        return JSON.stringify(value);
    }

    if (typeof value === "object") {
        return JSON.stringify(value);
    }

    return String(value).replaceAll('"', '""');
}

function downloadCsv(filename, rows) {
    if (!rows || rows.length === 0) {
        alert("Não há dados para exportar.");
        return;
    }

    const headers = Object.keys(rows[0]);

    const csv = [
        headers.join(";"),
        ...rows.map(row => headers.map(header => `"${normalizeCsvValue(row[header])}"`).join(";"))
    ].join("\n");

    const blob = new Blob(["\ufeff" + csv], {
        type: "text/csv;charset=utf-8;"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function buildReportTable(title, rows, columns, emptyText = "Nenhum registro encontrado.") {
    if (!rows || rows.length === 0) {
        return `
            <div class="report-section-box">
                <h4>${escapeHtml(title)}</h4>
                <p class="report-empty">${escapeHtml(emptyText)}</p>
            </div>
        `;
    }

    const head = columns.map(col => `<th>${escapeHtml(col.label)}</th>`).join("");

    const body = rows.slice(0, 10).map(row => {
        return `<tr>${columns.map(col => `<td>${escapeHtml(col.render ? col.render(row) : row[col.key] || "—")}</td>`).join("")}</tr>`;
    }).join("");

    const extra = rows.length > 10
        ? `<p style="margin-top: 8px; color: #6D5B25; font-weight: 800;">Mostrando 10 de ${rows.length} registros. Baixe o CSV para ver tudo.</p>`
        : "";

    return `
        <div class="report-section-box">
            <h4>${escapeHtml(title)}</h4>
            <div class="report-table-wrapper">
                <table class="report-table">
                    <thead><tr>${head}</tr></thead>
                    <tbody>${body}</tbody>
                </table>
            </div>
            ${extra}
        </div>
    `;
}

function mapUsersForCsv(users) {
    return users.map(user => ({
        id: user.id,
        nome: user.name || "",
        email: user.email || "",
        cpf: user.cpf || "",
        whatsapp: user.whatsapp || "",
        criado_em: formatDateTime(user.createdAt),
        ultimo_acesso: formatDateTime(user.lastVisitAt),
        white_label: user.whiteLabelActive ? "Sim" : "Não"
    }));
}

function mapOrdersForCsv(orders) {
    return orders.map(order => ({
        id: order.id,
        cliente: order.userName || "",
        email: order.userEmail || "",
        cpf: order.userCpf || "",
        whatsapp: order.userWhatsapp || "",
        fazenda: order.farmName || "",
        talhao: order.fieldName || "",
        status: order.status || "",
        valor: order.price || "",
        pix: order.pixKey || "",
        pagamento_confirmado: order.paymentConfirmed ? "Sim" : "Não",
        pagamento_informado: order.paymentInformed ? "Sim" : "Não",
        arquivado: order.archived ? "Sim" : "Não",
        operacao: order.operationType || "",
        sistema: order.gpsModel || "",
        direcionamento: order.directionLabel || "",
        forma_definicao_angulo: order.angleDefinitionLabel || "",
        sentido_predefinido: order.presetDirectionLabel || "",
        angulo: order.compassDegree ?? "",
        pontos: Array.isArray(order.mapPoints) ? order.mapPoints.length : 0,
        modificacao_arquivo: order.modificationRequested ? "Sim" : "Não",
        descricao_modificacao: order.modificationDescription || "",
        criado_em: formatDateTime(order.createdAt),
        finalizado_em: formatDateTime(order.completedAt)
    }));
}

function mapFinancialForCsv(orders) {
    return orders.map(order => ({
        id: order.id,
        cliente: order.userName || "",
        talhao: order.fieldName || "",
        status: order.status || "",
        valor: order.price || 0,
        pix: order.pixKey || "",
        pagamento_informado: order.paymentInformed ? "Sim" : "Não",
        pagamento_confirmado: order.paymentConfirmed ? "Sim" : "Não",
        criado_em: formatDateTime(order.createdAt)
    }));
}

async function generateAdminReports() {
    if (!currentUserIsAdmin) {
        return alert("Acesso negado.");
    }

    const summaryContainer = document.getElementById('admin-reports-summary');
    const detailsContainer = document.getElementById('admin-reports-details');

    summaryContainer.innerHTML = "<p>Carregando relatórios...</p>";
    detailsContainer.classList.add('hidden');
    detailsContainer.innerHTML = "";

    showLoading("Gerando relatórios...");

    try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        const ordersSnapshot = await getDocs(collection(db, "orders"));

        const users = [];
        const orders = [];

        usersSnapshot.forEach(docSnap => {
            users.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        ordersSnapshot.forEach(docSnap => {
            orders.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        users.sort((a, b) => {
            const dateA = timestampToDate(a.createdAt)?.getTime() || 0;
            const dateB = timestampToDate(b.createdAt)?.getTime() || 0;
            return dateB - dateA;
        });

        orders.sort((a, b) => {
            const dateA = timestampToDate(a.createdAt)?.getTime() || 0;
            const dateB = timestampToDate(b.createdAt)?.getTime() || 0;
            return dateB - dateA;
        });

        const visitedLastWeek = users.filter(user => isDateWithinLastDays(user.lastVisitAt, 7));
        const usersWithOrdersIds = new Set(orders.map(order => order.userId).filter(Boolean));
        const usersWithOrders = users.filter(user => usersWithOrdersIds.has(user.id));

        const waitingPrice = orders.filter(order => (order.status || "Aguardando valor") === "Aguardando valor" || order.status === "Pendente");
        const waitingPayment = orders.filter(order => order.status === "Aguardando pagamento");
        const paymentInformed = orders.filter(order => order.status === "Pagamento informado");
        const inQueue = orders.filter(order => order.status === "Na fila" || order.status === "Em produção");
        const completed = orders.filter(order => order.status === "Concluído" && order.archived !== true);
        const archived = orders.filter(order => order.archived === true);
        const modificationOrders = orders.filter(order => order.modificationRequested === true);

        const totalValue = orders.reduce((sum, order) => sum + (Number(order.price) || 0), 0);
        const confirmedValue = orders
            .filter(order => order.paymentConfirmed === true)
            .reduce((sum, order) => sum + (Number(order.price) || 0), 0);
        const pendingValue = orders
            .filter(order => order.price && order.paymentConfirmed !== true)
            .reduce((sum, order) => sum + (Number(order.price) || 0), 0);

        adminReportsCache = {
            users,
            orders,
            visitedLastWeek,
            usersWithOrders,
            waitingPrice,
            waitingPayment,
            paymentInformed,
            inQueue,
            completed,
            archived,
            modificationOrders,
            financial: orders.filter(order => order.price)
        };

        summaryContainer.innerHTML = `
            <div class="report-metric-grid">
                <div class="report-metric-card">
                    <span class="report-metric-label">Usuários cadastrados</span>
                    <span class="report-metric-value">${users.length}</span>
                </div>
                <div class="report-metric-card">
                    <span class="report-metric-label">Acessaram nos últimos 7 dias</span>
                    <span class="report-metric-value">${visitedLastWeek.length}</span>
                </div>
                <div class="report-metric-card">
                    <span class="report-metric-label">Clientes com pedido</span>
                    <span class="report-metric-value">${usersWithOrders.length}</span>
                </div>
                <div class="report-metric-card">
                    <span class="report-metric-label">Total de pedidos</span>
                    <span class="report-metric-value">${orders.length}</span>
                </div>
                <div class="report-metric-card">
                    <span class="report-metric-label">Aguardando orçamento</span>
                    <span class="report-metric-value">${waitingPrice.length}</span>
                </div>
                <div class="report-metric-card">
                    <span class="report-metric-label">Aguardando pagamento</span>
                    <span class="report-metric-value">${waitingPayment.length}</span>
                </div>
                <div class="report-metric-card">
                    <span class="report-metric-label">Pagamento informado</span>
                    <span class="report-metric-value">${paymentInformed.length}</span>
                </div>
                <div class="report-metric-card">
                    <span class="report-metric-label">Na fila</span>
                    <span class="report-metric-value">${inQueue.length}</span>
                </div>
                <div class="report-metric-card">
                    <span class="report-metric-label">Concluídos</span>
                    <span class="report-metric-value">${completed.length}</span>
                </div>
                <div class="report-metric-card">
                    <span class="report-metric-label">Arquivados</span>
                    <span class="report-metric-value">${archived.length}</span>
                </div>
                <div class="report-metric-card">
                    <span class="report-metric-label">Modificação de arquivo</span>
                    <span class="report-metric-value">${modificationOrders.length}</span>
                </div>
                <div class="report-metric-card">
                    <span class="report-metric-label">Valor confirmado</span>
                    <span class="report-metric-value">${formatMoney(confirmedValue)}</span>
                </div>
            </div>

            <p style="color: var(--text-muted); font-size: 0.88rem;">
                Valor total orçado: <strong>${formatMoney(totalValue)}</strong> •
                Valor pendente de confirmação: <strong>${formatMoney(pendingValue)}</strong>
            </p>
        `;

        detailsContainer.innerHTML = `
            ${buildReportTable("Usuários que acessaram nos últimos 7 dias", visitedLastWeek, [
                { label: "Nome", key: "name" },
                { label: "E-mail", key: "email" },
                { label: "WhatsApp", key: "whatsapp" },
                { label: "Último acesso", render: row => formatDateTime(row.lastVisitAt) }
            ])}

            ${buildReportTable("Pedidos pendentes de ação", [...waitingPrice, ...waitingPayment, ...paymentInformed], [
                { label: "Cliente", key: "userName" },
                { label: "Talhão", key: "fieldName" },
                { label: "Status", key: "status" },
                { label: "Valor", render: row => formatMoney(row.price) },
                { label: "Criado em", render: row => formatDateTime(row.createdAt) }
            ])}

            ${buildReportTable("Últimos pedidos", orders, [
                { label: "Cliente", key: "userName" },
                { label: "Fazenda", key: "farmName" },
                { label: "Talhão", key: "fieldName" },
                { label: "Status", key: "status" },
                { label: "Sistema", key: "gpsModel" },
                { label: "Criado em", render: row => formatDateTime(row.createdAt) }
            ])}

            ${buildReportTable("Demandas de modificação de arquivo", modificationOrders, [
                { label: "Cliente", key: "userName" },
                { label: "Talhão", key: "fieldName" },
                { label: "Status", key: "status" },
                { label: "Descrição", key: "modificationDescription" },
                { label: "Criado em", render: row => formatDateTime(row.createdAt) }
            ])}
        `;

        detailsContainer.classList.remove('hidden');

        document.querySelectorAll('#admin-reports-card button, .admin-report-actions button').forEach(button => {
            button.disabled = false;
        });

        document.getElementById('btn-export-users-csv').disabled = false;
        document.getElementById('btn-export-visits-csv').disabled = false;
        document.getElementById('btn-export-orders-csv').disabled = false;
        document.getElementById('btn-export-pending-csv').disabled = false;
        document.getElementById('btn-export-financial-csv').disabled = false;
        document.getElementById('btn-export-full-csv').disabled = false;

    } catch (error) {
        console.error(error);
        summaryContainer.innerHTML = "<p>Erro ao gerar relatórios. Verifique as regras do Firebase.</p>";
    } finally {
        hideLoading();
    }
}

function requireReportsCache() {
    if (!adminReportsCache) {
        alert("Clique em Gerar Relatórios primeiro.");
        return false;
    }

    return true;
}

document.getElementById('btn-generate-admin-reports').addEventListener('click', generateAdminReports);

document.getElementById('btn-export-users-csv').addEventListener('click', () => {
    if (!requireReportsCache()) return;
    downloadCsv("usuarios_cadastrados_up_agro.csv", mapUsersForCsv(adminReportsCache.users));
});

document.getElementById('btn-export-visits-csv').addEventListener('click', () => {
    if (!requireReportsCache()) return;
    downloadCsv("acessos_ultimos_7_dias_up_agro.csv", mapUsersForCsv(adminReportsCache.visitedLastWeek));
});

document.getElementById('btn-export-orders-csv').addEventListener('click', () => {
    if (!requireReportsCache()) return;
    downloadCsv("todos_pedidos_up_agro.csv", mapOrdersForCsv(adminReportsCache.orders));
});

document.getElementById('btn-export-pending-csv').addEventListener('click', () => {
    if (!requireReportsCache()) return;
    const pending = [
        ...adminReportsCache.waitingPrice,
        ...adminReportsCache.waitingPayment,
        ...adminReportsCache.paymentInformed,
        ...adminReportsCache.inQueue
    ];
    downloadCsv("pendencias_up_agro.csv", mapOrdersForCsv(pending));
});

document.getElementById('btn-export-financial-csv').addEventListener('click', () => {
    if (!requireReportsCache()) return;
    downloadCsv("financeiro_up_agro.csv", mapFinancialForCsv(adminReportsCache.financial));
});

document.getElementById('btn-export-full-csv').addEventListener('click', () => {
    if (!requireReportsCache()) return;

    const fullRows = [
        ...mapUsersForCsv(adminReportsCache.users).map(row => ({ tipo: "usuario", ...row })),
        ...mapOrdersForCsv(adminReportsCache.orders).map(row => ({ tipo: "pedido", ...row }))
    ];

    downloadCsv("relatorio_completo_up_agro.csv", fullRows);
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
    if (!currentUserIsAdmin) return alert("Acesso negado.");

    if (!adminSelectedBanner) {
        return alert("Selecione um banner primeiro.");
    }

    showLoading('Salvando Banner...');

    try {
        const snapshot = await uploadBytes(
            ref(storage, `app_assets/global_banner_${Date.now()}`),
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
        console.error(error);
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
    if (!currentUserIsAdmin) return alert("Acesso negado.");

    if (!adminSelectedLogo) {
        return alert("Selecione uma logo primeiro.");
    }

    showLoading('Salvando Logo...');

    try {
        const snapshot = await uploadBytes(
            ref(storage, `app_assets/global_logo_${Date.now()}`),
            adminSelectedLogo
        );

        const logoUrl = await getDownloadURL(snapshot.ref);

        await setDoc(doc(db, "settings", "app"), {
            logoUrl: logoUrl
        }, { merge: true });

        alert("Logo principal atualizada!");

        document.getElementById('main-app-logo').src = logoUrl;
    } catch (error) {
        console.error(error);
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

    const statusClass = getStatusClass(status, order.archived === true);
    const statusText = getStatusText(status, order.archived === true);

    return `
        <div class="admin-order-card">
            <div class="order-card-header">
                <div>
                    <h4 class="order-title">${escapeHtml(order.fieldName || "Pedido sem talhão")}</h4>
                    <p class="order-subtitle">${escapeHtml(order.farmName || "Fazenda não informada")} • ${dateStr}</p>
                </div>
                <span class="status-badge ${statusClass}">${escapeHtml(statusText)}</span>
            </div>

            <div class="info-grid">
                <div class="info-box">
                    <span class="info-label">Cliente</span>
                    <span class="info-value">${escapeHtml(order.userName || "Não informado")}</span>
                </div>

                <div class="info-box">
                    <span class="info-label">WhatsApp</span>
                    <span class="info-value">${escapeHtml(order.userWhatsapp || "Não informado")}</span>
                </div>

                <div class="info-box">
                    <span class="info-label">E-mail</span>
                    <span class="info-value">${escapeHtml(order.userEmail || "Não informado")}</span>
                </div>

                <div class="info-box">
                    <span class="info-label">CPF</span>
                    <span class="info-value">${escapeHtml(order.userCpf || "Não informado")}</span>
                </div>

                <div class="info-box">
                    <span class="info-label">Valor</span>
                    <span class="info-value">${formatMoney(order.price)}</span>
                </div>

                <div class="info-box">
                    <span class="info-label">Operação</span>
                    <span class="info-value">${escapeHtml(order.operationType || "Não informado")}</span>
                </div>

                <div class="info-box">
                    <span class="info-label">Largura</span>
                    <span class="info-value">${escapeHtml(order.implementWidth || "0")}m</span>
                </div>

                <div class="info-box">
                    <span class="info-label">Sistema</span>
                    <span class="info-value">${escapeHtml(order.gpsModel || "Não informado")}</span>
                </div>
            </div>

            ${order.fileUrl ? `<a href="${order.fileUrl}" target="_blank" class="btn-secondary">Baixar Arquivo Anexado</a>` : ''}
            ${order.orientationFileUrl ? `<a href="${order.orientationFileUrl}" target="_blank" class="btn-secondary">Baixar Croqui/Orientação</a>` : ''}

            <details class="admin-details">
                <summary>Ver detalhes técnicos e pontos do mapa</summary>
                <div style="margin-top: 10px;">
                    <p><strong>Marca/Sistema:</strong> ${escapeHtml(order.systemBrand || "")}</p>
                    <p><strong>Modelo/Formato:</strong> ${escapeHtml(order.systemModel || "")}</p>
                    <p><strong>Direcionamento:</strong> ${escapeHtml(order.directionLabel || "Definido pela UP Agritechnology")}</p>
                    ${order.directionMode === "user_defined" ? `<p><strong>Forma de definição:</strong> ${escapeHtml(order.angleDefinitionLabel || "")}</p>` : ""}
                    ${order.presetDirectionLabel ? `<p><strong>Sentido escolhido:</strong> ${escapeHtml(order.presetDirectionLabel)}</p>` : ""}
                    ${order.directionMode === "user_defined" ? `<p><strong>Ângulo:</strong> ${escapeHtml(order.compassDegree || "0")}°</p>` : ""}
                    ${order.orientationFileUrl ? `<p><strong>Arquivo/croqui de orientação:</strong> <a href="${order.orientationFileUrl}" target="_blank">Abrir arquivo</a></p>` : ""}
                    <p><strong>Demanda de modificação:</strong> ${order.modificationRequested ? "Sim" : "Não"}</p>
                    ${order.modificationRequested ? `<p><strong>Descrição da modificação:</strong> ${escapeHtml(order.modificationDescription || "")}</p>` : ""}
                    <p><strong>Observações:</strong> ${escapeHtml(order.observations || "Nenhuma")}</p>
                    ${buildMapPointsHtml(order.mapPoints)}
                </div>
            </details>

            <div class="admin-delete-zone">
                <button class="btn danger full-width btn-delete-order-admin" data-id="${escapeHtml(orderId)}">
                    Apagar Pedido
                </button>
                <p class="delete-warning-text">Use apenas para pedidos de teste ou registros que realmente devem ser removidos.</p>
            </div>

            <input type="hidden" value="${escapeHtml(orderId)}">
    `;
}

async function loadAdminOrders() {
    await loadAdminPaymentSettings();

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
                        <div class="admin-action-box">
                            <p style="font-weight: 800; color: var(--primary-dark); margin-bottom: 10px;">Definir cobrança do pedido</p>

                            <div class="admin-payment-form">
                                <div>
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
                                </div>

                                ${currentUserIsMainAdmin ? `
                                    <div>
                                        <label>Chave PIX</label>
                                        <input 
                                            type="text" 
                                            class="form-control admin-pix-input" 
                                            id="admin-pix-${orderId}" 
                                            placeholder="Digite a chave PIX"
                                            value="${escapeHtml(order.pixKey || adminPaymentSettings.fixedPixKey || "")}"
                                        >
                                        ${adminPaymentSettings.lockedPixEnabled && adminPaymentSettings.fixedPixKey ? `<p class="collaborator-note">PIX travado para colaboradores: ${escapeHtml(adminPaymentSettings.fixedPixKey)}</p>` : ""}
                                    </div>
                                ` : `
                                    <div>
                                        <label>Chave PIX travada pelo ADM principal</label>
                                        <input 
                                            type="text" 
                                            class="form-control admin-pix-input pix-locked-readonly" 
                                            id="admin-pix-${orderId}" 
                                            value="${escapeHtml(adminPaymentSettings.fixedPixKey || "Nenhuma chave PIX configurada")}"
                                            readonly
                                        >
                                        <p class="collaborator-note">Como colaborador, você informa apenas o valor. A chave PIX é definida pelo ADM principal.</p>
                                    </div>
                                `}

                                <button class="btn primary full-width btn-set-price-pix full-row" data-id="${orderId}">
                                    Salvar Valor e Enviar Cobrança ao Cliente
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                return;
            }

            if (status === "Aguardando pagamento" || status === "Pagamento informado") {
                hasPending = true;

                pendingContainer.innerHTML += `
                    ${baseInfoHtml}
                        <div class="admin-action-box">
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

                        <div class="admin-action-box">
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
                                data-userid="${escapeHtml(order.userId || "")}">
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

        if (!hasPricing) pricingContainer.innerHTML = "<p>Nenhum pedido aguardando valor.</p>";
        if (!hasPending) pendingContainer.innerHTML = "<p>Nenhum pagamento aguardando confirmação.</p>";
        if (!hasQueue) queueContainer.innerHTML = "<p>Nenhum pedido na fila.</p>";
        if (!hasCompleted) completedContainer.innerHTML = "<p>Nenhum pedido concluído.</p>";
        if (!hasArchived) archivedContainer.innerHTML = "<p>Nenhum pedido arquivado.</p>";

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
        let pixKey = currentUserIsMainAdmin
            ? (pixInput ? pixInput.value.trim() : "")
            : (adminPaymentSettings.lockedPixEnabled ? (adminPaymentSettings.fixedPixKey || "") : "");

        if (!price || price <= 0) {
            return alert("Informe um valor válido para o pedido.");
        }

        if (!pixKey) {
            return alert(currentUserIsMainAdmin
                ? "Informe a chave PIX."
                : "O ADM principal precisa configurar e travar uma chave PIX antes de o colaborador dar orçamento.");
        }

        showLoading('Salvando cobrança...');

        try {
            await setDoc(doc(db, "orders", orderId), {
                price: price,
                pixKey: pixKey,
                status: "Aguardando pagamento",
                pricedAt: serverTimestamp(),
                pricedBy: currentUser.uid,
                pricedByRole: currentUserAdminRole || "principal"
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

        if (!confirmacao) return;

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
        const userId = e.target.getAttribute('data-userid');

        const fileInput = document.getElementById(`upload-final-${orderId}`);
        const file = fileInput.files[0];

        if (!file) {
            return alert("Selecione o arquivo final.");
        }

        showLoading('Enviando Arquivo Final...');

        try {
            const filePath = `completed_orders/${userId}/${Date.now()}_${file.name}`;
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

        if (!confirmacao) return;

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


async function deleteAdminOrder(orderId) {
    if (!currentUserIsAdmin) {
        return alert("Acesso negado.");
    }

    const firstConfirm = confirm("Tem certeza que deseja apagar este pedido? Essa ação remove o pedido da listagem do sistema.");

    if (!firstConfirm) return;

    const secondConfirm = confirm("Confirme novamente: este pedido será apagado e não aparecerá mais no painel ADM nem para o cliente.");

    if (!secondConfirm) return;

    showLoading("Apagando pedido...");

    try {
        await deleteDoc(doc(db, "orders", orderId));
        alert("Pedido apagado com sucesso.");
        loadAdminOrders();
    } catch (error) {
        console.error(error);
        alert("Erro ao apagar pedido. Verifique as regras do Firebase.");
    } finally {
        hideLoading();
    }
}

document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-delete-order-admin')) {
        const orderId = e.target.getAttribute('data-id');

        if (!orderId) {
            return alert("Pedido não identificado.");
        }

        await deleteAdminOrder(orderId);
    }
});

// ==========================================
// SERVICE WORKER
// ==========================================

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
        reg.update();
    }).catch((error) => {
        console.warn('Service Worker não registrado:', error);
    });

    let refreshing;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;

        refreshing = true;
        window.location.reload();
    });
}
