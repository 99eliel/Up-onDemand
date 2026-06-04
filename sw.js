// Mude este número de versão sempre que fizer uma grande alteração estrutural no projeto.
// Isso garante que o cache antigo seja totalmente deletado.
const CACHE_NAME = 'upagri-cache-v1.0';

const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  // skipWaiting força o novo Service Worker a assumir o controle IMEDIATAMENTE,
  // sem esperar o usuário fechar a aba.
  self.skipWaiting(); 
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Ativação do Service Worker (Limpeza de Caches Antigos)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Se o cache que existe for diferente da versão atual (CACHE_NAME), delete-o
          if (cacheName !== CACHE_NAME) {
            console.log('Limpando cache antigo do UpAgri:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // claim() faz o SW controlar as abas abertas na hora
  );
});

// Interceptação das requisições (Estratégia: Network First)
self.addEventListener('fetch', (event) => {
  // Ignora requisições de outras origens (como as chamadas para o banco de dados do Firebase)
  // Fazemos cache apenas dos arquivos locais do nosso projeto
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    // 1º: Tenta buscar a versão mais recente na internet (Rede)
    fetch(event.request)
      .catch(() => {
        // 2º: Se falhar (usuário sem internet), busca no cache
        return caches.match(event.request);
      })
  );
});
