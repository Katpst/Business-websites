import { cp, mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { readBusiness, readSnapshot } from '../src/data.ts';
import { render } from '../src/render.ts';

export async function build(root = process.cwd()): Promise<void> {
  const business = await readBusiness(path.join(root, 'business.json'));
  const snapshot = await readSnapshot(business, path.join(root, '.cache/google.json'));
  if (!snapshot) console.log('No Google snapshot: displaying a Google reviews link; no review text or rating is invented.');
  if (!business.legal.legalName || !(business.legal.siren || business.legal.siret) || !business.legal.hosting) {
    console.log('Business legal details are incomplete. Fill them in before publishing.');
  }
  if (!business.website) console.log('No public website URL: this preview uses noindex.');
  const html = render(business, snapshot);
  const destination = path.resolve(root, 'dist');
  const stage = path.resolve(root, '.cache', `build-${process.pid}`);
  const previous = path.resolve(root, '.cache', `previous-dist-${process.pid}`);
  // All recursively removed/moved paths are fixed generated directories inside this workspace.
  const ownedPath = (candidate: string): void => {
    const relative = path.relative(path.resolve(root), candidate);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Unsafe build output path.');
  };
  [destination, stage, previous].forEach(ownedPath);
  await mkdir(path.join(stage, 'assets'), { recursive: true });
  try {
    await writeFile(path.join(stage, 'index.html'), html);
    await writeFile(path.join(stage, 'contact.html'), render(business, snapshot, 'contact'));
    await cp(path.join(root, 'src/style.css'), path.join(stage, 'assets/style.css'));
    await cp(path.join(root, 'public/assets'), path.join(stage, 'assets'), { recursive: true });
    const photos = [
      business.hero.image, business.hero.detailImage,
      ...business.services.map(service => service.image),
      ...(business.projects ?? []).flatMap(project => [project.before, project.after]),
      business.beforeAfter?.before, business.beforeAfter?.after,
    ].filter(photo => photo !== undefined);
    if (photos.length) {
      const publicRoot = await realpath(path.join(root, 'public'));
      for (const photo of new Map(photos.map(photo => [photo.file, photo])).values()) {
        const source = await realpath(path.join(publicRoot, photo.file));
        const relative = path.relative(publicRoot, source);
        if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Site photos must be inside public/.');
        const target = path.join(stage, photo.file);
        await mkdir(path.dirname(target), { recursive: true });
        await cp(source, target);
      }
    }
    for (const script of ['contact', ...(business.beforeAfter || business.projects?.some(project => project.layout === 'slider') ? ['slider'] : [])]) {
      const code = await readFile(path.join(root, `src/${script}.ts`), 'utf8');
      await writeFile(path.join(stage, `assets/${script}.js`), ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText);
    }
    for (const photo of snapshot?.photos ?? []) {
      await writeFile(path.join(stage, 'assets', photo.file), Buffer.from(photo.base64, 'base64'));
    }
    let hadPrevious = false;
    try { await rename(destination, previous); hadPrevious = true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    try { await rename(stage, destination); }
    catch (error) { if (hadPrevious) await rename(previous, destination); throw error; }
    if (hadPrevious) await rm(previous, { recursive: true, force: true });
    console.log('Built dist/index.html. Run npm run preview to view it.');
  } finally { await rm(stage, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  build().catch(error => { console.error(error instanceof Error ? error.message : 'Build failed.'); process.exitCode = 1; });
}
