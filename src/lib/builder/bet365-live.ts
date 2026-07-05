export interface Bet365LiveQuote {
  price: number;
  link?: string;
  selectionId?: string;
}

export type Bet365LiveMap = Map<string, Bet365LiveQuote>;

export interface Bet365LiveBundle {
  quotes: Bet365LiveMap;
  eventUrls: Map<number, string>;
}
