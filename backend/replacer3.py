import os

replacements = {
    '조작: <strong>← →</strong> Move |': 'Controls: <strong>← →</strong> Move |',
    'setMessage("MULTI! 공이 늘어났습니다");': 'setMessage("MULTI! Balls increased");',
    'Cleared all bricks.<br>최종 Score:': 'Cleared all bricks.<br>Final Score:',
    'LivesLost all.<br>최종 Score:': 'LivesLost all.<br>Final Score:',
    'ctx.fillText("조작: ← →", W - 155, 49);': 'ctx.fillText("Controls: ← →", W - 155, 49);',
    'ctx.fillText(`효과: ${effectText.join(", ")}`, 330, 49);': 'ctx.fillText(`Effect: ${effectText.join(", ")}`, 330, 49);',
    "const descs=[['W','Expand Paddle','#00d4ff'],['S','속도 감소','#ffd166'],['♥','체력 +1','#ff4d6d'],['M','멀티볼','#06d6a0']];": "const descs=[['W','Expand Paddle','#00d4ff'],['S','Speed Down','#ffd166'],['♥','Life +1','#ff4d6d'],['M','Multiball','#06d6a0']];",
    "cx.fillText('← → Arrow keys Paddle controls  |  Space 공 발사',W/2,420);": "cx.fillText('← → Arrow keys Paddle controls  |  Space Launch Ball',W/2,420);",
    'cx.fillText(`최종 Score: ${gs.score}`,W/2,320);': 'cx.fillText(`Final Score: ${gs.score}`,W/2,320);',
    '<p class="small" style="margin-top:12px">패들: ← → | Pause: P | 재시작: R</p>': '<p class="small" style="margin-top:12px">Paddle: ← → | Pause: P | Restart: R</p>',
    '<p class="muted">세련된 테마의 Enhanced Arkanoid</p>': '<p class="muted">Enhanced Arkanoid with a stylish theme</p>',
    '<button class="btn" id="restartBtn">재시작</button>': '<button class="btn" id="restartBtn">Restart</button>',
    "<button class=\"btn\" id=\"againBtn\">${win ? '다음 Level' : 'Restart'}</button>": "<button class=\"btn\" id=\"againBtn\">${win ? 'Next Level' : 'Restart'}</button>",
    "h && h.addEventListener('click', ()=> alert('좌우 Use arrow keys to control the paddle.\\nPto Pause, R to Restart.'));": "h && h.addEventListener('click', ()=> alert('Use Left/Right arrow keys to control the paddle.\\nP to Pause, R to Restart.'));",
    "howBtn.addEventListener('click', ()=> alert('좌우 Use arrow keys to control the paddle.\\nPto Pause, R to Restart.'));": "howBtn.addEventListener('click', ()=> alert('Use Left/Right arrow keys to control the paddle.\\nP to Pause, R to Restart.'));",
    "if(h) h.addEventListener('click', ()=> alert('좌우 Use arrow keys to control the paddle.\\nPto Pause, R to Restart.'));": "if(h) h.addEventListener('click', ()=> alert('Use Left/Right arrow keys to control the paddle.\\nP to Pause, R to Restart.'));",
    "<li><strong>좌우 Arrow keys</strong>to move the paddle</li>": "<li><strong>Left/Right Arrow keys</strong> to move the paddle</li>",
    "<li>공이 바닥에 떨어지면 Lives이 줄어듭니다</li>": "<li>Lose a life if the ball drops</li>",
    '최종 Score: <span id="final-score">0</span></p>': 'Final Score: <span id="final-score">0</span></p>',
    '<p>모든 Lives을 잃었습니다.<br>': '<p>Lost all lives.<br>',
    '획득 Score: <span id="gameover-score">0</span></p>': 'Score: <span id="gameover-score">0</span></p>',
    '<span>초록색: 더 많은 Score (30점)</span>': '<span>Green: More points (30pts)</span>',
    "DOUBLE_POINTS: {color: '#2ecc71', effect: 'Score 2배'}": "DOUBLE_POINTS: {color: '#2ecc71', effect: 'Double Score'}",
    "message = 'Score 2배';": "message = 'Double Score';",
    '<p id="result-score">최종 Score: 0</p>': '<p id="result-score">Final Score: 0</p>',
    'resultScore.innerText = `최종 Score: ${score}`;': 'resultScore.innerText = `Final Score: ${score}`;',
    'ctx.fillText("최종 Score: " + score, canvas.width / 2, canvas.height / 2 + 20);': 'ctx.fillText("Final Score: " + score, canvas.width / 2, canvas.height / 2 + 20);',
    '← → Arrow keys : 패들 Move<br>': '← → Arrow keys : Move Paddle<br>',
    "document.getElementById('lose-score-text').innerHTML = `최종 Score <strong>${score}</strong>`;": "document.getElementById('lose-score-text').innerHTML = `Final Score <strong>${score}</strong>`;",
    "document.getElementById('win-score-text').innerHTML = `최종 Score <strong>${score}</strong>`;": "document.getElementById('win-score-text').innerHTML = `Final Score <strong>${score}</strong>`;",
    '<div class="final-score">최종 Score: <span id="finalScore">0</span></div>': '<div class="final-score">Final Score: <span id="finalScore">0</span></div>',
    '<div class="final-score">최종 Score: <span id="victoryScore">0</span></div>': '<div class="final-score">Final Score: <span id="victoryScore">0</span></div>',
    '<p id="endDesc">최종 Score: 0</p>': '<p id="endDesc">Final Score: 0</p>',
    "endDesc.textContent=`최종 Score: ${score}`": "endDesc.textContent=`Final Score: ${score}`",
    "endDesc.textContent=`완벽 클리어! Score: ${score}`": "endDesc.textContent=`Perfect Clear! Score: ${score}`",
    '<p>최종 Score: <span id="final-score-loss">0</span></p>': '<p>Final Score: <span id="final-score-loss">0</span></p>',
    '<p>총 Score: <span id="final-score-win">0</span></p>': '<p>Total Score: <span id="final-score-win">0</span></p>',
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
        
print('Tertiary replacements done.')
