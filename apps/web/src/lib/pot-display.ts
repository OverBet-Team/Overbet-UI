type SidePotLike = { amount?: number | null };
type PlayerBetLike = { bet?: number | null };

type PotDisplayState = {
  pot?: number | null;
  sidePots?: SidePotLike[] | null;
  players?: PlayerBetLike[] | null;
};

function nonNegativeAmount(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Number(value));
}

export function getPotDisplayAmounts(state: PotDisplayState | null | undefined) {
  const totalPot =
    nonNegativeAmount(state?.pot) +
    (state?.sidePots ?? []).reduce((sum, sidePot) => sum + nonNegativeAmount(sidePot?.amount), 0);

  const currentRoundAmount = (state?.players ?? []).reduce(
    (sum, player) => sum + nonNegativeAmount(player?.bet),
    0,
  );

  return {
    totalPot,
    currentRoundAmount,
  };
}
