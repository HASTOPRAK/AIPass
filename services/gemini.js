import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not defined in environment variables");
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const DEFAULT_MODEL = "gemini-2.0-flash";

function buildPrompt(toolKey, input) {
    const text = input.trim();

    switch (toolKey) {
    case "summarizer":
      return `Summarize the text below into:
- 5 bullet key points
- 3 action items
- 1 short TL;DR line

Text:
"""${text}"""`;

    case "email_writer":
      return `Write a professional email based on the request below.
Return ONLY the email body.

Request:
"""${text}"""`;

    case "marketing_copy":
      return `Write marketing copy based on the details below:
- 1 headline
- 1 subheadline
- 5 benefit bullets
- 1 short CTA

Details:
"""${text}"""`;

    case "action_plan":
  return `You are an assistant that converts meeting notes into a clean action plan.

Return in this exact format:

1) Summary (3 bullets)
2) Decisions (bullets)
3) Action items (checkbox list). Each item must include:
   - Owner (if unknown, write "Unassigned")
   - Due date (if unknown, write "No date")
4) Risks / blockers (bullets)
5) Next meeting agenda (bullets)

Meeting notes:
"""${text}"""`;


    default:
      return text;
  }
}

export async function runGeminiTool({ toolKey, input }) {
  const prompt = buildPrompt(toolKey, input);

  const response = await ai.models.generateContent({
    model: DEFAULT_MODEL,
    contents: prompt,
    config: {
      temperature: 0.6,
      maxOutputTokens: 400,
      candidateCount: 1,
    },
  });

  const text = (response.text || "").trim();
  if (!text) {
    throw new Error("AI returned empty response");
    }
    return text;
  }