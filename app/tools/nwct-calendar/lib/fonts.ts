import { Inter, Oswald } from "next/font/google";

// Calendar-scoped fonts. The original AI Studio source loaded Inter for body
// copy and Oswald for headers/date bars. We expose them as CSS variables so
// only the calendar preview/print area picks them up — the rest of the app
// keeps the site-wide Montserrat from app/layout.tsx.
export const interCalendar = Inter({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-inter-calendar",
  display: "swap",
});

export const oswaldCalendar = Oswald({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-oswald-calendar",
  display: "swap",
});
