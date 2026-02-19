import Hero from "@/components/Hero";
import Stats from "@/components/Stats";
import About from "@/components/About";
import CaseStudies from "@/components/CaseStudies";
import Roadmap from "@/components/Roadmap";
import Team from "@/components/Team";
import ToolsPreview from "@/components/ToolsPreview";
import SurveyBanner from "@/components/SurveyBanner";

export default function Home() {
  return (
    <>
      <Hero />
      <Stats />
      <About />
      <CaseStudies />
      <ToolsPreview />
      <Roadmap />
      <Team />
      <SurveyBanner />
    </>
  );
}
