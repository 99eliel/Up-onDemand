# On-Demand

Sistema Web/PWA para solicitação, organização e acompanhamento de pedidos de **linhas para piloto automático**, desenvolvido para uso da **UP Agritechnology**.

O sistema permite que clientes criem pedidos, enviem arquivos, marquem pontos no mapa, definam orientação de linhas, acompanhem pagamento e recebam o arquivo final. Também possui painel administrativo com controle de pedidos, permissões de colaboradores, chave PIX travada, relatórios e gerenciamento da fila de produção.

---

## Visão geral

O **On-Demand** foi desenvolvido para facilitar o processo de solicitação de arquivos e linhas para piloto automático agrícola. A plataforma funciona diretamente pelo navegador e também pode ser instalada como aplicativo PWA em celular ou computador.

O sistema possui duas áreas principais:

* **Área do Cliente**
* **Painel Administrativo**

A área do cliente é voltada para cadastro, envio de pedidos e acompanhamento.
O painel administrativo é voltado para orçamento, confirmação de pagamento, fila, entrega de pedidos, controle de colaboradores e gestão do sistema.

---

## Principais funcionalidades

### Área do Cliente

* Cadastro de cliente com nome, CPF, data de nascimento, WhatsApp, e-mail e senha.
* Login por e-mail e senha.
* Tela inicial personalizada.
* Bloco **Como usar o On-Demand**.
* Abertura do manual em PDF.
* Criação de novo pedido.
* Solicitação de aerofotolevantamento por e-mail.
* Visualização de pedidos anteriores.
* Acompanhamento do status do pedido.
* Visualização de valor e chave PIX.
* Confirmação de pagamento pelo cliente.
* Download do arquivo final quando o pedido for concluído.

---

### Novo pedido

No formulário de novo pedido, o cliente pode informar:

* Nome da fazenda.
* Talhão.
* Tipo de operação.
* Largura útil do implemento.
* Sistema ou marca do monitor.
* Modelo ou formato do monitor.
* Observações adicionais.
* Pontos de referência no mapa.
* Arquivos da área.
* Arquivo de orientação ou croqui.
* Demanda de modificação de arquivo.

---

### Mapa interativo

O sistema possui mapa interativo com recursos para apoiar a interpretação técnica do pedido.

Recursos disponíveis:

* Mapa com visualização normal.
* Mapa por satélite.
* Satélite com nomes.
* Relevo/topográfico.
* Botão para localizar posição atual.
* Marcação de pontos de referência.
* Suporte para 1 até 12 pontos.
* Exibição dos pontos cardeais.
* Visualização da seta de direcionamento.
* Linhas internas na seta para representar o sentido das linhas.

---

### Direcionamento das linhas

O cliente pode escolher entre diferentes formas de orientação:

1. **Definido pela UP Agritechnology**

   * A equipe interpreta o melhor sentido das linhas com base no arquivo e nos pontos enviados.

2. **Informarei o sentido desejado**

   * O cliente pode definir o sentido manualmente usando seta/ângulo.
   * Também pode escolher um sentido predefinido.

3. **Enviar arquivo ou croqui com orientação específica**

   * O cliente envia um arquivo complementar indicando o sentido desejado.

---

### Objetivo da operação

O sistema permite selecionar objetivos de operação como:

* Linhas de plantio.
* Linhas de pulverização.
* Linhas de colheita.
* Outro.

Quando o cliente escolhe **Outro**, o sistema abre um campo para digitar manualmente o objetivo da operação.

---

### Sistemas de piloto automático atendidos

O sistema apresenta opções para os principais formatos e monitores utilizados no campo:

* Monitores ISO11783: TaskData.
* Fendt: Shapefile.
* Topcon: Shapefile.
* Stara: Dados.
* CNH Industrial: `.CN1` ou Shapefile.
* Trimble: AgGPS ou AgData.
* John Deere: GS2 1800, GS3 2630 e GEN4 4600.
* Outro sistema: o cliente informa o nome manualmente.

---

### Demanda de modificação de arquivo

Existe uma opção específica para pedidos que não envolvem criação completa de linhas, mas sim alteração de arquivos existentes.

Exemplos:

* Corrigir borda.
* Converter arquivo.
* Ajustar linhas.
* Revisar talhão.
* Adaptar arquivo para outro monitor.
* Corrigir formato.

Ao marcar essa opção, o sistema simplifica o formulário e mantém apenas os campos necessários para explicar a modificação desejada.

---

## Status dos pedidos

O pedido pode passar pelos seguintes status:

