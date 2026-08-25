// Archive Mode API Adapter (Zero Server Network Requests)
const ARCHIVE_BASE = "/static/archive";

function isArchiveMode() {
  return window.VEILPLAYS_CONFIG?.archiveMode !== false;
}

// Session-level storage helpers for demo play/evaluations
const SESSION_EVALS_KEY = "veilplays_archive_session_evals";
const SESSION_REACTIONS_KEY = "veilplays_archive_session_reactions";
const SESSION_REPLIES_KEY = "veilplays_archive_session_replies";

function getSessionEvaluations() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_EVALS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveSessionEvaluations(evals) {
  try {
    sessionStorage.setItem(SESSION_EVALS_KEY, JSON.stringify(evals));
  } catch (e) {
    console.warn("Failed to save session evaluations", e);
  }
}

function getSessionReactions() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_REACTIONS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveSessionReactions(reactions) {
  try {
    sessionStorage.setItem(SESSION_REACTIONS_KEY, JSON.stringify(reactions));
  } catch (e) {
    console.warn("Failed to save session reactions", e);
  }
}

function getSessionReplies() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_REPLIES_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveSessionReplies(replies) {
  try {
    sessionStorage.setItem(SESSION_REPLIES_KEY, JSON.stringify(replies));
  } catch (e) {
    console.warn("Failed to save session replies", e);
  }
}

async function apiFetchGames() {
  const lang = state.language || "ko";
  const primaryUrl = `${ARCHIVE_BASE}/games-${lang}.json`;
  const fallbackUrl = `/archive/games-${lang}.json`;

  let res = await fetch(primaryUrl).catch(() => null);
  if (!res || !res.ok) {
    res = await fetch(fallbackUrl);
  }
  if (!res.ok) {
    throw new Error(`Failed to load archive games catalog for lang=${lang}`);
  }

  const data = await res.json();
  state.games = data.games || {};
  state.categories = data.categories || [];
  return data;
}

async function apiFetchAuthConfig() {
  return {
    configured: false,
    archiveMode: true,
  };
}

async function apiFetchAuthMe() {
  if (!state.account) {
    throw new Error("auth_failed");
  }
  return state.account;
}

async function getCurrentAuthHeaders(includeJson = false) {
  const headers = includeJson ? { "Content-Type": "application/json" } : {};
  if (state.authUser) {
    headers.Authorization = "Bearer demo-token-archive";
  }
  return headers;
}

async function apiFetchResults(gameType) {
  if (!gameType) return { results: [], is_admin: false };

  const encodedGameType = encodeURIComponent(gameType);
  const primaryUrl = `${ARCHIVE_BASE}/results/${encodedGameType}.json`;
  const fallbackUrl = `/archive/results/${encodedGameType}.json`;

  let res = await fetch(primaryUrl).catch(() => null);
  if (!res || !res.ok) {
    res = await fetch(fallbackUrl);
  }
  if (!res.ok) {
    throw new Error(`Failed to load archive results for gameType=${gameType}`);
  }

  const data = await res.json();
  const results = (data.results || []).map((item) => ({ ...item }));

  // Merge session reactions & replies
  const sessionReactions = getSessionReactions();
  const sessionReplies = getSessionReplies();

  results.forEach((model) => {
    if (Array.isArray(model.comments)) {
      model.comments.forEach((c) => {
        if (sessionReactions[c.id]) {
          const reaction = sessionReactions[c.id];
          c.user_reaction = reaction.type;
          c.like_count = (c.like_count || 0) + (reaction.likeDelta || 0);
          c.dislike_count =
            (c.dislike_count || 0) + (reaction.dislikeDelta || 0);
        }
        if (sessionReplies[c.id]) {
          c.replies = [...(c.replies || []), ...sessionReplies[c.id]];
        }
      });
    }
  });

  const payload = {
    results,
    is_admin: false,
  };

  return setCachedResultsData(gameType, payload);
}

