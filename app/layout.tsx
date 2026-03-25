import type { Metadata } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import ScrollRevealProvider from "@/components/ScrollRevealProvider";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import { LayoutShell } from "@/components/LayoutShell";

const inter = Inter({ subsets: ["latin"] });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" });

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
      <body className={`${inter.className} ${montserrat.variable}`}>
        <ScrollRevealProvider />
        <AnalyticsTracker />
        <LayoutShell
          navigation={<Navigation />}
          footer={<Footer />}
        >
          {children}
        </LayoutShell>
      </body>
    </html>
  );
}
