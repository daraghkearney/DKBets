/** FotMob CDN player headshot from numeric player id. */
export function playerImageUrl(playerId: number): string {
  return `https://images.fotmob.com/image_resources/playerimages/${playerId}.png`;
}
