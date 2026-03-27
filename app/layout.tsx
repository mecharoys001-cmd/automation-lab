import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import UserIndicatorServer from "@/components/UserIndicatorServer";
import ScrollRevealProvider from "@/components/ScrollRevealProvider";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import { LayoutShell } from "@/components/LayoutShell";

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
      <body className={`${montserrat.variable} ${montserrat.className}`}>
        <ScrollRevealProvider />
        <AnalyticsTracker />
        <LayoutShell
          navigation={<Navigation userSlot={<UserIndicatorServer />} />}
          footer={<Footer />}
        >
          {children}
        </LayoutShell>
      </body>
    </html>
  );
}
