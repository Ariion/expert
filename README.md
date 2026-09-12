# StatusPulse

**Agrégateur de status pages fournisseurs + alerting.** Un micro-SaaS conçu pour
tourner sans opérateur humain : acquisition par SEO programmatique, paiement
récurrent Stripe, livraison de valeur entièrement automatisée, auto-réparation
et alerte humaine uniquement en cas de panne du système lui-même.

---

## 1. Le concept et pourquoi il convertit

### Le problème payant

Une équipe produit dépend aujourd'hui de 20 à 60 fournisseurs SaaS : cloud,
paiement, email, authentification, CDN, observabilité. Quand l'un d'eux tombe,
l'équipe l'apprend par ses propres clients — jamais par le fournisseur.
Personne ne surveille 40 pages de statut à la main, et la plupart des
fournisseurs ne proposent qu'un abonnement email par service, sans vue
d'ensemble ni routage vers Slack.

Le coût du problème est immédiat et chiffrable : 30 minutes de retard à
diagnostiquer « ce n'est pas nous, c'est notre prestataire » se paient en
tickets support, en SLA et en confiance client. Le coût de la solution est de
19 €/mois. La décision d'achat ne demande aucune réunion.

### Pourquoi ce modèle est automatisable à 100 %

| Étape | Qui la fait | Coût marginal |
|---|---|---|
| Produire le contenu qui attire le trafic | le collecteur (cron) | 0 |
| Convertir le visiteur en lead | formulaire sur la page SEO | 0 |
| Encaisser | Stripe Checkout + webhooks | 0 |
| Livrer la valeur | file d'alertes + dispatcher | 0 |
| Retenir le client | digest quotidien automatique | 0 |
| Réparer les incidents internes | cron de réconciliation | 0 |

La donnée qui fait le produit (les incidents) est **publiée gratuitement par
les fournisseurs eux-mêmes** dans des formats standards (Statuspage.io JSON,
Atom, RSS). Il n'y a ni contenu à rédiger, ni support à assurer pour délivrer
le service, ni infrastructure à maintenir.

### Le moteur d'acquisition : SEO programmatique à intention maximale

Chaque fournisseur du catalogue génère automatiquement :

- `/status/<slug>` — « *X est-il en panne ?* » : statut en direct, disponibilité
  sur 90 jours, historique complet, FAQ en données structurées `FAQPage` ;
- `/categories/<catégorie>` — page d'agrégation par maillon d'infrastructure ;
- `/compare/<a>-vs-<b>` — comparatif de fiabilité, à intention commerciale.

71 fournisseurs dans le catalogue de départ produisent déjà **267 URLs**
indexables, dont le contenu se met à jour tout seul toutes les 2 à 5 minutes.
Ajouter un fournisseur = ajouter une ligne dans `data/services.ts` : la page,
le sitemap, l'ingestion et les alertes suivent, sans redéploiement.

Ces requêtes (« slack down », « aws panne », « github status ») ont trois
propriétés rares réunies : volume élevé, intention immédiate, et un visiteur
qui a **un problème en cours** au moment exact où il arrive. C'est le meilleur
contexte de conversion qui existe — il ne se paie pas en publicité, il se
construit une fois.

### La boucle de conversion

```
Recherche « stripe down »
   └─> /status/stripe (page statique, < 100 ms)
        └─> « Être alerté quand Stripe tombe » — email, sans carte bancaire
             └─> lien de confirmation (double opt-in, délivrabilité préservée)
                  └─> compte Free actif : 3 fournisseurs, alertes différées 15 min
                       └─> l'utilisateur ajoute un 4ᵉ fournisseur  ──> mur payant
                            └─> Stripe Checkout ──> Pro 19 €/mois
```

Les deux limites du plan Free sont choisies pour faire mal exactement là où la
valeur est ressentie : **le nombre de fournisseurs** (une stack réelle en
compte 20+) et **le délai de 15 minutes** (inacceptable pendant un incident
réel). Le plan Free reste sincèrement utile — c'est ce qui le rend partageable
et crédible — mais il devient insuffisant dès que le produit sert vraiment.

### Tarification

| Plan | Prix | Fournisseurs | Délai d'alerte | Canaux |
|---|---|---|---|---|
| Free | 0 € | 3 | 15 min | email |
| **Pro** | **19 €/mois** | 50 | instantané | email, Slack, webhook |
| Team | 49 €/mois | 500 | instantané | 25 canaux, rapports SLA, API |

