const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// ✅ Use server-side env var ONLY
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ Missing GEMINI_API_KEY in .env");
  // Hard stop so you don't run a broken server silently
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

// -------------------------
// Ask Tia prompt router
// -------------------------
function getAskTiaSystem(category = "general") {
  const common = `
You are Ask Tia inside TeenConnect.
Be kind, teen-friendly, and practical.
Ask up to 2 follow-up questions if needed.
Do not request sensitive personal info (passwords, SSN, bank logins).
Keep it clear and readable.
`.trim();

  const systems = {
    devotionals: `
${common}
ROLE: Devotional guide.
Write a short uplifting devotional (6–12 sentences).
Include 1 Bible verse reference (reference only; no long quotes).
End with a short 1–2 sentence prayer.
`.trim(),

    homework: `
${common}
ROLE: Homework tutor.
Explain step-by-step in a way a high schooler understands.
If the problem is missing details, ask 1–2 questions.
`.trim(),

    teen_advice: `
${common}
ROLE: Teen advice mentor.
Be supportive, non-judgmental, and give actionable steps.
Encourage talking to a trusted adult for serious situations.
`.trim(),

    business: `
${common}
ROLE: Business/brand strategy coach.
Give practical steps, examples, and simple templates.
Focus on ethical, realistic advice.
`.trim(),

    financial: `
${common}
ROLE: Financial advisor style (teen-friendly).
Give practical money steps. If details are missing, ask 1–2 follow-ups.
Always end with: "This is general information, not financial advice."
`.trim(),

    general: `
${common}
ROLE: General assistant.
Be helpful and concise.
`.trim(),
  };

  return systems[category] || systems.general;
}

function buildAskTiaPrompt({ question, category, context }) {
  const ctx =
    context && typeof context === "object" && Object.keys(context).length
      ? `Context (optional): ${JSON.stringify(context)}`
      : "Context: none provided";

  return `
${ctx}
Category: ${category}

User question: ${question}
`.trim();
}

// ✅ Ask Tia endpoint (one endpoint, many categories)
app.post("/api/ask-tia", async (req, res) => {
  try {
    const { question, category = "general", context = {} } = req.body;

    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "Question is required." });
    }

    const system = getAskTiaSystem(category);
    const prompt = buildAskTiaPrompt({
      question: question.trim(),
      category,
      context,
    });

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const result = await model.generateContent(`${system}\n\n${prompt}`);
    const response = await result.response;

    res.json({ answer: response.text() });
  } catch (error) {
    console.error("❌ Error in /api/ask-tia:", error);
    res.status(500).json({ error: "Ask Tia failed to generate a response." });
  }
});

// ✅ Existing Gemini proxy route (supports either messages OR prompt)
app.post("/gemini", async (req, res) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const { messages, prompt } = req.body;

    if (!messages && !prompt) {
      return res
        .status(400)
        .json({ error: "Provide either 'messages' or 'prompt' in request body." });
    }

    // If messages exist, use them; otherwise use prompt text
    const input = messages || prompt;

    const result = await model.generateContent(input);
    const response = await result.response;

    res.json({ text: response.text() });
  } catch (error) {
    console.error("❌ Error in /gemini route:", error);
    res.status(500).json({ error: "Gemini failed to generate response." });
  }
});

// ✅ Ask Tia route — accepts { prompt: "..." }
app.post("/api/ask-tia", async (req, res) => {
  try {
    const prompt = (req.body?.prompt || "").trim();
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ text: response.text() });
  } catch (error) {
    console.error("❌ Error in /api/ask-tia route:", error);
    res.status(500).json({ error: "Gemini failed to generate response." });
  }
});

// ✅ Base route (optional, just for test)
// ✅ Base route (quick test)
app.get("/", (req, res) => {
  res.send("✅ Gemini API Proxy is running.");
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
