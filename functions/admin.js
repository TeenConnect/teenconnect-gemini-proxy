// functions/admin.js (ESM)
// Single source of truth: initializes firebase-admin ONCE + exports db/bucket.

import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

/**
 * Your real bucket (from Firebase Console):
 * teenconnect-b2871.firebasestorage.app
 */
function resolveStorageBucket() {
  // Hard-lock to your real bucket first (matches your screenshots)
  const locked = "teenconnect-b2871.firebasestorage.app";
  if (locked) return locked;

  // (Fallbacks kept for safety)
  if (process.env.FIREBASE_STORAGE_BUCKET) return process.env.FIREBASE_STORAGE_BUCKET;

  try {
    const cfg = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG) : {};
    if (cfg?.storageBucket) return cfg.storageBucket;
  } catch {
    // ignore
  }

  if (process.env.GCLOUD_PROJECT) return `${process.env.GCLOUD_PROJECT}.firebasestorage.app`;
  return "";
}

export const STORAGE_BUCKET_NAME = resolveStorageBucket();

// ✅ Init admin exactly once
if (!getApps().length) {
  initializeApp(
    STORAGE_BUCKET_NAME ? { storageBucket: STORAGE_BUCKET_NAME } : undefined
  );
}

export const db = getFirestore();

// ✅ Always use explicit bucket name so admin never guesses wrong
export const bucket = getStorage().bucket(STORAGE_BUCKET_NAME);
