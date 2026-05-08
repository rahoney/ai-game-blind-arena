import os

replacements = {
    '조작: <strong>← →</strong> Move |': 'Controls: <strong>← →</strong> Move |',
    'setMessage("MULTI! 공이 늘어났습니다");': 'setMessage("MULTI! Balls increased");',
    'Cleared all bricks.<br>최종 Score:': 'Cleared all bricks.<br>Final Score:',
    'LivesLost all.<br>최종 Score:': 'LivesLost all.<br>Final Score:',
    'ctx.fillText("조작: ← →", W - 155, 49);': 'ctx.fillText("Controls: ← →", W - 155, 49);',
    'ctx.fillText(`효과: ${effectText.join(", ")}`, 330, 49);': 'ctx.fillText(`Effect: ${effectText.join(", ")}`, 330, 49);',
    'flash:0,           // 화면 플래시 강도': 'flash:0,           // Screen flash intensity',
    'launched:false,    // 공 발사 여부': 'launched:false,    // Ball launched or not',
    "const descs=[['W','Expand Paddle','#00d4ff'],['S','속도 감소','#ffd166'],['♥','체력 +1','#ff4d6d'],['M','멀티볼','#06d6a0']];": "const descs=[['W','Expand Paddle','#00d4ff'],['S','Speed Down','#ffd166'],['♥','Life +1','#ff4d6d'],['M','Multiball','#06d6a0']];",
    "cx.fillText('← → Arrow keys Paddle controls  |  Space 공 발사',W/2,420);": "cx.fillText('← → Arrow keys Paddle controls  |  Space Launch ball',W/2,420);",
    'cx.fillText(`최종 Score: ${gs.score}`,W/2,320);': 'cx.fillText(`Final Score: ${gs.score}`,W/2,320);',
    '패들: ← → | Pause: P | 재시작: R': 'Paddle: ← → | Pause: P | Restart: R',
    '세련된 테마의 Enhanced Arkanoid': 'Enhanced Arkanoid with stylish theme',
    '재시작': 'Restart',
    'let game; // 게임 인스턴스': 'let game; // Game instance',
    'this.items = []; // 떨어지는 아이템들': 'this.items = []; // Falling items',
    'this.itemChance = 0.22; // 특정 벽돌이 아이템 드롭 확률': 'this.itemChance = 0.22; // Drop chance',
    'this.spawnBall(); // 초기 볼': 'this.spawnBall(); // Initial ball',
    'const angle = rel * Math.PI/3; // 최대 60도': 'const angle = rel * Math.PI/3; // Max 60 deg',
    'p.vy += 0.12; // 중력': 'p.vy += 0.12; // Gravity',
    "다음 Level": "Next Level",
    "// DOM이 붙은 뒤에 이벤트 연결": "// Connect events after DOM attach",
    "좌우 Use arrow keys to control the paddle.\\nPto Pause, R to Restart.": "Use arrow keys to control the paddle.\\nP to Pause, R to Restart.",
    "- Game.resetAll: 모든 게임 상태(Score, Lives, 패들, 볼, 벽돌, 아이템, 파티클)를 초기화합니다.": "- Game.resetAll: Reset all game states.",
    "- Game.update: 매 프레임 패들/볼/아이템/파티클의 물리와 충돌을 처리합니다.": "- Game.update: Handle physics and collisions every frame.",
    "- 충돌 시 벽돌의 HP를 감소시키고 파티클을 생성하며, 특정 벽돌은 아이템을 드롭합 니다.": "- Generate particles on collision, specific bricks drop items.",
    "- 아이템은 패들과 충돌하면 즉시 applyItem으로 효과가 적용됩니다.": "- Items apply effects immediately upon collision with paddle.",
    "- restartGame은 requestAnimationFrame을 취소하고 Game 인스턴스를 새로 만들어 모 든 상태를 완전 초기화합니다.": "- restartGame completely resets all states.",
    "<strong>좌우 Arrow keys</strong>to move the paddle": "<strong>Left/Right Arrow keys</strong> to move the paddle",
    "공이 바닥에 떨어지면 Lives이 줄어듭니다": "Lose a life if the ball drops",
    '최종 Score: <span id="final-score">0</span></p>': 'Final Score: <span id="final-score">0</span></p>',
    '모든 Lives을 잃었습니다.<br>': 'Lost all lives.<br>',
    '획득 Score: <span id="gameover-score">0</span></p>': 'Score Acquired: <span id="gameover-score">0</span></p>',
    '<span>초록색: 더 많은 Score (30점)</span>': '<span>Green: More Score (30pts)</span>',
    "DOUBLE_POINTS: {color: '#2ecc71', effect: 'Score 2배'}": "DOUBLE_POINTS: {color: '#2ecc71', effect: 'Score x2'}",
    "let color = '#3498db'; // 기본 파란색": "let color = '#3498db'; // Default blue",
    "message = 'Score 2배';": "message = 'Score x2';",
    '<p id="result-score">최종 Score: 0</p>': '<p id="result-score">Final Score: 0</p>',
    "type: Math.random() > 0.5 ? 'WIDE' : 'FAST' // Expand Paddle 또는 Ball Speed Up": "type: Math.random() > 0.5 ? 'WIDE' : 'FAST' // Expand Paddle or Ball Speed Up",
    'resultScore.innerText = `최종 Score: ${score}`;': 'resultScore.innerText = `Final Score: ${score}`;',
    'const hasItem = Math.random() < 0.2; // 아이템 생성 확률': 'const hasItem = Math.random() < 0.2; // Item spawn chance',
    'paddleWidth = 160; // 즉시 적용': 'paddleWidth = 160; // Apply immediately',
    'setTimeout(() => { paddleWidth = 100; }, 5000); // 5초 후 원상복구': 'setTimeout(() => { paddleWidth = 100; }, 5000); // Reset after 5s',
    'ctx.shadowBlur = 0; // 초기화': 'ctx.shadowBlur = 0; // Reset',
    'p.alpha -= 0.02; // 서서히 투명해짐': 'p.alpha -= 0.02; // Fade out',
    'item.y += item.vy; // 아래로 떨어짐': 'item.y += item.vy; // Fall down',
    'ctx.fillText("최종 Score: " + score, canvas.width / 2, canvas.height / 2 + 20);': 'ctx.fillText("Final Score: " + score, canvas.width / 2, canvas.height / 2 + 20);',
    'ctx.textAlign = "left"; // 설정 복구': 'ctx.textAlign = "left"; // Restore setting',
    'const angle = (Math.random() * Math.PI / 2) - (Math.PI / 4); // -45도 ~ 45도': 'const angle = (Math.random() * Math.PI / 2) - (Math.PI / 4); // -45 to 45 deg',
    '← → Arrow keys : 패들 Move<br>': '← → Arrow keys : Move Paddle<br>',
    'const hue = 180 + r * 32; // 네온 그라데이션': 'const hue = 180 + r * 32; // Neon gradient',
    'document.getElementById(\'lose-score-text\').innerHTML = `최종 Score <strong>${score}</strong>`;': 'document.getElementById(\'lose-score-text\').innerHTML = `Final Score <strong>${score}</strong>`;',
    'ball.vy = -Math.abs(ball.vy) * 1.03; // 살짝 가속': 'ball.vy = -Math.abs(ball.vy) * 1.03; // Slight acceleration',
    'p.vy += 0.18; // 중력': 'p.vy += 0.18; // Gravity',
    'document.getElementById(\'win-score-text\').innerHTML = `최종 Score <strong>${score}</strong>`;': 'document.getElementById(\'win-score-text\').innerHTML = `Final Score <strong>${score}</strong>`;',
    'ball.vx = (Math.random() * 3.8 - 1.9); // 약간의 랜덤 각도': 'ball.vx = (Math.random() * 3.8 - 1.9); // Slight random angle',
    '<div class="final-score">최종 Score: <span id="finalScore">0</span></div>': '<div class="final-score">Final Score: <span id="finalScore">0</span></div>',
    '<div class="final-score">최종 Score: <span id="victoryScore">0</span></div>': '<div class="final-score">Final Score: <span id="victoryScore">0</span></div>',
    'this.vy += 0.2; // 중력': 'this.vy += 0.2; // Gravity',
    'this.trail = []; // 꼬리 효과': 'this.trail = []; // Trail effect',
    'return false; // 공 잃음': 'return false; // Ball lost',
    'const angle = hitPos * Math.PI / 3; // 최대 60도': 'const angle = hitPos * Math.PI / 3; // Max 60 deg',
    '<p id="endDesc">최종 Score: 0</p>': '<p id="endDesc">Final Score: 0</p>',
    "function gameOver(){ gameState='gameover'; endTitle.textContent='GAME OVER'; endDesc.textContent=`최종 Score: ${score}`; endScreen.classList.remove('hidden'); }": "function gameOver(){ gameState='gameover'; endTitle.textContent='GAME OVER'; endDesc.textContent=`Final Score: ${score}`; endScreen.classList.remove('hidden'); }",
    "function winGame(){ gameState='win'; endTitle.textContent='YOU WIN!'; endDesc.textContent=`완벽 클리어! Score: ${score}`; endScreen.classList.remove('hidden'); boom(W/2,H/2,'#a78bfa',120); }": "function winGame(){ gameState='win'; endTitle.textContent='YOU WIN!'; endDesc.textContent=`Perfect Clear! Score: ${score}`; endScreen.classList.remove('hidden'); boom(W/2,H/2,'#a78bfa',120); }",
    '<p>최종 Score: <span id="final-score-loss">0</span></p>': '<p>Final Score: <span id="final-score-loss">0</span></p>',
    '<p>총 Score: <span id="final-score-win">0</span></p>': '<p>Total Score: <span id="final-score-win">0</span></p>',
    "WIDER_PADDLE: { type: 'wider', color: '#FFD700', effect: () => game.paddle.width += 30 }, // 노란색": "WIDER_PADDLE: { type: 'wider', color: '#FFD700', effect: () => game.paddle.width += 30 }, // Yellow",
    "MINI_BALL: { type: 'mini', color: '#00FFFF', effect: () => { game.balls.forEach(b => b.radius = Math.max(4, b.radius - 2)); } }, // 청록색": "MINI_BALL: { type: 'mini', color: '#00FFFF', effect: () => { game.balls.forEach(b => b.radius = Math.max(4, b.radius - 2)); } }, // Cyan",
    "FROZEN_TIME: { type: 'frozen', color: '#FF69B4', effect: () => game.frozenTimer = 300 } // 분홍색 (시간 정지 느낌으로 속도를 줄임)": "FROZEN_TIME: { type: 'frozen', color: '#FF69B4', effect: () => game.frozenTimer = 300 } // Pink",
    "this.decay = Math.random() * 0.02 + 0.015; // 사라지는 속도": "this.decay = Math.random() * 0.02 + 0.015; // Decay rate",
    "this.dy = 2; // 떨어지는 속도": "this.dy = 2; // Falling speed",
    "this.dx = 4 * (Math.random() > 0.5 ? 1 : -1); // 초기 속도": "this.dx = 4 * (Math.random() > 0.5 ? 1 : -1); // Initial speed",
    "return true; // Touched the floor (손실)": "return true; // Touched the floor",
    "this.frozenTimer = 0; // Pause 타이머 (파워업용)": "this.frozenTimer = 0; // Pause timer",
    "this.resetBricks(); // 초기 배치": "this.resetBricks(); // Initial placement",
    "const colors = ['#e94560', '#5352ed', '#0f3460', '#e94560', '#ffd700']; // 색상 테마": "const colors = ['#e94560', '#5352ed', '#0f3460', '#e94560', '#ffd700']; // Color theme",
    "this.paddle.width = PADDLE_WIDTH; // Paddle Size 원상복구": "this.paddle.width = PADDLE_WIDTH; // Reset paddle size",
    "b.x = brickX; // 위치 저장 (애니메이션 용도 아님, 계산 용도)": "b.x = brickX; // Save position",
    "if (ball.y + ball.radius >= CANVAS_HEIGHT - 20 && // 패들 y 위치 부근": "if (ball.y + ball.radius >= CANVAS_HEIGHT - 20 && // Near paddle Y position"
}

d = 'backend/static/games/en/강화된 벽돌깨기'
files = [f for f in os.listdir(d) if f.endswith('.html')]

for f in files:
    filepath = os.path.join(d, f)
    with open(filepath, 'r', encoding='utf-8') as file:
        content = file.read()
    
    for k, v in replacements.items():
        content = content.replace(k, v)
        
    with open(filepath, 'w', encoding='utf-8') as file:
        file.write(content)
        
print('Replacements done.')