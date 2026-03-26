import Hero from "@/components/Hero";
import Stats from "@/components/Stats";
import About from "@/components/About";
import CaseStudies from "@/components/CaseStudies";
import ToolsPreview from "@/components/ToolsPreview";
import Roadmap from "@/components/Roadmap";
import Team from "@/components/Team";
import SurveyBanner from "@/components/SurveyBanner";

export default function Home() {
  return (
    <>
      <Hero />
      <About />
      <CaseStudies />
      <ToolsPreview />
      <Roadmap />
      <Team />
      <SurveyBanner />
    </>
  );
}
