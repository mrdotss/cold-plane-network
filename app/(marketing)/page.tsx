import type { Metadata } from "next";
import { Navbar } from "@/components/marketing/Navbar";
import { Hero } from "@/components/marketing/Hero";
import { Features } from "@/components/marketing/Features";
import { MigrationAdvisor } from "@/components/marketing/MigrationAdvisor";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { DemoPreview } from "@/components/marketing/DemoPreview";
import { CTABanner } from "@/components/marketing/CTABanner";
import { Footer } from "@/components/marketing/Footer";

export const metadata: Metadata = {
  title: "Cold Network Plane — Spec-First Network Topology Studio",
  description:
    "Design hybrid cloud and network topologies with a live preview. Generate Terraform and config artifacts instantly.",
  openGraph: {
    title: "Cold Network Plane — Spec-First Network Topology Studio",
    description:
      "Design hybrid cloud and network topologies with a live preview. Generate Terraform and config artifacts instantly.",
    type: "website",
  },
};

export default function MarketingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <Navbar />
      <Hero />
      <Features />
      <MigrationAdvisor />
      <HowItWorks />
      <DemoPreview />
      <CTABanner />
      <Footer />
    </div>
  );
}
