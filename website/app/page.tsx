import { Navbar } from "@/components/navbar"
import { HeroSection } from "@/components/hero-section"
import { PainPointsSection } from "@/components/pain-points-section"
import { ValuePropsSection } from "@/components/value-props-section"
import { FeaturesSection } from "@/components/features-section"
import { DownloadSection } from "@/components/download-section"
import { Footer } from "@/components/footer"
import { WechatOverlay } from "@/components/wechat-overlay"

export default function Home() {
  return (
    <main className="min-h-screen">
      <WechatOverlay />
      <Navbar />
      <HeroSection />
      <PainPointsSection />
      <ValuePropsSection />
      <FeaturesSection />
      <DownloadSection />
      <Footer />
    </main>
  )
}
