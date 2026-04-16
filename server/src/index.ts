import "dotenv/config";
import cors from "cors";
import express from "express";

const app = express();
app.use(express.json({ limit: "1mb" }));

const corsOrigin = process.env.CORS_ORIGIN;
app.use(
  cors(
    corsOrigin
      ? { origin: corsOrigin.split(",").map((o) => o.trim()) }
      : { origin: true },
  ),
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`Tongue API listening on port ${port}`);
});