---

## 2. Architecture

### Choix techniques et justification

| Brique | Techno | Pourquoi |
|---|---|---|
| Application | Next.js 16 (App Router) | Pages SEO pré-rendues + ISR : le trafic ne touche jamais la base |
| Exécution | Vercel (serverless) | Zéro serveur à maintenir, mise à l'échelle automatique, coût nul à faible trafic |
| Base | Postgres (Supabase) | Relationnel, transactionnel, fonctions de file `SKIP LOCKED` |
| Paiement | Stripe Checkout + Billing Portal | Aucune page de paiement à écrire, aucune donnée bancaire chez nous, résiliation en self-service |
| Email | Resend (HTTP direct) | Une requête HTTP, pas de SDK à charger dans chaque lambda |
| Ordonnancement | Vercel Cron | Pas de worker à héberger |
| Style | CSS écrit à la main | Zéro JavaScript client sur les pages SEO, zéro dépendance de build |

Dépendances de production : **5** (`next`, `react`, `react-dom`, `postgres`,
`stripe`, `fast-xml-parser`, `zod`). Moins de dépendances, moins de mises à
jour de sécurité à subir — c'est un choix d'exploitation, pas d'esthétique.

### Arborescence commentée

```
statuspulse/
├── data/
│   └── services.ts              Catalogue des fournisseurs surveillés.
│                                UNE LIGNE = UNE PAGE INDEXABLE + UN FLUX SUIVI.
├── supabase/
│   └── schema.sql               Schéma complet, idempotent : tables, index,
│                                triggers, fonctions de file (SKIP LOCKED), RLS.
├── scripts/
│   ├── seed-services.ts         Amorce/actualise le catalogue (`--check` teste les flux).
│   ├── selftest.ts              Auto-test des parseurs, sans base ni réseau externe.
│   └── run-cron-local.ts        Déclenche un job cron en local.
├── src/
│   ├── lib/                     ── LOGIQUE MÉTIER (aucun rendu ici) ──
│   │   ├── env.ts               Validation zod des variables, différée au runtime.
│   │   ├── db.ts                Client Postgres paresseux (proxy) + retry/backoff.
│   │   ├── feeds.ts             Récupération + normalisation Statuspage/Atom/RSS.
│   │   ├── ingest.ts            CŒUR : diff des incidents, détection d'événements,
│   │   │                        mise en file des alertes, backoff adaptatif.
│   │   ├── dispatch.ts          Vidage de la file : email / Slack / webhook signé HMAC.
│   │   ├── rollup.ts            Agrégats de disponibilité + digests quotidiens.
│   │   ├── maintenance.ts       Purge, réconciliation Stripe, watchdog.
│   │   ├── ops.ts               Journal opérationnel + alerte humaine dédupliquée.
│   │   ├── stripe.ts            Client, checkout, portail, projection d'abonnement.
│   │   ├── auth.ts              Connexion sans mot de passe (lien magique + session).
│   │   ├── plans.ts             Grille tarifaire et limites produit (source unique).
│   │   ├── queries.ts           Lectures typées pour les pages.
│   │   ├── format.ts            Libellés, durées, dates.
│   │   └── http.ts              Redirections POST/GET, garde-fous anti-abus, auth cron.
│   ├── components/              StatusBadge, UptimeBar (90 j en CSS pur), WatchForm.
│   └── app/
│       ├── page.tsx             Accueil : preuve sociale, incidents récents, conversion.
│       ├── status/[slug]/       ★ LA page programmatique (ISR 120 s, JSON-LD).
│       ├── categories/[slug]/   Pages d'agrégation par catégorie.
│       ├── compare/[pair]/      Comparatifs « A vs B » (surface longue traîne).
│       ├── pricing/             Tarifs + FAQ commerciale.
│       ├── dashboard/           Espace client (plan, fournisseurs, canaux, historique).
│       ├── login/               Connexion sans mot de passe.
│       ├── sitemap.ts           Sitemap dynamique segmenté (5 000 URLs/fichier).
│       ├── robots.ts            robots.txt généré.
│       └── api/
│           ├── subscribe/       Entrée du tunnel : email -> compte + alerte active.
│           ├── auth/            request | verify | logout.
│           ├── watch/           add | remove (applique les limites de plan).
│           ├── channels/        add | remove (validation anti-SSRF des webhooks).
│           ├── stripe/          checkout | portal | webhook (signé + idempotent).
│           ├── cron/            ingest | dispatch | rollup | reconcile.
│           └── health/          Sonde publique pour moniteur externe.
├── vercel.json                  Planification des 4 jobs cron + durées max.
└── .env.example                 Toutes les variables, commentées.
```

