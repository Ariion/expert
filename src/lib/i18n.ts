/**
 * Bilingue français / anglais.
 *
 * Le français reste à la racine (`/status/github`) parce que ces adresses sont
 * déjà indexées : les déplacer derrière un préfixe `/fr` aurait sacrifié le seul
 * capital de référencement acquis. L'anglais s'ajoute sous `/en`, sans toucher à
 * une seule URL existante.
 *
 * L'anglais n'est pas une traduction de confort : « is github down » se cherche
 * environ trente fois plus que « github est-il en panne ». C'est le même code,
 * les mêmes données et les mêmes pages — pour un marché d'un autre ordre de
 * grandeur.
 */
export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";
export const HTML_LANG: Record<Locale, string> = { fr: "fr", en: "en" };
export const OG_LOCALE: Record<Locale, string> = { fr: "fr_FR", en: "en_US" };

/** Préfixe d'URL d'une locale. Le français n'en a pas. */
export function localePrefix(locale: Locale): string {
  return locale === "fr" ? "" : `/${locale}`;
}

/**
 * Construit un chemin dans la locale demandée.
 * `href("en", "/status/github")` → `/en/status/github`
 * `href("fr", "/")`              → `/`
 */
export function href(locale: Locale, path: string): string {
  const clean = path === "/" ? "" : path.replace(/\/+$/, "");
  return `${localePrefix(locale)}${clean}` || "/";
}

/** Chemin équivalent dans l'autre langue, pour le sélecteur et les hreflang. */
export function otherLocale(locale: Locale): Locale {
  return locale === "fr" ? "en" : "fr";
}

/**
 * Certaines pages n'ont pas le même segment dans les deux langues : les URLs
 * françaises étaient déjà publiées quand l'anglais est arrivé, et les renommer
 * aurait cassé des liens pour rien. Cette table garde les deux versions
 * alignées, notamment pour les balises `hreflang`.
 */
const PATH_ALIASES: Array<{ fr: string; en: string }> = [{ fr: "/bienvenue", en: "/welcome" }];

export function translatePath(path: string, to: Locale): string {
  const from = to === "fr" ? "en" : "fr";
  const alias = PATH_ALIASES.find((a) => a[from] === path);
  return href(to, alias ? alias[to] : path);
}

/** Étiquettes de catégorie : le slug brut ne se lit pas en anglais. */
export const CATEGORY_LABEL: Record<Locale, Record<string, string>> = {
  fr: {
    cloud: "Cloud & infrastructure",
    donnees: "Données",
    paiement: "Paiement",
    communication: "Communication",
    support: "Support client",
    email: "Email & messagerie",
    marketing: "Marketing & analytics",
    developpement: "Outils de développement",
    productivite: "Productivité",
    observabilite: "Observabilité",
    securite: "Sécurité & identité",
    ecommerce: "E-commerce",
    "no-code": "No-code & automatisation",
    ia: "Intelligence artificielle",
  },
  en: {
    cloud: "Cloud & infrastructure",
    donnees: "Databases & data",
    paiement: "Payments",
    communication: "Communication",
    support: "Customer support",
    email: "Email & messaging",
    marketing: "Marketing & analytics",
    developpement: "Developer tools",
    productivite: "Productivity",
    observabilite: "Observability",
    securite: "Security & identity",
    ecommerce: "E-commerce",
    "no-code": "No-code & automation",
    ia: "Artificial intelligence",
  },
};

export function categoryLabel(slug: string, locale: Locale): string {
  return CATEGORY_LABEL[locale][slug] ?? slug.replace(/-/g, " ");
}

// ---------------------------------------------------------------------------
// Dictionnaire
// ---------------------------------------------------------------------------

