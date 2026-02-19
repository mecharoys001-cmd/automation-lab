import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "The Automation Lab | NWCT Arts Council",
  description:
    "A research-driven pilot exploring responsible, human-centered automation to reduce administrative burden for arts & culture nonprofits in Northwest Connecticut.",
  keywords: [
    "automation",
    "nonprofit",
    "arts council",
    "AI",
    "technology",
    "Northwest Connecticut",
  ],
  openGraph: {
    title: "The Automation Lab",
    description:
      "Reducing administrative burden in the cultural sector through technology.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Navigation />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