### Les quatre boucles automatiques

```
┌── ingest ── toutes les 5 min ────────────────────────────────────────────┐
│ claim_services_for_fetch() prend un lot sous bail (pas de doublon même   │
│ si deux exécutions se chevauchent) → fetch conditionnel (ETag) → parse   │
│ → diff par empreinte → upsert → mise en file des alertes concernées      │
│ → cadence adaptée : 2 min si le service est dégradé, backoff si échec.   │
└──────────────────────────────────────────────────────────────────────────┘
┌── dispatch ── toutes les 2 min ──────────────────────────────────────────┐
│ claim_alert_deliveries() → envoi email/Slack/webhook → succès marqué,    │
│ échec remis en file avec backoff quadratique (1,4,9,16,25 min),          │
│ abandon après 6 tentatives → alerte humaine. Canal mort désactivé        │
│ après 15 échecs.                                                         │
└──────────────────────────────────────────────────────────────────────────┘
┌── rollup ── chaque nuit ─────────────────────────────────────────────────┐
│ Recalcul de la disponibilité journalière sur 90 jours (une seule requête │
│ SQL, découpage des incidents par jour) → projection sur `services`       │
│ → digest quotidien aux comptes payants.                                  │
└──────────────────────────────────────────────────────────────────────────┘
┌── reconcile ── chaque nuit ──────────────────────────────────────────────┐
│ Purge (rétention bornée sur toutes les tables chaudes) → remise en file  │
│ des livraisons bloquées → réconciliation Stripe (rattrape tout webhook   │
│ perdu) → watchdog : alerte si l'ingestion s'est arrêtée en silence.      │
└──────────────────────────────────────────────────────────────────────────┘
```

### Ce qui garantit qu'on ne perd ni un paiement ni une alerte

- **Paiements** : signature Stripe vérifiée sur le corps brut ; table
  `stripe_events` pour l'idempotence (Stripe rejoue, nous non) ; en cas
  d'échec de traitement, la trace est supprimée et un 500 renvoyé pour que
  Stripe réessaie (jusqu'à 3 jours) ; et une **réconciliation quotidienne**
  qui reprojette l'état réel des abonnements, webhook ou pas.
- **Alertes** : pattern outbox. La détection écrit en base, l'envoi est un
  second temps. Contrainte d'unicité `(canal, incident, type d'événement)` :
  une même alerte ne peut pas partir deux fois, même si l'ingestion rejoue.
- **Alertes fantômes** : un incident déjà clos au moment où on le découvre, ou
  démarré il y a plus de 48 h, ne déclenche rien. Une fausse alerte détruit la
  confiance plus vite qu'une alerte manquée.
- **Pannes silencieuses** : le watchdog surveille l'absence d'activité (pas
  seulement les erreurs) — aucune ingestion réussie depuis 45 min, file en
  retard, flux massivement cassés, incohérence de facturation.

---

## 3. Déploiement en moins de 30 minutes

Prérequis : un compte GitHub, Vercel, Supabase, Stripe et Resend (tous avec un
palier gratuit suffisant pour démarrer), plus un nom de domaine.

### Étape 1 — Base de données (5 min)

1. Créer un projet sur [supabase.com](https://supabase.com) (région proche de
   vos utilisateurs).
2. *Project Settings → Database → Connection string → **Transaction pooler***
   (port **6543**). Copier l'URL, remplacer `[YOUR-PASSWORD]`.
   > Le pooler est obligatoire en serverless : le port 5432 épuiserait les
   > connexions en quelques minutes.
3. Appliquer le schéma :
   ```bash
   psql "postgresql://postgres.xxx:MDP@aws-0-eu-west-3.pooler.supabase.com:6543/postgres" \
        -f supabase/schema.sql
   ```
   (ou coller le contenu de `supabase/schema.sql` dans *SQL Editor → Run*).

### Étape 2 — Stripe (6 min)

1. *Catalogue de produits → Ajouter un produit* :
   - « StatusPulse Pro », tarif **récurrent mensuel 19 €** → noter l'ID `price_…`
   - « StatusPulse Team », tarif **récurrent mensuel 49 €** → noter l'ID `price_…`
2. *Paramètres → Facturation → Portail client* : activer le portail, autoriser
   l'annulation et le changement de plan (c'est ce qui supprime tout support
   lié à la facturation).
3. *Développeurs → Clés API* : copier la clé secrète.
4. Le webhook se configure à l'étape 5, une fois l'URL connue.

### Étape 3 — Email (4 min)

1. Créer un compte [resend.com](https://resend.com), ajouter votre domaine.
2. Publier les enregistrements DNS proposés (SPF + DKIM). **Ne pas sauter
   cette étape** : sans domaine vérifié, les alertes finissent en spam et le
   produit ne vaut rien.
3. Copier la clé API.

### Étape 4 — Déploiement (5 min)

```bash
git clone <votre-repo> statuspulse && cd statuspulse
npm install
npx vercel --prod          # ou : importer le repo depuis le tableau de bord Vercel
```

Renseigner les variables d'environnement (section 4) dans
*Vercel → Project → Settings → Environment Variables*, puis rattacher le
domaine (*Settings → Domains*). `APP_URL` doit valoir exactement l'URL
publique finale, sans slash final.

> Les jobs cron de `vercel.json` s'exécutent à la minute sur un plan Vercel
> **Pro**. Sur le plan Hobby, la fréquence est limitée à un déclenchement
> quotidien : conservez les routes telles quelles et déclenchez-les depuis un
> ordonnanceur externe gratuit (cron-job.org, GitHub Actions) en appelant
> `https://votre-domaine/api/cron/ingest?key=$CRON_SECRET`.

