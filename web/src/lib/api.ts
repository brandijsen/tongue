import axios from "axios";

const raw = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
const baseURL = raw.replace(/\/$/, "");

export const api = axios.create({
  baseURL,
  timeout: 120_000,
  headers: { "Content-Type": "application/json" },
});

export function isApiConfigured(): boolean {
  return baseURL.length > 0;
}
