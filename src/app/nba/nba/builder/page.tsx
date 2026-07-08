export default function NbaBuilderPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-bold">NBA Prop Builder</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Probability-backed same-game parlays for points, rebounds, assists and
        3-pointers — built from NBA.com game logs and usage rates. Pipeline wired;
        builder composition launches in the next phase.
      </p>
      <div className="mt-8 rounded-2xl border border-orange-500/30 bg-orange-500/5 p-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-orange-300">
          Coming next
        </p>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">
          <li>· PTS / REB / AST / 3PM prop legs with hit-rates</li>
          <li>· Opponent defensive matchup adjustments</li>
          <li>· Minutes & usage trend context</li>
        </ul>
      </div>
    </div>
  );
}
