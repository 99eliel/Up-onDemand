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
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ==========================================
// VARIÁVEIS GLOBAIS E UTILITÁRIOS
// ==========================================

let currentUser = null;
let currentUserData = null;
let currentUserIsAdmin = false;
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

            const adminDoc = await getDoc(doc(db, "admins", user.uid));
            currentUserIsAdmin = adminDoc.exists() && adminDoc.data().active !== false;

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

    const reliefMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap'
    });

    satelliteMap.addTo(referenceMap);

    L.control.layers({
        "Satélite": satelliteMap,
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

function updateDirectionUI() {
    const mode = getSelectedDirectionMode();
    const compass = document.getElementById('compass-overlay');
    const angleBox = document.getElementById('compass-angle-box');
    const orientationGroup = document.getElementById('orientation-file-group');
    const orientationFileInput = document.getElementById('orientation-file-upload');

    const angleControlGroup = document.getElementById('angle-control-group');

    if (mode === "user_defined") {
        compass.classList.remove('hidden');
        angleBox.classList.remove('hidden');
        if (angleControlGroup) angleControlGroup.classList.remove('hidden');
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

        setElementDisabledBySelector('#operation-type, #implement-width, #system-brand, #system-model, #system-other-name, #orientation-file-upload', true);
        document.querySelectorAll('input[name="line-direction-mode"]').forEach(radio => radio.disabled = true);
    } else {
        alertBox.classList.add('hidden');
        descriptionGroup.classList.add('hidden');
        description.required = false;

        mapSection.classList.remove('disabled-section');
        directionSection.classList.remove('disabled-section');

        setElementDisabledBySelector('#operation-type, #implement-width, #system-brand, #system-model, #system-other-name, #orientation-file-upload', false);
        document.querySelectorAll('input[name="line-direction-mode"]').forEach(radio => radio.disabled = false);
        updateDirectionUI();
    }
}

// ==========================================
// SOLICITAÇÃO E CHECKOUT
// ==========================================

document.getElementById('btn-next-step').addEventListener('click', () => {
    document.getElementById('service-form').reset();
    document.getElementById('system-other-group').classList.add('hidden');
    document.getElementById('system-other-name').required = false;
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
    updateCompassVisual();
    document.getElementById('system-model').innerHTML = `<option value="">Selecione primeiro a marca/sistema...</option>`;
    document.getElementById('kml-filename').textContent = "Anexar Arquivo KML/KMZ/SHP em ZIP *";
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
    selectedKmlFile = e.target.files[0];

    document.getElementById('kml-filename').textContent = selectedKmlFile
        ? `✔ ${selectedKmlFile.name}`
        : "Anexar Arquivo KML/KMZ/SHP em ZIP *";
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

    if (!selectedKmlFile) {
        return alert("Anexe o arquivo KML/KMZ/SHP em ZIP.");
    }

    const modificationRequested = document.getElementById('modification-requested').checked;
    const modificationDescription = document.getElementById('modification-description').value.trim();

    if (modificationRequested && !modificationDescription) {
        return alert("Explique o que deseja modificar no arquivo.");
    }

    const directionMode = getSelectedDirectionMode();
    const directionLabel = getSelectedDirectionLabel();

    let systemBrand = "";
    let systemModel = "";
    let gpsModel = "Demanda de modificação de arquivo";

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
        operationType: modificationRequested ? "Modificação de arquivo" : document.getElementById('operation-type').value,
        implementWidth: modificationRequested ? "" : document.getElementById('implement-width').value,
        systemBrand: systemBrand,
        systemModel: systemModel,
        gpsModel: gpsModel,
        directionMode: modificationRequested ? "modification_only" : directionMode,
        directionLabel: modificationRequested ? "Demanda de modificação de arquivo" : directionLabel,
        compassDegree: (!modificationRequested && directionMode === "user_defined") ? compassDegree : null,
        observations: document.getElementById('observations').value.trim(),
        modificationRequested: modificationRequested,
        modificationDescription: modificationDescription,
        mapPoints: modificationRequested ? [] : selectedMapPoints,
        fileName: selectedKmlFile.name
    };

    document.getElementById('order-summary-list').innerHTML = modificationRequested
        ? `
            <li><strong>Fazenda:</strong> ${escapeHtml(currentOrderData.farmName)}</li>
            <li><strong>Talhão:</strong> ${escapeHtml(currentOrderData.fieldName)}</li>
            <li><strong>Tipo:</strong> Demanda de modificação de arquivo</li>
            <li><strong>Arquivo:</strong> ${escapeHtml(currentOrderData.fileName)}</li>
            <li><strong>Descrição:</strong> ${escapeHtml(currentOrderData.modificationDescription)}</li>
        `
        : `
            <li><strong>Fazenda:</strong> ${escapeHtml(currentOrderData.farmName)}</li>
            <li><strong>Talhão:</strong> ${escapeHtml(currentOrderData.fieldName)}</li>
            <li><strong>Operação:</strong> ${escapeHtml(currentOrderData.operationType)}</li>
            <li><strong>Largura:</strong> ${escapeHtml(currentOrderData.implementWidth)}m</li>
            <li><strong>Sistema:</strong> ${escapeHtml(currentOrderData.gpsModel)}</li>
            <li><strong>Direcionamento:</strong> ${escapeHtml(currentOrderData.directionLabel)}</li>
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
        const filePath = `orders_files/${currentUser.uid}/${Date.now()}_${selectedKmlFile.name}`;
        const snapshot = await uploadBytes(ref(storage, filePath), selectedKmlFile);
        const fileUrl = await getDownloadURL(snapshot.ref);

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
        document.getElementById('kml-filename').textContent = "Anexar Arquivo KML/KMZ/SHP em ZIP *";

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

const adminSettingsModal = document.getElementById('admin-settings-modal');

document.getElementById('btn-admin-panel').addEventListener('click', () => {
    if (!currentUserIsAdmin) {
        return alert("Seu usuário não tem permissão de administrador.");
    }

    showScreen('admin-screen');
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

document.getElementById('btn-make-admin').addEventListener('click', async () => {
    const email = document.getElementById('new-admin-email').value.trim().toLowerCase();

    if (!email) {
        return alert("Informe o e-mail do usuário.");
    }

    const confirmacao = confirm(`Tornar ${email} um administrador?`);

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
            active: true,
            createdAt: serverTimestamp(),
            createdBy: currentUser.uid
        }, { merge: true });

        alert("Administrador liberado com sucesso!");
        document.getElementById('new-admin-email').value = "";
    } catch (error) {
        console.error(error);
        alert("Erro ao liberar administrador. Verifique as regras do Firestore.");
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
                    ${order.directionMode === "user_defined" ? `<p><strong>Ângulo da rosa dos ventos:</strong> ${escapeHtml(order.compassDegree || "0")}°</p>` : ""}
                    ${order.orientationFileUrl ? `<p><strong>Arquivo/croqui de orientação:</strong> <a href="${order.orientationFileUrl}" target="_blank">Abrir arquivo</a></p>` : ""}
                    <p><strong>Demanda de modificação:</strong> ${order.modificationRequested ? "Sim" : "Não"}</p>
                    ${order.modificationRequested ? `<p><strong>Descrição da modificação:</strong> ${escapeHtml(order.modificationDescription || "")}</p>` : ""}
                    <p><strong>Observações:</strong> ${escapeHtml(order.observations || "Nenhuma")}</p>
                    ${buildMapPointsHtml(order.mapPoints)}
                </div>
            </details>

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

                                <div>
                                    <label>Chave PIX</label>
                                    <input 
                                        type="text" 
                                        class="form-control admin-pix-input" 
                                        id="admin-pix-${orderId}" 
                                        placeholder="Digite a chave PIX"
                                        value="${escapeHtml(order.pixKey || "")}"
                                    >
                                </div>

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
