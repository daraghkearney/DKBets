import { use } from "react";
import LegacyRedirect from "@/components/LegacyRedirect";
import { footballFixtureStaticParams } from "@/lib/stats/fixture-static-params";

export async function generateStaticParams() {
  return footballFixtureStaticParams();
}

export default function MatchDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <LegacyRedirect to={`/football/premier-league/matches/${id}/`} />
  );
}
