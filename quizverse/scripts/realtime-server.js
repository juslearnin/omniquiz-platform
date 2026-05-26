const http = require("http");
const { Server } = require("socket.io");

const port = Number(process.env.REALTIME_PORT || 3001);

const server = http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === "POST" && req.url === "/emit") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const event = JSON.parse(body || "{}");
        io.emit("omniquiz:event", {
          type: event.type || "sync",
          quizId: event.quizId || null,
          actorId: event.actorId || null,
          at: Date.now(),
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Invalid realtime payload." }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ success: false, error: "Not found." }));
});

const io = new Server(server, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  socket.emit("omniquiz:ready", { socketId: socket.id, at: Date.now() });
});

server.listen(port, () => {
  console.log(`[omniquiz-realtime] listening on http://localhost:${port}`);
});
