*** Begin Patch
*** Update File: functions/legacyCompat.js
@@
 // functions/legacyCompat.js (ESM, Firebase Functions v2)
 // Keeps old cloud function names alive WITHOUT breaking trigger types.
 
-import { onRequest, onCall } from "firebase-functions/v2/https";
+import { onRequest, onCall, HttpsError } from "firebase-functions/v2/https";
 import { onSchedule } from "firebase-functions/v2/scheduler";
 import { logger } from "firebase-functions";
 import { defineSecret } from "firebase-functions/params";
 import { FieldValue } from "firebase-admin/firestore";
 import { db, bucket } from "./admin.js";
 
 const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
 const GEMINI_MODEL = "gemini-2.5-flash";
 
 // ------------------------
 // Helpers
 // ------------------------
 function setCors(res) {
   res.set("Access-Control-Allow-Origin", "*");
   res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
   res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
+  res.set("Vary", "Origin");
 }
 
 async function callGemini({ apiKey, prompt }) {
   if (!apiKey) throw new Error("Missing GEMINI_API_KEY secret");
@@
   const resp = await fetch(url, {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({
       contents: [{ role: "user", parts: [{ text: String(prompt || "") }] }],
     }),
   });
 
   const data = await resp.json();
 
   if (!resp.ok) {
     logger.error("Gemini error:", resp.status, data);
     throw new Error(data?.error?.message || "Gemini request failed");
   }
 
   return (data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
 }
 
 function safeParseJSON(text) {
   const raw = String(text || "").trim();
   const match = raw.match(/{[\s\S]*}/);
   const candidate = match ? match[0] : raw;
   return JSON.parse(candidate);
 }
 
 // ------------------------
 // Legacy: askTiaFrontend / askTiaHttp (HTTP)
 // ------------------------
 export const askTiaFrontend = onRequest(
   { region: "us-central1", cors: true, timeoutSeconds: 60, secrets: [GEMINI_API_KEY] },
   async (req, res) => {
     if (req.method === "OPTIONS") {
       setCors(res);
       return res.status(204).send("");
     }
+    setCors(res);
     return res.json({
       ok: true,
       message: "askTiaFrontend is deprecated. Use /api/ask-tia (function askTia).",
     });
   }
 );
 
 export const askTiaHttp = onRequest(
   { region: "us-central1", cors: true, timeoutSeconds: 60, secrets: [GEMINI_API_KEY] },
   async (req, res) => {
     if (req.method === "OPTIONS") {
       setCors(res);
       return res.status(204).send("");
     }
+    setCors(res);
     return res.json({
       ok: true,
       message: "askTiaHttp is deprecated. Use /api/ask-tia (function askTia).",
     });
   }
 );
 
 // ------------------------
 // Legacy Tips endpoints (HTTP)
 // ------------------------
 async function tipsHandler(req, res, mode) {
   if (req.method === "OPTIONS") {
     setCors(res);
     return res.status(204).send("");
   }
+  setCors(res);
 
   try {
     const { topic = "self-confidence", question = "" } = req.body || {};
     const prompt = `
 You are Tia, a kind teen mentor.
@@
 export const tiaPollAdvice = onRequest(
   { region: "us-central1", cors: true, timeoutSeconds: 60, secrets: [GEMINI_API_KEY] },
   async (req, res) => tipsHandler(req, res, "tiaPollAdvice")
 );
 
 // ------------------------
 // ✅ Legacy sendLetter MUST stay CALLABLE (onCall) because it is deployed that way
 // Writes to Firestore outbox + Storage log
 // ------------------------
 export const sendLetter = onCall(
-  { region: "us-central1" },
+  { region: "us-central1" },
   async (request) => {
     try {
       const body = request.data || {};
       const to = String(body.to || "").trim();
       const subject = String(body.subject || "").trim();
       const message = String(body.message || "").trim();
 
       if (!to || !subject || !message) {
-        throw new Error("Missing to/subject/message");
+        throw new HttpsError("invalid-argument", "Missing to/subject/message");
       }
 
       const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
       const record = {
         id,
@@
 
       return { ok: true, id, status: "queued" };
     } catch (e) {
       logger.error("sendLetter (callable) failed:", e);
-      throw new Error("sendLetter failed: " + (e?.message || "unknown"));
+      // Keep callable-friendly error shape
+      if (e instanceof HttpsError) throw e;
+      throw new HttpsError("internal", "sendLetter failed: " + (e?.message || "unknown"));
     }
   }
 );
@@
 export const backupCycleSync = onCall(
   { region: "us-central1" },
   async () => {
     const collections = [
       "dailyDevotional",
       "dailyPolls",
       "lettersOutbox",
       "dailyPollsLegacy",
     ];
 
     const stamp = new Date().toISOString().replace(/[:.]/g, "-");
     const backup = {};
 
     for (const name of collections) {
       const snap = await db.collection(name).limit(500).get();
       backup[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
     }
 
     await bucket.file(`backups/manual/${stamp}.json`).save(JSON.stringify(backup, null, 2), {
       contentType: "application/json",
       cacheControl: "private, max-age=0, no-transform",
     });
 
     return { ok: true, saved: `backups/manual/${stamp}.json` };
   }
 );
*** End Patch
