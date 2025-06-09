

let game;
let selected;
let dropMode = false;
let selectedDrop = null;
let moveHistory = [];
let aiEnabled = false;
let selectedDropOwner = null;

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
    game.decrementTime(game.turn);
    updateTimers();
    if (game.time[game.turn] <= 0) {
      messageElem.textContent = `${game.turn}の持ち時間切れです！`;
      disableInteraction();
      clearInterval(timerInterval);
    }
  }, 1000);
}

function aiPlay() {
  if (!aiEnabled || game.turn !== "後手") return;

  const depth = aiDifficulty === 3 ? 4 : 2;
  const bestMove = { drop: true, to: { x: 4, y: 4 }, piece: '歩' }; // 仮: AIロジックを導入可能

  if (!bestMove) {
    messageElem.textContent = "先手の勝ち！";
    disableInteraction();
    return;
  }

  if (bestMove.drop) {
    game.drop(bestMove.to.x, bestMove.to.y, bestMove.piece);
    moveHistory.push(bestMove);
  } else {
    game.move(bestMove.from.x, bestMove.from.y, bestMove.to.x, bestMove.to.y, bestMove.promote);
    moveHistory.push(bestMove);
  }

  if (game.isCheckmate && game.isCheckmate()) {
    messageElem.textContent = "後手の勝ち！";
    disableInteraction();
    return;
  }

  render();
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

// --- 関数定義 ---
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

// --- DOMContentLoaded ---
document.addEventListener("DOMContentLoaded", () => {
  const kifBtn = document.createElement("button");
  kifBtn.textContent = "KIF保存";
  kifBtn.onclick = exportKifAsKIF; // ここで使ってもOK
});




function updateHands() {
  const senteHandElem = document.getElementById("sente-hand");
  const goteHandElem = document.getElementById("gote-hand");
  senteHandElem.innerHTML = "先手持ち駒: ";
  goteHandElem.innerHTML = "後手持ち駒: ";

  const addPieceSpan = (elem, type, count, owner) => {
    const span = document.createElement("span");
    span.className = "piece";
    span.textContent = `${type}×${count}`;
    if (owner === "後手") span.style.transform = "rotate(180deg)";
    span.addEventListener("click", () => {
      selectedDrop = type;
      selectedDropOwner = owner;
      dropMode = true;
      messageElem.textContent = `${owner}の${type} を打ちます。位置を選んでください。`;
    });
    elem.appendChild(span);
  };

  for (const [type, count] of Object.entries(game.hands["先手"])) {
    if (count > 0) addPieceSpan(senteHandElem, type, count, "先手");
  }
  for (const [type, count] of Object.entries(game.hands["後手"])) {
    if (count > 0) addPieceSpan(goteHandElem, type, count, "後手");
  }
}

function disableInteraction() {
  boardElem.style.pointerEvents = "none";
  const buttons = document.querySelectorAll("button");
  buttons.forEach(btn => btn.disabled = true);
  clearInterval(timerInterval);
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

      if (dropMode && selectedDrop && game.isLegalDrop(x, y, selectedDrop)) {
        cell.classList.add("legal-move");
        cell.addEventListener("click", () => handleDrop(x, y));
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
  updateHands();
  updateTimers();
}

function handleDrop(x, y) {
  if (!selectedDrop) return;
  if (game.drop(x, y, selectedDrop, selectedDropOwner)) {
    moveHistory.push({ drop: true, to: { x, y }, piece: selectedDrop });
    selectedDrop = null;
    selectedDropOwner = null;
    dropMode = false;
    if (aiEnabled) setTimeout(aiPlay, 300);
  }
  render();
}

function handlePieceClick(x, y) {
  const piece = game.board[y][x];
  if (piece && piece.owner === game.turn) {
    selected = { x, y, owner: piece.owner };
    messageElem.textContent = `${piece.type} を選択しました`;
    render();
  }
}

function handleCellClick(x, y) {
  const [sx, sy] = [selected.x, selected.y];
  const legalMoves = game.getLegalMoves(sx, sy);
  if (!legalMoves.some(([mx, my]) => mx === x && my === y)) {
    selected = null;
    render();
    return;
  }

  const piece = game.board[sy][sx];
  const autoPromote = game.shouldAutoPromote ? game.shouldAutoPromote(sx, sy, x, y) : false;
  let promote = false;
  if (autoPromote) promote = true;
  else if (game.canPromote && game.canPromote(sy, y, piece)) promote = confirm("成りますか？");

  if (game.move(sx, sy, x, y, promote)) {
    moveHistory.push({ drop: false, from: { x: sx, y: sy }, to: { x, y }, promote });
    selected = null;
    if (aiEnabled) setTimeout(aiPlay, 300);
  }
  render();
}

document.addEventListener("DOMContentLoaded", () => {
  // 初期化
  boardElem = document.getElementById("board");
  messageElem = document.getElementById("message");
  turnElem = document.getElementById("turn");

  game = new ShogiGame();
  selected = null;
  dropMode = false;
  selectedDrop = null;
  moveHistory = [];
  aiEnabled = false;

  // コントロールパネル作成
  const controlPanel = document.createElement("div");
  controlPanel.className = "control-panel";
  document.body.appendChild(controlPanel); // ★ 先に追加！

  // 棋譜保存ボタン
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "棋譜保存";
  saveBtn.onclick = exportKif;
  controlPanel.appendChild(saveBtn);

  // ファイル読込（JSON）
  const loadInput = document.createElement("input");
  loadInput.type = "file";
  loadInput.accept = ".json";
  loadInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) importKif(file);
  };
  controlPanel.appendChild(loadInput);

  // AI ON/OFF
  const aiToggle = document.createElement("button");
  aiToggle.id = "aiToggle";
  aiToggle.textContent = "AI: OFF";
  aiToggle.onclick = () => {
    aiEnabled = !aiEnabled;
    aiToggle.textContent = `AI: ${aiEnabled ? "ON" : "OFF"}`;
    if (aiEnabled && game.turn === "後手") aiPlay();
  };
  controlPanel.appendChild(aiToggle);

  // 難易度
  const difficultyBtn = document.createElement("button");
  difficultyBtn.id = "difficultyBtn";
  difficultyBtn.textContent = "難易度: 普通";
  difficultyBtn.onclick = () => {
    aiDifficulty = aiDifficulty % 3 + 1;
    difficultyBtn.textContent = `難易度: ${["弱い", "普通", "強い"][aiDifficulty - 1]}`;
  };
  controlPanel.appendChild(difficultyBtn);

  // 性格
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

  // 打ち込みキャンセル
  const cancelDropBtn = document.createElement("button");
  cancelDropBtn.textContent = "打ち込みキャンセル";
  cancelDropBtn.onclick = () => {
    selectedDrop = null;
    dropMode = false;
    messageElem.textContent = "打ち込みをキャンセルしました";
  };
  controlPanel.appendChild(cancelDropBtn);

  // KIF保存
  const kifBtn = document.createElement("button");
  kifBtn.textContent = "KIF保存";
  kifBtn.onclick = exportKifAsKIF;
  controlPanel.appendChild(kifBtn);

  // 一時停止/再開
  const pauseBtn = document.createElement("button");
  pauseBtn.textContent = "一時停止";
  let paused = false;
  pauseBtn.onclick = () => {
    paused = !paused;
    pauseBtn.textContent = paused ? "再開" : "一時停止";
    if (!paused && aiEnabled && game.turn === "後手") setTimeout(aiPlay, 300);
  };
  controlPanel.appendChild(pauseBtn);

  // 残りのUIセットアップ
  showKifuList();
  render();
});

