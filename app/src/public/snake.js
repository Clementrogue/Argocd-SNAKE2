'use strict';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const GRID = 20; // 20x20 cases
const CELL = canvas.width / GRID;

const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlay-text');
const scoreboardEl = document.getElementById('scoreboard');
const versionBadge = document.getElementById('version-badge');

let accent = '#39ff14';
let snake, dir, nextDir, food, score, best, loop, running;

best = Number(localStorage.getItem('snake-best') || 0);
bestEl.textContent = best;

function reset() {
  snake = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
  dir = { x: 1, y: 0 };
  nextDir = dir;
  score = 0;
  scoreEl.textContent = 0;
  placeFood();
}

function placeFood() {
  do {
    food = {
      x: Math.floor(Math.random() * GRID),
      y: Math.floor(Math.random() * GRID),
    };
  } while (snake.some((s) => s.x === food.x && s.y === food.y));
}

function draw() {
  ctx.fillStyle = '#16162a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // nourriture
  ctx.fillStyle = '#ff3b6b';
  ctx.fillRect(food.x * CELL + 2, food.y * CELL + 2, CELL - 4, CELL - 4);

  // serpent
  ctx.fillStyle = accent;
  snake.forEach((seg, i) => {
    ctx.globalAlpha = i === 0 ? 1 : 0.85;
    ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
  });
  ctx.globalAlpha = 1;
}

function step() {
  dir = nextDir;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
  const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);
  if (hitWall || hitSelf) return gameOver();

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreEl.textContent = score;
    placeFood();
  } else {
    snake.pop();
  }
  draw();
}

function start() {
  reset();
  draw();
  overlay.classList.add('hidden');
  running = true;
  clearInterval(loop);
  loop = setInterval(step, 110);
}

async function gameOver() {
  clearInterval(loop);
  running = false;
  if (score > best) {
    best = score;
    bestEl.textContent = best;
    localStorage.setItem('snake-best', String(best));
  }
  overlayText.textContent = `Perdu ! Score : ${score} — ESPACE pour rejouer`;
  overlay.classList.remove('hidden');

  if (score > 0) {
    const player = (localStorage.getItem('snake-player') || '').trim();
    const name =
      player || (prompt('Ton pseudo pour le classement ?', 'anonyme') || 'anonyme');
    localStorage.setItem('snake-player', name);
    try {
      await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player: name, score }),
      });
      loadScores();
    } catch (e) {
      /* API indisponible : on ignore */
    }
  }
}

async function loadScores() {
  try {
    const res = await fetch('/api/scores');
    const scores = await res.json();
    if (!scores.length) return;
    scoreboardEl.innerHTML = scores
      .map((s) => `<li><span>${escapeHtml(s.player)}</span><span>${s.score}</span></li>`)
      .join('');
  } catch (e) {
    /* silencieux */
  }
}

async function loadVersion() {
  try {
    const res = await fetch('/api/version');
    const { version, color } = await res.json();
    versionBadge.textContent = version;
    if (color) {
      accent = color;
      document.documentElement.style.setProperty('--accent', color);
    }
  } catch (e) {
    versionBadge.textContent = 'v?';
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// --- Contrôles ---
const KEYS = {
  ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 },
  z: { x: 0, y: -1 }, s: { x: 0, y: 1 }, q: { x: -1, y: 0 }, d: { x: 1, y: 0 },
};

document.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    e.preventDefault();
    if (!running) start();
    return;
  }
  const d = KEYS[e.key];
  if (!d || !running) return;
  // interdit le demi-tour
  if (d.x === -dir.x && d.y === -dir.y) return;
  nextDir = d;
});

canvas.addEventListener('click', () => { if (!running) start(); });

// init
loadVersion();
loadScores();
