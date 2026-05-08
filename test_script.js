
// ── 상수 ──
const ROWS = 8, COLS = 8;
const MAX_HP = 10;
const FOG_RADIUS = 2;      // 시야 반경
const ENEMY_HP = 4;
const ENEMY_DMG = 2;
const PLAYER_DMG = 3;
const ITEM_HEAL = 3;
const WALL_CHANCE = 0.22;  // Wall 생성 확률

// ── 게임 Status ──
let state = {};

// ── 유틸 ──
const rng = (n) => Math.floor(Math.random() * n);
const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

// BFS로 (sr,sc)에서 (er,ec)까지 도달 가능한지 확인
function isReachable(grid, sr, sc, er, ec) {
  const visited = Array.from({length: ROWS}, () => Array(COLS).fill(false));
  const q = [[sr, sc]];
  visited[sr][sc] = true;
  while (q.length) {
    const [r, c] = q.shift();
    if (r === er && c === ec) return true;
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = r+dr, nc = c+dc;
      if (inBounds(nr, nc) && !visited[nr][nc] && grid[nr][nc] !== 'W') {
        visited[nr][nc] = true;
        q.push([nr, nc]);
      }
    }
  }
  return false;
}

// ── 맵 생성 ──
function generateMap() {
  let grid, pr, pc, er, ec;
  // Exit까지 경로 보장될 때까지 재생성
  do {
    grid = Array.from({length: ROWS}, () => Array(COLS).fill('F')); // 전부 Floor
    // 랜덤 Wall 배치
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (Math.random() < WALL_CHANCE) grid[r][c] = 'W';

    // Player: 좌상단 근처
    pr = rng(2); pc = rng(2);
    grid[pr][pc] = 'F';

    // Exit: 우하단 근처
    er = ROWS - 1 - rng(2); ec = COLS - 1 - rng(2);
    grid[er][ec] = 'F';
  } while (!isReachable(grid, pr, pc, er, ec));

  return { grid, pr, pc, er, ec };
}

// ── Enemy & 아이템 배치 ──
function placeEntities(grid, pr, pc, er, ec) {
  const enemies = [], items = [];
  const occupied = new Set([`${pr},${pc}`, `${er},${ec}`]);

  // Empty Floor 타일 수집
  const floors = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid[r][c] === 'F' && !occupied.has(`${r},${c}`)) floors.push([r,c]);

  const pick = () => {
    if (!floors.length) return null;
    const i = rng(floors.length);
    const pos = floors.splice(i, 1)[0];
    occupied.add(`${pos[0]},${pos[1]}`);
    return pos;
  };

  // Enemy 3 monsters
  for (let i = 0; i < 3; i++) {
    const pos = pick();
    if (pos) enemies.push({ r: pos[0], c: pos[1], hp: ENEMY_HP, maxHp: ENEMY_HP });
  }
  // 아이템 2개
  for (let i = 0; i < 2; i++) {
    const pos = pick();
    if (pos) items.push({ r: pos[0], c: pos[1] });
  }

  return { enemies, items };
}

// ── 게임 초기화 ──
function initGame() {
  const { grid, pr, pc, er, ec } = generateMap();
  const { enemies, items } = placeEntities(grid, pr, pc, er, ec);

  state = {
    grid,
    player: { r: pr, c: pc, hp: MAX_HP },
    exit: { r: er, c: ec },
    enemies,
    items,
    turn: 0,
    score: 0,
    kills: 0,
    over: false,
    // 탐색된 타일 (fog of war)
    revealed: Array.from({length: ROWS}, () => Array(COLS).fill(false)),
    visible: Array.from({length: ROWS}, () => Array(COLS).fill(false)),
    logs: [],
  };
  computeVisibility();
  renderAll();
  addLog('sys', 'Stepped into the dungeon. Find the exit! 🚪');
}

// ── 시야 계산 (원형 FOV) ──
function computeVisibility() {
  const { player, visible, revealed } = state;
  // 기존 visible 초기화
  for (let r = 0; r < ROWS; r++) visible[r].fill(false);

  for (let r = player.r - FOG_RADIUS; r <= player.r + FOG_RADIUS; r++) {
    for (let c = player.c - FOG_RADIUS; c <= player.c + FOG_RADIUS; c++) {
      if (!inBounds(r, c)) continue;
      const dist = Math.abs(r - player.r) + Math.abs(c - player.c);
      if (dist <= FOG_RADIUS) {
        visible[r][c] = true;
        revealed[r][c] = true;
      }
    }
  }
}

