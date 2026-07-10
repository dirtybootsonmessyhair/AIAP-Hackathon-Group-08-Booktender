import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Booktender | Read with intention",
  description: "A community-powered AI reading companion."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
