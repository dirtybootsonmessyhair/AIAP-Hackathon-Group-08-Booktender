export type CatalogueBook = {
  id: string;
  title: string;
  author: string;
  genres: string[];
  moods: string[];
  description: string;
  readingMinutes: number;
  cover?: string;
  publicDomain: boolean;
  sourceUrl: string;
  buyUrl?: string;
  communityCount: number;
};

export const catalogue: CatalogueBook[] = [
  { id:"frankenstein", title:"Frankenstein", author:"Mary Shelley", genres:["Classic","Gothic"], moods:["Reflective","Adventurous"], description:"A haunting classic about ambition, responsibility and belonging.", readingMinutes:55, cover:"https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg", publicDomain:true, sourceUrl:"https://www.gutenberg.org/ebooks/84", communityCount:482 },
  { id:"pride", title:"Pride and Prejudice", author:"Jane Austen", genres:["Classic","Romance"], moods:["Cozy","Hopeful"], description:"A witty, warm social comedy with one of literature's great slow-burn romances.", readingMinutes:50, cover:"https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg", publicDomain:true, sourceUrl:"https://www.gutenberg.org/ebooks/1342", communityCount:691 },
  { id:"jane-eyre", title:"Jane Eyre", author:"Charlotte Brontë", genres:["Classic","Coming of age"], moods:["Reflective","Hopeful"], description:"An intimate story of independence, courage and finding a voice of one's own.", readingMinutes:65, cover:"https://www.gutenberg.org/cache/epub/1260/pg1260.cover.medium.jpg", publicDomain:true, sourceUrl:"https://www.gutenberg.org/ebooks/1260", communityCount:355 },
  { id:"alice", title:"Alice's Adventures in Wonderland", author:"Lewis Carroll", genres:["Classic","Fantasy"], moods:["Adventurous","Cozy"], description:"A playful, strange and delightfully quick tumble through a world of curious logic.", readingMinutes:35, cover:"https://www.gutenberg.org/cache/epub/11/pg11.cover.medium.jpg", publicDomain:true, sourceUrl:"https://www.gutenberg.org/ebooks/11", communityCount:274 },
  { id:"secret-garden", title:"The Secret Garden", author:"Frances Hodgson Burnett", genres:["Classic","Feel-good"], moods:["Hopeful","Cozy"], description:"A restorative story about friendship, fresh air and small changes that grow into renewal.", readingMinutes:45, cover:"https://www.gutenberg.org/cache/epub/17396/pg17396.cover.medium.jpg", publicDomain:true, sourceUrl:"https://www.gutenberg.org/ebooks/17396", communityCount:519 },
  { id:"walden", title:"Walden", author:"Henry David Thoreau", genres:["Classic","Philosophy"], moods:["Focused","Reflective"], description:"A thoughtful invitation to simplify, notice what matters and live deliberately.", readingMinutes:40, cover:"https://www.gutenberg.org/cache/epub/205/pg205.cover.medium.jpg", publicDomain:true, sourceUrl:"https://www.gutenberg.org/ebooks/205", communityCount:198 },
  { id:"atomic-habits", title:"Atomic Habits", author:"James Clear", genres:["Non-fiction","Self growth"], moods:["Focused","Hopeful"], description:"A practical modern guide to making small actions easier to repeat.", readingMinutes:40, publicDomain:false, sourceUrl:"https://jamesclear.com/atomic-habits", buyUrl:"https://www.amazon.in/s?k=Atomic+Habits+James+Clear", communityCount:812 },
  { id:"kite-runner", title:"The Kite Runner", author:"Khaled Hosseini", genres:["Literary fiction","Contemporary"], moods:["Reflective","Hopeful"], description:"An emotionally rich novel about friendship, guilt, family and redemption.", readingMinutes:60, publicDomain:false, sourceUrl:"https://www.amazon.in/s?k=The+Kite+Runner+Khaled+Hosseini", buyUrl:"https://www.amazon.in/s?k=The+Kite+Runner+Khaled+Hosseini", communityCount:733 },
  { id:"alchemist", title:"The Alchemist", author:"Paulo Coelho", genres:["Fiction","Fable"], moods:["Hopeful","Adventurous"], description:"A short, reflective fable about purpose, risk and following a personal calling.", readingMinutes:35, publicDomain:false, sourceUrl:"https://www.amazon.in/s?k=The+Alchemist+Paulo+Coelho", buyUrl:"https://www.amazon.in/s?k=The+Alchemist+Paulo+Coelho", communityCount:945 }
];

export const moods = ["Cozy","Focused","Hopeful","Reflective","Adventurous"] as const;
export type Mood = typeof moods[number];

export function fallbackRecommendations(mood: string, genres: string[] = []) {
  const matched = catalogue.filter((book) => book.moods.includes(mood) || book.genres.some((genre) => genres.includes(genre)));
  return (matched.length >= 3 ? matched : catalogue).slice(0, 3).map((book, index) => ({
    bookId: book.id,
    reason: index === 0 ? `This is the strongest fit for a ${mood.toLowerCase()} reading moment.` : `Its tone and reading commitment make it an easy next step for today.`
  }));
}
