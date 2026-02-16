// functions/index.js (ESM)

// IMPORTANT: this import runs FIRST and guarantees admin is initialized
import "./admin.js";

// Main function(s)
export { askTia } from "./askTia.js";

// Schedulers
export { generateDailyDevotional, createDailyPoll } from "./dailyDose.js";

// Legacy compatibility exports
export {
  askTiaFrontend,
  askTiaHttp,
  getTiaTips,
  tiaTips,
  tiaPollAdvice,
  sendLetter,
  deliverLetters,
  backupCycleSync,
  generateDailyPoll,
} from "./legacyCompat.js";