function apiPrefetchResults(gameType) {
  if (!gameType) return Promise.resolve(null);
  const cached = getCachedResultsData(gameType);
  if (cached) return Promise.resolve(cached);
  if (state.resultsRefreshPromises?.[gameType])
    return state.resultsRefreshPromises[gameType];

  const promise = apiFetchResults(gameType)
    .catch((error) => {
      console.error("Archive results prefetch failed", error);
      return null;
    })
    .finally(() => {
      const nextPromises = { ...(state.resultsRefreshPromises || {}) };
      delete nextPromises[gameType];
      state.resultsRefreshPromises = nextPromises;
    });

  state.resultsRefreshPromises = {
    ...(state.resultsRefreshPromises || {}),
    [gameType]: promise,
  };
  return promise;
}

async function apiFetchMyPage() {
  if (!state.authUser && !state.account) return null;

  const primaryUrl = `${ARCHIVE_BASE}/demo-mypage.json`;
  const fallbackUrl = `/archive/demo-mypage.json`;

  let res = await fetch(primaryUrl).catch(() => null);
  if (!res || !res.ok) {
    res = await fetch(fallbackUrl);
  }
  if (!res.ok) {
    throw new Error("Failed to load archive demo mypage data");
  }

  const data = await res.json();

  // Merge session evaluations into mypage metrics
  const sessionEvals = getSessionEvaluations();
  if (sessionEvals.length > 0) {
    const copy = JSON.parse(JSON.stringify(data));
    copy.unique_eval_model_count =
      (copy.unique_eval_model_count || 0) + sessionEvals.length;
    if (copy.badge) {
      copy.badge.current_count = copy.unique_eval_model_count;
    }
    state.myPageData = copy;
    return copy;
  }

  state.myPageData = data;
  return data;
}

async function apiFetchUserEvals() {
  if (!state.authUser && !state.account) {
    state.userEvals = [];
    return;
  }

  const primaryUrl = `${ARCHIVE_BASE}/demo-user-evals.json`;
  const fallbackUrl = `/archive/demo-user-evals.json`;

  let res = await fetch(primaryUrl).catch(() => null);
  if (!res || !res.ok) {
    res = await fetch(fallbackUrl);
  }
  if (!res.ok) {
    state.userEvals = getSessionEvaluations();
    return;
  }

  const data = await res.json();
  const baseEvals = data.evals || [];
  const sessionEvals = getSessionEvaluations();

  // Combine base evals + session evals (avoiding duplicate IDs)
  const sessionIds = new Set(sessionEvals.map((e) => e.id));
  const combined = [
    ...sessionEvals,
    ...baseEvals.filter((e) => !sessionIds.has(e.id)),
  ];

  state.userEvals = combined;
}

async function apiRecordPlay(gameType, blindId) {
  const model = state.games?.[gameType]?.find(
    (item) => item.blind_id === blindId,
  );
  if (model) {
    model.play_count = Number(model.play_count || 0) + 1;
  }
  return true;
}