| Status               | Significado                                                   |
| -------------------- | ------------------------------------------------------------- |
| Aguardando valor     | Pedido recebido e aguardando orçamento                        |
| Aguardando pagamento | Valor e chave PIX já foram definidos                          |
| Pagamento informado  | Cliente informou que realizou o pagamento                     |
| Na fila              | Pagamento confirmado e pedido enviado para produção           |
| Concluído            | Arquivo final entregue ao cliente                             |
| Arquivado            | Pedido finalizado e removido da visualização principal do ADM |

---

## Painel Administrativo

O painel administrativo permite gerenciar os pedidos recebidos e acompanhar todo o fluxo de atendimento.

Funções principais:

* Ver pedidos aguardando valor.
* Dar orçamento.
* Informar valor do pedido.
* Enviar chave PIX ao cliente.
* Ver pagamentos pendentes.
* Confirmar pagamento.
* Enviar pedido para fila.
* Ver fila de produção.
* Anexar arquivo final.
* Concluir pedido.
* Arquivar pedido.
* Desarquivar pedido.
* Apagar pedidos de teste.
* Ver relatórios administrativos.
* Gerenciar administradores e colaboradores.
* Configurar chave PIX travada.
* Alterar banner e logo do sistema.

---

## Administrador principal e colaboradores

O sistema possui dois níveis administrativos:

### Administrador principal

O administrador principal possui acesso total ao sistema.

Ele pode:

* Ver todos os pedidos.
* Dar orçamento.
* Confirmar pagamentos.
* Entregar pedidos.
* Arquivar e desarquivar pedidos.
* Apagar pedidos.
* Ver relatórios.
* Alterar logo e banner.
* Definir chave PIX oficial.
* Criar novos administradores.
* Criar colaboradores.
* Definir permissões dos colaboradores.

---

### Colaborador ADM

O colaborador pode ter permissões personalizadas.

O administrador principal escolhe o que cada colaborador pode fazer, como:

* Ver pedidos aguardando valor.
* Dar orçamento.
* Ver pagamentos pendentes.
* Confirmar pagamento.
* Ver fila de pedidos.
* Entregar/concluir pedidos.
* Ver pedidos concluídos.
* Arquivar/desarquivar pedidos.
* Ver pedidos arquivados.
* Apagar pedidos.

O colaborador não acessa os relatórios administrativos e não altera a chave PIX travada, salvo se for promovido para administrador principal.

---

## Chave PIX travada

O sistema possui uma configuração de **chave PIX oficial**.

O administrador principal pode definir e travar a chave PIX.
Quando um colaborador dá orçamento, ele informa apenas o valor. A chave PIX enviada ao cliente é a chave oficial definida pelo administrador principal.

Isso evita que colaboradores usem chaves PIX diferentes da autorizada.

---

## Relatórios administrativos

O sistema possui relatórios internos para acompanhamento da operação.

Os relatórios podem incluir:

* Total de usuários cadastrados.
* Visitantes recentes.
* Clientes com pedidos.
* Pedidos por status.
* Pedidos pendentes.
* Valores confirmados.
* Exportação de dados em CSV.
* Relatório geral de pedidos.

Os relatórios são restritos ao administrador principal.

---

## Instalação como PWA

O **On-Demand** pode ser instalado como aplicativo no celular ou computador.

Recursos PWA:

* Instalação pelo navegador.
* Ícone personalizado.
* Nome do app como **On-Demand**.
* Tela com identidade visual própria.
* Uso em modo standalone.
* Cache básico de arquivos principais.

Arquivos relacionados ao PWA:

* `manifest.json`
* `manifest.webmanifest`
* `sw.js`
* `icon-192x192.png`
* `icon-512x512.png`
* `icon-maskable-192x192.png`
* `icon-maskable-512x512.png`

---

## Tecnologias utilizadas

O projeto utiliza:

* HTML5.
* CSS3.
* JavaScript.
* Firebase Authentication.
* Firebase Firestore.
* Firebase Storage.
* Firebase Hosting ou GitHub Pages.
* Leaflet.js para mapas.
* Service Worker para PWA.
* Manifest Web App.

---

## Estrutura dos arquivos

A estrutura principal do projeto é:

```text
/
├── index.html
├── app.js
├── style.css
├── sw.js
├── manifest.json
├── manifest.webmanifest
├── manual_up_agro_instrucoes.pdf
├── logo-ondemand.png
├── icon-192x192.png
├── icon-512x512.png
├── icon-maskable-192x192.png
└── icon-maskable-512x512.png
```

---

## Configuração do Firebase

Para usar o sistema em outro projeto Firebase, é necessário configurar:

