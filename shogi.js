
// === 完全統合・公式ルール・AI対応版 shogi.js ===
// 含まれる機能: 駒の移動, 成り, 王手/詰み判定, 打ち歩詰め, 持将棋, 千日手, タイマー制御

class Piece {
  constructor(type, owner, promoted = false) {
    this.type = type;
    this.owner = owner;
    this.promoted = promoted;
  }

  clone() {
    return new Piece(this.type, this.owner, this.promoted);
  }

  toString() {
    return (this.owner === '後手' ? 'v' : '') + (this.promoted ? '+' : '') + this.type;
  }
}

class ShogiGame {
  constructor() {
    this.board = this.initBoard();
    this.turn = '先手';
    this.hands = { '先手': {}, '後手': {} };
    this.history = [];
    this.time = { '先手': 300, '後手': 300 }; // ⏱ 5分持ち時間（秒）
  }

  decrementTime(player) {
    if (this.time[player] > 0) {
      this.time[player]--;
    }
  }

  initBoard() {
    const B = null;
    const v = (t) => new Piece(t, '後手');
    const s = (t) => new Piece(t, '先手');
    return [
      [v('香'), v('桂'), v('銀'), v('金'), v('玉'), v('金'), v('銀'), v('桂'), v('香')],
      [B, v('飛'), B, B, B, B, B, v('角'), B],
      Array(9).fill(v('歩')),
      Array(9).fill(B),
      Array(9).fill(B),
      Array(9).fill(B),
      Array(9).fill(s('歩')),
      [B, s('角'), B, B, B, B, B, s('飛'), B],
      [s('香'), s('桂'), s('銀'), s('金'), s('王'), s('金'), s('銀'), s('桂'), s('香')]
    ];
  }

  isInsideBoard(x, y) {
    return x >= 0 && x < 9 && y >= 0 && y < 9;
  }

