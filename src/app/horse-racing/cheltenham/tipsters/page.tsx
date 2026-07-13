import PremiumGate from "@/components/subscription/PremiumGate";
import TipsterIntelPage from "@/components/horse-racing/TipsterIntelPage";
import { FEATURES } from "@/lib/subscription/config";

export default function Page() {
  return (
    <PremiumGate feature={FEATURES.racingIntel}>
      <TipsterIntelPage />
    </PremiumGate>
  );
}