### Étape 5 — Webhook Stripe (3 min)

1. *Développeurs → Webhooks → Ajouter un endpoint* :
   `https://votre-domaine/api/stripe/webhook`
2. Événements à écouter :
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`.
3. Copier le *Signing secret* (`whsec_…`) dans `STRIPE_WEBHOOK_SECRET`, puis
   redéployer.

### Étape 6 — Amorçage et vérification (5 min)

```bash
# Catalogue de 71 fournisseurs + vérification que chaque flux répond
DATABASE_URL="..." npm run db:seed -- --check

# Première ingestion (ne déclenche aucune alerte : backfill silencieux)
curl -H "authorization: Bearer $CRON_SECRET" https://votre-domaine/api/cron/ingest

# Agrégats de disponibilité
curl -H "authorization: Bearer $CRON_SECRET" https://votre-domaine/api/cron/rollup

# Contrôles
curl https://votre-domaine/api/health
curl https://votre-domaine/sitemap/0.xml | grep -c "<url>"
```

Enfin : déclarer `https://votre-domaine/sitemap/0.xml` dans la Google Search
Console, et brancher un moniteur externe gratuit sur `/api/health` — c'est le
seul dispositif qui vous préviendra si la plateforme d'hébergement elle-même
tombe.

---

## 4. Variables d'environnement

Toutes sont obligatoires sauf mention contraire. Modèle complet et commenté
dans [`.env.example`](.env.example).

| Variable | Où l'obtenir | Rôle |
|---|---|---|
| `DATABASE_URL` | Supabase → Database → **Transaction pooler** (port 6543) | Connexion Postgres |
| `APP_URL` | votre domaine, sans slash final | Liens email, redirections Stripe, URL canoniques, sitemap |
| `STRIPE_SECRET_KEY` | Stripe → Développeurs → Clés API | Appels API Stripe |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → Signing secret | Vérification de signature |
| `STRIPE_PRICE_PRO` | Stripe → Catalogue → tarif Pro | Mappe le paiement au plan Pro |
| `STRIPE_PRICE_TEAM` | Stripe → Catalogue → tarif Team | Mappe le paiement au plan Team |
| `RESEND_API_KEY` | Resend → API Keys | Envoi des emails |
| `EMAIL_FROM` | `Nom <alertes@votredomaine.com>` | Expéditeur (domaine vérifié obligatoire) |
| `AUTH_SECRET` | `openssl rand -base64 48` | Hachage des tokens de session et signature HMAC des webhooks sortants |
| `CRON_SECRET` | `openssl rand -base64 24` | Protège `/api/cron/*` |
| `OPS_ALERT_EMAIL` | *(optionnel)* votre email | Destinataire des alertes système critiques |
| `OPS_ALERT_WEBHOOK` | *(optionnel)* URL Slack entrante | Alertes système critiques sur Slack |