  getLegalDrops(type) {
    const result = [];
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        if (!this.board[y][x] && this.isLegalDrop(x, y, type)) {
          result.push([x, y]);
        }
      }
    }
    return result;
  }

  getLegalMoves(x, y) {
    const piece = this.board[y][x];
    if (!piece || piece.owner !== this.turn) return [];
    const dir = this.turn === '先手' ? -1 : 1;
    const moves = [];

    const addStep = (dx, dy) => {
      const nx = x + dx, ny = y + dy;
      if (!this.isInsideBoard(nx, ny)) return;
      const target = this.board[ny][nx];
      if (!target || target.owner !== piece.owner) moves.push([nx, ny]);
    };
    const addLine = (dx, dy) => {
      for (let i = 1; i < 9; i++) {
        const nx = x + dx * i, ny = y + dy * i;
        if (!this.isInsideBoard(nx, ny)) break;
        const target = this.board[ny][nx];
        if (!target) {
          moves.push([nx, ny]);
        } else {
          if (target.owner !== piece.owner) moves.push([nx, ny]);
          break;
        }
      }
    };

    if (piece.promoted && ['歩','香','桂','銀'].includes(piece.type)) {
      addStep(0, dir); addStep(1, dir); addStep(-1, dir);
      addStep(1, 0); addStep(-1, 0); addStep(0, -dir);
      return moves;
    }

    switch (piece.type) {
      case '歩': addStep(0, dir); break;
      case '香': addLine(0, dir); break;
      case '桂': addStep(-1, dir * 2); addStep(1, dir * 2); break;
      case '銀':
        addStep(-1, dir); addStep(0, dir); addStep(1, dir);
        addStep(-1, -dir); addStep(1, -dir); break;
      case '金':
      case 'と': case '成銀': case '成桂': case '成香':
        addStep(-1, dir); addStep(0, dir); addStep(1, dir);
        addStep(-1, 0); addStep(1, 0); addStep(0, -dir); break;
      case '角':
        addLine(1, 1); addLine(-1, 1); addLine(1, -1); addLine(-1, -1); break;
      case '飛':
        addLine(1, 0); addLine(-1, 0); addLine(0, 1); addLine(0, -1); break;
      case '王': case '玉':
        for (const dx of [-1,0,1]) {
          for (const dy of [-1,0,1]) {
            if (dx !== 0 || dy !== 0) addStep(dx, dy);
          }
        }
        break;
    }

    if (piece.promoted && (piece.type === '角' || piece.type === '飛')) {
      addStep(1,0); addStep(-1,0); addStep(0,1); addStep(0,-1);
      if (piece.type === '飛') {
        addStep(1,1); addStep(-1,-1); addStep(1,-1); addStep(-1,1);
      }
    }

    return moves;
  }

  

  shouldAutoPromote(fromX, fromY, toX, toY) {
    const piece = this.board[fromY][fromX];
    if (!piece || piece.promoted) return false;
    const player = this.turn;
    const movingTo = (player === "先手") ? toY : 8 - toY;
    if (piece.type === "歩" || piece.type === "香") return movingTo === 0;
    if (piece.type === "桂") return movingTo <= 1;
    return false;
  }

  canPromote(fromY, toY, piece) {
    if (!piece || piece.promoted) return false;
    const promoteZone = piece.owner === '先手' ? (fromY <= 2 || toY <= 2) : (fromY >= 6 || toY >= 6);
    const promotable = ['歩', '香', '桂', '銀', '角', '飛'];
    return promoteZone && promotable.includes(piece.type);
  }

  move(sx, sy, dx, dy, promote = false) {
    const piece = this.board[sy][sx];
    if (!piece || piece.owner !== this.turn) return false;
    const legal = this.getLegalMoves(sx, sy).some(([mx, my]) => mx === dx && my === dy);
    if (!legal) return false;

    const captured = this.board[dy][dx];
    const newPiece = piece.clone();
    if (promote) newPiece.promoted = true;

    const clone = this.clone();
    clone.board[sy][sx] = null;
    clone.board[dy][dx] = newPiece;

    if (clone.isKingInCheck(this.turn)) return false;

    if (captured) this.capture(captured);
    this.board[dy][dx] = newPiece;
    this.board[sy][sx] = null;
    this.toggleTurn();
    return true;
  }

  drop(x, y, type, owner = this.turn) {
    if (this.board[y][x]) return false;
    if (!this.isLegalDrop(x, y, type)) return false;

    if (type === "歩") {
      const clone = this.clone();
      clone.hands[owner][type]--;
      clone.board[y][x] = new Piece(type, owner);
      if (clone.isCheckmate()) return false; // 打ち歩詰め
    }

    const hand = this.hands[owner];
    if (!hand[type] || hand[type] <= 0) return false;

    this.board[y][x] = new Piece(type, owner);
    hand[type]--;
    if (owner === this.turn) this.toggleTurn();
    return true;
  }

  isLegalDrop(x, y, type) {
    if (this.board[y][x]) return false;
    if (type === '歩') {
      for (let row = 0; row < 9; row++) {
        const p = this.board[row][x];
        if (p && p.owner === this.turn && p.type === '歩' && !p.promoted) return false;
      }
      if ((this.turn === '先手' && y === 0) || (this.turn === '後手' && y === 8)) return false;
    }
    if (type === '桂') {
      if ((this.turn === '先手' && y <= 1) || (this.turn === '後手' && y >= 7)) return false;
    }
    if (type === '香') {
      if ((this.turn === '先手' && y === 0) || (this.turn === '後手' && y === 8)) return false;
    }
    return true;
  }

  capture(piece) {
    const type = piece.type;
    const owner = piece.owner === '先手' ? '後手' : '先手';
    const hand = this.hands[owner];
    hand[type] = (hand[type] || 0) + 1;
  }

  toggleTurn() {
    this.turn = this.turn === '先手' ? '後手' : '先手';
  }

  isKingInCheck(player) {
    let kingX = -1, kingY = -1;
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const p = this.board[y][x];
        if (p && p.owner === player && (p.type === '王' || p.type === '玉')) {
          kingX = x;
          kingY = y;
        }
      }
    }
    if (kingX === -1) return true;

    const opponent = player === "先手" ? "後手" : "先手";
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const p = this.board[y][x];
        if (p && p.owner === opponent) {
          const moves = this.getLegalMoves(x, y);
          if (moves.some(([tx, ty]) => tx === kingX && ty === kingY)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  isCheckmate() {
    if (!this.isKingInCheck(this.turn)) return false;
    const moves = this.generateAllLegalMoves();
    for (const move of moves) {
      const clone = this.clone();
      clone.applyMove(move);
      if (!clone.isKingInCheck(this.turn)) return false;
    }
    return true;
  }

  generateAllLegalMoves() {
    const moves = [];
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        const p = this.board[y][x];
        if (p && p.owner === this.turn) {
          for (const [mx, my] of this.getLegalMoves(x, y)) {
            const promote = this.shouldAutoPromote(x, y, mx, my);
            moves.push({ from: { x, y }, to: { x: mx, y: my }, promote, drop: false });
          }
        }
      }
    }
    for (const [type, count] of Object.entries(this.hands[this.turn])) {
      if (count > 0) {
        for (const [x, y] of this.getLegalDrops(type)) {
          moves.push({ drop: true, to: { x, y }, piece: type });
        }
      }
    }
    return moves;
  }

  applyMove(move) {
    if (move.drop) {
      this.drop(move.to.x, move.to.y, move.piece);
    } else {
      this.move(move.from.x, move.from.y, move.to.x, move.to.y, move.promote);
    }
  }

  clone() {
    const newGame = new ShogiGame();
    newGame.board = this.board.map(row => row.map(p => (p ? p.clone() : null)));
    newGame.turn = this.turn;
    newGame.hands = JSON.parse(JSON.stringify(this.hands));
    return newGame;
  }

  // 千日手と持将棋
  serialize() {
    return JSON.stringify({
      board: this.board.map(row => row.map(p => (p ? [p.type, p.owner, p.promoted] : null))),
      hands: this.hands,
      turn: this.turn
    });
  }

  pushHistory() {
    this.history.push(this.serialize());
  }

  isSennichite() {
    const current = this.serialize();
    return this.history.filter(h => h === current).length >= 4;
  }

  calculateMaterialPoints(player) {
    const values = { '飛': 5, '角': 5, '金': 1, 'と': 1, '成銀': 1, '成桂': 1, '成香': 1 };
    let points = 0;

    for (let row of this.board) {
      for (let p of row) {
        if (p && p.owner === player) {
          const key = p.promoted
            ? (p.type === '歩' ? 'と' :
               p.type === '銀' ? '成銀' :
               p.type === '桂' ? '成桂' :
               p.type === '香' ? '成香' : p.type)
            : p.type;
          points += values[key] || 0;
        }
      }
    }

    for (const [type, count] of Object.entries(this.hands[player])) {
      const key = (type === '歩' || type === '銀' || type === '香' || type === '桂') ? 'と' : type;
      points += (values[key] || 0) * count;
    }

    return points;
  }

  isJishogi() {
    return this.calculateMaterialPoints("先手") >= 24 &&
           this.calculateMaterialPoints("後手") >= 24;
  }
}
  
