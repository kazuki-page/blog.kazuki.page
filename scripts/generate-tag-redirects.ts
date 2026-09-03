import { mkdir, writeFile } from 'node:fs/promises';
import { tags } from '../src/data/tags.ts';
import { tagRedirectLines } from '../src/lib/tag-redirects.ts';

const lines = tagRedirectLines(Object.values(tags));

await mkdir('dist', { recursive: true });
await writeFile('dist/_redirects', `${lines.join('\n')}${lines.length ? '\n' : ''}`, 'utf8');
console.log(`タグURLのリダイレクト: ${lines.length} 件`);