Les deux dernières sont optionnelles techniquement, **indispensables en
pratique** : elles sont le seul canal par lequel le système vous réclame de
l'attention. Sans elles, une panne d'ingestion peut durer des jours sans que
personne ne le sache.

---

## 5. Exploitation courante

```bash
npm run dev                    # développement local
npm run selftest               # auto-test des parseurs (15 vérifications, sans base)
npm run typecheck              # vérification TypeScript
npm run db:seed -- --check     # catalogue + test de tous les flux
npm run cron:local -- ingest   # déclenche un job en local
```

**Ajouter un fournisseur** — une ligne dans `data/services.ts`, puis
`npm run db:seed`. La page, le sitemap, l'ingestion et les alertes suivent
automatiquement. C'est le seul geste de « croissance » qui vaille la peine
d'être fait à la main, et il prend trente secondes.

**Coût d'exploitation** : nul jusqu'aux premiers clients (paliers gratuits
Vercel/Supabase/Resend), puis de l'ordre de 45 €/mois tout compris (Vercel Pro
20 $ + Supabase 25 $) — soit trois abonnements Pro pour atteindre le seuil de
rentabilité.

**Surveillance attendue de votre part** : aucune tant qu'aucune alerte
`OPS_ALERT_*` n'arrive. Les alertes critiques sont dédupliquées à l'heure et
ne concernent que quatre situations : collecteur arrêté, file d'alertes
bloquée, webhook Stripe en échec répété, flux fournisseurs massivement cassés.

---

## 6. État de vérification du code

Ce qui a été exécuté et vérifié :

- `npm run typecheck` — aucune erreur.
- `npx next build` — build complet, **267 URLs** générées (71 pages
  fournisseur, 14 catégories, ~178 comparatifs), sitemap et robots inclus.
- `npm run selftest` — **15 vérifications** sur les parseurs : Statuspage v2,
  Atom, RSS, en-têtes conditionnels 304, nettoyage HTML, empreintes de
  déduplication, remontée d'erreur HTTP.
- **Test d'intégration de bout en bout sur un PostgreSQL 16 réel** — 18
  vérifications : schéma appliqué, trigger de compteur, backfill silencieux,
  détection d'incident, exclusion des archives et des comptes non vérifiés,
  délai de plan Free, idempotence sur rejeu, livraison webhook signée HMAC,
  notification de résolution, remise en file avec backoff après échec d'envoi,
  calcul de disponibilité au prorata, purge, watchdog, backoff sur flux mort.
- Routes HTTP vérifiées sur un serveur de production local : pages, sitemap
  (267 URLs), `robots.txt`, JSON-LD `FAQPage`/`BreadcrumbList`, `/api/health`,
  rejet des crons non authentifiés (401), rejet du webhook Stripe non signé
  (400), redirection du tableau de bord non connecté, création de compte via
  le formulaire public.

Ce qui n'a **pas** pu être vérifié ici et doit l'être au déploiement :

- **L'accessibilité réelle des 71 flux fournisseurs.** L'environnement de
  développement utilisé bloque les requêtes sortantes vers les domaines
  externes (403 sur toutes les status pages). Les URLs du catalogue ont été
  construites à partir des conventions publiques (`/api/v2/summary.json` pour
  Statuspage.io, flux Atom/RSS officiels pour les autres), mais certaines
  peuvent avoir changé. **Exécutez `npm run db:seed -- --check` juste après le
  déploiement** : la commande teste chaque flux et liste ceux à corriger. Un
  flux en échec est de toute façon mis en backoff automatiquement et signalé
  après six tentatives — il ne bloque jamais les autres.
- Les appels réels à Stripe et Resend (clés de test indisponibles ici).

---

## 7. Cadre juridique

Le produit agrège des pages de statut **publiques**, destinées par leurs
éditeurs à une diffusion large, et cite systématiquement sa source avec un
lien vers la page officielle. Il ne republie pas de contenu sous licence, ne
contourne aucune authentification et s'identifie explicitement auprès des
serveurs (`User-Agent: StatusPulseBot/1.0`), avec requêtes conditionnelles
(ETag) pour minimiser la charge imposée aux fournisseurs.

Les marques citées appartiennent à leurs détenteurs ; la page `/legal` le
mentionne et affiche l'absence d'affiliation. Si un fournisseur demande son
retrait, une ligne suffit : `update services set is_active = false where slug
= '…'`.
