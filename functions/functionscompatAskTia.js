import { onRequest } from "firebase-functions/v2/https";
import { askTia } from "./askTia.js";

// Same behavior as askTia, just older function names kept alive.
export const askTiaHttp = onRequest({ region: "us-central1" }, (req, res) => askTia(req, res));

// If you used to call a “frontend” endpoint, you can keep it.
// Here we just point people to Hosting.
export const askTiaFrontend = onRequest({ region: "us-central1" }, (req, res) => {
  res.status(200).send("Frontend is served by Hosting. Use /api/ask-tia for API.");
});