// ── Log 추가 ──
function addLog(type, msg) {
  state.logs.unshift({ type, msg });
  if (state.logs.length > 20) state.logs.pop();
  renderLog();
}

function renderLog() {
  const el = document.getElementById('log');
  el.innerHTML = state.logs.slice(0, 5).map(l =>
    `<p class="${l.type}">${l.msg}</p>`
  ).join('');
}

// ── 전체 렌더 ──
function renderAll() {
  const gridEl = document.getElementById('grid');
  const { grid, player, exit, enemies, items, visible, revealed } = state;

  // Enemy/아이템 위치 빠른 조회용 맵
  const eMap = {};
  enemies.forEach(e => eMap[`${e.r},${e.c}`] = e);
  const iMap = {};
  items.forEach(i => iMap[`${i.r},${i.c}`] = i);

  let html = '';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const isVis = visible[r][c];
      const isRev = revealed[r][c];
      const isWall = grid[r][c] === 'W';
      const isExit = exit.r === r && exit.c === c;
      const isPlayer = player.r === r && player.c === c;
      const enemy = eMap[`${r},${c}`];
      const item = iMap[`${r},${c}`];

      let cls = 'cell';
      let icon = '';

      if (!isRev) {
        cls += ' hidden';
      } else if (!isVis) {
        cls += ' fog';
        if (isWall) icon = '<span class="icon" style="opacity:.4">🧱</span>';
      } else {
        // 현재 시야 내
        cls += ' lit';
        if (isWall) { cls += ' wall'; icon = '<span class="icon">🧱</span>'; }
        else if (isPlayer) { cls += ' floor'; icon = '<span class="icon">🧙</span>'; }
        else if (isExit) { cls += ' exit'; icon = '<span class="icon">🚪</span>'; }
        else if (enemy) icon = `<span class="icon" title="HP:${enemy.hp}">👺</span>`;
        else if (item)  icon = '<span class="icon">💊</span>';
        else { cls += ' floor'; }
      }

      html += `<div class="${cls}">${icon}</div>`;
    }
  }
  gridEl.innerHTML = html;
  updateHUD();
}

// ── HUD 갱신 ──
function updateHUD() {
  const { player, score, turn, kills } = state;
  const pct = (player.hp / MAX_HP) * 100;
  document.getElementById('hpFill').style.width = pct + '%';
  document.getElementById('hpFill').style.background =
    pct > 60 ? 'linear-gradient(90deg,#30a030,#5fdf5f)' :
    pct > 30 ? 'linear-gradient(90deg,#c0a010,#f0c020)' :
               'linear-gradient(90deg,#e03030,#f55)';
  document.getElementById('hudScore').textContent = score;
  document.getElementById('hudTurn').textContent = turn;
  document.getElementById('hudKills').textContent = kills;
}

// ── Enemy 이동 (간단 AI: Player 방향으로 한 칸) ──
function moveEnemies() {
  const { grid, player, enemies } = state;
  const occupied = new Set(enemies.map(e => `${e.r},${e.c}`));

  enemies.forEach(e => {
    const dr = Math.sign(player.r - e.r);
    const dc = Math.sign(player.c - e.c);
    // 우선 수직/수평 중 랜덤 선택
    const dirs = Math.random() < 0.5
      ? [[dr, 0], [0, dc], [0, -dc], [-dr, 0]]
      : [[0, dc], [dr, 0], [-dr, 0], [0, -dc]];

    for (const [mr, mc] of dirs) {
      if (mr === 0 && mc === 0) continue;
      const nr = e.r + mr, nc = e.c + mc;
      if (!inBounds(nr, nc)) continue;
      if (grid[nr][nc] === 'W') continue;
      if (occupied.has(`${nr},${nc}`)) continue;
      // Player와 같은 칸 → 공격
      if (nr === player.r && nc === player.c) {
        combatEnemyAttacks(e);
        break;
      }
      // 이동
      occupied.delete(`${e.r},${e.c}`);
      e.r = nr; e.c = nc;
      occupied.add(`${e.r},${e.c}`);
      break;
    }
  });
}

