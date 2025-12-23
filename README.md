# Projet Frontend/Backend

Application React (Vite) avec un serveur Node (Express) pour l'API maison, le proxy Groq, les uploads et l'envoi SMTP. Ce README detaille l'installation, la configuration, la structure et les commandes utiles.

## Sommaire
- [Apercu](#apercu)
- [Stack technique](#stack-technique)
- [Prerequis](#prerequis)
- [Installation](#installation)
- [Configuration (.env)](#configuration-env)
- [Commandes principales](#commandes-principales)
- [Architecture du projet](#architecture-du-projet)
- [Frontend (Vite/React)](#frontend-vitereact)
- [Backend (server.js)](#backend-serverjs)
- [Qualite et verifications](#qualite-et-verifications)
- [Deploiement](#deploiement)
- [Depannage rapide](#depannage-rapide)

## Apercu
Interface React (routing client via `react-router-dom`) avec composants UI modernes (Radix UI + Tailwind). Un serveur Node expose l'API maison (CRUD admin, uploads, SMTP), un proxy Groq pour le chat, et un endpoint de sante MySQL optionnel.

## Stack technique
- Frontend : React 18, Vite 6, React Router 7, Tailwind CSS, Framer Motion.
- UI : Radix UI primitives, Tailwind utilities, Lucide icons.
- Etat/donnees : @tanstack/react-query, React Hook Form, Zod (validation).
- Backend : Node/Express (`server.js`), MySQL (`mysql2`), SMTP (`nodemailer`), upload (`multer`).
- Outils : ESLint 9, PostCSS, Vite dev server/build.

## Prerequis
- Node.js 18+ (npm inclus)
- Navigateur moderne
- Optionnel : une base MySQL si vous voulez persister les donnees
- Optionnel : un serveur SMTP pour le formulaire de contact

## Installation
```bash
npm install
```

## Configuration (.env)
Creer un fichier `.env` a la racine. Exemple :
```
# Auth admin (backend)
ADMIN_CODE=your_admin_code
ADMIN_SECRET=change_me_long_random_string
ADMIN_TOKEN_TTL_SECONDS=43200

# API front (optionnel si meme origine)
# VITE_API_BASE_URL=

# Groq (assistant)
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.3-70b-versatile

# SMTP (contact)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
MAIL_TO=
PUBLIC_BASE_URL=https://atelierdesespaces.fr

# Uploads
# UPLOAD_REQUIRE_AUTH=false
# UPLOAD_MAX_BYTES=8388608

# MySQL (optionnel)
MYSQL_HOST=localhost
MYSQL_USER=user
MYSQL_PASSWORD=password
MYSQL_DATABASE=database
MYSQL_PORT=3306
```
Ne commitez pas de cles sensibles dans le repo.

## Commandes principales
- `npm run dev` : lance le frontend Vite (par defaut sur http://localhost:5173).
- `npm run backend` : lance le serveur Node (`server.js`).
- `npm run build` : build de production du frontend.
- `npm run preview` : previsualise le build localement.
- `npm run lint` : verifie le code avec ESLint.

## Architecture du projet
- `src/` : code frontend
  - `pages/` : pages React (routing client)
  - `components/` : composants UI (inclut Radix wrappers et elements admin)
  - `api/` : client API (`apiClient`) + helper assistant
  - `utils/` : utilitaires (helpers de routing, etc.)
- `server.js` : serveur Node/Express pour API + chat + SMTP + uploads
- `index.html` : point d'entree Vite
- `tailwind.config.js` / `postcss.config.js` : configuration CSS
- `vite.config.js` : configuration Vite (aliases, plugins)

## Frontend (Vite/React)
- Dev server rapide (`npm run dev`) avec HMR.
- Routing client via `react-router-dom`.
- Gestion des donnees et cache serveur via `@tanstack/react-query`.
- UI basee sur Radix UI + Tailwind + Lucide (icones).
- Animations possibles avec Framer Motion.
- Validation de formulaires avec React Hook Form + Zod.

## Backend (server.js)
Endpoints principaux :
- `POST /api/admin/login` : authentification admin
- `GET /api/admin/me` : session admin courante
- `POST /api/email` : envoi SMTP (contact)
- `POST /api/upload` : upload de fichier (public, optionnellement protege)
- `POST /api/llm` : appel LLM (resume admin)
- `GET/POST/PUT/DELETE /api/:entity` : CRUD entites (projets, prestations, events, listes, etc.)
- `GET /api/chat` : liste des conversations en memoire
- `GET /api/chat/:conversationId` : detail conversation
- `POST /api/chat` : proxy Groq (assistant)
- `GET /api/db/health` : ping MySQL si configure

Historique chat conserve en memoire (Map) pour les conversations : ideal en dev, a remplacer en prod par un stockage persistant.

### Lancement backend
```bash
npm run backend
# ou
node server.js
```
Assurez-vous que `GROQ_API_KEY` est renseignee avant de lancer.

## Qualite et verifications
- Lint : `npm run lint`
- Build : `npm run build` (assure la compatibilite de production)
- Pas de suite de tests fournie actuellement. Ajoutez-en selon vos besoins (Jest/Testing Library/Playwright).

## Deploiement
1) Construire le frontend : `npm run build` (output dans `dist/`).
2) Servir `dist/` via un serveur statique (nginx, serve, etc.).
3) Deployer `server.js` sur un runtime Node (VPS, Railway, Fly.io, etc.).
   - Fournir les variables `.env` (auth, SMTP, Groq, MySQL).
   - Configurer un reverse proxy pour router `/api/*` et `/uploads/*` vers le serveur Node.

## Depannage rapide
- Erreur Groq : verifier `GROQ_API_KEY` et la connectivite reseau.
- MySQL health en erreur : confirmer host/user/password/db/port et acces reseau.
- SMTP en erreur : verifier host/user/password/port et TLS.
- HMR ou dev server indisponible : port 5173 libre ? sinon lancer `npm run dev -- --port 5174`.
- Build echoue : lancer `npm run lint` pour identifier les problemes de syntaxe ou de config.
