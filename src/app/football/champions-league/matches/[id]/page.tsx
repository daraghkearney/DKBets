import MatchDetailClient from "../../../premier-league/matches/[id]/MatchDetailClient";
import { footballFixtureStaticParams } from "@/lib/stats/fixture-static-params";
import { CHAMPIONS_LEAGUE_COMPETITION_ID } from "@/lib/sports/football";

export async function generateStaticParams() {
  return footballFixtureStaticParams(CHAMPIONS_LEAGUE_COMPETITION_ID);
}

export default function MatchDetailPage() {
  return <MatchDetailClient />;
}
