// === 将棋UI：完全修正版 with タイマー＆棋譜保存・KIF ===

let game;
let selected;
let dropMode = false;
let selectedDrop = null;
let moveHistory = [];
let aiEnabled = false;
let selectedDropOwner = null;
let paused = false;

let boardElem;
let messageElem;
let turnElem;
let senteTimerElem;
let goteTimerElem;
let timerInterval = null;

let aiDifficulty = 2;
let aiPersonality = "バランス";

function updateTurn() {
  turnElem.textContent = `${game.turn}の番です`;
}

function updateTimers() {
  if (senteTimerElem && goteTimerElem) {
    const format = (sec) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
    senteTimerElem.textContent = `先手: ${format(game.time['先手'])}`;
    goteTimerElem.textContent = `後手: ${format(game.time['後手'])}`;
  }
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!paused) {
      game.decrementTime(game.turn);
      updateTimers();
      if (game.time[game.turn] <= 0) {
        messageElem.textContent = `${game.turn}の持ち時間切れです！`;
        disableInteraction();
        clearInterval(timerInterval);
      }
    }
  }, 1000);
}

function render() {
  boardElem.innerHTML = "";
  for (let y = 0; y < 9; y++) {
    const row = document.createElement("div");
    row.className = "row";
    for (let x = 0; x < 9; x++) {
      const cell = document.createElement("div");
      cell.className = "cell";

      const piece = game.board[y][x];
      if (piece) {
        const span = document.createElement("span");
        span.className = "piece";
        span.textContent = piece.promoted ? "成" + piece.type : piece.type;
        if (piece.owner === "後手") span.style.transform = "rotate(180deg)";
        span.addEventListener("click", () => handlePieceClick(x, y));
        cell.appendChild(span);
      }

      if (selected && selected.owner === game.turn) {
        const legalMoves = game.getLegalMoves(selected.x, selected.y);
        if (legalMoves.some(([mx, my]) => mx === x && my === y)) {
          cell.classList.add("legal-move");
          cell.addEventListener("click", () => handleCellClick(x, y));
        }
      }

      row.appendChild(cell);
    }
    boardElem.appendChild(row);
  }

  updateTurn();
  updateTimers();
  updateHands();
  updateKifuList();
}

function exportKif() {
  const data = {
    aiDifficulty,
    aiPersonality,
    time: game.time,
    history: moveHistory
  };
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kifu.json";
  a.click();
  URL.revokeObjectURL(url);
}

function exportKifAsKIF() {
  const lines = [];
  lines.push("手合割：平手");
  lines.push("先手：あなた");
  lines.push("後手：AI");

  moveHistory.forEach((move, i) => {
    const turn = i % 2 === 0 ? "▲" : "△";
    const num = i + 1;
    let moveStr = "";
    if (move.drop) {
      const file = move.to.x + 1;
      const rank = move.to.y + 1;
      moveStr = `${num} ${turn}${file}${rank}打${move.piece}`;
    } else {
      const fx = move.from.x + 1;
      const fy = move.from.y + 1;
      const tx = move.to.x + 1;
      const ty = move.to.y + 1;
      const promo = move.promote ? "成" : "";
      moveStr = `${num} ${turn}${tx}${ty}(${fx}${fy})${promo}`;
    }
    lines.push(moveStr);
  });

  const kifStr = lines.join("\n");
  const blob = new Blob([kifStr], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kifu.kif";
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", () => {
  boardElem = document.getElementById("board");
  messageElem = document.getElementById("message");
  turnElem = document.getElementById("turn");
  senteTimerElem = document.getElementById("sente-timer");
  goteTimerElem = document.getElementById("gote-timer");

  game = new ShogiGame();
  selected = null;
  dropMode = false;
  selectedDrop = null;
  moveHistory = [];
  aiEnabled = false;

  const controlPanel = document.createElement("div");
  controlPanel.className = "control-panel";
  document.body.appendChild(controlPanel);

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "棋譜保存";
  saveBtn.onclick = exportKif;
  controlPanel.appendChild(saveBtn);

  const loadInput = document.createElement("input");
  loadInput.type = "file";
  loadInput.accept = ".json";
  loadInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) importKif(file);
  };
  controlPanel.appendChild(loadInput);

  const aiToggle = document.createElement("button");
  aiToggle.id = "aiToggle";
  aiToggle.textContent = "AI: OFF";
  aiToggle.onclick = () => {
    aiEnabled = !aiEnabled;
    aiToggle.textContent = `AI: ${aiEnabled ? "ON" : "OFF"}`;
    if (aiEnabled && game.turn === "後手") aiPlay();
  };
  controlPanel.appendChild(aiToggle);

  const difficultyBtn = document.createElement("button");
  difficultyBtn.id = "difficultyBtn";
  difficultyBtn.textContent = "難易度: 普通";
  difficultyBtn.onclick = () => {
    aiDifficulty = aiDifficulty % 3 + 1;
    difficultyBtn.textContent = `難易度: ${["弱い", "普通", "強い"][aiDifficulty - 1]}`;
  };
  controlPanel.appendChild(difficultyBtn);

  const personalityBtn = document.createElement("button");
  personalityBtn.id = "personalityBtn";
  personalityBtn.textContent = "性格: バランス";
  personalityBtn.onclick = () => {
    aiPersonality = aiPersonality === "バランス"
      ? "攻撃" : aiPersonality === "攻撃"
      ? "防御" : "バランス";
    personalityBtn.textContent = `性格: ${aiPersonality}`;
  };
  controlPanel.appendChild(personalityBtn);

  const pauseBtn = document.createElement("button");
  pauseBtn.textContent = "一時停止";
  pauseBtn.onclick = () => {
    paused = !paused;
    pauseBtn.textContent = paused ? "再開" : "一時停止";
  };
  controlPanel.appendChild(pauseBtn);

  const kifBtn = document.createElement("button");
  kifBtn.textContent = "KIF保存";
  kifBtn.onclick = exportKifAsKIF;
  controlPanel.appendChild(kifBtn);

  startTimer();
  render();
});
