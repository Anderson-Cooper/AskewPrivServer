const server = require('http').createServer();
const io = require('socket.io')(server);

const {performance} = require('perf_hooks');

const Filter = require('bad-words'),
      filter = new Filter();

const recipes = {
  "workbench": {"wood": 20},
  "wall": {"wood": 30, "workbench": "+"},
  "fire": {"wood": 50, "stone": 5},
  "roof": {"wood": 20, "workbench": "+"},
  "oven": {"ash": 5, "stone": 15, "workbench": "+"},
  "steel": {"stone": 5, "oven": "+"},
  "steelwall": {"steel": 10, "workbench": "+"},  "pick": {"wood": 20, "workbench": "+"}
};

function sendToReady(...args) {
  const sockets = io.sockets.sockets;
  for (let socket in sockets) {
    if(!isready[socket]) continue;
    sockets[socket].emit(...args);
  }
}

function addItem(player, item, amt) {
  if(player === undefined) return;
  if(player.items[item] === undefined) {
    player.items[item] = amt;
  } else {
    player.items[item] += amt;
  }
}

function hasEnoughItems (items, recipe) {
  for(let item in recipe) {
    if (recipe[item] === '+') continue;
    if (items[item] === undefined || recipe[item] > items[item]) return false;
  }
  return true;
}

const players = {};

let   objects = [];

const objData = {
  'steel': {
    velY: 0
  },
  'wood': {
    velY: 0
  },
  'saw': {
    velY: 0
  },
  'fire': {
    strength: 20,
    velY: 0,
    onHit: function (socket, _) {
      this.strength --;

      if(this.strength < 1){
        addItem(players[socket.id], "ash", 5);
        socket.emit("addItem", "ash", 5);
        return true;
      }

      this.velY = 0.1;
    },
  },

  'oven': {
    strength: 40,
    velY: 0,
    onHit: function (socket, tool) {
      if(tool === "saw") return;
      this.strength --;

      if(this.strength < 1){
        addItem(players[socket.id], "stone", 15);
        socket.emit("addItem", "stone", 15);
        return true;
      }

      this.velY = 0.1;
    },
  },

  'workbench': {
    strength: 30,
    onHit: function (socket, _) {
      this.strength --;

      if(this.strength < 1){
        addItem(players[socket.id], "wood", 10);
        socket.emit("addItem", "wood", 10);
        return true;
      }

      this.velY = 0.1;
    },
    velY: 0
  },

  'wall': {
    strength: 30,
    onHit: function (socket, _) {
      this.strength --;

      if(this.strength < 1){
        addItem(players[socket.id], "wood", 10);
        socket.emit("addItem", "wood", 10);
        return true;
      }

      this.velY = 0.1;
    },
    velY: 0
  },

  'steelwall': {
    strength: 60,
    onHit: function (socket, tool) {
      if (tool === "saw") return;
      this.strength --;

      if(this.strength < 1){
        addItem(players[socket.id], "steel", 10);
        socket.emit("addItem", "steel", 10);
        return true;
      }

      this.velY = 0.1;
    },
    velY: 0
  },

  'roof': {
    onHit: () => {},
    velY: 0
  },

  'bush': {
    strength: 15,

    onHit: function (socket, tool) {
      this.strength --;
      socket.emit("addItem", "wood", tool === "saw" ? 1 : 2);
      addItem(players[socket.id], "wood", tool === "saw" ? 1 : 2);

      if(this.strength < 1) {
        this.strength = Math.floor(10 + Math.random() * 25);
        this.pos = {x: (Math.random() - 0.5) * 40, y: -1, z: (Math.random() - 0.5) * 40};

        const i = objects.indexOf(this);
        sendToReady("delete", i);
        objects.splice(i, 1);
        sendToReady("newObject", this);
        objects.push(this);
      } else this.velY = 0.1;
    },
    velY: 0,
    defaultOffsetY: 0.5
  },

  'tree': {
    strength: 25,

    onHit: function (socket, tool) {
      this.strength --;
      socket.emit("addItem", "wood", tool === "saw" ? 2 : 4);
      addItem(players[socket.id], "wood", tool === "saw" ? 2 : 4);

      if(this.strength < 1) {
        this.strength = Math.floor(10 + Math.random() * 25);
        this.pos = {x: (Math.random() - 0.5) * 40, y: -1, z: (Math.random() - 0.5) * 40};

        const i = objects.indexOf(this);
        sendToReady("delete", i);
        objects.splice(i, 1);
        sendToReady("newObject", this);
        objects.push(this);
      } else this.velY = 0.1;
    },
    velY: 0
  },

  'rock': {
    strength: 45,

    onHit: function (socket, tool) {
      if(tool === "saw") return;
      this.strength --;
      socket.emit("addItem", "stone", 1);
      addItem(players[socket.id], "stone", 1);

      if(this.strength < 1) {
        this.strength = Math.floor(10 + Math.random() * 25);
        this.pos = {x: (Math.random() - 0.5) * 40, y: -1, z: (Math.random() - 0.5) * 40};

        const i = objects.indexOf(this);
        sendToReady("delete", i);
        objects.splice(i, 1);
        sendToReady("newObject", this);
        objects.push(this);
      } else this.velY = 0.1;
    },
    velY: 0
  }
}

