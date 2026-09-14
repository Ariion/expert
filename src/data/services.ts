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
  /** Adresses à essayer si l'adresse principale ne répond plus. */
  alt_feeds?: string[];
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

  // --- Cloud & infrastructure (suite) -------------------------------------
  ["ovhcloud", "OVHcloud", "cloud", "status.ovhcloud.com", "ovhcloud.com", "Hébergeur européen : serveurs, cloud public et domaines."],
  ["scaleway", "Scaleway", "cloud", "status.scaleway.com", "scaleway.com", "Cloud français : instances, stockage objet et Kubernetes."],
  ["clever-cloud", "Clever Cloud", "cloud", "status.clever-cloud.com", "clever-cloud.com", "PaaS français pour applications et bases managées."],
  ["linode", "Akamai Linode", "cloud", "status.linode.com", "linode.com", "Serveurs virtuels et stockage."],
  ["vultr", "Vultr", "cloud", "status.vultr.com", "vultr.com", "Instances cloud et bare metal."],
  ["hetzner", "Hetzner", "cloud", "status.hetzner.com", "hetzner.com", "Serveurs dédiés et cloud à bas coût."],
  ["bunny-net", "Bunny.net", "cloud", "status.bunny.net", "bunny.net", "CDN, stockage et streaming vidéo."],
  ["deno-deploy", "Deno Deploy", "cloud", "status.deno.com", "deno.com", "Exécution JavaScript à la périphérie."],
  ["koyeb", "Koyeb", "cloud", "status.koyeb.com", "koyeb.com", "Plateforme serverless européenne."],
  ["upcloud", "UpCloud", "cloud", "status.upcloud.com", "upcloud.com", "Serveurs cloud à stockage rapide."],

  // --- Données -------------------------------------------------------------
  ["mongodb-cloud", "MongoDB Cloud", "donnees", "status.cloud.mongodb.com", "mongodb.com", "Services cloud MongoDB."],
  ["cockroachdb", "CockroachDB Cloud", "donnees", "status.cockroachlabs.cloud", "cockroachlabs.com", "Base SQL distribuée managée."],
  ["clickhouse", "ClickHouse Cloud", "donnees", "status.clickhouse.com", "clickhouse.com", "Entrepôt analytique en colonnes."],
  ["fivetran", "Fivetran", "donnees", "status.fivetran.com", "fivetran.com", "Pipelines de données managés."],
  ["dbt-cloud", "dbt Cloud", "donnees", "status.getdbt.com", "getdbt.com", "Transformation de données analytiques."],
  ["meilisearch", "Meilisearch Cloud", "donnees", "status.meilisearch.com", "meilisearch.com", "Moteur de recherche français hébergé."],
  ["typesense", "Typesense Cloud", "donnees", "status.typesense.org", "typesense.org", "Moteur de recherche open source hébergé."],

  // --- Paiement et finance -------------------------------------------------
  ["mollie", "Mollie", "paiement", "status.mollie.com", "mollie.com", "Paiements en ligne européens."],
  ["gocardless", "GoCardless", "paiement", "status.gocardless.com", "gocardless.com", "Prélèvements SEPA et récurrents."],
  ["checkout-com", "Checkout.com", "paiement", "status.checkout.com", "checkout.com", "Passerelle de paiement internationale."],
  ["paddle", "Paddle", "paiement", "status.paddle.com", "paddle.com", "Vendeur de référence pour éditeurs de logiciels."],
  ["square", "Square", "paiement", "status.squareup.com", "squareup.com", "Encaissement en ligne et en boutique."],
  ["wise", "Wise", "paiement", "status.wise.com", "wise.com", "Transferts et comptes multidevises."],
  ["qonto", "Qonto", "paiement", "status.qonto.com", "qonto.com", "Compte professionnel français."],
  ["revolut-business", "Revolut Business", "paiement", "status.revolut.com", "revolut.com", "Compte professionnel et cartes."],

  // --- Développement -------------------------------------------------------
  ["gitlab", "GitLab", "developpement", "status.gitlab.com", "gitlab.com", "Hébergement Git, CI/CD et registre."],
  ["docker-hub", "Docker Hub", "developpement", "status.docker.com", "docker.com", "Registre d'images de conteneurs."],
  ["hashicorp", "HashiCorp Cloud", "developpement", "status.hashicorp.com", "hashicorp.com", "Terraform Cloud, Vault et Consul."],
  ["sonarcloud", "SonarCloud", "developpement", "status.sonarsource.com", "sonarsource.com", "Analyse de qualité de code."],
  ["codecov", "Codecov", "developpement", "status.codecov.io", "codecov.io", "Couverture de tests."],
  ["pypi", "PyPI", "developpement", "status.python.org", "pypi.org", "Registre de paquets Python."],
  ["jfrog", "JFrog", "developpement", "status.jfrog.io", "jfrog.com", "Gestion d'artefacts logiciels."],

  // --- Communication et support -------------------------------------------
  ["vonage", "Vonage", "communication", "status.vonage.com", "vonage.com", "API voix, SMS et vidéo."],
  ["ringcentral", "RingCentral", "communication", "status.ringcentral.com", "ringcentral.com", "Téléphonie et visioconférence d'entreprise."],
  ["crisp", "Crisp", "support", "status.crisp.chat", "crisp.chat", "Messagerie client française."],
  ["freshworks", "Freshworks", "support", "status.freshworks.com", "freshworks.com", "Helpdesk et CRM."],
  ["pipedrive", "Pipedrive", "support", "status.pipedrive.com", "pipedrive.com", "CRM commercial."],

  // --- Email ---------------------------------------------------------------
  ["mailgun", "Mailgun", "email", "status.mailgun.com", "mailgun.com", "API d'envoi d'emails transactionnels."],
  ["brevo", "Brevo", "email", "status.brevo.com", "brevo.com", "Emailing et automatisation, éditeur français."],
  ["mailjet", "Mailjet", "email", "status.mailjet.com", "mailjet.com", "Emailing transactionnel et marketing français."],
  ["resend", "Resend", "email", "status.resend.com", "resend.com", "API d'envoi d'emails pour développeurs."],
  ["customer-io", "Customer.io", "email", "status.customer.io", "customer.io", "Messagerie comportementale."],

  // --- Observabilité -------------------------------------------------------
  ["betterstack", "Better Stack", "observabilite", "status.betterstack.com", "betterstack.com", "Surveillance de disponibilité et logs."],
  ["logrocket", "LogRocket", "observabilite", "status.logrocket.com", "logrocket.com", "Rejeu de sessions et suivi d'erreurs."],
  ["honeycomb", "Honeycomb", "observabilite", "status.honeycomb.io", "honeycomb.io", "Observabilité de systèmes distribués."],
  ["opsgenie", "Opsgenie", "observabilite", "opsgenie.status.atlassian.com", "atlassian.com", "Astreinte et alerting."],

  // --- Sécurité et identité ------------------------------------------------
  ["clerk", "Clerk", "securite", "status.clerk.com", "clerk.com", "Authentification et gestion d'utilisateurs."],
  ["workos", "WorkOS", "securite", "status.workos.com", "workos.com", "SSO et annuaire pour applications B2B."],
  ["1password", "1Password", "securite", "status.1password.com", "1password.com", "Gestionnaire de mots de passe d'équipe."],
  ["bitwarden", "Bitwarden", "securite", "status.bitwarden.com", "bitwarden.com", "Gestionnaire de mots de passe open source."],
  ["dashlane", "Dashlane", "securite", "status.dashlane.com", "dashlane.com", "Gestionnaire de mots de passe français."],
  ["cloudflare-zero-trust", "Cloudflare Zero Trust", "securite", "www.cloudflarestatus.com", "cloudflare.com", "Accès réseau sans confiance implicite."],

  // --- Productivité --------------------------------------------------------
  ["monday", "monday.com", "productivite", "status.monday.com", "monday.com", "Gestion de projet visuelle."],
  ["clickup", "ClickUp", "productivite", "status.clickup.com", "clickup.com", "Gestion de tâches et de documents."],
  ["asana", "Asana", "productivite", "status.asana.com", "asana.com", "Gestion de projet d'équipe."],
  ["canva", "Canva", "productivite", "status.canva.com", "canva.com", "Création graphique en ligne."],
  ["cal-com", "Cal.com", "productivite", "status.cal.com", "cal.com", "Prise de rendez-vous open source."],
  ["framer", "Framer", "productivite", "status.framer.com", "framer.com", "Création de sites pour designers."],
  ["webflow-status", "Webflow Cloud", "productivite", "status.webflow.com", "webflow.com", "Hébergement des sites Webflow."],

  // --- Ressources humaines et finance (France) -----------------------------
  ["payfit", "PayFit", "productivite", "status.payfit.com", "payfit.com", "Paie et RH, éditeur français."],
  ["pennylane", "Pennylane", "productivite", "status.pennylane.com", "pennylane.com", "Comptabilité et pilotage financier français."],
  ["spendesk", "Spendesk", "paiement", "status.spendesk.com", "spendesk.com", "Gestion des dépenses professionnelles."],
  ["lucca", "Lucca", "productivite", "status.lucca.fr", "lucca.fr", "Logiciels RH français."],

  // --- IA ------------------------------------------------------------------
  ["mistral-ai", "Mistral AI", "ia", "status.mistral.ai", "mistral.ai", "Modèles de langage européens."],
  ["hugging-face", "Hugging Face", "ia", "status.huggingface.co", "huggingface.co", "Modèles, jeux de données et inférence."],
  ["replicate", "Replicate", "ia", "status.replicate.com", "replicate.com", "Exécution de modèles à la demande."],
  ["elevenlabs", "ElevenLabs", "ia", "status.elevenlabs.io", "elevenlabs.io", "Synthèse vocale."],
  ["pinecone", "Pinecone", "ia", "status.pinecone.io", "pinecone.io", "Base vectorielle managée."],
  ["groq", "Groq", "ia", "status.groq.com", "groq.com", "Inférence de modèles à très faible latence."],

  // --- E-commerce et marketing --------------------------------------------
  ["bigcommerce", "BigCommerce", "ecommerce", "status.bigcommerce.com", "bigcommerce.com", "Plateforme e-commerce hébergée."],
  ["lemonsqueezy", "Lemon Squeezy", "ecommerce", "status.lemonsqueezy.com", "lemonsqueezy.com", "Vente de produits numériques, vendeur de référence."],
  ["imgix", "imgix", "marketing", "status.imgix.com", "imgix.com", "Traitement et diffusion d'images."],
  ["amplitude", "Amplitude", "marketing", "status.amplitude.com", "amplitude.com", "Analyse de produit."],
  ["posthog", "PostHog", "marketing", "status.posthog.com", "posthog.com", "Analyse de produit open source."],

  // --- Jeux vidéo et divertissement -----------------------------------------
  // Statuspage.io confirmé pour ces deux-là ; les autres (Riot, PlayStation,
  // Xbox, Meta) sont dans EXPLICIT_FEEDS plus bas, avec leur propre format.
  ["epic-games", "Epic Games", "jeux", "status.epicgames.com", "epicgames.com", "Fortnite, Epic Games Store et services en ligne."],
  ["twitch", "Twitch", "jeux", "status.twitch.tv", "twitch.tv", "Diffusion de jeux vidéo en direct."],

  // --- Grand public et réseaux sociaux --------------------------------------
  ["reddit", "Reddit", "communication", "www.redditstatus.com", "reddit.com", "Forums et communautés en ligne."],

  // --- Observabilité et erreurs (suite) -------------------------------------
  ["rollbar", "Rollbar", "observabilite", "status.rollbar.com", "rollbar.com", "Suivi d'erreurs en temps réel."],
  ["bugsnag", "Bugsnag", "observabilite", "status.bugsnag.com", "bugsnag.com", "Surveillance de la stabilité applicative."],
  ["airbrake", "Airbrake", "observabilite", "status.airbrake.io", "airbrake.io", "Suivi d'erreurs et de performance."],
  ["honeybadger", "Honeybadger", "observabilite", "status.honeybadger.io", "honeybadger.io", "Suivi d'erreurs pour applications web."],
  ["checkly", "Checkly", "observabilite", "status.checklyhq.com", "checklyhq.com", "Surveillance synthétique et de performance."],
  ["site24x7", "Site24x7", "observabilite", "status.site24x7.com", "site24x7.com", "Surveillance d'infrastructure et d'applications."],
  ["statuscake", "StatusCake", "observabilite", "status.statuscake.com", "statuscake.com", "Surveillance de disponibilité de sites."],
  ["uptimerobot", "UptimeRobot", "observabilite", "status.uptimerobot.com", "uptimerobot.com", "Surveillance de disponibilité de sites."],
  ["instatus", "Instatus", "observabilite", "status.instatus.com", "instatus.com", "Pages de statut hébergées."],

  // --- Développement et CI/CD (suite) ---------------------------------------
  ["travis-ci", "Travis CI", "developpement", "www.traviscistatus.com", "travis-ci.com", "Intégration continue historique."],
  ["buildkite", "Buildkite", "developpement", "www.buildkitestatus.com", "buildkite.com", "Plateforme de CI/CD auto-hébergée."],
  ["postman", "Postman", "developpement", "status.postman.com", "postman.com", "Test et documentation d'API."],
  ["launchdarkly", "LaunchDarkly", "developpement", "status.launchdarkly.com", "launchdarkly.com", "Feature flags et déploiement progressif."],
  ["split-io", "Split", "developpement", "status.split.io", "split.io", "Feature flags et tests A/B."],
  ["unbounce", "Unbounce", "marketing", "status.unbounce.com", "unbounce.com", "Création de pages d'atterrissage."],

  // --- Contenu et CMS ---------------------------------------------------------
  ["contentful", "Contentful", "productivite", "status.contentful.com", "contentful.com", "CMS headless pour équipes produit."],
  ["sanity", "Sanity", "productivite", "status.sanity.io", "sanity.io", "CMS headless structuré."],
  ["prismic", "Prismic", "productivite", "status.prismic.io", "prismic.io", "CMS headless pour sites marketing."],
  ["storyblok", "Storyblok", "productivite", "status.storyblok.com", "storyblok.com", "CMS headless visuel."],
  ["datocms", "DatoCMS", "productivite", "status.datocms.com", "datocms.com", "CMS headless orienté performance."],
  ["webflow-cms", "Webflow", "no-code", "status.webflow.com", "webflow.com", "Création de sites sans code."],

  // --- Analyse produit et expérience utilisateur ------------------------------
  ["mixpanel", "Mixpanel", "marketing", "status.mixpanel.com", "mixpanel.com", "Analyse d'événements produit."],
  ["heap", "Heap", "marketing", "status.heap.io", "heap.io", "Analyse comportementale automatique."],
  ["fullstory", "FullStory", "marketing", "status.fullstory.com", "fullstory.com", "Rejeu de sessions et analyse d'expérience."],
  ["hotjar", "Hotjar", "marketing", "status.hotjar.com", "hotjar.com", "Cartes de chaleur et retours utilisateurs."],
  ["optimizely", "Optimizely", "marketing", "status.optimizely.com", "optimizely.com", "Tests A/B et personnalisation."],
  ["drift", "Drift", "support", "status.drift.com", "drift.com", "Messagerie commerciale conversationnelle."],
  ["livechat", "LiveChat", "support", "status.livechat.com", "livechat.com", "Messagerie client en direct."],

  // --- Paiement et finance (suite) --------------------------------------------
  ["klarna", "Klarna", "paiement", "status.klarna.com", "klarna.com", "Paiement fractionné et achat différé."],

  // --- Identité et accès (suite) -----------------------------------------------
  ["duo-security", "Duo Security", "securite", "status.duo.com", "duo.com", "Authentification multifacteur d'entreprise."],
  ["onelogin", "OneLogin", "securite", "status.onelogin.com", "onelogin.com", "Gestion d'identité et SSO."],
  ["jumpcloud", "JumpCloud", "securite", "status.jumpcloud.com", "jumpcloud.com", "Répertoire d'identité cloud."],

  // --- E-commerce (suite) -------------------------------------------------------
  ["squarespace", "Squarespace", "ecommerce", "status.squarespace.com", "squarespace.com", "Création de sites et boutiques en ligne."],
  ["recharge", "Recharge", "ecommerce", "status.rechargepayments.com", "rechargepayments.com", "Abonnements pour boutiques e-commerce."],
  ["gorgias", "Gorgias", "support", "status.gorgias.com", "gorgias.com", "Support client pour e-commerce."],
];

