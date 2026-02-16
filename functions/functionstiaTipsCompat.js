import { onRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

// Minimal versions so your old endpoints still deploy.
// You can replace the data source/format later.

export const getTiaTips = onRequest({ region: "us-central1" }, async (req, res) => {
  const snap = await db.collection("tiaTips").orderBy("createdAt", "desc").limit(25).get();
  const tips = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  res.json({ tips });
});

export const tiaTips = onRequest({ region: "us-central1" }, async (req, res) => {
  const snap = await db.collection("tiaTips").orderBy("createdAt", "desc").limit(10).get();
  const tips = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  res.json({ tips });
});

export const tiaPollAdvice = onRequest({ region: "us-central1" }, async (req, res) => {
  // Stub for compatibility. Add Gemini logic later if you want.
  res.json({
    text: "tiaPollAdvice endpoint is active. Tell me what inputs you want (pollId, votes, etc.) and I’ll wire it up."
  });
});
