# StatusPulse

**Agrégateur de status pages fournisseurs + alerting.** Un micro-SaaS conçu pour
tourner sans opérateur humain : acquisition par SEO programmatique, paiement
récurrent Stripe, livraison de valeur entièrement automatisée, auto-réparation
et alerte humaine uniquement en cas de panne du système lui-même.

---

## 0. Ce que vous avez à faire, en une page

**Cinq actions, une vingtaine de minutes, une seule fois.** Tout le reste est
exécuté par `npm run setup`, puis par le système lui-même.

| # | Action | Durée | Pourquoi ça ne peut pas être automatisé |
|---|---|---|---|
| 1 | Créer 4 comptes gratuits : [Supabase](https://supabase.com), [Stripe](https://stripe.com), [Resend](https://resend.com), [Vercel](https://vercel.com) | 8 min | Ils vous sont nominatifs |
| 2 | Dans Stripe, renseigner identité + IBAN (KYC) | 5 min | Obligation légale pour encaisser |
| 3 | Publier les 2 enregistrements DNS que Resend affiche | 3 min | Accès à votre registrar |
| 4 | Lancer `npm run setup` et coller 4 valeurs quand il les demande | 4 min | — |
| 5 | Sur Vercel : « Import Git Repository » → sélectionner ce dépôt | 2 min | Autorisation GitHub ↔ Vercel |

Ensuite : **plus rien**. Pas de contenu à écrire, pas de client à accueillir,
pas de serveur à surveiller. Vous ne recevez un email que si le système
lui-même tombe.

### Ce que `npm run setup` fait à votre place

- applique les 12 tables, index, triggers et fonctions SQL sur votre base ;
- installe les 71 fournisseurs et teste leurs flux un par un (ceux qui ne
  répondent pas sont désactivés pour ne pas publier de page vide) ;
- crée les produits et tarifs Stripe (Pro 19 €/mois, Team 49 €/mois) ;
- crée l'endpoint webhook Stripe **et récupère sa clé de signature** — aucun
  copier-coller de `whsec_…` ;
- configure le portail de facturation (résiliation et changement de plan en
  self-service : c'est ce qui supprime tout support lié à l'abonnement) ;
- génère les secrets applicatifs ;
- vérifie que votre domaine d'envoi est validé chez Resend ;
- pousse toutes les variables dans Vercel si vous lui donnez un token ;
- lance la première collecte et affiche l'état du système.

Le script est **idempotent** : relancez-le autant de fois que nécessaire, il
complète ce qui manque sans rien dupliquer. `npm run doctor` donne à tout
moment l'état complet (collecteur, file d'alertes, MRR Stripe, SEO).

### « Je mets juste mon PayPal et l'argent rentre ? »

Presque. Deux nuances, dites franchement :

- **L'encaissement passe par Stripe, pas PayPal.** PayPal ne gère pas
  proprement l'abonnement récurrent avec essai, changement de plan, relance
  d'impayé et portail client — c'est précisément ce qui évite d'avoir à
  s'occuper des clients. Stripe le fait, et c'est ce qui est intégré ici.