const fr = {
  nav: {
    providers: "Fournisseurs",
    categories: "Catégories",
    pricing: "Tarifs",
    login: "Connexion",
    start: "Commencer",
    switchTo: "English",
    switchLabel: "Voir cette page en anglais",
  },
  footer: {
    tagline: "agrégateur de status pages et alerting fournisseurs.",
    disclaimer:
      "Données issues des pages de statut publiques officielles. Non affilié aux fournisseurs cités.",
    allProviders: "Tous les fournisseurs",
    legal: "Mentions légales",
  },
  status: {
    operational: "Opérationnel",
    degraded: "Performances dégradées",
    partial_outage: "Panne partielle",
    major_outage: "Panne majeure",
    maintenance: "Maintenance",
    unknown: "Inconnu",
  },
  impact: {
    none: "Aucun",
    minor: "Mineur",
    major: "Majeur",
    critical: "Critique",
    maintenance: "Maintenance",
  },
  time: {
    never: "—",
    justNow: "à l'instant",
    minutes: (n: number) => `il y a ${n} min`,
    hours: (n: number) => `il y a ${n} h`,
    days: (n: number) => `il y a ${n} j`,
    months: (n: number) => `il y a ${n} mois`,
    years: (n: number) => `il y a ${n} an(s)`,
    ninetyDaysAgo: "il y a 90 jours",
    today: "aujourd'hui",
    noData: "pas de donnée",
    incidentsCount: (n: number) => `${n} incident(s)`,
  },
  home: {
    metaTitle: "Surveillez les status pages de tous vos fournisseurs",
    metaDescription:
      "Un seul tableau de bord pour AWS, Stripe, Slack, GitHub, Twilio et 140+ fournisseurs. Alerte email, Slack ou webhook dès qu'un incident est publié. Gratuit pour 3 services.",
    pill: (services: number, incidents: number) =>
      `${services} fournisseurs surveillés · ${incidents} incidents sur 30 jours`,
    h1a: "Vos clients ne devraient pas être",
    h1b: "les premiers à vous dire que Stripe est down.",
    lead: "Upstream Status interroge en continu les pages de statut officielles de vos fournisseurs et vous alerte par email, Slack ou webhook dans les minutes qui suivent la publication d'un incident. Rien à installer, rien à maintenir.",
    ctaPrimary: "Commencer gratuitement",
    ctaSecondary: "Parcourir les fournisseurs",
    stats: {
      detection: ["Détection", "≤ 5 min", "après publication par le fournisseur"],
      providers: ["Fournisseurs", "status pages suivies en continu"],
      degraded: ["En incident", "à cet instant précis"],
      effort: ["Intervention", "0 h", "aucune action de votre part"],
    },
    recentIncidents: "Incidents récents",
    seeAll: "Tout voir →",
    noIncidents:
      "Aucun incident enregistré pour l'instant. Le collecteur alimente cette page toutes les 5 minutes.",
    resolved: "résolu",
    ongoing: "en cours",
    mostWatched: "Fournisseurs les plus surveillés",
    howItWorks: "Comment ça marche",
    steps: [
      [
        "1. Choisissez votre stack",
        "Sélectionnez les fournisseurs dont dépend votre produit : cloud, paiement, email, auth, CDN…",
      ],
      [
        "2. Nous surveillons en continu",
        "Chaque status page officielle est interrogée toutes les 2 à 5 minutes, avec une cadence accélérée quand un service se dégrade.",
      ],
      [
        "3. Vous recevez l'alerte",
        "Email, Slack ou webhook signé — avant que le support client ne s'enflamme. Puis l'avis de résolution.",
      ],
    ],
    planCta: "Voir les tarifs",
    byCategory: "Par catégorie",
    categoryCount: (count: number, degraded: number) =>
      `${count} fournisseurs · ${degraded} en incident`,
  },
  statusIndex: {
    metaTitle: "Statut en direct de 140+ fournisseurs SaaS",
    metaDescription:
      "Tableau de bord unique : statut en temps réel, disponibilité et historique d'incidents de tous les fournisseurs SaaS et cloud majeurs.",
    h1: (n: number) => `Statut en direct de ${n} fournisseurs`,
    lead: "Relevé automatique des pages de statut officielles, toutes les 2 à 5 minutes. Cliquez sur un fournisseur pour son historique d'incidents et sa disponibilité sur 90 jours.",
    seeCategory: "Voir la catégorie →",
    uptimeShort: (pct: string) => `${pct} % / 90 j`,
  },
  categories: {
    metaTitle: "Catégories de fournisseurs surveillés",
    metaDescription:
      "Cloud, paiement, email, authentification, CDN, observabilité : parcourez les status pages surveillées par catégorie.",
    h1: "Catégories",
    lead: "Chaque catégorie regroupe les fournisseurs d'un même maillon de votre infrastructure. Un incident chez l'un d'eux vous concerne directement.",
  },
  category: {
    metaTitle: (label: string, n: number) =>
      `Statut des fournisseurs ${label} (${n} services surveillés)`,
    metaDescription: (label: string, names: string) =>
      `Statut en direct, disponibilité et historique d'incidents des principaux fournisseurs ${label} : ${names}.`,
    h1: (label: string) => `Fournisseurs ${label}`,
    lead: (n: number, down: number) =>
      `${n} services surveillés, ${down} actuellement en incident. Données relevées automatiquement sur les pages de statut officielles.`,
    thService: "Service",
    thUptime: "Dispo. 90 j",
    thLast: "Dernier incident",
    thStatus: "Statut",
    comparisons: "Comparatifs",
  },
  service: {
    notFound: "Fournisseur introuvable",
    metaTitle: (name: string) => `${name} est-il en panne ? Statut en direct et historique`,
    metaDescription: (name: string, status: string) =>
      `${name} : ${status} (vérifié il y a moins de 5 minutes). Historique des incidents sur 90 jours, disponibilité mesurée et alerte gratuite par email dès la prochaine panne.`,
    h1: (name: string) => `${name} est-il en panne ?`,
    unchangedSince: (ago: string) =>
      `état inchangé depuis ${ago} · relevé automatique toutes les 5 minutes`,
    fallbackDescription: (name: string) =>
      `${name} publie ses incidents sur une page de statut officielle. Upstream Status la surveille en continu et vous alerte automatiquement.`,
    kpiStatus: "Statut actuel",
    kpiUptime: "Disponibilité 90 j",
    kpiIncidents: "Incidents 90 j",
    kpiLast: "Dernier incident",
    uptimeTitle: "Disponibilité sur 90 jours",
    historyTitle: "Historique des incidents",
    noIncidents: (name: string) => `Aucun incident publié par ${name} sur la période collectée.`,
    duration: "Durée :",
    officialPost: "communication officielle",
    sourceTitle: "Source officielle",
    sourceBody: (name: string) =>
      `Les données de cette page proviennent exclusivement de la page de statut publique de ${name}.`,
    sourceCta: "Page de statut officielle",
    watchers: (n: number, name: string, site: string) =>
      `${n} personne(s) surveillent ${name} via ${site}.`,
    relatedTitle: (label: string) => `Autres services ${label}`,
    compareCta: (a: string, b: string) => `Comparer ${a} et ${b} →`,
    faqTitle: "Questions fréquentes",
    faq: {
      q1: (name: string) => `${name} est-il en panne actuellement ?`,
      a1: (name: string, date: string, status: string, open: string) =>
        `Au dernier relevé (${date}), ${name} est en état « ${status} » d'après sa page de statut officielle. ${open}`,
      a1Open: (n: number, title: string) => `${n} incident(s) en cours : ${title}.`,
      a1None: "Aucun incident en cours n'est publié.",
      q2: (name: string) => `Quelle est la disponibilité de ${name} sur 90 jours ?`,
      a2: (name: string, pct: string, count: number) =>
        `${name} affiche ${pct} % de disponibilité sur les 90 derniers jours, avec ${count} incident(s) publiés.`,
      a2None: (name: string, site: string) =>
        `L'historique de ${name} est en cours de constitution sur ${site}.`,
      q3: (name: string) => `Comment être prévenu automatiquement d'une panne de ${name} ?`,
      a3: (name: string, site: string) =>
        `Créez une alerte gratuite sur ${site} : dès qu'un incident est publié sur la status page de ${name}, vous recevez un email (ou une notification Slack/webhook avec un plan payant).`,
    },
  },
  compare: {
    notFound: "Comparatif introuvable",
    metaTitle: (a: string, b: string) => `${a} ou ${b} : lequel tombe le moins souvent ?`,
    metaDescription: (a: string, b: string) =>
      `Comparatif de fiabilité ${a} vs ${b} : disponibilité sur 90 jours, nombre d'incidents et statut en direct, mesurés sur les status pages officielles.`,
    h1: (a: string, b: string) => `${a} vs ${b} : fiabilité comparée`,
    lead: "Comparatif fondé uniquement sur les incidents publiés par les fournisseurs eux-mêmes sur leurs pages de statut officielles, sur les 90 derniers jours.",
    leadWinner: (name: string) => ` Sur cette période, ${name} affiche la meilleure disponibilité.`,
    leadTie: " Les deux services affichent une disponibilité équivalente sur la période.",
    kpiUptime: "Dispo. 90 j",
    kpiIncidents: "Incidents 90 j",
    kpiLast: "Dernier",
    readingTitle: "Lecture du comparatif",
    reading: (a: string, sa: string, b: string, sb: string) =>
      `${a} est actuellement « ${sa} », ${b} est « ${sb} ». Un fournisseur qui publie beaucoup d'incidents n'est pas nécessairement moins fiable : c'est souvent le signe d'une status page honnête et granulaire. L'indicateur utile reste la durée cumulée d'indisponibilité, affichée ci-dessus.`,
  },
  watch: {
    titleService: (name: string) => `Être alerté quand ${name} tombe`,
    titleGeneric: "Être alerté en cas de panne",
    // Pendant une panne en cours, la promesse utile n'est pas « la prochaine
    // fois » : c'est « maintenant ». Le visiteur cherche quand ce sera réparé.
    titleOngoing: (name: string) => `Être prévenu dès que ${name} est rétabli`,
    bodyOngoing:
      "Laissez votre email : vous recevez un message dès que le fournisseur publie la résolution. Inutile de rafraîchir cette page. Gratuit, sans carte bancaire.",
    submitOngoing: "Me prévenir du rétablissement",
    body: "Gratuit, 3 fournisseurs, sans carte bancaire. Vous recevez un email dès qu'un incident est publié sur la page de statut officielle.",
    placeholder: "vous@entreprise.com",
    emailLabel: "Adresse email",
    submit: "Activer l'alerte",
  },
  pricing: {
    metaTitle: "Tarifs — surveillance de vos fournisseurs à partir de 0 €",
    metaDescription:
      "Gratuit pour 3 fournisseurs. Pro à 19 €/mois pour 50 fournisseurs, alertes instantanées, Slack et webhooks. Team à 49 €/mois avec rapports SLA et API.",
    h1: "Un abonnement, zéro maintenance",
    lead: "Le prix d'une heure de panne non détectée dépasse largement celui d'une année d'abonnement. Sans engagement, résiliable en un clic depuis le portail de facturation.",
    leadNoAccount:
      "Aucun compte à créer avant de payer : il se crée tout seul à partir de votre email de facturation.",
    mostChosen: "Le plus choisi",
    freeCta: "Créer un compte gratuit",
    upgradeCta: (plan: string) => `Passer en ${plan}`,
    faqTitle: "Questions fréquentes",
    faq: [
      [
        "D'où viennent les données ?",
        "Exclusivement des pages de statut publiques des fournisseurs (format Statuspage, Atom ou RSS). Nous ne testons pas les services nous-mêmes : nous relayons ce que le fournisseur publie, sans délai d'interprétation.",
      ],
      [
        "Quel est le délai de détection ?",
        "Chaque status page est interrogée toutes les 5 minutes, et toutes les 2 minutes lorsqu'un service est déjà dégradé. L'alerte part dans la foulée sur les plans payants.",
      ],
      [
        "Dois-je créer un compte avant de payer ?",
        "Non. Vous entrez directement dans le paiement Stripe ; le compte est créé à partir de l'adresse de facturation et un lien de connexion vous est envoyé dans la foulée. Aucun mot de passe à retenir, ici ni ailleurs.",
      ],
      [
        "Puis-je résilier à tout moment ?",
        "Oui. Le portail de facturation Stripe est accessible depuis votre tableau de bord : résiliation, changement de plan, factures, moyens de paiement.",
      ],
      [
        "Que se passe-t-il si je dépasse la limite ?",
        "Rien ne casse : la surveillance des fournisseurs déjà enregistrés continue. Vous ne pouvez simplement plus en ajouter tant que vous n'avez pas changé de plan.",
      ],
    ],
  },
  plans: {
    free: {
      name: "Free",
      priceLabel: "0 €",
      features: [
        "3 fournisseurs surveillés",
        "Alertes email (différées de 15 min)",
        "Historique d'incidents 90 jours",
      ],
    },
    pro: {
      name: "Pro",
      priceLabel: "19 €/mois",
      features: [
        "50 fournisseurs surveillés",
        "Alertes instantanées (< 5 min après le fournisseur)",
        "Slack + webhooks illimités",
        "Digest quotidien de disponibilité",
        "Historique complet + export",
      ],
    },
    team: {
      name: "Team",
      priceLabel: "49 €/mois",
      features: [
        "Fournisseurs illimités en pratique (500)",
        "25 canaux (par équipe, par service)",
        "Rapports SLA mensuels automatiques",
        "Accès API en lecture",
        "Support prioritaire par email",
      ],
    },
  },
  login: {
    metaTitle: "Connexion",
    metaDescription: "Connexion sans mot de passe à votre tableau de bord Upstream Status.",
    h1: "Connexion",
    lead: "Pas de mot de passe à retenir : vous recevez un lien de connexion valable 30 minutes.",
    sent: "Lien envoyé. Ouvrez votre boîte mail (et le dossier indésirables, au cas où).",
    expired: "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.",
    invalidEmail: "Adresse email invalide.",
    emailLabel: "Adresse email",
    placeholder: "vous@entreprise.com",
    submit: "Recevoir mon lien de connexion",
  },
  welcome: {
    metaTitle: "Paiement confirmé — votre surveillance démarre",
    metaDescription:
      "Votre abonnement Upstream Status est actif. Un lien de connexion vient de partir vers votre boîte mail.",
    pill: "Paiement confirmé",
    h1: "Votre surveillance est active",
    lead: "Nous venons de vous envoyer un lien de connexion à l'adresse utilisée pour le paiement. Un clic suffit : aucun mot de passe à créer.",
    nextTitle: "Ce qui se passe maintenant",
    next: [
      "Ouvrez l'email intitulé « Votre lien de connexion » (vérifiez les indésirables).",
      "Choisissez les fournisseurs à surveiller depuis votre tableau de bord.",
      "Dès qu'un incident est publié sur leur status page officielle, l'alerte part.",
    ],
    missingTitle: "Vous ne trouvez pas l'email ?",
    missingBody:
      "Demandez-en un nouveau avec la même adresse : votre abonnement y est déjà rattaché.",
    missingCta: "Recevoir un nouveau lien",
  },
  legal: {
    metaTitle: "Mentions légales et traitement des données",
    metaDescription:
      "Éditeur, hébergement, sources de données et traitement des données personnelles.",
    h1: "Mentions légales",
    publisherTitle: "Éditeur du site",
    publisherRegistration: "Immatriculation",
    publisherContact: "Contact",
    publisherMissing:
      "L'identité de l'éditeur n'est pas encore renseignée. Elle apparaîtra ici dès que les variables correspondantes seront définies.",
    hostingTitle: "Hébergement",
    hostingBody:
      "Le site est hébergé par Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis. Les données applicatives sont hébergées dans l'Union européenne (Supabase, région Irlande).",
    sourcesTitle: "Sources des données",
    sourcesBody: (site: string) =>
      `${site} agrège et republie des informations issues des pages de statut publiques des fournisseurs cités, accessibles sans authentification et destinées à la diffusion publique. Chaque page indique sa source officielle et y renvoie. ${site} n'est affilié à aucun de ces fournisseurs et leurs marques restent la propriété de leurs détenteurs respectifs.`,
    dataTitle: "Données personnelles",
    dataBody:
      "Les seules données collectées sont l'adresse email nécessaire à l'envoi des alertes, la liste des fournisseurs surveillés et les identifiants de facturation gérés par Stripe. Aucune revente, aucun traceur publicitaire, aucun cookie autre que le cookie de session. Suppression du compte et de toutes les données associées sur simple demande par email.",
    liabilityTitle: "Limitation de responsabilité",
    liabilityBody: (site: string) =>
      `Le service est fourni « en l'état ». Les alertes dépendent de la publication d'incidents par les fournisseurs eux-mêmes : ${site} ne peut garantir la détection d'une panne qui n'aurait pas été publiée sur la page de statut officielle.`,
  },
  notFound: {
    h1: "Page introuvable",
    lead: "Ce fournisseur n'est pas (encore) surveillé par Upstream Status, ou l'adresse est erronée.",
    ctaProviders: "Voir tous les fournisseurs",
    ctaHome: "Accueil",
  },
  email: {
    magicSubject: (site: string) => `Votre lien de connexion ${site}`,
    magicTitle: "Connexion en un clic",
    magicBody: "Ce lien est valable 30 minutes et ne fonctionne qu'une seule fois.",
    magicCta: "Ouvrir mon tableau de bord",
    magicFooter: "Si vous n'avez pas demandé ce lien, ignorez cet email.",
    magicText: (site: string, url: string) =>
      `Connexion ${site} : ${url}\n(valable 30 minutes, usage unique)`,
    welcomeSubjectService: (name: string) => `Surveillance de ${name} activée`,
    welcomeSubject: (site: string) => `Votre surveillance ${site} est active`,
    welcomeTitleService: (name: string) => `Vous êtes alerté dès que ${name} tombe`,
    welcomeTitle: "Surveillance active",
    welcomeBody1:
      "Nous interrogeons les status pages officielles de vos fournisseurs toutes les 5 minutes. Dès qu'un incident est publié, vous recevez l'alerte — sans avoir à ouvrir quoi que ce soit.",
    welcomeBody2:
      "<strong>Ajoutez le reste de votre stack</strong> : la panne qui vous coûtera cher est rarement celle que vous surveilliez déjà.",
    welcomeCta: "Ajouter mes fournisseurs",
    welcomeText: (url: string) => `Surveillance active. Ajoutez vos fournisseurs : ${url}`,
    incidentVerb: { opened: "en cours", updated: "mis à jour", resolved: "résolu" },
    incidentSubject: (icon: string, name: string, verb: string, title: string) =>
      `${icon} ${name} — incident ${verb} : ${title}`,
    incidentMeta: (impact: string, state: string, started: string) =>
      `<strong>Impact :</strong> ${impact} &nbsp;·&nbsp; <strong>État :</strong> ${state} &nbsp;·&nbsp; <strong>Début :</strong> ${started}`,
    incidentCta: "Voir le détail de l'incident",
    incidentHistory: (name: string) => `Historique complet de ${name}`,
    limitSubject: "Vous avez atteint la limite du plan Free",
    limitTitle: (count: number) => `${count} fournisseurs surveillés — la limite Free est de 3`,
    limitBody:
      "Passez en Pro pour surveiller jusqu'à 50 fournisseurs, recevoir les alertes <strong>sans délai de 15 minutes</strong>, et les router vers Slack ou un webhook.",
    limitCta: "Passer en Pro — 19 €/mois",
    limitText: (url: string) => `Limite Free atteinte. Passez en Pro : ${url}`,
    digestSubject: (date: string) => `Disponibilité de votre stack — ${date}`,
    digestTitle: (date: string) => `Récapitulatif du ${date}`,
    digestCta: "Ouvrir le tableau de bord",
    dunningSubject: "Échec du paiement — vos alertes instantanées sont menacées",
    dunningBody:
      "Le prélèvement de votre abonnement a échoué. Mettez à jour votre moyen de paiement pour conserver les alertes instantanées.",
    dunningCta: "Mettre à jour",
    footerNote: (site: string) =>
      `Vous recevez cet email parce que vous surveillez des fournisseurs sur ${site}.`,
    manageLink: "Gérer mes alertes",
  },
  errors: {
    unknownPlan: "Plan inconnu.",
    paymentUnavailable:
      "Le paiement est momentanément indisponible. Réessayez dans un instant.",
    portalUnavailable: "Portail de facturation momentanément indisponible.",
    missingProvider: "Fournisseur manquant.",
    planLimit: (plan: string, max: number) => `Limite du plan ${plan} atteinte (${max}).`,
    unknownChannel: "Canal inconnu.",
    channelNeedsPaid: (kind: string) => `Le canal ${kind} nécessite un plan payant.`,
    invalidEmail: "Adresse email invalide.",
    invalidUrl: "URL invalide.",
    httpsOnly: "Seules les URL HTTPS sont acceptées.",
    internalAddress: "Adresse interne refusée.",
    channelLimit: (max: number, plan: string) =>
      `Limite de ${max} canaux atteinte sur le plan ${plan}.`,
    generic: "Une erreur est survenue, réessayez dans un instant.",
  },
  dashboard: {
    metaTitle: "Tableau de bord",
    h1: "Tableau de bord",
    logout: "Se déconnecter",
    upgraded: "Paiement confirmé. Votre plan est activé — les alertes partent désormais sans délai.",
    saved: "Modification enregistrée.",
    currentPlan: "Plan actuel",
    planSummary: (used: number, max: number, delay: string) =>
      `${used}/${max} fournisseurs · ${delay}`,
    delayed: (min: number) => `alertes différées de ${min} min`,
    instant: "alertes instantanées",
    renewal: (ends: boolean, date: string) =>
      ` · ${ends ? "fin" : "renouvellement"} le ${date}`,
    manageBilling: "Gérer la facturation",
    upgradeCta: "Passer en Pro",
    pastDue:
      "Votre dernier paiement a échoué. Mettez à jour votre moyen de paiement pour conserver les alertes instantanées.",
    channelsTitle: "Canaux d'alerte",
    disabled: "désactivé",
    remove: "Retirer",
    noChannels: "Aucun canal configuré.",
    channelKind: "Type de canal",
    channelTarget: "email ou URL du webhook",
    destination: "Destination",
    add: "Ajouter",
    paidChannels: "Les canaux Slack et webhook nécessitent un plan payant.",
    watchedTitle: "Fournisseurs surveillés",
    lastIncident: "Dernier incident :",
    unwatch: "Ne plus suivre",
    noWatched: "Aucun fournisseur surveillé pour l'instant.",
    addProvider: "Ajouter un fournisseur",
    threshold: "Seuil d'alerte",
    thresholdAll: "Tous les incidents",
    thresholdMajor: "Majeurs et critiques",
    thresholdCritical: "Critiques uniquement",
    watchCta: "Surveiller",
    limitReached: (plan: string) => `Limite du plan ${plan} atteinte.`,
    limitCta: "Passer au plan supérieur",
    limitSuffix: " pour en ajouter davantage.",
    alertsTitle: "Dernières alertes envoyées",
    noAlerts: "Aucune alerte pour l'instant — c'est plutôt une bonne nouvelle.",
  },
};

