import "dotenv/config";
import { setDefaultResultOrder } from "node:dns";
import { setDefaultAutoSelectFamily } from "node:net";
import app from "./app.js";

// Prefer IPv4 addresses when resolving hostnames.
setDefaultResultOrder("ipv4first");

// Prevent Node.js from attempting multiple IP address families
// when establishing outgoing TCP connections.
setDefaultAutoSelectFamily(false);

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.log(`LittleSpace API is running on http://localhost:${PORT}`);
});
