let langData = { ko: {}, en: {} };

async function loadLanguageData() {
  try {
    const response = await fetch(`/static/lang.json?v=20260601-auth13`, { cache: 'reload' });
    if (!response.ok) {
      throw new Error(`lang.json request failed: ${response.status}`);
    }
    const data = await response.json();
    langData = {
      ko: data?.ko || {},
      en: data?.en || {},
    };
    // 브라우저 언어 기반 초기 설정 (기본값 ko)
    if (!state.language) {
      const browserLang = navigator.language.split('-')[0];
      state.language = (langData[browserLang]) ? browserLang : 'ko';
    }
  } catch (e) {
    console.error("Failed to load lang.json", e);
    langData = { ko: {}, en: {} };
    if (!state.language) state.language = 'ko';
  }
}

function t(key, params = {}) {
  const lang = state.language || 'ko';
  // 데이터 구조: { ko: { title: "..." }, en: { title: "..." } }
  const langBucket = langData?.[lang] || {};
  const koBucket = langData?.ko || {};
  let text = (langBucket && langBucket[key])
             ? langBucket[key]
             : (koBucket[key] || key);

  // 파라미터 교체 (예: {nickname} -> 사용자 닉네임)
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(`{${k}}`, v);
  }
  return text;
}
