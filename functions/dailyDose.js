*** Begin Patch
*** Update File: functions/dailyDose.js
@@
 // functions/dailyDose.js (ESM, Firebase Functions v2)
 
 import { onSchedule } from "firebase-functions/v2/scheduler";
 import { logger } from "firebase-functions";
 import { defineSecret } from "firebase-functions/params";
 import { FieldValue } from "firebase-admin/firestore";
 import { db, bucket } from "./admin.js";
 
 const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
 const GEMINI_MODEL = "gemini-2.5-flash";
 
 function chicagoTodayKey() {
   const parts = new Intl.DateTimeFormat("en-US", {
     timeZone: "America/Chicago",
     year: "numeric",
     month: "2-digit",
     day: "2-digit",
   }).formatToParts(new Date());
 
   const get = (t) => parts.find((p) => p.type === t)?.value || "";
   return `${get("year")}-${get("month")}-${get("day")}`;
 }
 
 function tryExtractJSON(text) {
   const raw = String(text || "")
     .replace(/```json/gi, "```")
     .replace(/```/g, "")
     .trim();
 
   const match = raw.match(/{[\s\S]*}/);
   const candidate = match ? match[0] : raw;
 
   try {
     return JSON.parse(candidate);
   } catch {
     logger.error("JSON parse failed. Raw model output:", raw);
     throw new Error("Gemini did not return valid JSON");
   }
 }
 
 async function geminiGenerateJSON(apiKey, prompt) {
   if (!apiKey) throw new Error("Missing GEMINI_API_KEY secret");
 
   const url =
     `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
       GEMINI_MODEL
     )}:generateContent?key=` + encodeURIComponent(apiKey);
 
+  // ✅ Node 20: fetch is global. (No node-fetch needed.)
   const r = await fetch(url, {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({
       contents: [{ role: "user", parts: [{ text: prompt }] }],
     }),
   });
 
   const json = await r.json();
 
   if (!r.ok) {
     logger.error("Gemini HTTP error:", r.status, json);
     throw new Error(json?.error?.message || "Gemini request failed");
   }
 
   const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
   return tryExtractJSON(text);
 }
 
 // 🕘 5:55 AM – create daily devotional doc + Storage backup
 export const generateDailyDevotional = onSchedule(
   {
     schedule: "every day 05:55",
     timeZone: "America/Chicago",
     region: "us-central1",
     cpu: 1,
     secrets: [GEMINI_API_KEY],
   },
   async () => {
     const todayKey = chicagoTodayKey();
     const ref = db.collection("dailyDevotional").doc(todayKey);
 
     if ((await ref.get()).exists) {
       logger.info(`Devotional already exists for ${todayKey}, skipping.`);
       return;
     }
 
     const prompt = `
 Create a short daily devotional for young adults. Return JSON with:
 - "title"
 - "verse" (just the reference)
 - "scripture" (full text of verse)
 - "reflection" (2–3 paragraphs)
 - "prayer" (1 paragraph)
 - "challenge" (2 reflection questions, with a blank line between them)
 
 Use \\n for all line breaks. Format exactly like:
 
 {
   "date": "${todayKey}",
   "title": "Title Here",
   "verse": "John 3:16",
   "scripture": "For God so loved the world...",
   "reflection": "Line1...\\n\\nLine2...",
   "prayer": "Prayer here...",
   "challenge": "1. First reflection question?\\n\\n2. Second reflection question?"
 }
 
 Only return JSON. No extra text.
 `.trim();
 
     try {
       const devo = await geminiGenerateJSON(GEMINI_API_KEY.value(), prompt);
       devo.date = devo.date || todayKey;
 
       await ref.create(devo);
 
       await bucket.file(`devotionals/${todayKey}.json`).save(JSON.stringify(devo, null, 2), {
         contentType: "application/json",
         cacheControl: "public, max-age=300",
       });
 
       logger.info(`Devotional created for ${todayKey}`);
     } catch (err) {
       logger.error("Devotional generation failed:", err);
     }
   }
 );
 
 // 🗳️ 6:00 AM – create matching poll doc + Storage backup
 export const createDailyPoll = onSchedule(
   {
     schedule: "every day 06:00",
     timeZone: "America/Chicago",
     region: "us-central1",
     cpu: 1,
     secrets: [GEMINI_API_KEY],
   },
   async () => {
     const todayKey = chicagoTodayKey();
     const devoRef = db.collection("dailyDevotional").doc(todayKey);
     const pollRef = db.collection("dailyPolls").doc(todayKey);
 
     const devoSnap = await devoRef.get();
     if (!devoSnap.exists) {
       logger.warn(`No devotional found for ${todayKey}.`);
       return;
     }
 
     if ((await pollRef.get()).exists) {
       logger.info(`Poll already exists for ${todayKey}, skipping.`);
       return;
     }
 
     const d = devoSnap.data() || {};
     const prompt = `
 You're a teen mentor writing a devotional poll.
 
 Based on this reflection, return JSON with:
 - "question" (for reflection)
 - "options" (4 multiple-choice answers)
 - "challenges" (2 reflection/action questions)
 
 Use this structure:
 
 {
   "question": "Poll question here?",
   "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
   "challenges": ["Challenge question 1?", "Challenge question 2?"]
 }
 
 Only return JSON. No extra text.
 
 Reflection:
 ${d.reflection || ""}
 `.trim();
 
     try {
       const poll = await geminiGenerateJSON(GEMINI_API_KEY.value(), prompt);
 
       const record = {
         title: d.title || "",
         date: todayKey,
-        question: poll.question || "",
-        options: Array.isArray(poll.options) ? poll.options.slice(0, 4) : [],
-        challenges: Array.isArray(poll.challenges) ? poll.challenges.slice(0, 2) : [],
+        question: String(poll?.question || "").trim(),
+        options: Array.isArray(poll?.options) ? poll.options.slice(0, 4).map((o) => String(o).trim()) : [],
+        challenges: Array.isArray(poll?.challenges) ? poll.challenges.slice(0, 2).map((c) => String(c).trim()) : [],
         votes: [],
         answers: [],
         created: FieldValue.serverTimestamp(),
       };
 
+      // ✅ Guard: must have question + 4 options to be useful
+      if (!record.question || record.options.length < 2) {
+        throw new Error("Gemini returned incomplete poll JSON.");
+      }
+
       await pollRef.create(record);
 
       await bucket.file(`polls/${todayKey}.json`).save(JSON.stringify(record, null, 2), {
         contentType: "application/json",
         cacheControl: "public, max-age=300",
       });
 
       logger.info(`Poll created for ${todayKey}`);
     } catch (err) {
       logger.error("Poll generation failed:", err);
     }
   }
 );
*** End Patch
