/* Le compilateur, avec les options du projet, pour les tests qui tiennent une
   option de tsconfig.json ou la bibliothèque du navigateur (pas de suffixe
   .test : le lanceur ne l'exécute pas). Le texte d'un fichier peut être
   remplacé, ou un fichier ajouté, sans rien écrire sur le disque. */
import path from "node:path";
import ts from "typescript";

export const ROOT = path.resolve(import.meta.dirname, "..");

/* Les options que tsc lit dans tsconfig.json. */
export function projectOptions() {
  const { config } = ts.readConfigFile(path.join(ROOT, "tsconfig.json"), ts.sys.readFile);
  return ts.parseJsonConfigFileContent(config, ts.sys, ROOT).options;
}

/* Un programme sur `rootNames` (chemins absolus), avec les options du projet
   que `overrides` retouche. `texts` donne le texte de fichiers retouchés ou
   ajoutés, par chemin absolu. */
export function createProgram(rootNames, { overrides = {}, texts = new Map() } = {}) {
  const options = { ...projectOptions(), ...overrides, incremental: false };
  const host = ts.createCompilerHost(options);
  const { fileExists, readFile, getSourceFile } = host;
  host.fileExists = (name) => texts.has(path.resolve(name)) || fileExists(name);
  host.readFile = (name) => texts.get(path.resolve(name)) ?? readFile(name);
  host.getSourceFile = (name, languageVersion, ...rest) => {
    const text = texts.get(path.resolve(name));
    return text === undefined ? getSourceFile(name, languageVersion, ...rest) : ts.createSourceFile(name, text, languageVersion, true);
  };
  return ts.createProgram({ rootNames, options, host });
}

/* Ce que tsc signalerait : les options et les déclarations globales, puis
   chacun des fichiers demandés. */
export function diagnosticsIn(program, files) {
  return [
    ...program.getOptionsDiagnostics(),
    ...program.getGlobalDiagnostics(),
    ...files.flatMap((file) => {
      const source = program.getSourceFile(file);
      return [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)];
    }),
  ];
}

/* Les codes d'erreur d'un vrai fichier du projet (chemin relatif à la
   racine), tel quel ou retouché par `edit` et compilé à sa place. Une
   retouche qui ne change rien ferait passer à vide le test qui attend une
   erreur : elle lève. */
export function diagnosticCodesFor(file, edit) {
  const filePath = path.join(ROOT, file);
  const texts = new Map();
  if (edit) {
    const original = ts.sys.readFile(filePath);
    const text = edit(original);
    if (text === original) throw new Error(`${file} : la retouche n'a rien changé — le motif qu'elle cherche a quitté le fichier`);
    texts.set(filePath, text);
  }
  const program = createProgram([filePath], { texts });
  return diagnosticsIn(program, [filePath]).map((diagnostic) => diagnostic.code);
}
