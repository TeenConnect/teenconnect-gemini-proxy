import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";

export const backupCycleSync = onSchedule(
  {
    schedule: "every day 03:00",
    timeZone: "America/Chicago",
    region: "us-central1"
  },
  async () => {
    logger.info("backupCycleSync is active (stub). Implement your backup logic here.");
  }
);
