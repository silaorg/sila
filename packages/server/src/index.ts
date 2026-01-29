import { startServer } from "./server";

const port = Number(process.env.PORT) || 6001;
const dbPath = process.env.DB_PATH || "data/server.sqlite";
const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-me";

void startServer({
  port,
  dbPath,
  jwtSecret,
});
