import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const staticRoot = resolve(projectRoot, 'backend/static');
const distRoot = resolve(projectRoot, 'dist');

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function walk(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(directory, entry.name);
        return entry.isDirectory() ? walk(path) : [path];
    });
}

function build(environment, extraEnvironment = {}) {
    execFileSync(process.execPath, ['scripts/build-static-site.mjs'], {
        cwd: projectRoot,
        env: {
            ...process.env,
            VERCEL_ENV: environment,
            ...extraEnvironment,
        },
        stdio: 'pipe',
    });
}

const sourceFiles = walk(staticRoot);
const sourceGameCount = sourceFiles.filter((path) => path.endsWith('.html') && path.includes('/games/')).length;
assert(sourceGameCount === 180, `Expected 180 game HTML files, found ${sourceGameCount}`);

const javascriptFiles = sourceFiles.filter((path) => path.endsWith('.js'));
for (const path of javascriptFiles) {
    execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' });
}

const hardcodedApiCalls = javascriptFiles.flatMap((path) => {
    const source = readFileSync(path, 'utf8');
    return source.includes("fetch('/api/") || source.includes('fetch("/api/')
        ? [path]
        : [];
});
assert(hardcodedApiCalls.length === 0, `Hard-coded API calls: ${hardcodedApiCalls.join(', ')}`);

build('production', { VEILPLAYS_GA_MEASUREMENT_ID: 'G-DEPLOYTEST' });
const productionConfig = readFileSync(resolve(distRoot, 'runtime-config.js'), 'utf8');
const productionIndex = readFileSync(resolve(distRoot, 'index.html'), 'utf8');
const productionRobots = readFileSync(resolve(distRoot, 'robots.txt'), 'utf8');
assert(productionConfig.includes('"frontendOrigin": "https://www.veilplays.com"'), 'Production frontend origin missing');
assert(productionConfig.includes('"apiOrigin": "https://api.veilplays.com"'), 'Production API origin missing');
assert(productionConfig.includes('"gaMeasurementId": "G-DEPLOYTEST"'), 'Production GA ID missing');
assert(!productionIndex.includes('noindex, nofollow'), 'Production must be indexable');
assert(productionIndex.includes('rel="canonical" href="https://www.veilplays.com/"'), 'Canonical URL missing');
assert(productionRobots.includes('Allow: /'), 'Production robots must allow crawling');

build('preview', { VERCEL_URL: 'veilplays-preview.example.vercel.app' });
const previewConfig = readFileSync(resolve(distRoot, 'runtime-config.js'), 'utf8');
const previewIndex = readFileSync(resolve(distRoot, 'index.html'), 'utf8');
const previewRobots = readFileSync(resolve(distRoot, 'robots.txt'), 'utf8');
assert(previewConfig.includes('"apiOrigin": ""'), 'Preview must not use the production API by default');
assert(previewIndex.includes('noindex, nofollow'), 'Preview noindex is missing');
assert(previewRobots.includes('Disallow: /'), 'Preview robots must block crawling');

const sourceRelativeFiles = sourceFiles.map((path) => path.slice(staticRoot.length + 1));
const missingDistFiles = sourceRelativeFiles.filter((path) => !existsSync(resolve(distRoot, path)));
assert(missingDistFiles.length === 0, `Build output is missing files: ${missingDistFiles.join(', ')}`);

console.log(`Deployment preparation verified: ${sourceFiles.length} static files, ${sourceGameCount} games.`);
