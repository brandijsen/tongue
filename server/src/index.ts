import "./loadEnv";
import cors from "cors";
import express from "express";
import { chatRouter } from "./api/chatRoute";
import { prisma } from "./lib/prisma";

const app = express();

const isProd = process.env.NODE_ENV === "production";
const corsFromEnv =
  process.env.CORS_ORIGIN?.split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean) ??
  [];
const allowedOrigins =
  corsFromEnv.length > 0
    ? corsFromEnv
    : isProd
      ? []
      : ["http://localhost:3000", "http://127.0.0.1:3000"];
if (isProd && allowedOrigins.length === 0) {
  console.error("CORS_ORIGIN is required in production: set one or more origins (comma-separated), no *.");
  process.exit(1);
}
app.use(cors({ origin: allowedOrigins }));

app.use(express.json({ limit: "1mb" }));

// Chat API: all conversation traffic is POST /api/chat (no GET for messages)
app.use("/api/chat", chatRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const port = Number(process.env.PORT) || 4000;

void (async function start() {
  try {
    await prisma.$connect();
    console.log("Prisma connected to database");
    app.listen(port, () => {
      console.log(`Tongue API listening on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to connect Prisma — not starting HTTP server", err);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  }
})();
