export default function Guide() {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-edge bg-surface p-5">
        <h3 className="mb-2 font-bold">How the maths works</h3>
        <p className="text-xs leading-relaxed text-muted">
          For any market, add up 1 ÷ odds for the best price on every outcome.
          If the total is under 1.00, the bookmakers disagree enough that
          backing <em>every</em> outcome locks in profit. Your stake is split
          in proportion to 1 ÷ odds per leg, so every outcome returns the same
          payout — and that payout is bigger than what you staked. A total of
          0.97 means a guaranteed 3.1% return, win, lose or draw.
        </p>
      </div>
      <div className="rounded-2xl border border-edge bg-surface p-5">
        <h3 className="mb-2 font-bold">Execution tips</h3>
        <ul className="flex flex-col gap-1.5 text-xs leading-relaxed text-muted">
          <li>
            <strong className="text-foreground">Speed matters:</strong> arbs
            close in minutes. Have all bookmaker accounts funded and logged in
            before you start.
          </li>
          <li>
            <strong className="text-foreground">Confirm the price:</strong>{" "}
            always check the odds on the bookmaker&apos;s own slip before
            placing — never rely solely on an aggregator.
          </li>
          <li>
            <strong className="text-foreground">Place the fragile leg
            first:</strong> start with the bookmaker most likely to cut the
            price, then complete the other legs.
          </li>
          <li>
            <strong className="text-foreground">Round your stakes:</strong>{" "}
            odd amounts like £73.42 flag you as an arber. The calculator&apos;s
            rounding mode handles this.
          </li>
        </ul>
      </div>
      <div className="rounded-2xl border border-edge bg-surface p-5">
        <h3 className="mb-2 font-bold">Know the risks</h3>
        <ul className="flex flex-col gap-1.5 text-xs leading-relaxed text-muted">
          <li>
            <strong className="text-foreground">Price movement:</strong> if a
            price shortens after you&apos;ve placed one leg, the guarantee can
            vanish. Re-check the maths before completing.
          </li>
          <li>
            <strong className="text-foreground">Palpable errors:</strong>{" "}
            bookmakers can void bets placed at clearly mistaken prices —
            usually the biggest &quot;arbs&quot;. Be wary of returns above
            ~5%.
          </li>
          <li>
            <strong className="text-foreground">Account restrictions:</strong>{" "}
            consistent arbing gets accounts stake-limited (&quot;gubbed&quot;).
            Vary your betting and round stakes.
          </li>
          <li>
            <strong className="text-foreground">Rule differences:</strong>{" "}
            make sure both legs settle on the same terms (90 minutes vs
            extra time matters in knockouts).
          </li>
        </ul>
        <p className="mt-3 border-t border-edge pt-2 text-[11px] text-muted">
          18+ only. Please gamble responsibly —{" "}
          <a
            href="https://www.gambleaware.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            GambleAware.org
          </a>
        </p>
      </div>
    </section>
  );
}
