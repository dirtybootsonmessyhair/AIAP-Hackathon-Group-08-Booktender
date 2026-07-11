import { NextRequest, NextResponse } from "next/server";
import { catalogue } from "../../../lib/catalogue";

type GutenbergBook = { id:number; title:string; authors:{name:string}[]; subjects:string[]; download_count:number; formats:Record<string,string> };
type OpenLibraryBook = { key:string; title:string; author_name?:string[]; cover_i?:number; first_publish_year?:number; edition_count?:number; subject?:string[] };
type SearchResult = { id:string; title:string; author:string; subjects:string[]; popularity:number; cover:string|null; readerUrl:string; publicDomain:boolean; buyUrl?:string; description:string };

const normalise = (value:string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const amazon = (title:string, author:string) => `https://www.amazon.in/s?k=${encodeURIComponent(`${title} ${author}`)}`;
async function getJson<T>(url:string, headers:Record<string,string>) {
  try { const response=await fetch(url, { cache:"no-store", headers, signal:AbortSignal.timeout(10_000) }); return response.ok ? await response.json() as T : null; } catch { return null; }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() || "fiction";
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") || "1"));
  const headers = { "Accept":"application/json", "User-Agent":"Booktender/1.0 (contact: booktender@demo.local)" };
  const gutendexUrl = `https://gutendex.com/books/?search=${encodeURIComponent(query)}&page=${page}`;
  const openLibraryUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=12&fields=key,title,author_name,cover_i,first_publish_year,edition_count,subject`;

  const [openData, gutenbergData] = await Promise.all([
    getJson<{ docs?:OpenLibraryBook[] }>(openLibraryUrl, headers),
    getJson<{ results?:GutenbergBook[] }>(gutendexUrl, headers),
  ]);
  const openDocs = openData?.docs || [];
  const gutenberg = gutenbergData?.results || [];
  const byTitle = new Map(gutenberg.map((book) => [normalise(book.title), book]));
  const globalResults: SearchResult[] = openDocs.map((book) => {
    const matched = byTitle.get(normalise(book.title));
    const author = book.author_name?.[0] || matched?.authors[0]?.name || "Unknown author";
    if (matched) return { id:`gutenberg-${matched.id}`, title:book.title, author, subjects:matched.subjects.slice(0,3), popularity:matched.download_count, cover:matched.formats["image/jpeg"] || (book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg` : null), readerUrl:`https://www.gutenberg.org/ebooks/${matched.id}`, publicDomain:true, description:"A verified public-domain Project Gutenberg edition." };
    return { id:`openlibrary-${book.key.replace(/[^a-z0-9]/gi, "-")}`, title:book.title, author, subjects:(book.subject || []).slice(0,3), popularity:book.edition_count || 0, cover:book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg` : null, readerUrl:amazon(book.title, author), buyUrl:amazon(book.title, author), publicDomain:false, description:"A global catalogue record. A paid or local-library edition may be available." };
  });
  if (globalResults.length) return NextResponse.json({ source:"Worldwide discovery via Open Library; free editions verified against Project Gutenberg", hasMore:true, books:globalResults });

  const words = normalise(query).split(" ").filter(Boolean);
  const publicDomain = catalogue.filter((book) => book.publicDomain);
  const matched = publicDomain.filter((book) => words.every((word) => normalise(`${book.title} ${book.author} ${book.genres.join(" ")}`).includes(word)));
  const curated: SearchResult[] = matched.slice(0,8).map((book) => ({ id:book.id, title:book.title, author:book.author, subjects:book.genres, popularity:book.communityCount, cover:book.cover || null, readerUrl:book.sourceUrl, publicDomain:true, description:book.description }));
  const searchUrl = `https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(query)}`;
  const exactSearch: SearchResult = { id:`gutenberg-search-${normalise(query).replace(/ /g,"-")}`, title:`Search Project Gutenberg for “${query}”`, author:"Open the official catalogue for exact free-book matches", subjects:["Official Project Gutenberg search"], popularity:0, cover:null, readerUrl:searchUrl, publicDomain:true, description:"The live global catalogue is temporarily unavailable; this opens your exact official Gutenberg search." };
  return NextResponse.json({ source:curated.length ? "Curated exact public-domain matches while global discovery reconnects" : "Global discovery is temporarily unavailable — exact Gutenberg search", hasMore:true, books:curated.length ? curated : [exactSearch] });
}