1. Firebase Authentication.
2. Firestore Database.
3. Firebase Storage.
4. Regras do Firestore.
5. Regras do Storage.
6. Domínio autorizado no Authentication.
7. Primeiro administrador principal.

---

### Authentication

No Firebase Console:

```text
Build → Authentication → Sign-in method
```

Ativar:

```text
Email/Password
```

O login do sistema é feito por e-mail e senha.

---

### Firestore Database

No Firebase Console:

```text
Build → Firestore Database → Create database
```

O Firestore armazena:

* Usuários.
* Pedidos.
* Administradores.
* Colaboradores.
* Permissões.
* Configurações do app.
* Chave PIX.
* Relatórios e dados operacionais.

---

### Storage

No Firebase Console:

```text
Build → Storage → Get started
```

O Storage armazena:

* Arquivos enviados pelo cliente.
* Arquivos finais enviados pelo ADM.
* Logo.
* Banner.
* Arquivos administrativos.

---

## Coleções usadas no Firestore

### `users`

Armazena os dados dos clientes.

Campos comuns:

```text
name
cpf
birthDate
whatsapp
email
createdAt
lastVisitAt
```

---

### `orders`

Armazena os pedidos feitos pelos clientes.

Campos comuns:

```text
userId
userName
userCpf
farmName
fieldName
operationType
implementWidth
systemBrand
systemModel
status
price
pixKey
paymentInformed
finalFileUrl
createdAt
```

---

### `admins`

Armazena administradores e colaboradores.

O ID do documento deve ser o mesmo UID do usuário no Firebase Authentication.

Campos comuns:

```text
active
email
name
role
permissions
createdAt
createdBy
```

Exemplo de administrador principal:

```text
active: true
email: "admin@email.com"
name: "Administrador"
role: "principal"
```

Exemplo de colaborador:

```text
active: true
email: "colaborador@email.com"
name: "Colaborador"
role: "collaborator"
permissions:
  viewPricing: true
  setPricing: true
  viewPending: true
  confirmPayment: false
  viewQueue: true
  completeOrder: false
  viewCompleted: true
  archiveOrder: false
  viewArchived: false
  deleteOrder: false
```

---

### `settings`

Armazena configurações gerais do sistema.

Documentos usados:

```text
settings/app
settings/payment
```

`settings/app` pode armazenar:

```text
globalLogoUrl
globalBannerUrl
```

`settings/payment` pode armazenar:

```text
fixedPixKey
lockedPixEnabled
updatedAt
updatedBy
```

---

## Criando o primeiro administrador principal

Após configurar o Firebase:

1. Crie uma conta normalmente pelo app.
2. Vá em:

```text
Firebase Console → Authentication → Users
```

3. Copie o UID do usuário.
4. Vá em:

```text
Firestore Database → Data
```

5. Crie a coleção:

```text
admins
```

6. Crie um documento com o ID igual ao UID copiado.
7. Adicione os campos:

```text
active: true
email: "email_do_admin@email.com"
name: "Nome do Administrador"
role: "principal"
```

Depois disso, ao entrar no sistema, o usuário será reconhecido como administrador principal.

---

## Regras do Firestore