// ── 전투: Enemy이 Player 공격 ──
function combatEnemyAttacks(enemy) {
  state.player.hp -= ENEMY_DMG;
  addLog('combat', `👺 Enemy attacked! -${ENEMY_DMG} HP (Remaining HP: ${state.player.hp})`);
  if (state.player.hp <= 0) {
    state.player.hp = 0;
    endGame(false);
  }
}

// ── 전투: Player가 Enemy 공격 ──
function combatPlayerAttacks(enemy) {
  enemy.hp -= PLAYER_DMG;
  addLog('combat', `⚔️ Attacked Enemy! -${PLAYER_DMG} (Enemy HP: ${Math.max(0, enemy.hp)})`);
  if (enemy.hp <= 0) {
    // Enemy 제거
    state.enemies = state.enemies.filter(e => e !== enemy);
    state.kills++;
    state.score += 50;
    addLog('sys', `💀 Enemy defeated! (+50pts)`);
  }
}

// ── Player 이동 ──
function movePlayer(dr, dc) {
  if (state.over) return;
  const { grid, player, exit, enemies, items } = state;
  const nr = player.r + dr, nc = player.c + dc;
  if (!inBounds(nr, nc)) return;
  if (grid[nr][nc] === 'W') { addLog('move', '🧱 It's a wall.'); return; }

  // Enemy과 접촉 → 전투
  const enemy = enemies.find(e => e.r === nr && e.c === nc);
  if (enemy) {
    combatPlayerAttacks(enemy);
    // 살아있으면 반격
    if (state.enemies.includes(enemy)) combatEnemyAttacks(enemy);
    state.turn++;
    moveEnemies();
    computeVisibility();
    renderAll();
    return;
  }

  // 이동
  player.r = nr; player.c = nc;
  state.turn++;
  state.score += 1;
  addLog('move', `🚶 Move (${nr},${nc})`);

  // 아이템 획득
  const iIdx = items.findIndex(i => i.r === nr && i.c === nc);
  if (iIdx !== -1) {
    player.hp = Math.min(MAX_HP, player.hp + ITEM_HEAL);
    state.score += 20;
    items.splice(iIdx, 1);
    addLog('item', `💊 Recovery Item! +${ITEM_HEAL} HP (Current: ${player.hp})`);
  }

  // Exit 도착
  if (nr === exit.r && nc === exit.c) {
    endGame(true);
    return;
  }

  // Enemy 이동 → 재렌더
  moveEnemies();
  computeVisibility();
  renderAll();
}

// ── Game Over ──
function endGame(win) {
  state.over = true;
  computeVisibility();
  renderAll();
  const overlay = document.getElementById('overlay');
  const bonus = win ? state.kills * 30 : 0;
  if (win) state.score += bonus;
  overlay.querySelector('#overlayTitle').textContent = win ? '🎉 Escape Successful!' : '💀 Dead';
  overlay.querySelector('#overlayMsg').textContent = win
    ? `Escaped the dungeon!\nFinal Score: ${state.score}pts`
    : `Health depleted.\nFinal Score: ${state.score}pts`;
  overlay.querySelector('#overlaySub').textContent =
    `Turn: ${state.turn} | Kills: ${state.kills} monsters` + (win ? ` | Bonus +${bonus}` : '');
  overlay.classList.add('active');
}

// ── 키 입력 ──
document.addEventListener('keydown', (e) => {
  if (!document.getElementById('gameScreen').classList.contains('active')) return;
  const map = {
    ArrowUp:'U', ArrowDown:'D', ArrowLeft:'L', ArrowRight:'R',
    w:'U', s:'D', a:'L', d:'R',
    W:'U', S:'D', A:'L', D:'R',
  };
  const dir = map[e.key];
  if (!dir) return;
  e.preventDefault();
  const mv = { U:[-1,0], D:[1,0], L:[0,-1], R:[0,1] }[dir];
  movePlayer(mv[0], mv[1]);
});

// ── 화면 전환 ──
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── 버튼 이벤트 ──
document.getElementById('btnStart').addEventListener('click', () => {
  showScreen('gameScreen');
  initGame();
});

document.getElementById('btnRestart').addEventListener('click', () => {
  document.getElementById('overlay').classList.remove('active');
  initGame(); // 모든 Status 완전 초기화
});
