import fs from 'node:fs';
import ts from 'typescript';
fs.writeFileSync(new URL('engine.mjs',import.meta.url),ts.transpileModule(fs.readFileSync(new URL('../src/engine.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2020,target:ts.ScriptTarget.ES2020}}).outputText);