- **Aucune plateforme, Stripe ou PayPal, ne verse d'argent sans vérifier
  votre identité** (pièce d'identité + IBAN). C'est la loi anti-blanchiment,
  pas un choix technique. Comptez 5 minutes de formulaire ; les fonds
  arrivent ensuite automatiquement sur votre compte selon le calendrier de
  virement Stripe.

Si vous préférez ne pas gérer la TVA vous-même, l'alternative est un
*merchant of record* (Paddle, Lemon Squeezy) qui facture à votre place et
reverse un net : dites-le et je remplace l'intégration Stripe.

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
├── supabase/
│   └── schema.sql               Schéma complet, idempotent : tables, index,
│                                triggers, fonctions de file (SKIP LOCKED), RLS.
├── .github/workflows/
│   └── cron.yml                 Ordonnanceur gratuit (alternative à Vercel Pro).
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

## 3. Déploiement détaillé

### Étape 1 — Base de données (3 min)

Créer un projet sur [supabase.com](https://supabase.com), région proche de vos
utilisateurs. Puis *Project Settings → Database → Connection string →*
**Transaction pooler** (port **6543**) : copier l'URL et remplacer
`[YOUR-PASSWORD]` par le mot de passe choisi à la création.

> Le pooler est obligatoire en serverless : le port 5432 épuiserait les
> connexions en quelques minutes. C'est la seule subtilité de toute
> l'installation.

Aucun SQL à exécuter : `npm run setup` applique le schéma (il n'a même pas
besoin de `psql`).

### Étape 2 — Stripe (5 min)

Créer le compte, puis renseigner l'activité, l'identité et l'IBAN
(vérification obligatoire pour recevoir des fonds). Copier ensuite, dans
*Développeurs → Clés API*, la **clé secrète** (`sk_…`, bouton « Reveal secret
key ») — et non la clé publiable (`pk_…`) affichée juste au-dessus, qui ne
sert qu'au navigateur. `npm run setup` refuse explicitement la mauvaise.

Une clé `sk_test_…` permet de valider tout le tunnel de paiement avec les
[cartes de test Stripe](https://stripe.com/docs/testing) sans encaisser un
centime ; basculez sur `sk_live_…` une fois le compte validé.

Rien d'autre : produits, tarifs, webhook et portail client sont créés par le
script.

### Étape 3 — Email (3 min + propagation DNS)

Créer un compte [resend.com](https://resend.com), ajouter votre domaine,
publier les enregistrements SPF et DKIM proposés chez votre registrar, copier
la clé API.

> Ne sautez pas la vérification du domaine : sans elle, les alertes finissent
> en spam et le produit ne vaut rien. `npm run setup` et `npm run doctor`
> vérifient ce point et le signalent tant qu'il n'est pas réglé.

### Étape 4 — Installation automatique (4 min)

```bash
git clone <votre-repo> statuspulse && cd statuspulse
npm install
npm run setup
```

Le script demande quatre valeurs (URL Postgres, URL publique du site, clé
Stripe, clé Resend + expéditeur), puis fait tout le reste et écrit
`.env.local`.

### Étape 5 — Mise en ligne (2 min)

Sur [vercel.com](https://vercel.com) : *Add New → Project → Import Git
Repository* → sélectionner le dépôt → *Deploy*. Rattacher ensuite votre
domaine dans *Settings → Domains*.

Pour les variables d'environnement, deux options :

- **automatique** — créer un token dans *Vercel → Account Settings → Tokens*,
  l'ajouter à `.env.local` avec l'identifiant du projet, puis relancer
  `npm run setup` :
  ```bash
  VERCEL_TOKEN="…"        # Vercel > Account Settings > Tokens
  VERCEL_PROJECT_ID="…"   # Project Settings > General > Project ID
  VERCEL_TEAM_ID="…"      # uniquement si le projet appartient à une équipe
  ```
- **manuelle** — copier le contenu de `.env.local` dans *Settings →
  Environment Variables*.

Puis relancer `npm run setup` une dernière fois : il détecte le site en ligne,
déclenche la première collecte et confirme que tout tourne.

### Étape 6 — Ordonnanceur (0 ou 2 min)

- **Plan Vercel Pro (20 $/mois)** : rien à faire, les crons de `vercel.json`
  se déclenchent automatiquement à la minute.
- **Plan Vercel Hobby (gratuit)** : le workflow
  [`.github/workflows/cron.yml`](.github/workflows/cron.yml) fait le même
  travail gratuitement. Ajoutez deux secrets dans *Repo GitHub → Settings →
  Secrets and variables → Actions* : `APP_URL` et `CRON_SECRET` (valeur
  générée dans `.env.local`). Rien d'autre.

### Étape 7 — Référencement (2 min, rentabilisé cent fois)

Déclarer `https://votre-domaine/sitemap/0.xml` dans la
[Google Search Console](https://search.google.com/search-console). C'est le
seul geste qui accélère réellement l'indexation des 267 pages.

Facultatif mais recommandé : brancher un moniteur externe gratuit
(UptimeRobot) sur `https://votre-domaine/api/health` — c'est le seul dispositif
capable de vous prévenir si la plateforme d'hébergement elle-même tombe.

---

## 4. Variables d'environnement

**`npm run setup` en remplit 7 sur 13 tout seul** (les deux secrets, les deux
identifiants de tarif Stripe, la clé de signature du webhook, la taxe
automatique, et il écrit le fichier). Vous n'en saisissez que quatre.
Modèle complet et commenté dans [`.env.example`](.env.example).

| Variable | Où l'obtenir | Rôle |
|---|---|---|
| `DATABASE_URL` | Supabase → Database → **Transaction pooler** (port 6543) | Connexion Postgres |
| `APP_URL` | votre domaine, sans slash final | Liens email, redirections Stripe, URL canoniques, sitemap |
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

**Ajouter un fournisseur** — une ligne dans `src/data/services.ts`, puis
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
