const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post("/api/gemini", async (req, res) => {
  const prompt = req.body.prompt;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }]
      })
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("❌ Gemini error:", err);
    res.status(500).json({ error: "Gemini request failed" });
  }
});

app.listen(PORT, () => console.log(`✅ Gemini proxy running on http://localhost:${PORT}`));
