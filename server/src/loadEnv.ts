import path from "path";
import dotenv from "dotenv";

/** Run before any module reads `process.env` (e.g. Prisma, CORS). */
dotenv.config({ path: path.join(__dirname, "..", ".env") });
