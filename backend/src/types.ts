export type User = {
  id: string;
  name: string;
  createdAt: number;
};

export type Chore = {
  id: string;
  name: string;
  emoji: string;
};

export type LeaderboardEntry = {
  id: string;
  name: string;
  tickets: number;
};

export type Activity = {
  id: string;
  userId: string;
  userName: string;
  choreId: string;
  choreName: string;
  choreEmoji: string;
  tickets: number;
  createdAt: number;
};

export type FridaySpin = {
  id: string;
  winnerId: string;
  winnerName: string;
  attendeeIds: string[];
  attendeeNames: string[];
  spunAt: number;
};

export type Snapshot = {
  chores: Chore[];
  leaderboard: LeaderboardEntry[];
  activity: Activity[];
  latestSpin: FridaySpin | null;
};

export type WsMessage = { type: "state"; payload: Snapshot };

export const FIXED_CHORES: Chore[] = [
  { id: "oppvask-ut", name: "Ta ut av oppvaskmaskinen", emoji: "🍽️" },
  { id: "oppvask-inn", name: "Sett inn i oppvaskmaskinen", emoji: "🫧" },
  { id: "planter", name: "Vanne planter", emoji: "🌱" },
  { id: "kaffe", name: "Fylle/fikse kaffemaskina", emoji: "☕" },
  { id: "rydde", name: "Rydde", emoji: "✨" },
];
