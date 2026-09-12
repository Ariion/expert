/**
 * Catalogue de départ — chaque ligne devient une page indexable.
 *
 * Format compact : [slug, nom, catégorie, hôte de la status page, domaine du
 * logo, description]. Le flux est déduit de l'hôte pour les status pages
 * Statuspage.io (~80 % du marché B2B) ; les exceptions sont listées plus bas
 * avec leur flux RSS/Atom.
 *
 * AJOUTER UN FOURNISSEUR = AJOUTER UNE LIGNE. Le reste (page, sitemap,
 * ingestion, alertes) suit automatiquement, sans redéploiement.
 */
export type FeedKind = "statuspage_v2" | "atom" | "rss";

export interface SeedService {
  slug: string;
  name: string;
  category: string;
  description: string;
  homepage: string;
  status_page_url: string;
  feed_url: string;
  feed_kind: FeedKind;
  logo_domain: string;
}

type Row = [slug: string, name: string, category: string, statusHost: string, domain: string, description: string];

const STATUSPAGE: Row[] = [
  // --- Cloud & infrastructure ---------------------------------------------
  ["cloudflare", "Cloudflare", "cloud", "www.cloudflarestatus.com", "cloudflare.com", "CDN, DNS et protection DDoS utilisés par une large part du web."],
  ["digitalocean", "DigitalOcean", "cloud", "status.digitalocean.com", "digitalocean.com", "Hébergement cloud, droplets et bases managées."],
  ["fastly", "Fastly", "cloud", "status.fastly.com", "fastly.com", "CDN et edge computing."],
  ["vercel", "Vercel", "cloud", "www.vercel-status.com", "vercel.com", "Hébergement frontend et fonctions serverless."],
  ["netlify", "Netlify", "cloud", "www.netlifystatus.com", "netlify.com", "Hébergement Jamstack et fonctions edge."],
  ["render", "Render", "cloud", "status.render.com", "render.com", "PaaS pour applications web et services managés."],
  ["fly-io", "Fly.io", "cloud", "status.flyio.net", "fly.io", "Déploiement d'applications au plus près des utilisateurs."],
  ["railway", "Railway", "cloud", "status.railway.app", "railway.app", "Plateforme de déploiement applicatif."],

  // --- Données & bases -----------------------------------------------------
  ["supabase", "Supabase", "donnees", "status.supabase.com", "supabase.com", "Postgres managé, auth et stockage."],
  ["mongodb-atlas", "MongoDB Atlas", "donnees", "status.mongodb.com", "mongodb.com", "Base de données documentaire managée."],
  ["planetscale", "PlanetScale", "donnees", "status.planetscale.com", "planetscale.com", "MySQL serverless."],
  ["neon", "Neon", "donnees", "status.neon.tech", "neon.tech", "Postgres serverless avec branches."],
  ["redis-cloud", "Redis Cloud", "donnees", "status.redis.io", "redis.io", "Cache et base clé-valeur managée."],
  ["snowflake", "Snowflake", "donnees", "status.snowflake.com", "snowflake.com", "Entrepôt de données cloud."],
  ["databricks", "Databricks", "donnees", "status.databricks.com", "databricks.com", "Plateforme data et IA."],
  ["elastic-cloud", "Elastic Cloud", "donnees", "status.elastic.co", "elastic.co", "Recherche et observabilité managées."],
  ["algolia", "Algolia", "donnees", "status.algolia.com", "algolia.com", "Moteur de recherche hébergé."],

  // --- Paiement ------------------------------------------------------------
  ["adyen", "Adyen", "paiement", "status.adyen.com", "adyen.com", "Plateforme de paiement omnicanal."],
  ["braintree", "Braintree", "paiement", "status.braintreepayments.com", "braintreepayments.com", "Passerelle de paiement PayPal."],
  ["plaid", "Plaid", "paiement", "status.plaid.com", "plaid.com", "Agrégation bancaire et open banking."],
  ["coinbase", "Coinbase", "paiement", "status.coinbase.com", "coinbase.com", "Plateforme d'échange de cryptoactifs."],

  // --- Communication & support --------------------------------------------
  ["zoom", "Zoom", "communication", "status.zoom.us", "zoom.us", "Visioconférence et webinaires."],
  ["discord", "Discord", "communication", "discordstatus.com", "discord.com", "Messagerie communautaire temps réel."],
  ["intercom", "Intercom", "support", "status.intercom.com", "intercom.com", "Messagerie client et support."],
  ["zendesk", "Zendesk", "support", "status.zendesk.com", "zendesk.com", "Helpdesk et ticketing."],
  ["front", "Front", "support", "status.frontapp.com", "frontapp.com", "Boîte de réception partagée."],
  ["help-scout", "Help Scout", "support", "status.helpscout.com", "helpscout.com", "Support client par email."],

  // --- Email & messagerie transactionnelle ---------------------------------
  ["twilio", "Twilio", "email", "status.twilio.com", "twilio.com", "SMS, voix et messagerie programmable."],
  ["sendgrid", "SendGrid", "email", "status.sendgrid.com", "sendgrid.com", "Email transactionnel et marketing."],
  ["postmark", "Postmark", "email", "status.postmarkapp.com", "postmarkapp.com", "Email transactionnel à forte délivrabilité."],
  ["mailchimp", "Mailchimp", "email", "status.mailchimp.com", "mailchimp.com", "Emailing et automatisation marketing."],
  ["klaviyo", "Klaviyo", "marketing", "status.klaviyo.com", "klaviyo.com", "Marketing automation e-commerce."],

  // --- Développement & CI --------------------------------------------------
  ["github", "GitHub", "developpement", "www.githubstatus.com", "github.com", "Hébergement de code, CI et registre de paquets."],
  ["bitbucket", "Bitbucket", "developpement", "bitbucket.status.atlassian.com", "bitbucket.org", "Hébergement Git d'Atlassian."],
  ["circleci", "CircleCI", "developpement", "status.circleci.com", "circleci.com", "Intégration et déploiement continus."],
  ["npm", "npm", "developpement", "status.npmjs.org", "npmjs.com", "Registre de paquets JavaScript."],
  ["jira", "Jira Software", "productivite", "jira-software.status.atlassian.com", "atlassian.com", "Suivi de tickets et gestion de projet."],
  ["confluence", "Confluence", "productivite", "confluence.status.atlassian.com", "atlassian.com", "Base de connaissances d'équipe."],
  ["trello", "Trello", "productivite", "trello.status.atlassian.com", "trello.com", "Gestion de tâches en kanban."],

  // --- Observabilité & sécurité -------------------------------------------
  ["datadog", "Datadog", "observabilite", "status.datadoghq.com", "datadoghq.com", "Monitoring d'infrastructure et APM."],
  ["sentry", "Sentry", "observabilite", "status.sentry.io", "sentry.io", "Suivi des erreurs applicatives."],
  ["new-relic", "New Relic", "observabilite", "status.newrelic.com", "newrelic.com", "Observabilité full-stack."],
  ["grafana-cloud", "Grafana Cloud", "observabilite", "status.grafana.com", "grafana.com", "Métriques, logs et dashboards managés."],
  ["pagerduty", "PagerDuty", "observabilite", "status.pagerduty.com", "pagerduty.com", "Astreinte et gestion d'incidents."],
  ["okta", "Okta", "securite", "status.okta.com", "okta.com", "Gestion d'identité et SSO d'entreprise."],

  // --- Productivité & collaboration ---------------------------------------
  ["notion", "Notion", "productivite", "status.notion.so", "notion.so", "Documentation et bases de connaissances."],
  ["figma", "Figma", "productivite", "status.figma.com", "figma.com", "Design collaboratif."],
  ["linear", "Linear", "productivite", "status.linear.app", "linear.app", "Suivi de tickets pour équipes produit."],
  ["airtable", "Airtable", "productivite", "status.airtable.com", "airtable.com", "Base de données collaborative."],
  ["miro", "Miro", "productivite", "status.miro.com", "miro.com", "Tableau blanc collaboratif."],
  ["dropbox", "Dropbox", "productivite", "status.dropbox.com", "dropbox.com", "Stockage et partage de fichiers."],
  ["box", "Box", "productivite", "status.box.com", "box.com", "Gestion documentaire d'entreprise."],
  ["calendly", "Calendly", "productivite", "status.calendly.com", "calendly.com", "Prise de rendez-vous automatisée."],
  ["loom", "Loom", "productivite", "status.loom.com", "loom.com", "Messages vidéo asynchrones."],
  ["typeform", "Typeform", "productivite", "status.typeform.com", "typeform.com", "Formulaires et enquêtes en ligne."],

  // --- E-commerce, marketing, no-code --------------------------------------
  ["shopify", "Shopify", "ecommerce", "www.shopifystatus.com", "shopify.com", "Plateforme e-commerce hébergée."],
  ["hubspot", "HubSpot", "marketing", "status.hubspot.com", "hubspot.com", "CRM et automatisation marketing."],
  ["segment", "Segment", "marketing", "status.segment.com", "segment.com", "Collecte et routage de données clients."],
  ["cloudinary", "Cloudinary", "marketing", "status.cloudinary.com", "cloudinary.com", "Gestion et transformation des médias."],
  ["webflow", "Webflow", "no-code", "status.webflow.com", "webflow.com", "Création de sites sans code."],
  ["zapier", "Zapier", "no-code", "status.zapier.com", "zapier.com", "Automatisation entre applications."],
  ["make", "Make", "no-code", "status.make.com", "make.com", "Scénarios d'automatisation visuels."],

  // --- IA ------------------------------------------------------------------
  ["openai", "OpenAI", "ia", "status.openai.com", "openai.com", "API de modèles de langage et d'images."],
  ["anthropic", "Anthropic", "ia", "status.anthropic.com", "anthropic.com", "API Claude et services associés."],
];

