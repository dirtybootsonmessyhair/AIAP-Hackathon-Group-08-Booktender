import { NextRequest, NextResponse } from "next/server";
import { catalogue, type CatalogueBook } from "../../../lib/catalogue";

const localCards = (book: Pick<CatalogueBook, "title" | "author" | "description" | "publicDomain">) => [
  `Premise: ${book.title} by ${book.author}. ${book.description}`,
  `What to look for: identify the central decision, pressure, or relationship that keeps the book moving.`,
  `Theme: read for what the book says about attention, desire, fear, belonging, power, or repair.`,
  `Character or argument lens: ask what each major choice reveals, not only what happens next.`,
  `Emotional map: notice where the book feels tense, tender, comic, lonely, hopeful, or morally uncomfortable.`,
  `Interpretation: the best Book Bite is not a shortcut; it is a clean doorway into the full work.`,
  `Memory hook: save the one idea you would still care about after a week.`,
  `Discussion prompt: what does this book make easier to understand about people?`,
  `Reader's choice: if this card feels useful, continue; if not, search another title and get a better fit.`,
  book.publicDomain
    ? `Route: use the final button to read the complete public-domain edition legally online.`
    : `Route: these are original orientation cards; use the final button to buy, borrow, or verify the full edition.`,
];

export async function POST(request: NextRequest) {
  const { bookId, book: suppliedBook } = await request.json().catch(() => ({})) as { bookId?: string; book?: Partial<CatalogueBook> };
  const seed = catalogue.find((item) => item.id === bookId);
  const book = seed || (suppliedBook?.title && suppliedBook.author && suppliedBook.description
    ? {
        id: bookId || "external",
        title: suppliedBook.title,
        author: suppliedBook.author,
        description: suppliedBook.description,
        publicDomain: Boolean(suppliedBook.publicDomain),
      }
    : undefined);

  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });

  const originalCards = seed?.bites;
  if (originalCards?.length === 10) return NextResponse.json({ cards: originalCards, source: "Booktender editorial" });

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ cards: localCards(book), source: "Booktender local guide" });
  }

  const prompt = `Create exactly 10 Booktender Book Bite cards for this book.

Book:
- Title: ${book.title}
- Author: ${book.author}
- Metadata: ${book.description}
- Public domain: ${Boolean(book.publicDomain)}

Task:
- Cards must be genuine spoiler-light summary and interpretation, not generic reading advice.
- Card 1: premise.
- Card 2: central themes.
- Card 3: main tension or argument.
- Card 4: key character/idea lens.
- Card 5: emotional atmosphere.
- Card 6: what to notice while reading.
- Card 7: why the book matters to readers.
- Card 8: discussion prompt.
- Card 9: takeaway for today's mood.
- Card 10: legal next step.

Rules:
- Use original wording.
- Do not quote long passages.
- For copyrighted books, do not reproduce or closely paraphrase publisher/online summaries.
- If you are uncertain, stay high-level rather than inventing plot facts.
- Each card must be 24 to 48 words.

Return only JSON: {"cards":["..."]}.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.55, maxOutputTokens: 900, responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error("Gemini request failed");
    const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const cards = text ? (JSON.parse(text) as { cards?: string[] }).cards : undefined;
    if (cards?.length === 10) return NextResponse.json({ cards, source: "Gemini" });
  } catch {
    // Local guide keeps the reader usable when AI is unavailable.
  }

  return NextResponse.json({ cards: localCards(book), source: "Booktender local guide" });
}
