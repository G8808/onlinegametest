const firebaseConfig = {
  apiKey: "AIzaSyAq2dKVgaUr7rtRceO591APSpfeVZ4rrpM",
  authDomain: "onlinebattleship-bcf8a.firebaseapp.com",
  databaseURL: "https://onlinebattleship-bcf8a-default-rtdb.firebaseio.com",
  projectId: "onlinebattleship-bcf8a",
  storageBucket: "onlinebattleship-bcf8a.firebasestorage.app",
  messagingSenderId: "799242637486",
  appId: "1:799242637486:web:0e7aeff1d2cdc8a048dd3f",
  measurementId: "G-JT2WN2BGG8"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let playerId = Math.random().toString(36).substr(2,9);
let playerNum;
let roomRef;

let myBoard = Array(64).fill(0);
let enemyShots = Array(64).fill(0);

let phase = "placing";
let turn = 0;

const ships = [
  { name: "Carrier", size: 5 },
  { name: "Battleship", size: 4 },
  { name: "Cruiser", size: 3 },
  { name: "Submarine", size: 3 },
  { name: "Destroyer", size: 2 }
];

let currentShip = 0;
let direction = "horizontal";

function join() {
  const room = document.getElementById("room").value;
  roomRef = db.ref("battleship/" + room);

  roomRef.once("value", snap => {
    const data = snap.val();

    if (!data) {
      playerNum = 1;
      roomRef.set({
        players: {1: playerId},
        boards: {},
        turn: 1,
        phase: "placing"
      });
    } else {
      playerNum = 2;
      roomRef.child("players/2").set(playerId);
    }

    listen();
  });
}

function listen() {
  roomRef.on("value", snap => {
    const data = snap.val();
    if (!data) return;

    turn = data.turn;
    phase = data.phase;

    if (data.boards && data.boards[playerNum]) {
      myBoard = data.boards[playerNum];
    }

    render();
  });
}

function render() {
  document.getElementById("status").innerText =
    phase === "placing"
      ? (currentShip < ships.length ? `Place ${ships[currentShip].name} (${ships[currentShip].size} cells) - ${direction}` : "Waiting for opponent")
      : (turn === playerNum ? "Your turn" : "Enemy turn");

  drawGrid("myBoard", myBoard, phase === "placing" && currentShip < ships.length ? placeShip : null);
  drawGrid("enemyBoard", enemyShots, attack);
}

function drawGrid(id, board, clickFn) {
  const div = document.getElementById(id);
  div.innerHTML = "";

  board.forEach((cell,i) => {
    const d = document.createElement("div");
    d.className = "cell";

    if (cell === 1) d.style.background = "gray";
    if (cell === 2) d.style.background = "red";
    if (cell === 3) d.style.background = "blue";

    if (clickFn) d.onclick = () => clickFn(i);
    div.appendChild(d);
  });
}

function placeShip(i) {
  if (phase !== "placing" || currentShip >= ships.length) return;

  const ship = ships[currentShip];
  const size = ship.size;
  const boardSize = 8;

  let positions = [];
  if (direction === "horizontal") {
    if (i % boardSize + size > boardSize) return; // out of bounds
    for (let j = 0; j < size; j++) {
      positions.push(i + j);
    }
  } else {
    if (Math.floor(i / boardSize) + size > boardSize) return;
    for (let j = 0; j < size; j++) {
      positions.push(i + j * boardSize);
    }
  }

  // check overlap
  if (positions.some(pos => myBoard[pos] === 1)) return;

  // place
  positions.forEach(pos => myBoard[pos] = 1);

  roomRef.child("boards/" + playerNum).set(myBoard);

  currentShip++;

  if (currentShip >= ships.length) {
    roomRef.child("ready/" + playerNum).set(true);
    roomRef.once("value", snap=>{
      const data = snap.val();
      if (data.ready && data.ready[1] && data.ready[2]) {
        roomRef.update({ phase: "playing" });
      }
    });
  }
}

function toggleDirection() {
  direction = direction === "horizontal" ? "vertical" : "horizontal";
  render();
}

function attack(i) {
  if (phase !== "playing") return;
  if (turn !== playerNum) return;

  const enemyNum = playerNum === 1 ? 2 : 1;

  roomRef.child("boards/" + enemyNum).once("value", snap => {
    let enemyBoard = snap.val();

    if (!enemyBoard) return;

    if (enemyBoard[i] === 1) {
      enemyBoard[i] = 2;
      enemyShots[i] = 2;
    } else {
      enemyShots[i] = 3;
    }

    roomRef.child("boards/" + enemyNum).set(enemyBoard);

    const win = enemyBoard.filter(x=>x===1).length === 0;
    if (win) {
      alert("You win!");
      roomRef.remove();
      return;
    }

    roomRef.update({ turn: enemyNum });
  });
}