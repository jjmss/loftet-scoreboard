import { join } from "node:path";
import { listen } from "./server.js";

const port = Number(process.env.PORT || 3000);
const dbPath = process.env.DATABASE_PATH || join(process.cwd(), "data", "loftet.db");
const { port: bound } = await listen({ port, dbPath });
console.log(`Loftet lytter på port ${bound} (${dbPath})`);
