import postgres from "postgres";
import { env } from "./env";

/**
 * Client Postgres unique par instance lambda.
 *
 * Serverless oblige : pool minuscule, connexion via le *pooler* Supabase
 * (port 6543, mode transaction) et `prepare: false` — les prepared statements
 * ne survivent pas au pooling transactionnel.
 */
declare global {
  // eslint-disable-next-line no-var
  var __sp_sql: ReturnType<typeof postgres> | undefined;
}


function create() {
  return postgres(env().DATABASE_URL, {
    // Une seule connexion par instance, plus une de réserve.
    //
    // Le pooler Supabase a un nombre de connexions client borné, partagé par
    // tout le projet. Chaque lambda qui en réserve trois épuise ce budget à
    // cinq instances — et les suivantes attendent, sans erreur, sans fin.
    // C'est la cause la plus fréquente d'une page qui « charge à l'infini » :
    // rien n'échoue, tout patiente. Nos requêtes durent quelques
    // millisecondes ; les sérialiser sur deux connexions coûte moins cher que
    // de saturer le pooler.
    max: 2,
    idle_timeout: 20,
    // Une connexion recyclée régulièrement évite de garder une place réservée
    // côté pooler pendant qu'une instance dort.
    max_lifetime: 60 * 10,
    connect_timeout: 10,
    prepare: false,
    onnotice: () => {},
    types: {
      // Les numeric Postgres arrivent en string par défaut : on veut des nombres.
      numeric: {
        to: 1700,
        from: [1700],
        serialize: (x: number) => String(x),
        parse: (x: string) => Number(x),
      },
    },
  });
}

type Sql = ReturnType<typeof postgres>;

function client(): Sql {
  if (!globalThis.__sp_sql) globalThis.__sp_sql = create();
  return globalThis.__sp_sql;
}

/**
 * Connexion différée.
 *
 * `sql` est un proxy : la connexion (et donc la validation des variables
 * d'environnement) n'a lieu qu'à la première requête réelle. Indispensable
 * pour que `next build` puisse importer ces modules sans secrets, et pour que
 * les pages statiques se rendent avec leurs valeurs de repli.
 */
export const sql: Sql = new Proxy(function noop() {} as unknown as Sql, {
  apply: (_target, _thisArg, args: unknown[]) =>
    (client() as unknown as (...a: unknown[]) => unknown)(...args),
  get: (_target, prop: string | symbol) => (client() as unknown as Record<string | symbol, unknown>)[prop],
}) as Sql;

/**
 * `sql.json` pour des valeurs dynamiques (contextes de log, payloads).
 * Le cast est volontaire : ces objets sont construits par nous et toujours
 * sérialisables, mais leur forme n'est pas connue statiquement.
 */
export const asJson = (value: unknown) => sql.json(value as never);

/**
 * Borne dure sur une requête de lecture.
 *
 * `connect_timeout` couvre l'ouverture de connexion, pas une requête qui
 * répond jamais. Sans cette borne, une page en cours de régénération attend
 * indéfiniment et le navigateur tourne dans le vide — le visiteur, lui, part.
 * Mieux vaut une page rendue avec des données vides, en deux secondes, qu'une
 * page parfaite qui n'arrive pas : les appelants retombent tous sur leur
 * valeur par défaut.
 *
 * La requête est annulée côté serveur, pour ne pas laisser la connexion
 * occupée après l'abandon.
 */
export function withTimeout<T>(query: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      (query as unknown as { cancel?: () => void }).cancel?.();
      reject(new Error(`${label} : pas de réponse en ${ms} ms`));
    }, ms);
    query.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** Retry générique avec backoff exponentiel + jitter. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseMs?: number; label?: string } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseMs = opts.baseMs ?? 250;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) break;
      const delay = baseMs * 2 ** i + Math.random() * baseMs;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(
    `${opts.label ?? "operation"} a échoué après ${attempts} tentatives : ${String(lastErr)}`,
  );
}
