import PremiumGate from "@/components/subscription/PremiumGate";
import RacingAnalysisPage from "@/components/horse-racing/RacingAnalysisPage";
import { FEATURES } from "@/lib/subscription/config";

export default function Page() {
  return (
    <PremiumGate feature={FEATURES.racingAnalysis}>
      <RacingAnalysisPage />
    </PremiumGate>
  );
}