Use regras compatíveis com usuários, pedidos, administradores e configurações.

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return signedIn()
        && exists(/databases/$(database)/documents/admins/$(request.auth.uid))
        && get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.active != false;
    }

    function isMainAdmin() {
      return isAdmin()
        && get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.role != "collaborator";
    }

    match /users/{userId} {
      allow create: if signedIn() && request.auth.uid == userId;
      allow read, update: if signedIn() && (
        request.auth.uid == userId || isAdmin()
      );
      allow delete: if isMainAdmin();
    }

    match /orders/{orderId} {
      allow create: if signedIn();

      allow read: if signedIn() && (
        isAdmin()
        || resource.data.userId == request.auth.uid
        || resource.data.clientId == request.auth.uid
        || resource.data.uid == request.auth.uid
      );

      allow update: if signedIn() && (
        isAdmin()
        || resource.data.userId == request.auth.uid
        || resource.data.clientId == request.auth.uid
        || resource.data.uid == request.auth.uid
      );

      allow delete: if isAdmin();
    }

    match /admins/{adminId} {
      allow get: if signedIn() && (
        request.auth.uid == adminId || isAdmin()
      );

      allow list: if isAdmin();

      allow create: if isMainAdmin();
      allow update: if isMainAdmin();
      allow delete: if isMainAdmin();
    }

    match /settings/{settingId} {
      allow read: if signedIn();
      allow write: if isMainAdmin();
    }

    match /visits/{visitId} {
      allow create: if signedIn();
      allow read, update, delete: if isAdmin();
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## Regras do Storage

Use regras compatíveis com arquivos de clientes, arquivos finais, logo e banner.

```js
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    function signedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return signedIn()
        && firestore.exists(/databases/(default)/documents/admins/$(request.auth.uid))
        && firestore.get(/databases/(default)/documents/admins/$(request.auth.uid)).data.active != false;
    }

    match /orders_files/{userId}/{fileName} {
      allow read: if signedIn() && (
        request.auth.uid == userId || isAdmin()
      );

      allow write: if signedIn() && request.auth.uid == userId;
      allow delete: if isAdmin();
    }

    match /orders_final/{userId}/{fileName} {
      allow read: if signedIn() && (
        request.auth.uid == userId || isAdmin()
      );

      allow write: if isAdmin();
      allow delete: if isAdmin();
    }

    match /admin_uploads/{fileName} {
      allow read: if true;
      allow write: if isAdmin();
      allow delete: if isAdmin();
    }

    match /app_assets/{fileName} {
      allow read: if true;
      allow write: if isAdmin();
      allow delete: if isAdmin();
    }

    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

---

## Hospedagem

O sistema pode ser hospedado em:

* GitHub Pages.
* Firebase Hosting.
* Servidor próprio.
* Hospedagem estática compatível com HTML, CSS e JavaScript.

Para GitHub Pages:

1. Subir todos os arquivos na raiz do repositório.
2. Ativar Pages nas configurações do repositório.
3. Escolher a branch principal.
4. Aguardar a publicação.
5. Adicionar o domínio gerado em:

```text
Firebase Authentication → Settings → Authorized domains
```

---

## Atualização de versão

Sempre que atualizar arquivos do sistema:

1. Subir `index.html`.
2. Subir `app.js`.
3. Subir `style.css`.
4. Subir `sw.js`.
5. Subir `manifest.json` e `manifest.webmanifest`, se tiver alteração no app/PWA.
6. Subir ícones, se tiver alteração visual.
7. Fazer limpeza de cache no navegador.

No navegador:

```text
F12 → Application → Clear storage → Clear site data
```

Depois:

```text
Ctrl + Shift + R
```

Se o app estiver instalado como PWA, pode ser necessário desinstalar e instalar novamente.

---

## Manual do cliente

O arquivo:

```text
manual_up_agro_instrucoes.pdf
```

é o manual de uso do cliente. Ele explica:

* Como acessar.
* Como criar pedido.
* Como marcar pontos no mapa.
* Como enviar arquivos.
* Como escolher direcionamento.
* Como acompanhar pagamento.
* Como baixar o arquivo final.
* Como instalar o app.

---

## Observações importantes

* O sistema depende do Firebase para login, banco de dados e armazenamento.
* O Firebase Authentication precisa estar ativo com Email/Password.
* As regras do Firestore e Storage precisam ser publicadas corretamente.
* O primeiro administrador principal precisa ser criado manualmente no Firestore.
* O colaborador só acessa o que o administrador principal permitir.
* A chave PIX dos colaboradores é controlada pelo administrador principal.
* Relatórios administrativos são restritos ao administrador principal.
* Arquivos enviados ao Storage podem continuar armazenados mesmo após exclusão do registro do pedido no Firestore.
* Para uso comercial, recomenda-se revisar regras, domínio, contrato, política de privacidade e responsabilidades sobre dados dos clientes.

---

## Identidade visual

O sistema utiliza identidade visual em preto e dourado, com a marca **On-Demand**.

Nome correto do aplicativo:

```text
On-Demand
```

Evitar variações como:

```text
On-demand
On Demand
ondemand
```

---

## Suporte

Para suporte, dúvidas ou manutenção, entrar em contato com o responsável técnico do sistema.

Contato comercial da operação:

```text
WhatsApp: (64) 99242-2227
Instagram: @up_agritechnology
E-mail: atendimento@upagritechnology.com.br
```

---

## Licença e uso

Este sistema foi desenvolvido para uso comercial conforme contrato firmado entre as partes.

A cópia, redistribuição, revenda, modificação estrutural, mudança de plataforma, criação de derivados ou uso fora do escopo contratado dependem de autorização expressa do responsável pelo desenvolvimento.

Atualizações, melhorias e ajustes podem ter cobrança separada conforme contrato de venda, implantação ou manutenção.

---

## Créditos

Sistema **On-Demand**
Linha para piloto automático UP Agritechnology

Desenvolvido por:

```text
Eliel do Carmo Gomes
```

---
