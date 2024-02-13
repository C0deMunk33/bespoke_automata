import type { Metadata } from "next";
import { Poiret_One } from "next/font/google";
import "./globals.css";

const poiret_one = Poiret_One({ weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bespoke Automata",
  description: "Custom AI Agents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={poiret_one.className}>{children}</body>
    </html>
  );
}
