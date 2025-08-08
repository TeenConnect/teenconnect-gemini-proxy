const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Initialize Gemini model
const genAI = new GoogleGenerativeAI(process.env.API_KEY);

// ✅ MAIN ROUTE — Gemini proxy
app.post("/gemini", async (req, res) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // This expects the body to be like:
    // { "messages": [ { "role": "user", "parts": ["Your prompt here"] } ] }
    const result = await model.generateContent(req.body.messages);
    const response = await result.response;
    res.json({ text: response.text() });
  } catch (error) {
    console.error("❌ Error in /gemini route:", error);
    res.status(500).json({ error: "Gemini failed to generate response." });
  }
});

// ✅ Base route (optional, just for test)
app.get("/", (req, res) => {
  res.send("✅ Gemini API Proxy is running.");
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
