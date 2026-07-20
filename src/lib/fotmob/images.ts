/** FotMob CDN player headshot from numeric player id. */
export function playerImageUrl(playerId: number): string {
  return `https://images.fotmob.com/image_resources/playerimages/${playerId}.png`;
}

/** FotMob CDN team crest from numeric team id. */
export function teamImageUrl(teamId: number): string {
  return `https://images.fotmob.com/image_resources/logo/teamlogo/${teamId}.png`;
}
