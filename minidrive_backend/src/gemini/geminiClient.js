const { GoogleGenAI } = require("@google/genai");
const geminiAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
module.exports = { geminiAi };