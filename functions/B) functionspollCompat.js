import { onRequest } from "firebase-functions/v2/https";
import { createDailyPoll } from "./dailyDose.js";

// Manual trigger endpoint (optional)
export const generateDailyPoll = onRequest({ region: "us-central1" }, async (req, res) => {
  // This “exists” so Firebase can deploy it. If you want it to actually run the scheduler logic,
  // we can add a shared helper later.
  res.status(200).json({ ok: true, message: "generateDailyPoll endpoint is active (manual trigger stub)." });
});
