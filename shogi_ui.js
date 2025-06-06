

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
  boardElem = document.getElementById("board");
  messageElem = document.getElementById("message");
  turnElem = document.getElementById("turn");
  senteTimerElem = document.getElementById("sente-timer");
  goteTimerElem = document.getElementById("gote-timer");
  document.body.appendChild(controlPanel);

  game = new ShogiGame();
  render();
  startTimer();

  const aiToggle = document.getElementById("aiToggle");
  if (aiToggle) {
    aiToggle.onclick = () => {
      aiEnabled = !aiEnabled;
      aiToggle.textContent = `AI: ${aiEnabled ? "ON" : "OFF"}`;
      if (aiEnabled && game.turn === "後手") aiPlay();
    };
  }
  const controlPanel = document.createElement("div");
controlPanel.className = "control-panel";

const saveBtn = document.createElement("button");
saveBtn.textContent = "棋譜保存";
saveBtn.onclick = exportKif;
controlPanel.appendChild(saveBtn);

const pauseBtn = document.createElement("button");
pauseBtn.id = "pauseBtn";
pauseBtn.textContent = "一時停止";
pauseBtn.onclick = togglePause;
controlPanel.appendChild(pauseBtn);

document.body.appendChild(controlPanel);

});