async function apiSubmitEvaluation(payload) {
  const gameType = payload.game_type;
  const blindId = payload.blind_model_id;
  const model = state.games?.[gameType]?.find(
    (item) => item.blind_id === blindId,
  );
  const actualModelName = model ? model.actual_model : "AI Model";

  const total = (
    (Number(payload.score_control || 0) +
      Number(payload.score_structure || 0) +
      Number(payload.score_presentation || 0) +
      Number(payload.score_difficulty || 0) +
      Number(payload.score_fun || 0) +
      Number(payload.score_overall || 0)) /
    6.0
  ).toFixed(1);

  const newEval = {
    id: `eval-session-${Date.now()}`,
    game_type: gameType,
    actual_model_name: actualModelName,
    blind_id: blindId,
    score_control: Number(payload.score_control || 0),
    score_structure: Number(payload.score_structure || 0),
    score_presentation: Number(payload.score_presentation || 0),
    score_difficulty: Number(payload.score_difficulty || 0),
    score_fun: Number(payload.score_fun || 0),
    score_overall: Number(payload.score_overall || 0),
    total_score: Number(total),
    comment: payload.comment || "",
    created_at: new Date().toISOString(),
  };

  const sessionEvals = getSessionEvaluations();
  sessionEvals.unshift(newEval);
  saveSessionEvaluations(sessionEvals);

  // Update state.userEvals
  state.userEvals = [newEval, ...(state.userEvals || [])];

  // If comment submitted, append to results cache
  if (payload.comment) {
    const cached = getCachedResultsData(gameType);
    if (cached && Array.isArray(cached.results)) {
      const targetModel = cached.results.find(
        (m) => m.actual_model_name === actualModelName,
      );
      if (targetModel) {
        targetModel.comments = targetModel.comments || [];
        targetModel.comments.unshift({
          id: newEval.id,
          display_name:
            state.account?.profile?.display_name ||
            (state.language === "ko" ? "데모플레이어" : "DemoPlayer"),
          comment: payload.comment,
          is_blinded: false,
          created_at: newEval.created_at,
          like_count: 0,
          dislike_count: 0,
          user_reaction: null,
          badge: {
            stage_key:
              state.account?.profile?.profile_badge_key || "badge_critic_owl",
          },
          replies: [],
        });
      }
    }
  }

  return {
    ok: true,
    status: 200,
    json: async () => ({
      actual_model_name: actualModelName,
      is_evaluated: true,
    }),
  };
}

async function apiToggleCommentReaction(evaluationId, reactionType) {
  const sessionReactions = getSessionReactions();
  const current = sessionReactions[evaluationId];

  if (current && current.type === reactionType) {
    // Toggle off
    delete sessionReactions[evaluationId];
  } else {
    sessionReactions[evaluationId] = {
      type: reactionType,
      likeDelta:
        reactionType === "like" ? 1 : current?.type === "like" ? -1 : 0,
      dislikeDelta:
        reactionType === "dislike" ? 1 : current?.type === "dislike" ? -1 : 0,
    };
  }
  saveSessionReactions(sessionReactions);
  return { ok: true, status: 200 };
}

async function apiSubmitCommentReply(evaluationId, replyText) {
  const sessionReplies = getSessionReplies();
  const list = sessionReplies[evaluationId] || [];
  list.push({
    id: `reply-session-${Date.now()}`,
    display_name:
      state.account?.profile?.display_name ||
      (state.language === "ko" ? "데모플레이어" : "DemoPlayer"),
    reply: replyText,
    created_at: new Date().toISOString(),
    is_blinded: false,
    badge: {
      stage_key:
        state.account?.profile?.profile_badge_key || "badge_critic_owl",
    },
  });
  sessionReplies[evaluationId] = list;
  saveSessionReplies(sessionReplies);
  return { ok: true, status: 200 };
}

async function apiUpdateProfileBadge(badgeKey) {
  if (state.account?.profile) {
    state.account.profile.profile_badge_key = badgeKey;
  }
  if (state.myPageData) {
    state.myPageData.profile_badge_key = badgeKey;
  }
  return { ok: true, status: 200 };
}

// Disabled write stubs for archive safety
async function apiUpdateProfileDisplayName() {
  throw new Error("archive_write_disabled");
}

async function apiUpdateProfileIdentity() {
  throw new Error("archive_write_disabled");
}

async function apiRequestSignupEmailCode() {
  throw new Error("archive_write_disabled");
}

async function apiConfirmSignupEmailCode() {
  throw new Error("archive_write_disabled");
}

async function apiCheckLoginIdAvailability() {
  return { available: false, reason: "archive_mode" };
}

async function apiCheckDisplayNameAvailability() {
  return { available: false, reason: "archive_mode" };
}

async function apiCheckMyDisplayNameAvailability() {
  return { available: false, reason: "archive_mode" };
}

async function apiDeleteAccount() {
  throw new Error("archive_write_disabled");
}

async function apiAdminToggleBlind() {
  throw new Error("archive_write_disabled");
}

async function apiFetchAdminOverview() {
  return { profiles: [], comments: [], replies: [] };
}

async function apiAdminUserAction() {
  throw new Error("archive_write_disabled");
}
