import { NextRequest, NextResponse } from "next/server";
import { catalogue, fallbackRecommendations, type CatalogueBook } from "../../../lib/catalogue";

type RequestBody = { mood?: string; genres?: string[]; prompt?: string; readIds?: string[] };
type GoogleVolume = {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    categories?: string[];
    description?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    averageRating?: number;
    ratingsCount?: number;
    pageCount?: number;
  };
};

const moodQueries: Record<string, string> = {
  Cozy: "comfort fiction warm family romance",
  Focused: "productivity habits philosophy deliberate living",
  Hopeful: "hopeful fiction inspiring personal growth",
  Reflective: "literary fiction memoir philosophy self reflection",
  Adventurous: "adventure mystery fantasy quest",
  Bright: "funny witty uplifting fiction",
  Gloomy: "quiet healing literary fiction grief hope",
};

const normalise = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const amazon = (title: string, author: string) => `https://www.amazon.in/s?k=${encodeURIComponent(`${title} ${author}`)}`;

function localFallback(mood: string, genres: string[] = []) {
  return fallbackRecommendations(mood, genres)
    .map((item) => ({ ...item, book: catalogue.find((book) => book.id === item.bookId) }))
    .filter((item): item is { bookId: string; reason: string; book: CatalogueBook } => Boolean(item.book));
}

function reasonFor(book: CatalogueBook, mood: string) {
  const availability = book.publicDomain ? "You can open the free legal edition after the Book Bites." : "Use Book Bites first, then the Amazon route if it fits.";
  return `${book.description} A strong ${mood.toLowerCase()} fit for today. ${availability}`;
}

function volumeToBook(volume: GoogleVolume, mood: string): CatalogueBook | null {
  const info = volume.volumeInfo;
  const title = info?.title;
  const author = info?.authors?.[0];
  if (!title || !author) return null;
  const exactFeatured = catalogue.find((book) => normalise(book.title) === normalise(title));
  if (exactFeatured) return exactFeatured;
  const image = (info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || "").replace(/^http:/, "https:");
  const categories = info.categories?.slice(0, 2) || ["Global catalogue"];
  const description = (info.description || `A globally catalogued book selected for a ${mood.toLowerCase()} reading moment.`).replace(/<[^>]*>/g, "").slice(0, 280);
  return {
    id: `google-${normalise(`${title}-${author}`).replace(/ /g, "-") || volume.id}`,
    title,
    author,
    genres: categories,
    moods: [mood],
    description,
    readingMinutes: Math.max(25, Math.min(80, Math.round((info.pageCount || 220) / 6))),
    cover: image || undefined,
    publicDomain: false,
    sourceUrl: amazon(title, author),
    buyUrl: amazon(title, author),
    communityCount: Math.max(80, info.ratingsCount || 120),
    rating: info.averageRating || 4.1,
    ratingsCount: Math.max(20, info.ratingsCount || 240),
  };
}

async function worldwideCandidates(body: RequestBody, mood: string) {
  const query = [body.prompt?.slice(0, 80), moodQueries[mood] || moodQueries.Hopeful, ...(body.genres || [])].filter(Boolean).join(" ");
  try {
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=12&printType=books&projection=full`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return [];
    const data = await response.json() as { items?: GoogleVolume[] };
    const seen = new Set<string>();
    return (data.items || [])
      .map((volume) => volumeToBook(volume, mood))
      .filter((book): book is CatalogueBook => Boolean(book))
      .filter((book) => {
        const key = normalise(`${book.title} ${book.author}`);
        if (seen.has(key)) return false;
        seen.add(key);
        return !(body.readIds || []).includes(book.id);
      });
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as RequestBody;
  const mood = body.mood || "Hopeful";
  const local = localFallback(mood, body.genres);
  const global = await worldwideCandidates(body, mood);
  const candidates = [...global, ...local.map((item) => item.book)].filter(Boolean).slice(0, 18);

  if (!process.env.GEMINI_API_KEY) {
    const picked = (candidates.length >= 3 ? candidates : local.map((item) => item.book)).slice(0, 3);
    return NextResponse.json({
      recommendations: picked.map((book) => ({ bookId: book.id, book, reason: reasonFor(book, mood) })),
      source: global.length ? "Worldwide discovery" : "Booktender local guide",
    });
  }

  const shortlist = candidates.map(({ id, title, author, genres, moods, readingMinutes, publicDomain, description }) => ({
    id, title, author, genres, moods, readingMinutes, publicDomain, description,
  }));
  const prompt = `You are Booktender. Select exactly 3 different books ONLY from this JSON candidate list: ${JSON.stringify(shortlist)}.

User mood today: ${mood}
Favourite genres: ${(body.genres || []).join(", ") || "none"}
Already read ids: ${(body.readIds || []).join(", ") || "none"}
User request: ${body.prompt || "a thoughtful next read"}

Return only valid JSON:
{"recommendations":[{"bookId":"candidate id","reason":"one specific, spoiler-free sentence under 28 words that explains why this book fits today's mood"}]}

Rules:
- Never invent titles or ids.
- Prefer a mix of free public-domain and paid/modern titles when it improves fit.
- Do not recommend a book listed as already read.`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.45, maxOutputTokens: 450, responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error("Gemini request failed");
    const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = text ? JSON.parse(text) as { recommendations?: { bookId: string; reason: string }[] } : null;
    const valid = parsed?.recommendations
      ?.map((item) => ({ ...item, book: candidates.find((book) => book.id === item.bookId) }))
      .filter((item): item is { bookId: string; reason: string; book: CatalogueBook } => Boolean(item.book))
      .slice(0, 3);
    if (valid?.length === 3) return NextResponse.json({ recommendations: valid, source: "Gemini + worldwide discovery" });
  } catch {
    // Reliable local fallback below.
  }

  const picked = (candidates.length >= 3 ? candidates : local.map((item) => item.book)).slice(0, 3);
  return NextResponse.json({
    recommendations: picked.map((book) => ({ bookId: book.id, book, reason: reasonFor(book, mood) })),
    source: global.length ? "Worldwide discovery" : "Booktender local guide",
  });
}
