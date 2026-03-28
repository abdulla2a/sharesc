import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  // Socket.io logic
  const rooms: Record<string, string[]> = {};

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", (roomId: string) => {
      if (!rooms[roomId]) {
        rooms[roomId] = [];
      }
      
      // Check if user is already in room
      if (!rooms[roomId].includes(socket.id)) {
        // Notify others in room
        rooms[roomId].forEach(userId => {
          socket.to(userId).emit("user-joined", socket.id);
        });

        rooms[roomId].push(socket.id);
        socket.join(roomId);
        
        console.log(`User ${socket.id} joined room ${roomId}`);
      }
    });

    socket.on("leave-room", (roomId: string) => {
      if (rooms[roomId]) {
        rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
        socket.to(roomId).emit("user-left", socket.id);
        socket.leave(roomId);
        console.log(`User ${socket.id} left room ${roomId}`);
      }
    });

    socket.on("disconnect", () => {
      // Remove from all rooms
      Object.keys(rooms).forEach(roomId => {
        rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
        socket.to(roomId).emit("user-left", socket.id);
      });
      console.log(`User ${socket.id} disconnected`);
    });

    socket.on("signal", (data: { to: string; signal: any }) => {
      io.to(data.to).emit("signal", {
        from: socket.id,
        signal: data.signal,
      });
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