/** Fournisseurs hors Statuspage : flux RSS/Atom officiels. */
const FEEDS: Array<Omit<SeedService, "alt_feeds">> = [
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

  // --- Jeux vidéo et divertissement (suite) --------------------------------
  // Aucun de ces quatre n'est sur Statuspage : `feed_url` pointe volontairement
  // sur la page humaine plutôt que sur un flux deviné. La découverte
  // automatique (src/lib/discover.ts) la lit dès la première tentative
  // échouée et en extrait la vraie adresse de flux déclarée par la page —
  // c'est plus fiable que de deviner un chemin RSS à l'aveugle.
  {
    slug: "league-of-legends",
    name: "League of Legends",
    category: "jeux",
    description: "Statut des serveurs de jeu Riot Games pour League of Legends.",
    homepage: "https://www.leagueoflegends.com",
    status_page_url: "https://status.riotgames.com/lol?region=na",
    feed_url: "https://status.riotgames.com/lol?region=na",
    feed_kind: "rss",
    logo_domain: "leagueoflegends.com",
  },
  {
    slug: "valorant",
    name: "Valorant",
    category: "jeux",
    description: "Statut des serveurs de jeu Riot Games pour Valorant.",
    homepage: "https://playvalorant.com",
    status_page_url: "https://status.riotgames.com/valorant?region=na",
    feed_url: "https://status.riotgames.com/valorant?region=na",
    feed_kind: "rss",
    logo_domain: "playvalorant.com",
  },
  {
    slug: "playstation-network",
    name: "PlayStation Network",
    category: "jeux",
    description: "Connexion, boutique et jeu en ligne sur PlayStation.",
    homepage: "https://www.playstation.com",
    status_page_url: "https://status.playstation.com/en-us/",
    feed_url: "https://status.playstation.com/en-us/",
    feed_kind: "rss",
    logo_domain: "playstation.com",
  },
  {
    slug: "xbox-live",
    name: "Xbox Live",
    category: "jeux",
    description: "Connexion, boutique et jeu en ligne sur Xbox.",
    homepage: "https://www.xbox.com",
    status_page_url: "https://support.xbox.com/en-US/xbox-live-status",
    feed_url: "https://support.xbox.com/en-US/xbox-live-status",
    feed_kind: "rss",
    logo_domain: "xbox.com",
  },
  {
    slug: "meta",
    name: "Meta (Facebook, Instagram, WhatsApp)",
    category: "communication",
    description: "Statut officiel de Facebook, Instagram, WhatsApp et Threads.",
    homepage: "https://about.meta.com",
    status_page_url: "https://metastatus.com",
    feed_url: "https://metastatus.com",
    feed_kind: "rss",
    logo_domain: "meta.com",
  },
  {
    slug: "google-gemini",
    name: "Google Gemini",
    category: "ia",
    description: "Statut de l'infrastructure Google IA derrière Gemini.",
    homepage: "https://gemini.google.com",
    // Gemini n'a pas de status page dédiée : ses incidents remontent sur celle
    // de Google Cloud, qui héberge son infrastructure. Même flux que
    // « google-cloud », donc jamais interrogé deux fois pour rien : la
    // collecte partage l'état entre les deux fournisseurs.
    status_page_url: "https://status.cloud.google.com",
    feed_url: "https://status.cloud.google.com/en/feed.atom",
    feed_kind: "atom",
    logo_domain: "gemini.google.com",
  },

  // --- Grand public : jeux et réseaux sociaux (suite) -----------------------
  // Même principe que Riot/PlayStation/Xbox/Meta plus haut : l'adresse
  // pointe sur la page humaine, et la découverte automatique
  // (src/lib/discover.ts) lit cette page dès le premier échec pour en
  // extraire la vraie adresse de flux déclarée, au lieu d'en deviner une.
  {
    slug: "minecraft",
    name: "Minecraft",
    category: "jeux",
    description: "Connexion et serveurs multijoueur Minecraft (Mojang).",
    homepage: "https://www.minecraft.net",
    status_page_url: "https://help.minecraft.net/hc/en-us/articles/360046311411",
    feed_url: "https://help.minecraft.net/hc/en-us/articles/360046311411",
    feed_kind: "rss",
    logo_domain: "minecraft.net",
  },
  {
    slug: "roblox",
    name: "Roblox",
    category: "jeux",
    description: "Connexion et jeu en ligne sur Roblox.",
    homepage: "https://www.roblox.com",
    status_page_url: "https://status.roblox.com",
    feed_url: "https://status.roblox.com",
    feed_kind: "rss",
    logo_domain: "roblox.com",
  },
  {
    slug: "ea",
    name: "Electronic Arts (EA)",
    category: "jeux",
    description: "Connexion et services en ligne EA (FIFA/FC, Apex Legends, Battlefield).",
    homepage: "https://www.ea.com",
    status_page_url: "https://help.ea.com/en/service-updates/",
    feed_url: "https://help.ea.com/en/service-updates/",
    feed_kind: "rss",
    logo_domain: "ea.com",
  },
  {
    slug: "battle-net",
    name: "Battle.net",
    category: "jeux",
    description: "Connexion et jeu en ligne Blizzard (World of Warcraft, Diablo, Overwatch).",
    homepage: "https://battle.net",
    status_page_url: "https://us.battle.net/support/en/article/status",
    feed_url: "https://us.battle.net/support/en/article/status",
    feed_kind: "rss",
    logo_domain: "battle.net",
  },
  {
    slug: "nintendo",
    name: "Nintendo",
    category: "jeux",
    description: "Connexion et boutique en ligne Nintendo Switch.",
    homepage: "https://www.nintendo.com",
    status_page_url: "https://en-americas-support.nintendo.com/app/status",
    feed_url: "https://en-americas-support.nintendo.com/app/status",
    feed_kind: "rss",
    logo_domain: "nintendo.com",
  },
  {
    slug: "spotify",
    name: "Spotify",
    category: "communication",
    description: "Lecture et connexion sur Spotify.",
    homepage: "https://www.spotify.com",
    status_page_url: "https://www.spotifystatus.com",
    feed_url: "https://www.spotifystatus.com",
    feed_kind: "rss",
    logo_domain: "spotify.com",
  },
  {
    slug: "x-twitter",
    name: "X (Twitter)",
    category: "communication",
    description: "Connexion et publication sur X.",
    homepage: "https://x.com",
    status_page_url: "https://status.x.com",
    feed_url: "https://status.x.com",
    feed_kind: "rss",
    logo_domain: "x.com",
  },
  {
    slug: "pinterest",
    name: "Pinterest",
    category: "communication",
    description: "Connexion et navigation sur Pinterest.",
    homepage: "https://www.pinterest.com",
    status_page_url: "https://help.pinterest.com/en/business/article/pinterest-outage",
    feed_url: "https://help.pinterest.com/en/business/article/pinterest-outage",
    feed_kind: "rss",
    logo_domain: "pinterest.com",
  },
];

