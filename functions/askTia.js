*** Begin Patch
*** Update File: public/index.html
@@
-async function callAskTia(question, contextOverrides = {}) {
-  const user = firebase.auth().currentUser;
-  if (!user) throw new Error("Please sign in before using Ask Tia.");
-
-  const response = await fetch(ASK_TIA_ENDPOINT || "/api/ask-tia", {
-    method: "POST",
-    headers: { "Content-Type": "application/json" },
-    body: JSON.stringify({
-      prompt: `Context: ${JSON.stringify(contextOverrides || {})}
-
-Question: ${question}`,
-    }),
-  });
-
-  const asText = await response.text();
-  if (!response.ok) throw new Error(`AskTia API ${response.status}: ${asText}`);
-
-  let result = {};
-  try { result = JSON.parse(asText); } catch { result = { text: asText }; }
-  return result;
-}
+async function callAskTia(question, contextOverrides = {}) {
+  const user = firebase.auth().currentUser;
+  if (!user) throw new Error("Please sign in before using Ask Tia.");
+
+  // Callable function lives in us-central1 (matches your function config)
+  const fn = firebase.app().functions("us-central1").httpsCallable("askTia");
+
+  // Callable payload must be in "data"
+  const res = await fn({
+    mode: "chat",
+    question,
+    context: contextOverrides || {}
+  });
+
+  // Callable returns { answer, text } per your function
+  return res?.data || {};
+}
*** End Patch
