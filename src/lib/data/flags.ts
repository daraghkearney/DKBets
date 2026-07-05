const FLAGS: Record<string, string> = {
  argentina: "🇦🇷", france: "🇫🇷", england: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", brazil: "🇧🇷", spain: "🇪🇸",
  portugal: "🇵🇹", netherlands: "🇳🇱", germany: "🇩🇪", italy: "🇮🇹", belgium: "🇧🇪",
  croatia: "🇭🇷", uruguay: "🇺🇾", colombia: "🇨🇴", morocco: "🇲🇦", usa: "🇺🇸",
  "united states": "🇺🇸", mexico: "🇲🇽", japan: "🇯🇵", senegal: "🇸🇳",
  switzerland: "🇨🇭", denmark: "🇩🇰", ecuador: "🇪🇨", "south korea": "🇰🇷",
  australia: "🇦🇺", nigeria: "🇳🇬", norway: "🇳🇴", egypt: "🇪🇬", paraguay: "🇵🇾",
  canada: "🇨🇦", ghana: "🇬🇭", "cape verde": "🇨🇻", poland: "🇵🇱", austria: "🇦🇹",
  scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", ireland: "🇮🇪", "republic of ireland": "🇮🇪",
  serbia: "🇷🇸", turkey: "🇹🇷", tunisia: "🇹🇳", algeria: "🇩🇿", "ivory coast": "🇨🇮",
  cameroon: "🇨🇲", "saudi arabia": "🇸🇦", iran: "🇮🇷", qatar: "🇶🇦", uzbekistan: "🇺🇿",
  jordan: "🇯🇴", panama: "🇵🇦", "costa rica": "🇨🇷", honduras: "🇭🇳", jamaica: "🇯🇲",
  chile: "🇨🇱", peru: "🇵🇪", venezuela: "🇻🇪", bolivia: "🇧🇴", "new zealand": "🇳🇿",
  ukraine: "🇺🇦", sweden: "🇸🇪", greece: "🇬🇷", romania: "🇷🇴", hungary: "🇭🇺",
  slovakia: "🇸🇰", slovenia: "🇸🇮", czechia: "🇨🇿", "czech republic": "🇨🇿",
  albania: "🇦🇱", georgia: "🇬🇪", "south africa": "🇿🇦", mali: "🇲🇱", "burkina faso": "🇧🇫",
  "dr congo": "🇨🇩", "congo dr": "🇨🇩", iraq: "🇮🇶", "united arab emirates": "🇦🇪",
  indonesia: "🇮🇩", china: "🇨🇳", curacao: "🇨🇼", haiti: "🇭🇹", "el salvador": "🇸🇻",
};

export function flagFor(team: string): string {
  return FLAGS[team.trim().toLowerCase()] ?? "⚽";
}
