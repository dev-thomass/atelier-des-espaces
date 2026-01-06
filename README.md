# L'Atelier des Espaces

Application web pour artisan multiservice specialise en renovation et amenagement interieur a Marseille et dans les Bouches-du-Rhone.

## Fonctionnalites

### Site vitrine
- **Accueil** : Presentation de l'entreprise et des services
- **Prestations** : Liste complete des services (renovation, cuisine, salle de bain, platrerie, peinture, carrelage, etc.)
- **Projets** : Galerie de realisations avec photos avant/apres
- **Contact** : Formulaire de contact avec envoi SMTP

### Espace administration
- **Authentification securisee** : Inscription/connexion avec email et mot de passe (bcrypt)
- **Gestion des projets** : CRUD complet avec upload d'images
- **Gestion des prestations** : Modification des services affiches
- **Calendrier interactif** : Planning avec synchronisation Google Calendar
- **Assistant IA** : Chatbot pour repondre aux prospects (Groq/LLaMA)
- **Mode sombre/clair** : Theme personnalisable

## Stack technique

### Frontend
- React 18 + Vite 6
- React Router 7
- Tailwind CSS
- Radix UI + Lucide icons
- Framer Motion (animations)
- @tanstack/react-query (gestion des donnees)
- React Hook Form + Zod (validation)

### Backend
- Node.js + Express
- MySQL (mysql2)
- bcrypt (hashage mots de passe)
- nodemailer (SMTP)
- multer (uploads)
- googleapis (Google Calendar API)

## Installation

```bash
npm install
```

## Configuration (.env)

Creer un fichier `.env` a la racine :

```env
# Authentification
ADMIN_SECRET=change_me_long_random_string
ADMIN_TOKEN_TTL_SECONDS=43200

# Base de donnees MySQL
MYSQL_HOST=localhost
MYSQL_USER=user
MYSQL_PASSWORD=password
MYSQL_DATABASE=database
MYSQL_PORT=3306

# SMTP (formulaire contact)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASS=password
SMTP_FROM=contact@example.com
MAIL_TO=destinataire@example.com

# Assistant IA (Groq)
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.3-70b-versatile

# Google Calendar (optionnel)
GOOGLE_SERVICE_ACCOUNT_EMAIL=service@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=calendar_id@group.calendar.google.com

# URLs publiques
PUBLIC_BASE_URL=https://atelierdesespaces.fr
```

## Commandes

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance le frontend (http://localhost:5173) |
| `npm run backend` | Lance le serveur API |
| `npm run build` | Build de production |
| `npm run preview` | Previsualise le build |
| `npm run lint` | Verification ESLint |

## Architecture

```
src/
  pages/           # Pages React (Accueil, Prestations, Projets, Contact, Gestion, AdminLogin)
  components/
    ui/            # Composants UI (Button, Card, Dialog, etc.)
    admin/         # Composants admin (AdminHero, modals)
    calendar/      # Calendrier interactif
    documents/     # Gestion devis/factures
  api/             # Client API et helpers
  hooks/           # Hooks personnalises
  utils/           # Utilitaires
server.js          # Serveur Express (API + SMTP + uploads)
```

## Prestations par defaut

Les prestations suivantes sont creees automatiquement au demarrage :

1. **Renovation complete** - Transformation integrale de l'interieur
2. **Renovation cuisine** - Creation ou renovation de cuisines
3. **Renovation salle de bain** - Conception et realisation de salles de bain
4. **Amenagement interieur** - Rangements sur mesure, dressings, placards
5. **Conception 3D** - Plans et rendus photoralistes
6. **Platrerie - Cloisons** - Cloisons, faux plafonds, enduits
7. **Peinture decorative** - Mise en peinture et effets decoratifs
8. **Carrelage - Faience** - Pose sol et murale
9. **Parquet - Revetement sol** - Pose et renovation de parquets
10. **Menuiserie interieure** - Portes, plinthes, habillages bois
11. **Electricite** - Renovation electrique et domotique
12. **Plomberie** - Travaux de plomberie sanitaire

## API Endpoints

### Authentification
- `POST /api/auth/register` - Inscription (email, password, name)
- `POST /api/auth/login` - Connexion (email, password)
- `GET /api/admin/me` - Session courante

### Entites (CRUD)
- `GET/POST/PUT/DELETE /api/:entity` - Gestion des projets, prestations, events, etc.

### Autres
- `POST /api/email` - Envoi de mail (formulaire contact)
- `POST /api/upload` - Upload de fichiers
- `POST /api/llm` - Appel LLM (resume)
- `GET/POST /api/chat` - Assistant IA
- `GET/POST/PUT/DELETE /api/calendar/events` - Google Calendar

## Deploiement

1. Build frontend : `npm run build` (genere `dist/`)
2. Servir `dist/` via nginx ou serveur statique
3. Deployer `server.js` sur un runtime Node (VPS, Railway, Fly.io)
4. Configurer les variables d'environnement
5. Configurer un reverse proxy pour `/api/*` et `/uploads/*`

## Depannage

- **Erreur d'inscription** : Verifier que MySQL est accessible et que le serveur a ete redemarre
- **Erreur SMTP** : Verifier host/user/password/port dans .env
- **Erreur Groq** : Verifier GROQ_API_KEY
- **Erreur Google Calendar** : Verifier les credentials du service account

## Licence

Projet prive - L'Atelier des Espaces
