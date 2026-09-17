export function pickWinner<T>(attendees: readonly T[], random: () => number = Math.random): T {
  if (attendees.length === 0) {
    throw new Error("Ingen til stede");
  }
  const index = Math.floor(random() * attendees.length);
  return attendees[Math.min(index, attendees.length - 1)] as T;
}

export function normalizeName(input: unknown): string {
  if (typeof input !== "string") {
    throw new Error("Navn må være tekst");
  }
  const name = input.trim().replace(/\s+/g, " ");
  if (name.length < 2) {
    throw new Error("Navnet må ha minst to tegn");
  }
  if (name.length > 32) {
    throw new Error("Navnet er for langt");
  }
  if (!/^[\p{L}\p{M}0-9 '.\-]+$/u.test(name)) {
    throw new Error("Navnet har ugyldige tegn");
  }
  return name;
}