/**
 * L'anglais reprend la même forme, clé pour clé : le type est dérivé du
 * français, donc toute clé oubliée ou renommée casse la compilation plutôt que
 * de produire une page à moitié traduite en production.
 */
const en: typeof fr = {
  nav: {
    providers: "Providers",
    categories: "Categories",
    pricing: "Pricing",
    login: "Sign in",
    start: "Get started",
    switchTo: "Français",
    switchLabel: "View this page in French",
  },
  footer: {
    tagline: "status page aggregator and vendor outage alerts.",
    disclaimer:
      "Data comes from the providers' official public status pages. Not affiliated with any provider listed.",
    allProviders: "All providers",
    legal: "Legal & privacy",
  },
  status: {
    operational: "Operational",
    degraded: "Degraded performance",
    partial_outage: "Partial outage",
    major_outage: "Major outage",
    maintenance: "Maintenance",
    unknown: "Unknown",
  },
  impact: {
    none: "None",
    minor: "Minor",
    major: "Major",
    critical: "Critical",
    maintenance: "Maintenance",
  },
  time: {
    never: "—",
    justNow: "just now",
    minutes: (n: number) => `${n} min ago`,
    hours: (n: number) => `${n} h ago`,
    days: (n: number) => (n === 1 ? "1 day ago" : `${n} days ago`),
    months: (n: number) => (n === 1 ? "1 month ago" : `${n} months ago`),
    years: (n: number) => (n === 1 ? "1 year ago" : `${n} years ago`),
    ninetyDaysAgo: "90 days ago",
    today: "today",
    noData: "no data",
    incidentsCount: (n: number) => (n === 1 ? "1 incident" : `${n} incidents`),
  },
  home: {
    metaTitle: "Monitor every provider's status page in one place",
    metaDescription:
      "One dashboard for AWS, Stripe, Slack, GitHub, Twilio and 140+ providers. Email, Slack or webhook alerts the moment an incident is published. Free for 3 services.",
    pill: (services: number, incidents: number) =>
      `${services} providers monitored · ${incidents} incidents in 30 days`,
    h1a: "Your customers should not be",
    h1b: "the first to tell you Stripe is down.",
    lead: "Upstream Status continuously reads your providers' official status pages and alerts you by email, Slack or webhook within minutes of an incident being published. Nothing to install, nothing to maintain.",
    ctaPrimary: "Start for free",
    ctaSecondary: "Browse providers",
    stats: {
      detection: ["Detection", "≤ 5 min", "after the provider publishes"],
      providers: ["Providers", "status pages read continuously"],
      degraded: ["Down right now", "at this exact moment"],
      effort: ["Your time", "0 h", "nothing for you to do"],
    },
    recentIncidents: "Recent incidents",
    seeAll: "See all →",
    noIncidents:
      "No incidents recorded yet. The collector refreshes this page every 5 minutes.",
    resolved: "resolved",
    ongoing: "ongoing",
    mostWatched: "Most watched providers",
    howItWorks: "How it works",
    steps: [
      [
        "1. Pick your stack",
        "Choose the providers your product depends on: cloud, payments, email, auth, CDN…",
      ],
      [
        "2. We watch them continuously",
        "Every official status page is read every 2 to 5 minutes, and faster once a service starts degrading.",
      ],
      [
        "3. You get the alert",
        "Email, Slack or a signed webhook — before support tickets start piling up. Then the all-clear.",
      ],
    ],
    planCta: "See pricing",
    byCategory: "By category",
    categoryCount: (count: number, degraded: number) => `${count} providers · ${degraded} down`,
  },
  statusIndex: {
    metaTitle: "Live status of 140+ SaaS providers",
    metaDescription:
      "One dashboard: live status, uptime and incident history for every major SaaS and cloud provider.",
    h1: (n: number) => `Live status of ${n} providers`,
    lead: "Read automatically from official status pages, every 2 to 5 minutes. Open a provider for its incident history and 90-day uptime.",
    seeCategory: "See category →",
    uptimeShort: (pct: string) => `${pct}% / 90d`,
  },
  categories: {
    metaTitle: "Provider categories",
    metaDescription:
      "Cloud, payments, email, authentication, CDN, observability: browse monitored status pages by category.",
    h1: "Categories",
    lead: "Each category groups the providers sitting at the same layer of your infrastructure. An incident at any of them is your incident too.",
  },
  category: {
    metaTitle: (label: string, n: number) => `${label} status — ${n} providers monitored`,
    metaDescription: (label: string, names: string) =>
      `Live status, uptime and incident history for the main ${label.toLowerCase()} providers: ${names}.`,
    h1: (label: string) => `${label} providers`,
    lead: (n: number, down: number) =>
      `${n} services monitored, ${down} currently reporting an incident. Read automatically from official status pages.`,
    thService: "Service",
    thUptime: "90d uptime",
    thLast: "Last incident",
    thStatus: "Status",
    comparisons: "Comparisons",
  },
  service: {
    notFound: "Provider not found",
    metaTitle: (name: string) => `Is ${name} down? Live status and incident history`,
    metaDescription: (name: string, status: string) =>
      `${name}: ${status} (checked less than 5 minutes ago). 90 days of incident history, measured uptime, and a free email alert the next time it goes down.`,
    h1: (name: string) => `Is ${name} down?`,
    unchangedSince: (ago: string) => `unchanged since ${ago} · checked automatically every 5 minutes`,
    fallbackDescription: (name: string) =>
      `${name} publishes its incidents on an official status page. Upstream Status reads it continuously and alerts you automatically.`,
    kpiStatus: "Current status",
    kpiUptime: "90-day uptime",
    kpiIncidents: "Incidents (90d)",
    kpiLast: "Last incident",
    uptimeTitle: "Uptime over 90 days",
    historyTitle: "Incident history",
    noIncidents: (name: string) => `${name} published no incident over the collected period.`,
    duration: "Duration:",
    officialPost: "official post",
    sourceTitle: "Official source",
    sourceBody: (name: string) =>
      `Everything on this page comes from ${name}'s public status page, and nowhere else.`,
    sourceCta: "Official status page",
    watchers: (n: number, name: string, site: string) =>
      n === 1
        ? `1 person watches ${name} through ${site}.`
        : `${n} people watch ${name} through ${site}.`,
    relatedTitle: (label: string) => `Other ${label.toLowerCase()} services`,
    compareCta: (a: string, b: string) => `Compare ${a} and ${b} →`,
    faqTitle: "Frequently asked questions",
    faq: {
      q1: (name: string) => `Is ${name} down right now?`,
      a1: (name: string, date: string, status: string, open: string) =>
        `As of the last check (${date}), ${name} reports “${status}” on its official status page. ${open}`,
      a1Open: (n: number, title: string) =>
        n === 1 ? `1 ongoing incident: ${title}.` : `${n} ongoing incidents, latest: ${title}.`,
      a1None: "No ongoing incident is published.",
      q2: (name: string) => `What is ${name}'s uptime over the last 90 days?`,
      a2: (name: string, pct: string, count: number) =>
        `${name} shows ${pct}% uptime over the last 90 days, across ${count} published incident(s).`,
      a2None: (name: string, site: string) =>
        `${name}'s history is still being built up on ${site}.`,
      q3: (name: string) => `How do I get notified automatically when ${name} goes down?`,
      a3: (name: string, site: string) =>
        `Create a free alert on ${site}: as soon as an incident is published on ${name}'s status page, you get an email (or a Slack/webhook notification on a paid plan).`,
    },
  },
  compare: {
    notFound: "Comparison not found",
    metaTitle: (a: string, b: string) => `${a} vs ${b}: which one goes down less often?`,
    metaDescription: (a: string, b: string) =>
      `${a} vs ${b} reliability: 90-day uptime, incident count and live status, measured from their official status pages.`,
    h1: (a: string, b: string) => `${a} vs ${b}: reliability compared`,
    lead: "Based purely on the incidents the providers themselves published on their official status pages over the last 90 days.",
    leadWinner: (name: string) => ` Over that period, ${name} shows the better uptime.`,
    leadTie: " Both services show equivalent uptime over the period.",
    kpiUptime: "90d uptime",
    kpiIncidents: "Incidents (90d)",
    kpiLast: "Last",
    readingTitle: "How to read this",
    reading: (a: string, sa: string, b: string, sb: string) =>
      `${a} currently reports “${sa}”, ${b} reports “${sb}”. A provider that publishes a lot of incidents is not necessarily less reliable — it is often the sign of an honest, granular status page. The number that matters is total downtime, shown above.`,
  },
  watch: {
    titleService: (name: string) => `Get alerted when ${name} goes down`,
    titleGeneric: "Get alerted when a provider goes down",
    titleOngoing: (name: string) => `Get told the moment ${name} is back up`,
    bodyOngoing:
      "Leave your email and we will message you as soon as the provider publishes the all-clear. No need to keep refreshing this page. Free, no credit card.",
    submitOngoing: "Tell me when it is fixed",
    body: "Free, 3 providers, no credit card. You get an email as soon as an incident is published on the official status page.",
    placeholder: "you@company.com",
    emailLabel: "Email address",
    submit: "Turn on the alert",
  },
  pricing: {
    metaTitle: "Pricing — monitor your providers from €0",
    metaDescription:
      "Free for 3 providers. Pro at €19/month for 50 providers, instant alerts, Slack and webhooks. Team at €49/month with SLA reports and API access.",
    h1: "One subscription, zero maintenance",
    lead: "One hour of an outage you did not see coming costs more than a year of this. No commitment, cancel in one click from the billing portal.",
    leadNoAccount:
      "No account to create before paying: it is created for you from your billing email.",
    mostChosen: "Most popular",
    freeCta: "Create a free account",
    upgradeCta: (plan: string) => `Upgrade to ${plan}`,
    faqTitle: "Frequently asked questions",
    faq: [
      [
        "Where does the data come from?",
        "Exclusively from the providers' public status pages (Statuspage, Atom or RSS). We never probe the services ourselves: we relay what the provider publishes, with no interpretation in between.",
      ],
      [
        "How fast is detection?",
        "Every status page is read every 5 minutes, and every 2 minutes once a service is already degraded. On paid plans the alert goes out immediately after that.",
      ],
      [
        "Do I need an account before paying?",
        "No. You go straight to Stripe; the account is created from your billing email and a sign-in link is sent to you right after. No password to remember, here or anywhere else.",
      ],
      [
        "Can I cancel any time?",
        "Yes. The Stripe billing portal is one click from your dashboard: cancel, switch plan, download invoices, update payment methods.",
      ],
      [
        "What happens if I hit the limit?",
        "Nothing breaks: the providers you already track keep being monitored. You simply cannot add more until you change plan.",
      ],
    ],
  },
  plans: {
    free: {
      name: "Free",
      priceLabel: "€0",
      features: ["3 providers monitored", "Email alerts (delayed by 15 min)", "90 days of incident history"],
    },
    pro: {
      name: "Pro",
      priceLabel: "€19/month",
      features: [
        "50 providers monitored",
        "Instant alerts (< 5 min after the provider)",
        "Unlimited Slack + webhooks",
        "Daily uptime digest",
        "Full history + export",
      ],
    },
    team: {
      name: "Team",
      priceLabel: "€49/month",
      features: [
        "Effectively unlimited providers (500)",
        "25 channels (per team, per service)",
        "Automatic monthly SLA reports",
        "Read API access",
        "Priority email support",
      ],
    },
  },
  login: {
    metaTitle: "Sign in",
    metaDescription: "Passwordless sign-in to your Upstream Status dashboard.",
    h1: "Sign in",
    lead: "No password to remember: we send you a sign-in link valid for 30 minutes.",
    sent: "Link sent. Check your inbox (and the spam folder, just in case).",
    expired: "That link has expired or has already been used. Request a new one.",
    invalidEmail: "Invalid email address.",
    emailLabel: "Email address",
    placeholder: "you@company.com",
    submit: "Send me a sign-in link",
  },
  welcome: {
    metaTitle: "Payment confirmed — your monitoring is live",
    metaDescription:
      "Your Upstream Status subscription is active. A sign-in link is on its way to your inbox.",
    pill: "Payment confirmed",
    h1: "Your monitoring is live",
    lead: "We just sent a sign-in link to the address you paid with. One click, no password to create.",
    nextTitle: "What happens now",
    next: [
      "Open the email titled “Your sign-in link” (check spam if you cannot find it).",
      "Pick the providers you want to watch from your dashboard.",
      "The moment an incident is published on their official status page, the alert goes out.",
    ],
    missingTitle: "Cannot find the email?",
    missingBody: "Request a new one with the same address: your subscription is already attached to it.",
    missingCta: "Send a new link",
  },
  legal: {
    metaTitle: "Legal notice and data handling",
    metaDescription: "Publisher, hosting, data sources and handling of personal data.",
    h1: "Legal & privacy",
    publisherTitle: "Site publisher",
    publisherRegistration: "Registration",
    publisherContact: "Contact",
    publisherMissing:
      "The publisher's details are not filled in yet. They will appear here as soon as the matching variables are set.",
    hostingTitle: "Hosting",
    hostingBody:
      "This site is hosted by Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, United States. Application data is hosted in the European Union (Supabase, Ireland region).",
    sourcesTitle: "Data sources",
    sourcesBody: (site: string) =>
      `${site} aggregates and republishes information from the public status pages of the providers listed, which are accessible without authentication and intended for public distribution. Every page names its official source and links to it. ${site} is not affiliated with any of these providers, and their trademarks remain the property of their respective owners.`,
    dataTitle: "Personal data",
    dataBody:
      "The only data collected is the email address needed to send alerts, the list of providers you watch, and the billing identifiers held by Stripe. Nothing is resold, there are no advertising trackers, and no cookie other than the session cookie. Account and data deletion on request by email.",
    liabilityTitle: "Limitation of liability",
    liabilityBody: (site: string) =>
      `The service is provided “as is”. Alerts depend on the providers publishing their own incidents: ${site} cannot guarantee detection of an outage that was never published on the official status page.`,
  },
  notFound: {
    h1: "Page not found",
    lead: "This provider is not monitored by Upstream Status (yet), or the address is wrong.",
    ctaProviders: "See all providers",
    ctaHome: "Home",
  },
  email: {
    magicSubject: (site: string) => `Your ${site} sign-in link`,
    magicTitle: "Sign in with one click",
    magicBody: "This link is valid for 30 minutes and works only once.",
    magicCta: "Open my dashboard",
    magicFooter: "If you did not request this link, ignore this email.",
    magicText: (site: string, url: string) =>
      `${site} sign-in: ${url}\n(valid for 30 minutes, single use)`,
    welcomeSubjectService: (name: string) => `Monitoring for ${name} is on`,
    welcomeSubject: (site: string) => `Your ${site} monitoring is live`,
    welcomeTitleService: (name: string) => `You will hear about it the moment ${name} goes down`,
    welcomeTitle: "Monitoring is live",
    welcomeBody1:
      "We read your providers' official status pages every 5 minutes. The moment an incident is published, the alert reaches you — with nothing to open or check.",
    welcomeBody2:
      "<strong>Add the rest of your stack</strong>: the outage that costs you is rarely the one you were already watching.",
    welcomeCta: "Add my providers",
    welcomeText: (url: string) => `Monitoring is live. Add your providers: ${url}`,
    incidentVerb: { opened: "ongoing", updated: "updated", resolved: "resolved" },
    incidentSubject: (icon: string, name: string, verb: string, title: string) =>
      `${icon} ${name} — incident ${verb}: ${title}`,
    incidentMeta: (impact: string, state: string, started: string) =>
      `<strong>Impact:</strong> ${impact} &nbsp;·&nbsp; <strong>State:</strong> ${state} &nbsp;·&nbsp; <strong>Started:</strong> ${started}`,
    incidentCta: "See the incident",
    incidentHistory: (name: string) => `Full history for ${name}`,
    limitSubject: "You have reached the Free plan limit",
    limitTitle: (count: number) => `${count} providers watched — the Free limit is 3`,
    limitBody:
      "Upgrade to Pro to watch up to 50 providers, get alerts <strong>without the 15-minute delay</strong>, and route them to Slack or a webhook.",
    limitCta: "Upgrade to Pro — €19/month",
    limitText: (url: string) => `Free limit reached. Upgrade to Pro: ${url}`,
    digestSubject: (date: string) => `Your stack's uptime — ${date}`,
    digestTitle: (date: string) => `Summary for ${date}`,
    digestCta: "Open the dashboard",
    dunningSubject: "Payment failed — your instant alerts are at risk",
    dunningBody:
      "The charge for your subscription failed. Update your payment method to keep instant alerts running.",
    dunningCta: "Update payment method",
    footerNote: (site: string) =>
      `You are receiving this because you monitor providers on ${site}.`,
    manageLink: "Manage my alerts",
  },
  errors: {
    unknownPlan: "Unknown plan.",
    paymentUnavailable: "Payment is temporarily unavailable. Please try again in a moment.",
    portalUnavailable: "The billing portal is temporarily unavailable.",
    missingProvider: "No provider selected.",
    planLimit: (plan: string, max: number) => `You have reached the ${plan} plan limit (${max}).`,
    unknownChannel: "Unknown channel.",
    channelNeedsPaid: (kind: string) => `The ${kind} channel requires a paid plan.`,
    invalidEmail: "Invalid email address.",
    invalidUrl: "Invalid URL.",
    httpsOnly: "Only HTTPS URLs are accepted.",
    internalAddress: "Internal address refused.",
    channelLimit: (max: number, plan: string) =>
      `You have reached the ${max}-channel limit on the ${plan} plan.`,
    generic: "Something went wrong, please try again in a moment.",
  },
  dashboard: {
    metaTitle: "Dashboard",
    h1: "Dashboard",
    logout: "Sign out",
    upgraded: "Payment confirmed. Your plan is active — alerts now go out with no delay.",
    saved: "Change saved.",
    currentPlan: "Current plan",
    planSummary: (used: number, max: number, delay: string) => `${used}/${max} providers · ${delay}`,
    delayed: (min: number) => `alerts delayed by ${min} min`,
    instant: "instant alerts",
    renewal: (ends: boolean, date: string) => ` · ${ends ? "ends" : "renews"} on ${date}`,
    manageBilling: "Manage billing",
    upgradeCta: "Upgrade to Pro",
    pastDue:
      "Your last payment failed. Update your payment method to keep instant alerts running.",
    channelsTitle: "Alert channels",
    disabled: "disabled",
    remove: "Remove",
    noChannels: "No channel configured.",
    channelKind: "Channel type",
    channelTarget: "email or webhook URL",
    destination: "Destination",
    add: "Add",
    paidChannels: "Slack and webhook channels require a paid plan.",
    watchedTitle: "Monitored providers",
    lastIncident: "Last incident:",
    unwatch: "Stop watching",
    noWatched: "No provider monitored yet.",
    addProvider: "Add a provider",
    threshold: "Alert threshold",
    thresholdAll: "All incidents",
    thresholdMajor: "Major and critical",
    thresholdCritical: "Critical only",
    watchCta: "Watch",
    limitReached: (plan: string) => `You have reached the ${plan} plan limit.`,
    limitCta: "Move up a plan",
    limitSuffix: " to add more.",
    alertsTitle: "Latest alerts sent",
    noAlerts: "No alert yet — which is rather good news.",
  },
};

export const DICT = { fr, en } as const;
export type Dict = typeof fr;

export function dict(locale: Locale): Dict {
  return DICT[locale] ?? DICT[DEFAULT_LOCALE];
}

/** Normalise une valeur arbitraire (paramètre, colonne, en-tête) en locale. */
export function asLocale(value: string | null | undefined): Locale {
  const v = (value ?? "").trim().toLowerCase().slice(0, 2);
  return (LOCALES as readonly string[]).includes(v) ? (v as Locale) : DEFAULT_LOCALE;
}

/**
 * Locale déduite d'un chemin. Sert aux routes d'API, qui reçoivent un
 * formulaire posté depuis l'une ou l'autre version du site et doivent renvoyer
 * le visiteur dans sa langue.
 */
export function localeFromPath(path: string | null | undefined): Locale {
  return /^\/en(\/|$)/.test(path ?? "") ? "en" : "fr";
}
