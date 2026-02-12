// Concentrate Flow
export const calcConcentrateFlow = (feedFlow, permeateFlow) =>
  feedFlow - permeateFlow;

// Permeate TDS
export const calcPermeateTDS = (feedTDS, rejectionPct = 99.7) =>
  feedTDS * (1 - rejectionPct / 100);

// Concentrate TDS (Mass Balance)
export const calcConcentrateTDS = (
  feedFlow,
  feedTDS,
  permeateFlow,
  permeateTDS
) => {
  const concentrateFlow = feedFlow - permeateFlow;
  if (concentrateFlow <= 0) return 0;

  return (
    (feedFlow * feedTDS - permeateFlow * permeateTDS) /
    concentrateFlow
  );
};

// Osmotic Pressure (psi)
export const calcOsmoticPressurePsi = (tds) =>
  0.0113 * tds;

// Flow Calculator
export function calculateFlows({
  permeate_m3h,
  recoveryPct,
  trains
}) {
  const recovery = recoveryPct / 100;

  const feed = permeate_m3h / recovery;
  const concentrate = feed - permeate_m3h;

  return {
    feed_m3h: feed,
    concentrate_m3h: concentrate,
    totalFeed_m3h: feed * trains
  };
}