/**
 * Adresses de secours connues, pour les fournisseurs qui ont migré ailleurs que
 * sous leur propre domaine de statut.
 */
const EXPLICIT_ALTS: Record<string, string[]> = {
  planetscale: [
    "https://planetscale.statuspage.io/api/v2/summary.json",
    "https://www.planetscalestatus.com/api/v2/summary.json",
  ],
  databricks: [
    "https://status.databricks.com/api/v2/summary.json",
    "https://databricks.statuspage.io/api/v2/summary.json",
    "https://status.databricks.com/history.rss",
  ],
  postmark: ["https://postmark.statuspage.io/api/v2/summary.json"],
  zendesk: [
    "https://zendesk.statuspage.io/api/v2/summary.json",
    "https://support.zendesk.com/api/v2/summary.json",
    "https://status.zendesk.com/history.rss",
  ],
  mailchimp: ["https://mailchimp.statuspage.io/api/v2/summary.json", "https://status.mailchimp.com/history.rss"],
  okta: [
    "https://trust.okta.com/api/v2/summary.json",
    "https://status.okta.com/api/v2/summary.json",
    "https://okta.statuspage.io/api/v2/summary.json",
  ],
  neon: ["https://neonstatus.com/api/v2/summary.json", "https://neon-status.statuspage.io/api/v2/summary.json"],
  auth0: ["https://status.auth0.com/api/v2/summary.json", "https://auth0.statuspage.io/api/v2/summary.json"],
  algolia: ["https://status.algolia.com/api/v2/summary.json", "https://algolia.statuspage.io/api/v2/summary.json"],
  fastly: ["https://www.fastlystatus.com/api/v2/summary.json", "https://status.fastly.com/index.json"],
  "new-relic": ["https://newrelic.statuspage.io/api/v2/summary.json"],
  snowflake: ["https://snowflake.statuspage.io/api/v2/summary.json"],
  box: ["https://box.statuspage.io/api/v2/summary.json"],
  dropbox: ["https://dropbox.statuspage.io/api/v2/summary.json"],
};

