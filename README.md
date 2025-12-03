# Projet Frontend/Backend

Application React (Vite) avec un mini serveur Node pour un proxy de chat et une sante MySQL. Ce README detaille l’installation, la configuration, la structure et les commandes utiles.

## Sommaire
- [Apercu](#apercu)
- [Stack technique](#stack-technique)
- [Prerequis](#prerequis)
- [Installation](#installation)
- [Configuration (.env)](#configuration-env)
- [Commandes principales](#commandes-principales)
- [Architecture du projet](#architecture-du-projet)
- [Frontend (Vite/React)](#frontend-vitereact)
- [Backend proxy (serverjs)](#backend-proxy-serverjs)
- [Qualite et verifications](#qualite-et-verifications)
- [Deploiement](#deploiement)
- [Depannage rapide](#depannage-rapide)

## Apercu
Interface React (routing client via `react-router-dom`) avec composants UI modernes (Radix UI + Tailwind). Un serveur Node se charge d’interfacer un modele Groq pour le chat et d’exposer un endpoint de sante MySQL optionnel.

## Stack technique
- Frontend : React 18, Vite 6, React Router 7, Tailwind CSS, Framer Motion.
- UI : Radix UI primitives, Tailwind utilities, Lucide icons.
- Etat/donnees : @tanstack/react-query, React Hook Form, Zod (validation).
- Backend : Node/Express (`server.js`) avec proxy Groq et test MySQL optionnel.
- Outils : ESLint 9, PostCSS, Vite dev server/build.

## Prerequis
- Node.js 18+ (npm inclus)
- Navigateur moderne
- Eventuellement une base MySQL si vous utilisez le check DB

## Installation
```bash
npm install
```

## Configuration (.env)
Creer un fichier `.env` a la racine. Valeurs attendues :
```
# Cle API Groq pour le proxy chat
GROQ_API_KEY=your_groq_key
# Modele Groq (optionnel, valeur par defaut indiquee dans server.js)
GROQ_MODEL=llama-3.3-70b-versatile

# Section MySQL optionnelle pour le endpoint /api/db/health
MYSQL_HOST=localhost
MYSQL_USER=user
MYSQL_PASSWORD=password
MYSQL_DATABASE=database
MYSQL_PORT=3306
```
Ne commitez pas de cles sensibles dans le repo.

## Commandes principales
- `npm run dev` : lance le frontend Vite (par defaut sur http://localhost:5173).
- `npm run backend` : lance le serveur Node (`server.js`) qui expose `/api/chat` et `/api/db/health`.
- `npm run build` : build de production du frontend.
- `npm run preview` : previsualise le build localement.
- `npm run lint` : verifie le code avec ESLint.

## Architecture du projet
- `src/` : code frontend
  - `pages/` : pages React (routing client)
  - `components/` : composants UI (inclut Radix wrappers et elements admin)
  - `api/` : clients API (ex: `base44Client` pour les appels data)
  - `utils/` : utilitaires (helpers de routing, etc.)
- `server.js` : serveur Node/Express pour proxy Groq et healthcheck MySQL.
- `index.html` : point d’entree Vite.
- `tailwind.config.js` / `postcss.config.js` : configuration CSS.
- `vite.config.js` : configuration Vite (aliases, plugins).

## Frontend (Vite/React)
- Dev server rapide (`npm run dev`) avec HMR.
- Routing client via `react-router-dom`.
- Gestion des donnees et cache serveur via `@tanstack/react-query`.
- UI basee sur Radix UI + Tailwind + Lucide (icones).
- Animations possibles avec Framer Motion.
- Validation de formulaires avec React Hook Form + Zod.

## Backend proxy (server.js)
- `/api/chat` : proxy vers Groq (modele configure par `GROQ_MODEL`).
- `/api/chat/:conversationId` : recuperation d’une conversation en memoire.
- `/api/db/health` : ping MySQL si les variables env sont renseignees.
- Historique conserve en memoire (Map) pour les conversations : ideal en dev, a remplacer pour la prod par un stockage persistant.

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
3) Deployer `server.js` (si le proxy est necessaire) sur un runtime Node (Railway, Fly.io, VPS...).  
   - Fournir les variables `.env` (GROQ, MySQL).  
   - Configurer un reverse proxy pour router les appels `/api/...` vers le serveur Node.

## Depannage rapide
- Erreur Groq : verifier `GROQ_API_KEY` et la connectivite reseau.
- MySQL health en erreur : confirmer host/user/password/db/port et acces reseau.
- HMR ou dev server indisponible : port 5173 libre ? sinon lancer `npm run dev -- --port 5174`.
- Build echoue : lancer `npm run lint` pour identifier les problemes de syntaxe ou de config.
