/**
 * Découpage d'un fichier SQL en instructions individuelles.
 *
 * Pourquoi ne pas tout envoyer d'un bloc : un pooler en mode transaction
 * (Supabase Supavisor, PgBouncer…) n'exécute pas un lot multi-instructions
 * comme un serveur direct. Il l'interrompt — « canceling statement due to
 * statement timeout » — et le schéma n'est appliqué qu'à moitié.
 *
 * Envoyer les instructions une par une fonctionne partout, permet de fixer un
 * délai d'exécution par instruction, et surtout de dire LAQUELLE a échoué.
 *
 * Le découpage doit respecter ce qui peut contenir un point-virgule sans le
 * terminer : chaînes, blocs dollar-quotés (`$$ … $$`, `$tag$ … $tag$`),
 * commentaires de ligne et de bloc, identifiants entre guillemets.
 */
export function splitSqlStatements(source: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;

  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag: string | null = null;

  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      current += char;
      if (char === "\n") inLineComment = false;
      i++;
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === "*" && next === "/") {
        current += next;
        i += 2;
        inBlockComment = false;
        continue;
      }
      i++;
      continue;
    }

    if (dollarTag) {
      if (source.startsWith(dollarTag, i)) {
        current += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      current += char;
      i++;
      continue;
    }

    if (inSingle) {
      current += char;
      // '' à l'intérieur d'une chaîne est un apostrophe échappé, pas une fin.
      if (char === "'" && next === "'") {
        current += next;
        i += 2;
        continue;
      }
      if (char === "'") inSingle = false;
      i++;
      continue;
    }

    if (inDouble) {
      current += char;
      if (char === '"') inDouble = false;
      i++;
      continue;
    }

    if (char === "-" && next === "-") {
      inLineComment = true;
      current += char;
      i++;
      continue;
    }
    if (char === "/" && next === "*") {
      inBlockComment = true;
      current += char;
      i++;
      continue;
    }
    if (char === "'") {
      inSingle = true;
      current += char;
      i++;
      continue;
    }
    if (char === '"') {
      inDouble = true;
      current += char;
      i++;
      continue;
    }
    if (char === "$") {
      const match = /^\$[A-Za-z_][A-Za-z_0-9]*\$|^\$\$/.exec(source.slice(i));
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }
    if (char === ";") {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
      i++;
      continue;
    }

    current += char;
    i++;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);

  // Une instruction réduite à des commentaires n'a rien à exécuter.
  return statements.filter((s) => s.split("\n").some((line) => line.trim() && !line.trim().startsWith("--")));
}
