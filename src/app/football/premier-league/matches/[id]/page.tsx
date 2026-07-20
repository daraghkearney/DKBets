import MatchDetailClient from "./MatchDetailClient";
import { footballFixtureStaticParams } from "@/lib/stats/fixture-static-params";

export async function generateStaticParams() {
  return footballFixtureStaticParams();
}

export default function MatchDetailPage() {
  return <MatchDetailClient />;
}
