import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "AIzaSyDFOHvPqpGlNCug7I-UO83XXiUpKHifcNo" });

async function main() {
    console.log("working...")
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: "Who is martin luther king junior?",
  });
  console.log(response.text);
}

main();