/** Fournisseurs hors Statuspage : flux RSS/Atom officiels. */
const FEEDS: Array<SeedService> = [
  {
    slug: "aws",
    name: "Amazon Web Services",
    category: "cloud",
    description: "EC2, S3, RDS, Lambda : le socle d'une grande partie d'Internet.",
    homepage: "https://aws.amazon.com",
    status_page_url: "https://health.aws.amazon.com/health/status",
    feed_url: "https://status.aws.amazon.com/rss/all.rss",
    feed_kind: "rss",
    logo_domain: "aws.amazon.com",
  },
  {
    slug: "google-cloud",
    name: "Google Cloud",
    category: "cloud",
    description: "Compute Engine, BigQuery, GKE et services managés Google.",
    homepage: "https://cloud.google.com",
    status_page_url: "https://status.cloud.google.com",
    feed_url: "https://status.cloud.google.com/en/feed.atom",
    feed_kind: "atom",
    logo_domain: "cloud.google.com",
  },
  {
    slug: "microsoft-azure",
    name: "Microsoft Azure",
    category: "cloud",
    description: "Machines virtuelles, App Service, Azure SQL et services Microsoft.",
    homepage: "https://azure.microsoft.com",
    status_page_url: "https://azure.status.microsoft/en-us/status",
    feed_url: "https://azurestatuscdn.azureedge.net/en-us/status/feed/",
    feed_kind: "rss",
    logo_domain: "azure.microsoft.com",
  },
  {
    slug: "slack",
    name: "Slack",
    category: "communication",
    description: "Messagerie d'équipe et intégrations.",
    homepage: "https://slack.com",
    status_page_url: "https://slack-status.com",
    feed_url: "https://slack-status.com/feed/rss",
    feed_kind: "rss",
    logo_domain: "slack.com",
  },
  {
    slug: "stripe",
    name: "Stripe",
    category: "paiement",
    description: "Paiements en ligne, abonnements et facturation.",
    homepage: "https://stripe.com",
    status_page_url: "https://status.stripe.com",
    feed_url: "https://www.stripestatus.com/history.rss",
    feed_kind: "rss",
    logo_domain: "stripe.com",
  },
  {
    slug: "heroku",
    name: "Heroku",
    category: "cloud",
    description: "PaaS historique pour applications web.",
    homepage: "https://www.heroku.com",
    status_page_url: "https://status.heroku.com",
    feed_url: "https://status.heroku.com/feed",
    feed_kind: "rss",
    logo_domain: "heroku.com",
  },
  {
    slug: "auth0",
    name: "Auth0",
    category: "securite",
    description: "Authentification et gestion d'identité as-a-service.",
    homepage: "https://auth0.com",
    status_page_url: "https://status.auth0.com",
    feed_url: "https://status.auth0.com/feed?domain=auth0.com",
    feed_kind: "rss",
    logo_domain: "auth0.com",
  },
];

export const SEED_SERVICES: SeedService[] = [
  ...STATUSPAGE.map(([slug, name, category, host, domain, description]) => ({
    slug,
    name,
    category,
    description,
    homepage: `https://${domain}`,
    status_page_url: `https://${host}`,
    feed_url: `https://${host}/api/v2/summary.json`,
    feed_kind: "statuspage_v2" as const,
    logo_domain: domain,
  })),
  ...FEEDS,
];
