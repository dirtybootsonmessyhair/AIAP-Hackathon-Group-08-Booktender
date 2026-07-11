import { NextRequest, NextResponse } from "next/server";

const usage = new Map<string, { count: number; reset: number }>();

const moodPicks: Record<string, { title: string; author: string; note: string }[]> = {
  Cozy: [
    { title: "The Secret Garden", author: "Frances Hodgson Burnett", note: "gentle, restorative, and legally free on Project Gutenberg" },
    { title: "Little Women", author: "Louisa May Alcott", note: "warm family reading with enough substance to keep it from feeling thin" },
    { title: "Pride and Prejudice", author: "Jane Austen", note: "sharp, social, and easy to return to in small sittings" },
  ],
  Focused: [
    { title: "Atomic Habits", author: "James Clear", note: "practical habit design for a short, high-utility session" },
    { title: "Walden", author: "Henry David Thoreau", note: "public-domain reflection on attention and deliberate living" },
    { title: "Deep Work", author: "Cal Newport", note: "a strong paid route if the user wants productivity depth" },
  ],
  Hopeful: [
    { title: "The Secret Garden", author: "Frances Hodgson Burnett", note: "public-domain hope without empty sweetness" },
    { title: "The Alchemist", author: "Paulo Coelho", note: "a short paid fable when the user wants purpose and momentum" },
    { title: "Anne of Green Gables", author: "L. M. Montgomery", note: "legally free in many public-domain catalogues and emotionally bright" },
  ],
  Reflective: [
    { title: "Jane Eyre", author: "Charlotte Bronte", note: "public-domain inner life, boundaries, and self-respect" },
    { title: "The Kite Runner", author: "Khaled Hosseini", note: "paid literary fiction for guilt, repair, and memory" },
    { title: "Walden", author: "Henry David Thoreau", note: "a free, slower meditation on living deliberately" },
  ],
  Adventurous: [
    { title: "The Adventures of Sherlock Holmes", author: "Arthur Conan Doyle", note: "public-domain mystery with quick payoffs" },
    { title: "Dracula", author: "Bram Stoker", note: "free gothic suspense with strong momentum" },
    { title: "The Hobbit", author: "J. R. R. Tolkien", note: "a paid route for classic quest energy" },
  ],
  Bright: [
    { title: "The Hitchhiker's Guide to the Galaxy", author: "Douglas Adams", note: "paid, absurd, and fast-moving" },
    { title: "Alice's Adventures in Wonderland", author: "Lewis Carroll", note: "free, playful, and strange in the best way" },
    { title: "Good Omens", author: "Terry Pratchett and Neil Gaiman", note: "paid comic fantasy with bite" },
  ],
  Gloomy: [
    { title: "The Secret Garden", author: "Frances Hodgson Burnett", note: "quietly restorative without pretending sadness is simple" },
    { title: "Jane Eyre", author: "Charlotte Bronte", note: "resilient, intimate, and free to read legally" },
    { title: "The Midnight Library", author: "Matt Haig", note: "paid contemporary fiction about regret and possibility" },
  ],
};

function localGuide(message: string, mood = "Hopeful") {
  const picks = moodPicks[mood] || moodPicks.Hopeful;
  const compactRequest = message.slice(0, 110);
  return [
    `For "${compactRequest}", I would start with these three:`,
    ...picks.map((book, index) => `${index + 1}. ${book.title} by ${book.author}: ${book.note}.`),
    "If you want the fastest next step, open the first one as Book Bites, then use the free-read or Amazon route at the end.",
  ].join("\n");
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "anonymous";
  const now = Date.now();
  const entry = usage.get(ip) || { count: 0, reset: now + 60_000 };
  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + 60_000;
  }
  if (entry.count >= 8) {
    return NextResponse.json({ reply: "I am taking a short breather. Please try again in a minute.", source: "rate limit" }, { status: 429 });
  }
  entry.count += 1;
  usage.set(ip, entry);

  const body = await request.json().catch(() => ({})) as { message?: string; mood?: string };
  const message = body.message?.trim().slice(0, 900) || "help me choose a book";
  const mood = body.mood || "Hopeful";

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ reply: localGuide(message, mood), source: "Booktender local guide", agent: false });
  }

  try {
    const prompt = `You are Booktender, a thoughtful AI reading companion and book concierge.

Task:
- Answer the user's reading question with specific, useful guidance.
- If recommendations are useful, give exactly 3 real books with author names and a one-sentence reason for each.
- Mention whether the best next route is likely "free public-domain search" or "Amazon/purchase route" when obvious.
- Keep it spoiler-light, practical, and warm.

Rules:
- Do not invent book titles, authors, quotes, awards, or availability.
- Do not reproduce copyrighted summaries or long passages.
- If a fact is uncertain, say "check availability" instead of pretending.
- Keep the answer under 180 words.

User mood: ${mood}
User request: ${message}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 320, temperature: 0.65 },
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error("Gemini request failed");
    const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return NextResponse.json({ reply: reply || localGuide(message, mood), source: reply ? "Gemini" : "Booktender local guide", agent: Boolean(reply) });
  } catch {
    return NextResponse.json({ reply: localGuide(message, mood), source: "Booktender local guide", agent: false });
  }
}
