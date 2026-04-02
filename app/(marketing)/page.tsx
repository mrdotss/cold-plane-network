import type { Metadata } from "next";
import { Navbar } from "@/components/marketing/Navbar";
import { Hero } from "@/components/marketing/Hero";
import { Features } from "@/components/marketing/Features";
import { MigrationAdvisor } from "@/components/marketing/MigrationAdvisor";
import { Sizing } from "@/components/marketing/Sizing";
import { CfmAnalysis } from "@/components/marketing/CfmAnalysis";
import { CspAnalysis } from "@/components/marketing/CspAnalysis";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { DemoPreview } from "@/components/marketing/DemoPreview";
import { CTABanner } from "@/components/marketing/CTABanner";
import { Footer } from "@/components/marketing/Footer";

export const metadata: Metadata = {
  title: "Cold Network Plane — Cloud Infrastructure Design & Optimization Platform",
  description:
    "Design hybrid cloud topologies, plan Azure-to-AWS migrations, right-size workloads with AI, optimize cloud costs, and analyze security posture — all from a single platform.",
  openGraph: {
    title: "Cold Network Plane — Cloud Infrastructure Design & Optimization Platform",
    description:
      "Design hybrid cloud topologies, plan Azure-to-AWS migrations, right-size workloads with AI, optimize cloud costs, and analyze security posture — all from a single platform.",
    type: "website",
  },
};

export default function MarketingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <DemoPreview />
      <MigrationAdvisor />
      <Sizing />
      <CfmAnalysis />
      <CspAnalysis />
      <CTABanner />
      <Footer />
    </div>
  );
}
