# StatusPulse

**Agrégateur de status pages fournisseurs + alerting.** Un micro-SaaS conçu pour
tourner sans opérateur humain : acquisition par SEO programmatique, paiement
récurrent Stripe, livraison de valeur entièrement automatisée, auto-réparation
et alerte humaine uniquement en cas de panne du système lui-même.

---

## 0. Ce que vous avez à faire — tout dans le navigateur

**Aucune commande à taper. Aucun logiciel à installer. Rien sur votre
ordinateur.** Quatre écrans, une quinzaine de minutes, une seule fois.

### Étape 1 — Mettre le site en ligne (2 min)

[vercel.com](https://vercel.com) → **Add New → Project** → *Import Git
Repository* → choisir `expert` → **Deploy**.

Si l'écran affiche une section **Environment Variables** pré-remplie (Vercel
la devine à partir de `.env.example`), **retirez toutes les lignes avec le
bouton « − »** — notamment `VERCEL_TOKEN`, dont le préfixe est réservé et
bloque le déploiement. Aucune variable ne doit être saisie ici : le workflow
« 1. Installation » les posera toutes, avec les bonnes valeurs.

Le site se construit sans configuration (il s'affiche vide, c'est normal).
Notez l'URL obtenue, du type `https://expert.vercel.app`.

### Étape 2 — Récupérer 6 valeurs (8 min)

