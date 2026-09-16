# Kit de lancement — textes prêts à publier

Le produit est en ligne, encaissable et indexé. Ce qui lui manque n'est pas une
fonction : ce sont des visiteurs. Le référencement naturel met trois à six mois
à produire ses premiers euros ; sur un horizon de trois semaines, seule une
mise en avant manuelle peut amener un premier client.

Ces textes sont versionnés ici pour pouvoir être corrigés, réutilisés et
comparés à leurs résultats. Ordre de priorité décroissante.

**Les publications anglophones pointent vers `/en`.** Un lecteur de Hacker News
ou de r/devops qui atterrit sur une page en français repart immédiatement ; le
site existe désormais dans les deux langues, il faut envoyer chacun sur la
sienne.

## Règles qui valent pour tout ce qui suit

- **Jamais deux fois le même texte.** Reddit et Hacker News détectent la
  duplication, et un compte grillé ne se rattrape pas.
- **Répondre aux commentaires dans les deux heures.** Un fil sans réponse de
  l'auteur retombe ; c'est la seule variable réellement sous contrôle.
- **Ne jamais demander de vote.** Sanction immédiate sur les deux plateformes.
- **Publier mardi, mercredi ou jeudi**, entre 15 h et 16 h heure de Paris
  (début de matinée aux États-Unis).

---

## 1. Hacker News — « Show HN »

Le plus fort levier unique : quelques milliers de visites en une journée si le
fil tient la première page. Publier sur https://news.ycombinator.com/submit

**Titre**

    Show HN: Upstream Status – one alert when any of your SaaS providers goes down

**Texte**

    I kept learning about provider outages from my own users. Every provider we
    depend on publishes a status page, and nobody watches twenty of them.

    Upstream Status polls the official status pages of 145 providers (Statuspage,
    Atom, RSS) every 5 minutes, every 2 minutes once something is already
    degraded, and sends one alert to email, Slack or a webhook. It reports what
    the provider published — it never probes the services itself, so it cannot
    invent an outage that the provider does not acknowledge.

    The ingestion side turned out to be the interesting part. A status page that
    migrates platforms almost never 404s: it serves an HTML page, with a 200, at
    the /api/v2/summary.json endpoint. A checker that trusts the status code
    passes forever and silently stops alerting. Eight of the 145 providers moved
    endpoint in the past month. So the collector parses the payload rather than
    the status code, keeps fallback URLs per provider, and re-arms disabled
    feeds once a day so a provider that comes back is picked up on its own.

    Free for 3 providers. Every provider page is public, so you can check what
    the data looks like without an account.

    Next.js on Vercel, Postgres on Supabase, no server to babysit.

    https://upstreamstatus.com/en

## 2. Reddit — r/devops

Le lien seul s'y fait retirer. Ce qui passe, c'est le retour d'expérience
technique, le lien en dernière ligne. Publier sur https://reddit.com/r/devops

**Titre**

    8 of the 145 status pages I poll silently changed endpoint last month

**Texte**

    I run a small service that polls third-party status pages, so I watch 145 of
    them continuously. Three things I did not expect:

    - A migrated status page rarely 404s. It returns 200 with an HTML page at
      the /api/v2/summary.json endpoint. If your check only looks at the HTTP
      code, it passes forever and you silently stop being alerted. This is the
      failure mode that actually bites, because everything looks green.
    - Providers move between Statuspage, Instatus and self-hosted, in both
      directions, without notice. Eight out of 145 in a month.
    - A fair number of Atom feeds fail on XML entity-expansion limits rather
      than on the network, so they look like transient errors and get retried
      forever.

    What ended up working: parse the payload instead of trusting the status
    code, keep a list of fallback URLs per provider and try them after a few
    consecutive failures, and re-arm disabled feeds once a day so a provider
    that comes back is picked up automatically.

    If you poll status pages yourself, those three things will save you a
    weekend. If you would rather not, that is what I built:
    https://upstreamstatus.com/en — free for 3 providers.

## 3. LinkedIn

Le réseau existant est le seul public déjà acquis. Pas de lien dans les trois
premières lignes : l'algorithme les pénalise.

    On apprend presque toujours qu'un fournisseur est en panne par ses propres
    clients.

    Chaque service qu'on utilise publie pourtant une page de statut. Personne ne
    surveille les vingt pages de statut de sa stack — jusqu'à la première panne
    qui coûte cher.

    J'ai mis en ligne Upstream Status. Il lit les pages de statut officielles de 145
    fournisseurs (AWS, Stripe, GitHub, OVHcloud, Scaleway, Qonto, PayFit,
    Brevo…) toutes les 5 minutes, et envoie une alerte par email, Slack ou
    webhook dès qu'un incident est publié. Rien à installer.

    Gratuit pour 3 fournisseurs : upstreamstatus.com

    Si vous surveillez déjà vos fournisseurs, je suis curieux de savoir comment.
    C'est typiquement la tâche qu'on repousse jusqu'au jour où elle se rappelle
    à nous.

## 4. Indie Hackers et r/SaaS

Public de fondateurs : ce qui intéresse, c'est la construction, pas le produit.
https://www.indiehackers.com/post/new

**Titre**

    I built a status-page monitor that runs on zero hours a week. Here is what that took.

**Texte**

    The product is simple: it polls 145 providers' official status pages and
    alerts you when one of yours goes down. What I wanted to test was different:
    whether a paid product can run with no human maintenance at all.

    What that required, concretely:

    - Ingestion that repairs itself. Providers migrate their status page without
      notice; the collector tries known fallback URLs after three failures and
      re-arms disabled feeds daily.
    - Billing as a projection, never a source of truth. Stripe is authoritative;
      a nightly reconciliation replays anything a lost webhook missed, so a
      customer who paid is never stuck on the free plan.
    - Alerting on the alerting. Everything writes to an event log with a global
      cap of six notifications per hour — I learned that one the hard way, with
      330 emails in one evening after a batch of providers migrated at once.
    - Checkout before signup. Asking for an account before the card was costing
      every conversion; the account is now created from the billing email after
      payment.

    Live here: https://upstreamstatus.com/en — free for 3 providers. Happy
    to go into detail on any of the four.

## 5. Product Hunt

À préparer la veille, publication mardi ou mercredi à 09 h 01 heure de Paris
(00 h 01 Pacifique) pour disposer de la journée entière de classement.

**Nom** : Upstream Status
**Accroche** : One alert when any of your SaaS providers goes down
**Lien** : https://upstreamstatus.com/en
**Description**

    Every provider you depend on publishes a status page. Nobody watches twenty
    of them. Upstream Status polls the official status pages of 145 providers every
    5 minutes and sends one alert to email, Slack or a webhook. It reports what
    the provider published, never a guess. Free for 3 providers.

---

## Ce qu'il est raisonnable d'attendre

| Canal | Visites si ça marche | Si ça ne marche pas |
| --- | --- | --- |
| Hacker News en première page | 2 000 à 8 000 en 24 h | 50 à 200 |
| Reddit r/devops bien accueilli | 500 à 3 000 | retrait du fil |
| LinkedIn | 200 à 1 500 | 50 |
| Indie Hackers | 100 à 600 | 30 |
| Product Hunt dans le top 5 | 800 à 3 000 | 100 |

Sur cent visiteurs, un à trois créent un compte ; sur cent comptes gratuits, un
à trois passent au payant dans le mois. Un premier client payant demande donc
de l'ordre de trois mille visiteurs — atteignable en une journée si un seul de
ces cinq canaux prend, hors de portée sans eux.
