*** Begin Patch
*** Update File: functions/askTia.js
@@
-// functions/askTia.js (ESM, Firebase Functions v2)
-
-import { onRequest } from "firebase-functions/v2/https";
+// functions/askTia.js (ESM, Firebase Functions v2) — CALLABLE ONLY
+
+import { onCall, HttpsError } from "firebase-functions/v2/https";
 import { defineSecret } from "firebase-functions/params";
 import { initializeApp, getApps } from "firebase-admin/app";
 import { getAuth } from "firebase-admin/auth";
 import { getFirestore, FieldValue } from "firebase-admin/firestore";
 import { logger } from "firebase-functions";
@@
 const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
 const GEMINI_MODEL = "gemini-2.5-flash";
 
 // ✅ Init Admin ONCE (safe even if this file loads before index.js)
 if (!getApps().length) initializeApp();
 
-function setCors(res) {
-  res.set("Access-Control-Allow-Origin", "*");
-  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
-  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
-  res.set("Vary", "Origin");
-}
-
-export const askTia = onRequest(
+export const askTia = onCall(
   {
     region: "us-central1",
     secrets: [GEMINI_API_KEY],
     timeoutSeconds: 60,
-    cors: true,
   },
-  async (req, res) => {
+  async (request) => {
     try {
-      // Preflight
-      if (req.method === "OPTIONS") {
-        setCors(res);
-        return res.status(204).send("");
-      }
-
-      setCors(res);
-
-      // Only allow POST
-      if (req.method !== "POST") {
-        return res.status(405).json({ error: "Method not allowed" });
-      }
-
-      // Auth
-      const authHeader = req.headers.authorization || "";
-      const match = authHeader.match(/^Bearer (.+)$/i);
-      if (!match) {
-        return res.status(401).json({ error: "Missing Authorization Bearer token" });
-      }
-
-      const idToken = match[1];
-      const decoded = await getAuth().verifyIdToken(idToken);
-      const uid = decoded.uid;
-
-      // Body
-      const body = req.body && typeof req.body === "object" ? req.body : {};
-      const { mode = "chat", question = "", context = "" } = body;
+      // ✅ Callable auth (auto-verified by Firebase SDK on client)
+      if (!request.auth?.uid) {
+        throw new HttpsError("unauthenticated", "You must be logged in to use Tia.");
+      }
+
+      const uid = request.auth.uid;
+
+      // ✅ Callable data (client passes request.data)
+      const body = request.data && typeof request.data === "object" ? request.data : {};
+      const mode = String(body.mode || "chat");
+      const question = String(body.question || "").trim();
+      const context = body.context != null ? body.context : "";
 
-      if (mode === "chat" && !question) {
-        return res.status(400).json({ error: "Missing question" });
-      }
+      if (!mode) throw new HttpsError("invalid-argument", "Mode is required.");
+      if (mode === "chat" && !question) {
+        throw new HttpsError("invalid-argument", "Missing question");
+      }
 
       const db = getFirestore();
 
       // Load memory
       const profileRef = db.collection("askTia").doc(uid).collection("meta").doc("profile");
       const profileSnap = await profileRef.get();
       const profile = profileSnap.exists ? profileSnap.data() : {};
       const prevMemory = profile?.memory || "";
@@
       // Pull last N exchanges
       const msgsSnap = await db
         .collection("askTia")
         .doc(uid)
         .collection("messages")
         .orderBy("ts", "desc")
         .limit(20)
         .get();
@@
       lastExchanges.reverse();
 
       // 1) Update memory
       const memoryUpdatePrompt = `
 You maintain a very short memory profile about the user for future personalization.
 Keep it factual, safe, and under ~1200 characters. Keep only stable traits, preferences, sensitivities, goals, recurring topics.
 Avoid PII beyond what the user explicitly said and avoid secrets. Summarize, do not quote verbatim.
 
 Previous memory:
 ${prevMemory || "(empty)"}
 
 Recent exchanges (Q->A):
 ${lastExchanges.map((e) => `Q: ${e.q}\nA: ${e.a}`).join("\n")}
 
 New question:
 ${question}
 
 Update the memory now. Output only the updated memory text.
 `.trim();
 
       const updatedMemory = await callGeminiText({
         apiKey: GEMINI_API_KEY.value(),
         model: GEMINI_MODEL,
         prompt: memoryUpdatePrompt,
       });
 
       // Save memory
       await profileRef.set(
         {
           memory: updatedMemory,
           updatedAt: FieldValue.serverTimestamp(),
         },
         { merge: true }
       );
 
       // 2) Answer prompt
       const answerPrompt = `
 You are Tia, a helpful, kind women's health mentor for teens.
 Personalize using the memory and reflections data. Be supportive, concise, and practical.
 
 Memory:
 ${updatedMemory}
 
 Reflections and growth summary:
 ${typeof context === "string" ? context : JSON.stringify(context)}
 
 User question:
 ${question}
 
 Now give your answer. Do not include the words "Memory" or "Summary" in the reply.
 `.trim();
 
       const answer = await callGeminiText({
         apiKey: GEMINI_API_KEY.value(),
         model: GEMINI_MODEL,
         prompt: answerPrompt,
       });
 
       // Save message
       await db.collection("askTia").doc(uid).collection("messages").add({
         mode,
         question,
         context,
         answer,
         ts: FieldValue.serverTimestamp(),
       });
 
-      return res.status(200).json({ answer });
+      // ✅ Return shape for callable:
+      // - answer: matches your older HTTP response usage
+      // - text: easy drop-in for other clients that expect result.data.text
+      return { answer, text: answer };
     } catch (err) {
-      logger.error("askTia failed:", err);
-      setCors(res);
-      return res.status(500).json({ error: "Server error" });
+      logger.error("askTia failed:", err);
+      if (err instanceof HttpsError) throw err;
+      throw new HttpsError("internal", err?.message || "Server error");
     }
   }
 );
 
 async function callGeminiText({ apiKey, model, prompt }) {
   if (!apiKey) throw new Error("Missing GEMINI_API_KEY secret");
 
   const url =
     `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=` +
     encodeURIComponent(apiKey);
 
   const body = {
     contents: [{ role: "user", parts: [{ text: prompt }] }],
   };
 
   const r = await fetch(url, {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify(body),
   });
 
   const json = await r.json();
 
   if (!r.ok) {
     throw new Error(json?.error?.message || "Gemini request failed");
   }
 
   const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
   return String(text).trim();
 }
*** End Patch
