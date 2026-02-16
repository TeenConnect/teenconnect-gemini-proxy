import { onRequest } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const db = getFirestore();

// Basic “queue letter” endpoint
export const sendLetter = onRequest({ region: "us-central1" }, async (req, res) => {
  const body = req.body || {};
  await db.collection("lettersQueue").add({
    ...body,
    status: "queued",
    createdAt: FieldValue.serverTimestamp(),
  });
  res.json({ ok: true, message: "Letter queued." });
});

// Basic “deliver letters” endpoint (manual)
export const deliverLetters = onRequest({ region: "us-central1" }, async (req, res) => {
  // Stub: you can implement email/push later.
  res.json({ ok: true, message: "deliverLetters endpoint is active (delivery logic not implemented yet)." });
});
