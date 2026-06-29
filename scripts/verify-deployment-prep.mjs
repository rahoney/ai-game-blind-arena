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
const productionAbout = readFileSync(resolve(distRoot, 'about/index.html'), 'utf8');
const productionTerms = readFileSync(resolve(distRoot, 'terms/index.html'), 'utf8');
const productionPrivacy = readFileSync(resolve(distRoot, 'privacy/index.html'), 'utf8');
const productionRobots = readFileSync(resolve(distRoot, 'robots.txt'), 'utf8');
assert(productionConfig.includes('"frontendOrigin": "https://www.veilplays.com"'), 'Production frontend origin missing');
assert(productionConfig.includes('"apiOrigin": "https://api.veilplays.com"'), 'Production API origin missing');
assert(productionConfig.includes('"gaMeasurementId": "G-DEPLOYTEST"'), 'Production GA ID missing');
assert(!productionIndex.includes('noindex, nofollow'), 'Production must be indexable');
assert(!productionAbout.includes('noindex, nofollow'), 'Production about page must be indexable');
assert(!productionTerms.includes('noindex, nofollow'), 'Production terms page must be indexable');
assert(!productionPrivacy.includes('noindex, nofollow'), 'Production privacy page must be indexable');
assert(productionIndex.includes('rel="canonical" href="https://www.veilplays.com/"'), 'Canonical URL missing');
assert(productionAbout.includes('rel="canonical" href="https://www.veilplays.com/about"'), 'About canonical URL missing');
assert(productionAbout.includes('VeilPlays는 여러 AI 모델이 동일한 프롬프트로 제작한 게임'), 'About static SEO content missing');
assert(productionTerms.includes('VeilPlays 이용약관'), 'Terms static SEO content missing');
assert(productionPrivacy.includes('VeilPlays 개인정보처리방침'), 'Privacy static SEO content missing');
assert(productionRobots.includes('Allow: /'), 'Production robots must allow crawling');

build('preview', { VERCEL_URL: 'veilplays-preview.example.vercel.app' });
const previewConfig = readFileSync(resolve(distRoot, 'runtime-config.js'), 'utf8');
const previewIndex = readFileSync(resolve(distRoot, 'index.html'), 'utf8');
const previewAbout = readFileSync(resolve(distRoot, 'about/index.html'), 'utf8');
const previewRobots = readFileSync(resolve(distRoot, 'robots.txt'), 'utf8');
assert(previewConfig.includes('"apiOrigin": ""'), 'Preview must not use the production API by default');
assert(previewIndex.includes('noindex, nofollow'), 'Preview noindex is missing');
assert(previewAbout.includes('noindex, nofollow'), 'Preview about noindex is missing');
assert(previewRobots.includes('Disallow: /'), 'Preview robots must block crawling');

const sourceRelativeFiles = sourceFiles.map((path) => path.slice(staticRoot.length + 1));
const missingDistFiles = sourceRelativeFiles.filter((path) => !existsSync(resolve(distRoot, path)));
assert(missingDistFiles.length === 0, `Build output is missing files: ${missingDistFiles.join(', ')}`);

console.log(`Deployment preparation verified: ${sourceFiles.length} static files, ${sourceGameCount} games.`);
