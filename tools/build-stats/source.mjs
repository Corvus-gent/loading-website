// Physical source lines (including comments/blank lines). No generated JSON or vendored code.
export const EXCLUDED=['node_modules','vendor','dist','out','coverage','test-results','playwright-report','submission','public','clients'];
export function sourceFile(file){return !file.split('/').some(p=>EXCLUDED.includes(p))&&!/(?:^|\/)(?:package-lock|yarn\.lock|pnpm-lock)|\.min\.|\.bundle\.|generated/i.test(file)&&/\.(?:[cm]?js|jsx|tsx?|html|css|scss|py|sh|sql|go|rs|php|vue|svelte|ya?ml)$/.test(file);}