/**
 * Chemins standards des status pages. Une adresse qui tombe en 404 signifie
 * presque toujours que le fournisseur a changé de plateforme, pas qu'il a
 * cessé de publier ses incidents : on essaie les conventions du marché avant
 * de renoncer à la page (et donc au trafic qu'elle apporte).
 */
function conventionalFeeds(statusPageUrl: string): string[] {
  const origin = statusPageUrl.replace(/\/+$/, "");
  return [
    `${origin}/api/v2/summary.json`,
    `${origin}/history.rss`,
    `${origin}/history.atom`,
    `${origin}/feed.rss`,
    `${origin}/feed`,
    `${origin}/rss`,
  ];
}

const withAlternates = (s: Omit<SeedService, "alt_feeds">): SeedService => ({
  ...s,
  alt_feeds: [...new Set([...(EXPLICIT_ALTS[s.slug] ?? []), ...conventionalFeeds(s.status_page_url)])].filter(
    (u) => u !== s.feed_url,
  ),
});

export const SEED_SERVICES: SeedService[] = [
  ...STATUSPAGE.map(([slug, name, category, host, domain, description]) =>
    withAlternates({
      slug,
      name,
      category,
      description,
      homepage: `https://${domain}`,
      status_page_url: `https://${host}`,
      feed_url: `https://${host}/api/v2/summary.json`,
      feed_kind: "statuspage_v2" as const,
      logo_domain: domain,
    }),
  ),
  ...FEEDS.map(withAlternates),
];
