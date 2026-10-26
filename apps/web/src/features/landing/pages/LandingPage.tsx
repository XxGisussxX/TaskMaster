import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";
import { useResolvedSession } from "@/app/guards";
import { LandingNavbar } from "../components/LandingNavbar";
import { Hero } from "../components/Hero";
import { Features } from "../components/Features";
import { HowItWorks } from "../components/HowItWorks";
import { CtaSection } from "../components/CtaSection";
import { LandingFooter } from "../components/LandingFooter";

export function LandingPage() {
  const user = useAuthStore((s) => s.user);
  const resolved = useResolvedSession();

  if (!resolved) return null;

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <CtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
