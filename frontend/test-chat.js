import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI("AIzaSyBWJ7vmDdg5NjrBkfFCEmcElfKyx__q8mo");
async function run() {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: "You are an assistant.",
  });
  const chat = model.startChat({ history: [] });
  try {
    console.log("Sending message...");
    const result = await chat.sendMessage("Hello");
    console.log("Response:", result.response.text());
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
