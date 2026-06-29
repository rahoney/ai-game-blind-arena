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

const staticSeoPages = [
    {
        path: 'about',
        sectionId: 'view-list',
        title: 'VeilPlays 소개 | 게임 기반 AI 모델 성능 비교·벤치마크',
        description: 'VeilPlays는 AI가 만든 게임을 직접 플레이하고, 블라인드로 기획력·디자인·코딩 성능을 비교 평가하는 게임 기반 AI 모델 벤치마크입니다.',
        bodyClass: 'theme-app',
        bodyHtml: `
            <article class="static-seo-page" aria-label="VeilPlays 소개">
                <h1>VeilPlays</h1>
                <p>VeilPlays는 여러 AI 모델이 동일한 프롬프트로 제작한 게임을 블라인드로 플레이하고 평가하는 서비스입니다.</p>
                <p>복잡한 수치 중심의 AI 성능 벤치마크 대신, 누구나 게임을 즐기면서 AI의 기획력, 코딩 역량, 디자인, 완성도 등을 직접 평가하고 비교할 수 있는 게임 기반 AI 모델 벤치마크입니다.</p>
                <h2>실험 조건</h2>
                <p>본 벤치마크는 기본 환경과 확장 환경, 두 가지 제작 조건을 바탕으로 진행되었습니다. 각 AI 모델은 단 한 번의 프롬프트를 입력받고 게임의 구성, 인터페이스, 그래픽, 스테이지, 기능을 자율적으로 구현합니다.</p>
                <h2>관전 포인트</h2>
                <p>각 모델의 프롬프트 해석, 구현 역량, 창의성, 기술 활용력, 웹 디자인 감각의 차이를 게임 플레이 경험으로 비교할 수 있습니다.</p>
            </article>
        `,
    },
    {
        path: 'terms',
        sectionId: 'view-terms',
        title: '이용약관 | VeilPlays',
        description: 'VeilPlays 이용약관. AI 생성 게임 플레이, 평가, 댓글 작성, 계정 이용에 관한 기본 규칙을 안내합니다.',
        bodyClass: 'theme-app',
        bodyHtml: `
            <article class="static-seo-page" aria-label="VeilPlays 이용약관">
                <h1>VeilPlays 이용약관</h1>
                <p>VeilPlays는 사용자가 AI 생성 게임을 플레이하고 평가하며 댓글을 남길 수 있는 실험형 게임 기반 AI 모델 벤치마크 서비스입니다.</p>
                <p>사용자는 서비스 이용 과정에서 타인의 권리를 침해하거나 서비스 운영을 방해하는 행위를 해서는 안 됩니다. 부적절한 평가, 댓글, 계정 활동은 숨김 처리되거나 제한될 수 있습니다.</p>
            </article>
        `,
    },
    {
        path: 'privacy',
        sectionId: 'view-privacy',
        title: '개인정보처리방침 | VeilPlays',
        description: 'VeilPlays 개인정보처리방침. 계정 식별, 평가와 댓글 기록, 서비스 운영에 필요한 정보 처리 기준을 안내합니다.',
        bodyClass: 'theme-app',
        bodyHtml: `
            <article class="static-seo-page" aria-label="VeilPlays 개인정보처리방침">
                <h1>VeilPlays 개인정보처리방침</h1>
                <p>VeilPlays는 계정 기반 AI 게임 평가 서비스를 제공하기 위해 계정 식별 정보, 평가와 댓글 기록, 서비스 운영에 필요한 최소 정보를 처리할 수 있습니다.</p>
                <p>수집된 정보는 서비스 제공, 평가 무결성 유지, 부정 이용 방지, 문의 응대, 서비스 개선을 위해 사용됩니다.</p>
            </article>
        `,
    },
];

function replaceMeta(html, page) {
    const url = `https://www.veilplays.com/${page.path}`;
    return html
        .replace(/<title>.*?<\/title>/, `<title>${page.title}</title>`)
        .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${page.description}">`)
        .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`)
        .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`)
        .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${page.title}">`)
        .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${page.description}">`)
        .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${page.title}">`)
        .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${page.description}">`)
        .replace(/"url": "https:\/\/www\.veilplays\.com\/"/, `"url": "${url}"`)
        .replace(/"description": "[^"]*"/, `"description": "${page.description}"`);
}

function injectStaticSeoContent(html, page) {
    const sectionPattern = new RegExp(`(<section id="${page.sectionId}" class="content-section">)(</section>)`);
    return html
        .replace(/<body class="[^"]*">/, `<body class="${page.bodyClass}">`)
        .replace('<div id="content-layer" class="hidden">', '<div id="content-layer">')
        .replace(sectionPattern, `$1${page.bodyHtml}$2`);
}

function writeStaticSeoPages() {
    const indexPath = resolve(outputDir, 'index.html');
    const indexHtml = readFileSync(indexPath, 'utf8');
    for (const page of staticSeoPages) {
        const pageDir = resolve(outputDir, page.path);
        mkdirSync(pageDir, { recursive: true });
        const pageHtml = injectStaticSeoContent(replaceMeta(indexHtml, page), page);
        writeFileSync(resolve(pageDir, 'index.html'), pageHtml, 'utf8');
    }
}

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

writeStaticSeoPages();

console.log(`Static site built for ${publicConfig.environment}: ${outputDir}`);
