# Base44 App

Application Vite + React connectee a l'API Base44, avec un petit serveur Node pour le proxy chat et les verifications MySQL.

## Prerequis
- Node.js 18+ et npm

## Installation
```bash
npm install
```

## Configuration (.env)
Creer un fichier `.env` a la racine avec au minimum:
```
GROQ_API_KEY=xxx
GROQ_MODEL=llama-3.3-70b-versatile   # optionnel, valeur par defaut
```
Optionnel pour la partie MySQL du proxy:
```
MYSQL_HOST=...
MYSQL_USER=...
MYSQL_PASSWORD=...
MYSQL_DATABASE=...
MYSQL_PORT=3306
```

## Lancer le frontend
```bash
npm run dev
```
Par defaut: http://localhost:5173

## Lancer le serveur proxy/chat
```bash
npm run backend
```
Expose /api/chat et /api/db/health. Necessite les variables .env ci-dessus.

## Autres scripts
- `npm run build` : build de production
- `npm run preview` : previsualisation du build
- `npm run lint` : linting du code
