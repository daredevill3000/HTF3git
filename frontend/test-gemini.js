import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI("AIzaSyAiRRHr7EX9PIlEO73fWevuC6gTZJM6rEA");
async function run() {
  const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash", "gemini-pro"];
  for (const m of models) {
    try {
      const model = genAI.getGenerativeModel({ model: m });
      const result = await model.generateContent("reply with 'ok'");
      console.log(`Success with ${m}:`, result.response.text().trim());
      break;
    } catch (e) {
      console.error(`Error with ${m}:`, e.message);
    }
  }
}
run();
