import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = resolve(projectRoot, 'backend/static');
const outputDir = resolve(projectRoot, 'dist');
const vercelEnvironment = process.env.VERCEL_ENV || 'development';

function readOrigin(name, fallback = '') {
    const value = (process.env[name] || fallback).trim().replace(/\/+$/, '');
    if (!value) return '';

    const parsed = new URL(value);
    if (
        !['http:', 'https:'].includes(parsed.protocol)
        || parsed.username
        || parsed.password
        || parsed.pathname !== '/'
        || parsed.search
        || parsed.hash
    ) {
        throw new Error(`${name} must contain an http(s) origin without a path`);
    }
    return parsed.origin;
}

function resolveFrontendOrigin() {
    const explicitOrigin = readOrigin('VEILPLAYS_FRONTEND_ORIGIN');
    if (explicitOrigin) return explicitOrigin;
    if (vercelEnvironment === 'production') return 'https://www.veilplays.com';
    if (process.env.VERCEL_URL) {
        return readOrigin('VEILPLAYS_FRONTEND_ORIGIN', `https://${process.env.VERCEL_URL}`);
    }
    return '';
}

function resolveApiOrigin() {
    const explicitOrigin = readOrigin('VEILPLAYS_API_ORIGIN');
    if (explicitOrigin) return explicitOrigin;
    return vercelEnvironment === 'production' ? 'https://api.veilplays.com' : '';
}

const publicConfig = {
    environment: process.env.VEILPLAYS_ENVIRONMENT || vercelEnvironment,
    frontendOrigin: resolveFrontendOrigin(),
    apiOrigin: resolveApiOrigin(),
    gaMeasurementId: process.env.VEILPLAYS_GA_MEASUREMENT_ID || '',
};

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
cpSync(sourceDir, outputDir, { recursive: true });
writeFileSync(
    resolve(outputDir, 'runtime-config.js'),
    `window.VEILPLAYS_CONFIG = Object.freeze(${JSON.stringify(publicConfig, null, 4)});\n`,
    'utf8',
);

if (vercelEnvironment !== 'production') {
    const indexPath = resolve(outputDir, 'index.html');
    const indexHtml = readFileSync(indexPath, 'utf8').replace(
        /(<meta name="viewport" content="[^"]+">)/,
        '$1\n    <meta name="robots" content="noindex, nofollow">',
    );
    writeFileSync(indexPath, indexHtml, 'utf8');
    writeFileSync(resolve(outputDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n', 'utf8');
}

console.log(`Static site built for ${publicConfig.environment}: ${outputDir}`);