| Valeur | Où la trouver, exactement |
|---|---|
| `DATABASE_URL` | [supabase.com](https://supabase.com) → votre projet → **Project Settings → Database → Connection string** → onglet **Transaction pooler** (port 6543). Remplacer `[YOUR-PASSWORD]` par le mot de passe du projet. |
| `STRIPE_SECRET_KEY` | [dashboard.stripe.com](https://dashboard.stripe.com) → **Développeurs → Clés API** → bouton **« Reveal secret key »** → commence par `sk_`. ⚠️ Pas la clé publiable `pk_` affichée au-dessus. |
| `RESEND_API_KEY` | [resend.com](https://resend.com) → **API Keys → Create API Key** → commence par `re_`. |
| `EMAIL_FROM` | Vous l'écrivez vous-même : `StatusPulse <alertes@votredomaine.com>`. Le domaine doit être ajouté dans Resend → **Domains** et ses 2 enregistrements DNS publiés chez votre registrar. |
| `VERCEL_TOKEN` | [vercel.com](https://vercel.com) → avatar → **Account Settings → Tokens → Create**. |
| `CRON_SECRET` | Vous l'inventez : n'importe quelle suite d'une trentaine de caractères au hasard. Elle sert uniquement à empêcher un inconnu de déclencher vos tâches. |

Facultatif mais recommandé : `OPS_ALERT_EMAIL`, votre adresse personnelle.
C'est par là que le système vous préviendra — et il ne vous écrira que s'il
tombe en panne.

### Étape 3 — Coller ces valeurs dans GitHub (3 min)

Dépôt GitHub → **Settings → Secrets and variables → Actions** → bouton
**New repository secret**, une fois par valeur : le *Name* est le nom de la
colonne de gauche, la *Secret* est la valeur.

> **Laissez le dépôt public pour l'instant.** Vos secrets restent privés dans
> tous les cas (ils sont chiffrés et ne s'affichent nulle part), et les minutes
> GitHub Actions — qui font tourner toute l'automatisation — ne sont gratuites
> et illimitées que sur un dépôt public. Le passage en privé se paie : voir
> « Le planificateur » plus bas.

### Étape 4 — Cliquer sur le bouton (1 min + 5 min d'attente)

Dépôt GitHub → onglet **Actions** → dans la colonne de gauche,
**« 1. Installation »** → bouton **« Run workflow »** → **Run workflow**.

Le workflow fait alors, tout seul, sur les serveurs de GitHub :

- application des 12 tables SQL sur votre base Supabase ;
- installation des 71 fournisseurs et test de leurs flux un par un ;
- création des produits et tarifs Stripe (Pro 19 €, Team 49 €) ;
- création du webhook Stripe **et récupération de sa clé de signature** ;
- configuration du portail de facturation (résiliation en self-service) ;
- génération des secrets applicatifs ;
- envoi de toutes les variables dans Vercel **et redéploiement du site** ;
- attente de la mise en ligne, puis première collecte d'incidents.

À la fin, le workflow affiche un rapport lisible : ce qui est en place,
l'adresse de votre site, et s'il reste quoi que ce soit à faire. S'il manque
un secret, il vous dit lequel et où le trouver. **Relancez-le autant de fois
que nécessaire : il ne crée jamais de doublon.**

### C'est fini

À partir de là, tout tourne seul :

| Ce qui se passe | Fréquence | Qui le fait |
|---|---|---|
| Collecte des incidents fournisseurs | toutes les 5 min | workflow « 3. Automatisation » |
| Envoi des alertes aux clients | toutes les 5 min | idem |
| Calcul des disponibilités + digests | chaque nuit | idem |
| Réconciliation Stripe, purge, watchdog | chaque nuit | idem |
| Encaissement des abonnements | en continu | Stripe |
| Mise à jour des pages SEO | en continu | le site lui-même |
| Maintien des tâches planifiées | 1er du mois | workflow « 4. Maintien » |

Deux boutons restent à votre disposition dans l'onglet **Actions**, sans
jamais ouvrir de terminal :

- **« 2. Diagnostic »** — état complet : fournisseurs, incidents, clients
  inscrits, abonnements payants et MRR, file d'alertes, santé de chaque tâche.
  Il tourne aussi tout seul chaque lundi.
- **« 1. Installation »** — à relancer après tout changement (nouvelle clé
  Stripe, passage en mode live, nom de domaine).

### Le planificateur : pourquoi GitHub et pas Vercel

`vercel.json` ne contient **aucune tâche planifiée**, volontairement : l'offre
gratuite de Vercel refuse toute fréquence supérieure à une fois par jour, ce
qui bloquerait le déploiement, et une collecte quotidienne ne servirait à rien
pour un produit qui vend de la réactivité.

C'est donc GitHub Actions qui déclenche tout, toutes les 5 minutes. Deux
conséquences à connaître :

| | Dépôt **public** (recommandé au départ) | Dépôt **privé** |
|---|---|---|
| Minutes GitHub Actions | gratuites et illimitées | 2 000/mois offertes — insuffisant pour une cadence de 5 min (~8 600 min nécessaires) |
| Coût mensuel | 0 € | il faut soit le plan Vercel Pro (20 $), soit un planificateur externe gratuit (cron-job.org) |
| Ce qui est visible | le code et les rapports des workflows | rien |
| Ce qui reste secret | **vos clés, votre base, vos clients** — toujours | idem |

Si vous passez le dépôt en privé plus tard, deux options, toutes deux sans
terminal :

1. **Vercel Pro (20 $/mois)** — remettez les tâches natives en ajoutant ce bloc
   à `vercel.json` (édition directe dans GitHub, bouton crayon) :
   ```json
   "crons": [
     { "path": "/api/cron/ingest",    "schedule": "*/5 * * * *" },
     { "path": "/api/cron/dispatch",  "schedule": "*/5 * * * *" },
     { "path": "/api/cron/rollup",    "schedule": "17 3 * * *" },
     { "path": "/api/cron/reconcile", "schedule": "42 4 * * *" }
   ]
   ```
   puis désactivez le workflow « 3. Automatisation » (Actions → ⋯ → *Disable*).
2. **[cron-job.org](https://cron-job.org) (gratuit)** — créez 4 tâches qui
   appellent `https://votre-domaine/api/cron/<job>` avec l'en-tête
   `Authorization: Bearer <votre CRON_SECRET>`, aux mêmes fréquences que
   ci-dessus.

Dernier détail, invisible mais décisif : GitHub désactive les tâches
planifiées d'un dépôt resté 60 jours sans activité — exactement le sort d'un
produit qui tourne tout seul. Le workflow « 4. Maintien de l'automatisation »
écrit un horodatage le 1er de chaque mois pour que cela n'arrive jamais.

### Deux gestes qui rapportent, quand vous aurez cinq minutes

1. **Google Search Console** ([search.google.com/search-console](https://search.google.com/search-console)) :
   ajouter votre domaine, puis *Sitemaps* → coller `sitemap/0.xml`. C'est ce
   qui déclenche l'indexation des 267 pages.
2. **Stripe en mode réel** : tant que vous utilisez une clé `sk_test_`, aucun
   euro n'est encaissé — c'est parfait pour tester le tunnel avec la carte
   `4242 4242 4242 4242`. Pour encaisser réellement, terminez la vérification
   d'identité Stripe (pièce d'identité + IBAN, obligation légale), remplacez
   le secret `STRIPE_SECRET_KEY` par la clé `sk_live_…` et relancez
   « 1. Installation ».

### « Je mets juste mon PayPal et l'argent rentre ? »

Presque. Deux nuances, dites franchement :

- **L'encaissement passe par Stripe, pas PayPal.** PayPal ne gère pas
  proprement l'abonnement récurrent avec changement de plan, relance d'impayé
  et portail client — c'est précisément ce qui évite d'avoir à s'occuper des
  clients. Stripe le fait, et c'est ce qui est intégré ici.
- **Aucune plateforme, Stripe ou PayPal, ne verse d'argent sans vérifier
  votre identité** (pièce d'identité + IBAN). C'est la réglementation
  anti-blanchiment, pas un choix technique. Cinq minutes de formulaire ; les
  virements tombent ensuite automatiquement sur votre compte.

Si vous préférez ne pas gérer la TVA vous-même, l'alternative est un
*merchant of record* (Paddle, Lemon Squeezy) qui facture à votre place et
vous reverse un net : il suffit de le demander pour que l'intégration soit
remplacée.

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
Ajouter un fournisseur = ajouter une ligne dans `src/data/services.ts` : la page,
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
| Application | Next.js 16 (App Router) | Pages SEO en cache + ISR : le trafic ne touche jamais la base |
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
├── supabase/
│   └── schema.sql               Schéma complet, idempotent : tables, index,
│                                triggers, fonctions de file (SKIP LOCKED), RLS.
├── .github/workflows/           ── TOUT SE PILOTE D'ICI, SANS TERMINAL ──
│   ├── install.yml              « 1. Installation » : un bouton, tout est câblé.
│   ├── diagnostic.yml           « 2. Diagnostic » : état complet du système.
│   ├── cron.yml                 « 3. Automatisation » : collecte et alertes.
│   └── keepalive.yml            « 4. Maintien » : empêche GitHub de désactiver
│                                les tâches planifiées après 60 jours de calme.
├── scripts/
│   ├── setup.mts                ★ INSTALLATION AUTOMATIQUE : schéma, catalogue,
│   │                            produits/tarifs/webhook/portail Stripe, secrets,
│   │                            variables Vercel, première collecte.
│   ├── doctor.mts               Diagnostic complet en une commande.
│   ├── selftest.ts              Auto-test des parseurs, sans base ni réseau externe.
│   ├── seed-services.ts         Actualise le catalogue seul (`--check` teste les flux).
│   └── run-cron-local.mts       Déclenche un job cron en local.
├── src/
│   ├── data/
│   │   └── services.ts          Catalogue des fournisseurs surveillés.
│   │                            UNE LIGNE = UNE PAGE INDEXABLE + UN FLUX SUIVI.
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
│   │   ├── bootstrap.ts         Auto-amorçage du catalogue si la base est vide.
│   │   ├── envfile.ts           Lecture/écriture .env (scripts d'install et de diag).
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
┌── dispatch ── toutes les 5 min ──────────────────────────────────────────┐
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

### Un build qui n'interroge jamais la base

Aucune page n'est pré-rendue au moment de la compilation : elles sont générées
à la première visite, puis maintenues à jour par revalidation. Pré-rendre les
~260 pages exigeait autant d'allers-retours vers la base pendant le build —
depuis un serveur de compilation qui n'est pas dans la même région que la base,
chaque page dépassait la minute et le déploiement échouait.

Le déploiement est ainsi **indépendant de la disponibilité de la base** et dure
une quinzaine de secondes au lieu de plusieurs minutes. Les pages d'ensemble
(accueil, liste, catégories, sitemap) sortent vides du build ; la première
collecte, qui suit de quelques minutes, les rafraîchit elle-même.

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

## 3. Variante : installation depuis un terminal

La section 0 suffit et ne demande aucun terminal. Cette variante n'existe que
si vous préférez travailler en local.

```bash
git clone https://github.com/Ariion/expert statuspulse && cd statuspulse
npm install
npm run setup      # pose 4 questions, fait tout le reste, écrit .env.local
```

Le script est le même que celui exécuté par le workflow « 1. Installation » :
schéma SQL, catalogue, produits/tarifs/webhook/portail Stripe, secrets,
variables Vercel, redéploiement, première collecte. En local il pose les
questions manquantes ; en CI il lit les secrets du dépôt.

Pour que `npm run setup` pousse lui-même les variables dans Vercel et
redéploie, ajoutez à `.env.local` :

```bash
VERCEL_TOKEN="…"        # Vercel > Account Settings > Tokens
VERCEL_TEAM_ID="…"      # uniquement si le projet appartient à une équipe
```

L'identifiant du projet et l'URL publique sont retrouvés automatiquement à
partir du token et du dépôt lié.

### Ordonnanceur

`vercel.json` ne déclare aucune tâche planifiée : l'offre gratuite de Vercel
les limite à une par jour et refuserait le déploiement. Le planificateur par
défaut est le workflow « 3. Automatisation » (secrets `APP_URL` et
`CRON_SECRET`). Les alternatives et leurs coûts sont détaillés en section 0,
« Le planificateur ».

Toutes les tâches sont **interruptibles** : elles se donnent un budget de
50 secondes, relibèrent ce qu'elles n'ont pas eu le temps de traiter et
reprennent au tick suivant. Aucune alerte n'est perdue si une fonction est
coupée par la plateforme.

---

## 4. Variables d'environnement

**`npm run setup` en remplit 7 sur 13 tout seul** (les deux secrets, les deux
identifiants de tarif Stripe, la clé de signature du webhook, la taxe
automatique, et il écrit le fichier). Vous n'en saisissez que quatre.
Modèle complet et commenté dans [`.env.example`](.env.example).

| Variable | Où l'obtenir | Rôle |
|---|---|---|
| `DATABASE_URL` | Supabase → Database → **Transaction pooler** (port 6543) | Connexion Postgres |
| `APP_URL` | *déduite du domaine Vercel si absente* | Liens email, redirections Stripe, URL canoniques, sitemap |
| `STRIPE_SECRET_KEY` | Stripe → Développeurs → Clés API | Appels API Stripe |
| `STRIPE_WEBHOOK_SECRET` | *rempli par `npm run setup`* | Vérification de signature |
| `STRIPE_PRICE_PRO` | *rempli par `npm run setup`* | Mappe le paiement au plan Pro |
| `STRIPE_PRICE_TEAM` | *rempli par `npm run setup`* | Mappe le paiement au plan Team |
| `STRIPE_AUTOMATIC_TAX` | *(optionnel)* `true` une fois Stripe Tax activé | TVA calculée automatiquement |
| `RESEND_API_KEY` | Resend → API Keys | Envoi des emails |
| `EMAIL_FROM` | `Nom <alertes@votredomaine.com>` | Expéditeur (domaine vérifié obligatoire) |
| `AUTH_SECRET` | *généré par `npm run setup`* | Hachage des tokens de session et signature HMAC des webhooks sortants |
| `CRON_SECRET` | *généré par `npm run setup`* | Protège `/api/cron/*` |
| `OPS_ALERT_EMAIL` | *(optionnel)* votre email | Destinataire des alertes système critiques |
| `OPS_ALERT_WEBHOOK` | *(optionnel)* URL Slack entrante | Alertes système critiques sur Slack |
| `VERCEL_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID` | *(optionnel)* Vercel → Tokens / Project ID | Permet à `npm run setup` de pousser les variables tout seul |

Les deux dernières sont optionnelles techniquement, **indispensables en
pratique** : elles sont le seul canal par lequel le système vous réclame de
l'attention. Sans elles, une panne d'ingestion peut durer des jours sans que
personne ne le sache.

---

## 5. Exploitation courante

**Depuis le navigateur (onglet Actions du dépôt) — le mode normal :**

| Bouton | Ce qu'il fait | Quand |
|---|---|---|
| **1. Installation** | installe ou répare tout, idempotent | après tout changement de clé ou de domaine |
| **2. Diagnostic** | état complet : fournisseurs, clients, MRR, file d'alertes, santé des tâches | au moindre doute (et chaque lundi, tout seul) |
| **3. Automatisation** | collecte, alertes, agrégats, réconciliation | tout seul, toutes les 5 minutes |

**Depuis un terminal, si vous en avez un :**

```bash
npm run setup                  # installation / réparation automatique (idempotent)
npm run doctor                 # état complet : collecteur, file, MRR Stripe, SEO
npm run selftest               # auto-test des parseurs (15 vérifications, sans base)
npm run dev                    # développement local
npm run typecheck              # vérification TypeScript
npm run db:seed -- --check     # catalogue seul + test de tous les flux
npm run cron:local -- ingest   # déclenche un job en local
```

Le catalogue s'installe aussi **tout seul** : si la table `services` est vide
(première mise en ligne, base recréée), la première exécution du collecteur
l'amorce. Il n'existe aucune étape d'installation qu'on puisse oublier.

**Ajouter un fournisseur** — modifiez `src/data/services.ts` directement dans
GitHub (bouton crayon, puis *Commit changes*) et relancez « 1. Installation ».
Une ligne ajoutée = une page indexable de plus, un flux surveillé de plus.
C'est le seul geste de « croissance » qui vaille la peine d'être fait à la
main, et il prend trente secondes.

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
- `npm run selftest` — **26 vérifications** : parseurs Statuspage v2, Atom et
  RSS, en-têtes conditionnels 304, nettoyage HTML, empreintes de
  déduplication, remontée d'erreur HTTP, résolution de l'URL publique
  (variable vide, blancs, valeur invalide, repli sur le domaine Vercel) et
  découpage du schéma SQL (blocs dollar-quotés, chaînes et commentaires
  contenant des points-virgules).
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
- `npm run setup` exécuté sur une base **vierge** : schéma appliqué sans
  `psql`, 71 fournisseurs installés, flux testés un par un, garde-fou vérifié
  (au-delà de 50 % d'échecs, aucune désactivation n'est appliquée — un taux
  pareil trahit le réseau local, pas les fournisseurs), `.env.local` écrit,
  relance idempotente sans doublon.
- `npm run doctor` exécuté : rapport complet (catalogue, flux, comptes,
  alertes, fraîcheur de chaque job, évènements système).

Ce qui n'a **pas** pu être vérifié ici (l'environnement de développement
utilisé bloque tout appel sortant vers des domaines tiers) et doit l'être au
déploiement :

- **L'accessibilité réelle des 71 flux fournisseurs.** Les URLs suivent les
  conventions publiques (`/api/v2/summary.json` pour Statuspage.io, flux
  Atom/RSS officiels pour les autres), mais certaines ont pu changer.
  **Aucune action à prévoir : `npm run setup` les teste tous et désactive ceux
  qui ne répondent pas.** Un flux qui casse plus tard est mis en backoff
  automatiquement, signalé après six tentatives, et ne bloque jamais les
  autres.
- **Les appels réels aux API Stripe, Resend et Vercel.** Le code
  d'installation est écrit contre leurs API documentées et chaque étape est
  isolée : un échec n'interrompt pas les autres, il apparaît dans le rapport
  final avec la marche à suivre, et la relance du script reprend là où ça a
  coincé.

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
