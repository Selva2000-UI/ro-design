// Concentrate flow = Feed − Permeate
export const calcConcentrateFlow = (feedFlow, permeateFlow) => {
  return feedFlow - permeateFlow;
};

// Concentrate TDS = Feed TDS / (1 − Recovery)
export const calcConcentrateTDS = (feedTDS, recoveryPct) => {
  return feedTDS / (1 - recoveryPct / 100);
};

// Osmotic pressure (psi) ≈ 0.01 × TDS
export const calcOsmoticPressurePsi = (tds) => {
  return 0.01 * tds;
};

// Permeate TDS ≈ 1.1% of feed TDS (98.9% effective rejection)
export const calcPermeateTDS = (feedTDS) => {
  return feedTDS * 0.011;
};


export function calculateFlows({
  permeate_m3h,
  recoveryPct,
  trains
}) {
  const recovery = recoveryPct / 100;

  const feed = permeate_m3h / recovery;
  const concentrate = calcConcentrateFlow(feed, permeate_m3h);

  return {
    feed_m3h: feed,
    concentrate_m3h: concentrate,
    totalFeed_m3h: feed * trains
  };
}