for(let i = 0; i < 150; i ++){
  objects.push({type: "bush", ...objData["bush"], pos: {x: (Math.random() - 0.5) * 80, y: -1, z: (Math.random() - 0.5) * 80}, rot: {x: Math.PI / -2, y: 0, z: Math.random() * Math.PI * 2}})
}
for(let i = 0; i < 50; i ++){
  objects.push({type: "tree", ...objData["tree"], pos: {x: (Math.random() - 0.5) * 80, y: -1, z: (Math.random() - 0.5) * 80}, rot: {x: Math.PI / -2, y: 0, z: Math.random() * Math.PI * 2}})
}
for(let i = 0; i < 25; i ++){
  objects.push({type: "rock", ...objData["rock"], pos: {x: (Math.random() - 0.5) * 80, y: -1, z: (Math.random() - 0.5) * 80}, rot: {x: Math.PI / -2, y: 0, z: Math.random() * Math.PI * 2}})
}

let isready = {};
let chatbuffers = {};

function newplr(socket, name) {
  players[socket.id] = {x: 0, y: 0, up: 0.7, r: 0, tool: {type: "saw", pos: {x: 0.7, y: 0.1, z: 0.43}, rot: {x: 0, y: Math.PI / 8, z: Math.PI / 8}}, name, items: {"saw": 1}};
}

io.on("connection", socket => {
  socket.on("ready", name => {
    isready[socket.id] = true;
    socket.emit("players", players);
    socket.emit("objects", objects);
    newplr(socket, name);
  });

  socket.on("tool", (type, pos, rot) => {
    if(!players[socket.id]) { socket.emit("giveReady"); return }
    players[socket.id].tool = {type, pos, rot};
  })

  socket.on("chat", msg => {
    if (chatbuffers[socket.id] !== undefined && performance.now() - chatbuffers[socket.id] <= 500) {
      chatbuffers[socket.id] = performance.now();
      socket.emit("incomingChat", "server: stop spamming");
    } else {
      chatbuffers[socket.id] = performance.now();
      sendToReady("incomingChat", filter.clean(msg));
    }
  })

  socket.on("positionUpdate", (x, y, up, r, toolPos, toolRot) => {
    if(!players[socket.id]) { socket.emit("giveReady"); return }
    players[socket.id].x = x;
    players[socket.id].y = y;
    players[socket.id].up = up;
    players[socket.id].r = r;
    players[socket.id].tool.pos = toolPos;
    players[socket.id].tool.rot = toolRot;
  })

  socket.on("hit", i => {
    const obj = objects[i];
    if(!obj) return;
    if(!players[socket.id]) { socket.emit("giveReady"); return }
    if(obj.onHit(socket, players[socket.id].tool.type)){
      objects = objects.filter(o => o !== obj);
      sendToReady("delete", i);
    }
  })

  socket.on('craft', item => {
    if (!players[socket.id]) { socket.emit("giveReady"); return }
    if (!hasEnoughItems(players[socket.id].items, recipes[item])) return;
    for(let resource in recipes[item]){
      if (recipes[item][resource] === "+") continue;
      addItem(players[socket.id], resource, -recipes[item][resource]);
    }
    addItem(players[socket.id], item, 1);
  })

  socket.on('build', (type, pos, rot) => {
    if (!players[socket.id]) { socket.emit("giveReady"); return }
    if (!players[socket.id].items[type]) return;
    addItem(players[socket.id], type, -1);
    objects.push({type, ...objData[type], pos, rot});
    sendToReady("newObject", objects[objects.length - 1]);
  })

  socket.on("disconnect", () => {1
    delete players[socket.id];
    delete isready[socket.id];
    sendToReady("players", players);
  })
})

let tick = 0;
let lastNightCycle = 0;
setInterval(() => {
  const send = tick % 6 === 0;
  
  if(send) {
    sendToReady("players", players);
    const newCycle = Math.floor((tick / 1520) % 2);
    if (lastNightCycle !== newCycle) {
      lastNightCycle = newCycle;
      sendToReady("nightCycle", lastNightCycle);
    }
  }

  let i = 0;
  for(let object of objects){
    object.pos.y += object.velY;
    object.velY -= 0.02;
    const lowest = (object.defaultOffsetY ? object.defaultOffsetY : 0);
    if(object.pos.y < lowest) {
      object.pos.y = lowest;
      object.velY = 0;
    }

    i ++;
  }

  if(send) sendToReady("nonDestructObj", objects);

  tick ++;
}, 16);

server.listen(3000);
