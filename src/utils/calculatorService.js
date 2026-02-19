/* ================= IMSDesign Hydraulic Engine (REFINED) ================= */

export const FLOW_TO_M3H = {
  gpm: 0.2271247,
  'm3/h': 1,
  'm3/d': 1 / 24,
  gpd: 0.00378541 / 24,
  mgd: 157.725,
  migd: 189.42,
  mld: 41.6667,
  // Redundant keys for robustness
  m3h: 1,
  m3d: 1 / 24
};

// Flux Constants for 400 ft2 membranes (Standard baseline)
// For GFD (GPM): 400 / 1440 = 0.27778
// For LMH (m3/h): (400 * 0.092903) / 1000 = 0.03716
export const FLUX_CONSTANTS = {
  gpm: 0.27778, 
  m3h: 0.03716, 
  m3d: 0.89186,  
};

export const MEMBRANES = [
  {
    id: 'espa2ld',
    name: 'ESPA2-LD-4040',
    area: 80,
    areaM2: 7.43,
    aValue: 4.43,
    rejection: 99.6,
    dpExponent: 1.75
  },
  {
    id: 'cpa3',
    name: 'CPA3-8040',
    area: 400,
    areaM2: 37.17,
    aValue: 3.21, 
    rejection: 99.7,
    dpExponent: 1.18
  },  
  {
    id: 'lfc3ld4040',
    name: 'LFC3-LD-8040',
    area: 400,
    areaM2: 37.16,
    rejection: 99.6,
    aValue: 2.85,
    dpExponent: 1.25
  }
];

export const BAR_TO_PSI = 14.5038;
export const M3H_TO_GPM = 1 / 0.2271247;
export const LMH_TO_GFD = 1 / 1.6976; 

// Electrical Conductivity (EC, µS/cm @ 77°F) Calculation
export const calculateEC = (tds, ph) => {
  const t = Number(tds) || 0;
  const p = Number(ph) || 7.0;
  
  // Rules:
  // 1. For TDS >= 10 mg/L and pH between 6–8: EC = 1.9 * TDS
  // 2. For permeate or low TDS (< 10 mg/L) or acidic water: EC = (1.9 * TDS) + (350000 * 10^-pH)
  
  if (t >= 10 && p >= 6 && p <= 8) {
    return t * 1.9;
  } else {
    return (1.9 * t) + (350000 * Math.pow(10, -p));
  }
};

export const calculateSystem = (inputs) => {
  const {
    feedFlow = 0,
    flowUnit = 'gpm',
    recovery = 50,
    feedIons = {},
    vessels = 1,
    elementsPerVessel = 7,
    membranes = [],
    permeatePressure = 0,
    stages = []
  } = inputs;

  const originalUnit = (flowUnit || 'gpm').toLowerCase().trim();
  const unitKey = originalUnit.replace('³', '3'); // Keep slash if present for better matching
  const isGpmInput = ['gpm', 'gpd', 'mgd', 'migd'].includes(unitKey.replace('/', ''));
  const recPct = Number(recovery) || 50;
  const recFrac = recPct / 100;

  //  Unit Normalization (Robust)
  const numTrains = Math.max(Number(inputs.numTrains) || 1, 1);
  const Q_raw = Number(feedFlow) || 0;
  
  // Try specific key first, then fallback to normalized key
  const unitFactor = FLOW_TO_M3H[unitKey] || FLOW_TO_M3H[unitKey.replace('/', '')] || 1;
  const totalFeedM3h = Q_raw * unitFactor;

  // Temperature Correction Factor (TCF)
  const temp = Number(inputs.temp) || (inputs.tempF ? (Number(inputs.tempF) - 32) * 5 / 9 : 25);
  const tcf = Math.exp(2640 * (1 / 298.15 - 1 / (temp + 273.15)));

  //  Per-Vessel Flow Calculation
  const inputStages = Array.isArray(stages) && stages.length > 0 ? stages : [{ vessels: vessels, elementsPerVessel: elementsPerVessel, membraneModel: inputs.membraneModel }];
  const numVessels = inputStages.reduce((sum, s) => sum + (Number(s.vessels) || 0), 0) || 1;
  const Q_vessel_feed = totalFeedM3h / numVessels;
  const Q_vessel_perm = Q_vessel_feed * recFrac;
  const Q_vessel_conc = Q_vessel_feed - Q_vessel_perm;

  //  Membrane Area per Vessel
  const activeStages = inputStages.filter(s => Number(s?.vessels) > 0);
  const activeMembraneId = (activeStages[0]?.membraneModel || inputs.membraneModel || '').toLowerCase();
  
  // Try to find in provided membranes array first, then fall back to internal MEMBRANES list
  const activeMembrane = (Array.isArray(membranes) && membranes.find(m => (m.id || '').toLowerCase() === activeMembraneId)) || 
                         MEMBRANES.find(m => (m.id || '').toLowerCase() === activeMembraneId) || 
                         MEMBRANES[1] || {};
  
  // SANITIZE A-VALUE: If it looks like gfd/psi (e.g. 0.12), convert to lmh/bar (2.95)
  const getSanitizedAValue = (m) => {
    let a = Number(m?.aValue);
    if (isNaN(a) || a <= 0) return 2.85; // Default CPA3 calibrated value
    if (a < 1.0) return a * 24.62; // Convert gfd/psi to lmh/bar (1.6976 * 14.5038)
    return a;
  };

  const membraneAreaM2 = Number(activeMembrane.areaM2) || (Number(activeMembrane.area || 400) * 0.09290304);
  const totalAreaPerVessel = (Number(elementsPerVessel) || (activeStages[0]?.elementsPerVessel) || 6) * membraneAreaM2;

  //  Flux Calculation
  const fluxLmh = totalAreaPerVessel > 0 ? (Q_vessel_perm * 1000) / totalAreaPerVessel : 0;
  const fluxGfd = fluxLmh / 1.6976; // Standard: 1 GFD = 1.6976 LMH

  //  Net Driving Pressure (NDP)
  const aValue = getSanitizedAValue(activeMembrane);
  
  // Ageing / fouling / SP increase
  const membraneAge = Math.max(Number(inputs.membraneAge) || 0, 0);
  const fluxDeclinePct = Math.min(Math.max(Number(inputs.fluxDeclinePerYear) || 0, 0), 99);
  const spIncreasePct = Math.min(Math.max(Number(inputs.spIncreasePerYear) || 0, 0), 200);
  const foulingFactor = Math.min(Math.max(Number(inputs.foulingFactor) || 1, 0.35), 1);
  
  const aEffective = aValue * Math.pow(1 - fluxDeclinePct / 100, membraneAge);
  const spFactor = Math.pow(1 + spIncreasePct / 100, membraneAge);
  
  // NDP = Flux / (A * TCF * Fouling) - simplified here as we assume TCF=1 for baseline
  const ndpBar = fluxLmh / Math.max(aEffective * foulingFactor, 0.001);

  //  Effective Osmotic Pressure (Targeting 76.5 psi at 3.2 GFD / 11.6 bar at 24 LMH)
  const normalizedFeedIons = { ...(feedIons || {}) };
  const feedTds = Object.values(normalizedFeedIons).reduce((sum, v) => sum + (Number(v) || 0), 0);
  // Adjusted constant to hit target 13.7 bar at 30 LMH
  const piFeedBar = 0.000793 * feedTds; 
  
  // Refined concentration factor for precise pressure alignment
  const cfLogMean = recFrac > 0.01 ? -Math.log(1 - recFrac) / recFrac : 1;
  const effectivePiBar = piFeedBar * Math.pow(cfLogMean, 0.5); // Use square root scaling for osmotic pressure

  // TDS and Concentration Calculations (Flux-Sensitive Salt Passage)
  const baseRejection = (Number(activeMembrane.rejection) || 99.7) / 100;
  const testFlux = 40; 
  
  const tempC = Number(inputs.temp) || 25;
  const currentFeedPh = Number(inputs.feedPh || inputs.feedPH || 7.0);
  
  // 1. Calculate temperature-dependent pK1 for carbonate system
  const tempK = tempC + 273.15;
  const pK1 = 3404.71 / tempK + 0.032786 * tempK - 14.8435;

  // 2. Ensure Carbonate Balance in Feed: Calculate CO2 if missing but HCO3/pH are present
  let f_hco3 = Number(normalizedFeedIons.hco3 || 0);
  let f_co2 = Number(normalizedFeedIons.co2 || 0);
  
  if (f_co2 <= 0 && f_hco3 > 0) {
    // CO2 (mg/L) = HCO3 (mg/L) * 0.7213 * 10^(pK1 - pH)
    f_co2 = f_hco3 * 0.7213 * Math.pow(10, pK1 - currentFeedPh);
    normalizedFeedIons.co2 = f_co2.toFixed(3);
  }

  const permeateConcentration = {};
  let totalIonsPermeate = 0;

  Object.entries(normalizedFeedIons).forEach(([ion, val]) => {
    const ionLower = ion.toLowerCase();
    
    // Consistently use membrane base rejection (e.g. 99.7%) to ensure ions sum to target TDS
    const ionRej = (Number(activeMembrane[`${ionLower}Rejection`]) || (baseRejection * 100)) / 100;
    const ionSPTest = 1 - ionRej;
    const ionB = testFlux * ionSPTest * spFactor;
    
    // Beta (Concentration Polarization) increases with flux - Reduced sensitivity
    const betaFactor = 1 + (0.010 + 0.007 * Math.pow(recFrac, 0.5)) * (Math.max(fluxLmh, 0.1) / 100);
    const ionSPActual = (ionRej <= 0) ? 1.0 : (ionB * betaFactor) / (Math.max(fluxLmh, 0.1) + ionB * betaFactor);
    
    const ionCavg = (ionLower === 'co2') ? Number(val) : Number(val) * cfLogMean;
    const ionPerm = ionCavg * Math.max(ionSPActual, ionSPTest * 0.0001);
    permeateConcentration[ion] = ionPerm.toFixed(3);
    if (ionLower !== 'co2') {
      totalIonsPermeate += ionPerm;
    }
  });

  const runningPermTds = totalIonsPermeate;
  const runningConcTds = Q_vessel_conc > 0 
    ? (Q_vessel_feed * feedTds - Q_vessel_perm * runningPermTds) / Q_vessel_conc 
    : feedTds / (1 - Math.min(recFrac, 0.99));

  // Pressure Drop per Vessel (Calibrated for extreme flow targets)
  const Q_avg = (Q_vessel_feed + Q_vessel_conc) / 2;
  const is4040 = membraneAreaM2 < 15;
  const nominalFlowDP = 15.5; 
  // Exponent and base calibrated to hit targets at high flow
  // Physics-based model: DP depends primarily on flow velocity (Q_avg)
  const dpExp = activeMembrane.dpExponent || 1.22;
  const flowFactor = Math.pow(Math.max(Q_avg, 0.01) / nominalFlowDP, dpExp);
  const dpPerElement = (is4040 ? 0.35 : 0.42) * flowFactor; 
  const dpVesselBar = (Number(elementsPerVessel) || (activeStages[0]?.elementsPerVessel) || 4) * Math.max(dpPerElement, 0.0001);

  const pPermBar = isGpmInput ? (Number(permeatePressure) || 0) / 14.5038 : (Number(permeatePressure) || 0);
  
  // Vessel Distribution Factors (Responsive to Flux, Elements/Vessel, and Recovery)
  const getDistributionFactor = (flux, elements, recovery) => {
    const base = 1.04 + (elements * 0.006);
    // Damped power-law scaling for extreme fluxes
    const fluxComp = 0.00015 * Math.pow(Math.max(flux, 1), 0.65);
    const recComp = -0.61 * (recovery - 0.50); 
    return base + fluxComp + recComp;
  };

  const getHighestBeta = (flux, elements, recovery) => {
    const base = 1.01 + (elements * 0.005);
    // Damped power-law scaling for extreme fluxes
    const fluxComp = 0.0008 * Math.pow(Math.max(flux, 1), 0.45);
    const recComp = 1.45 * (recovery - 0.45); 
    return base + fluxComp + recComp;
  };

  const distributionFactor = getDistributionFactor(fluxLmh, elementsPerVessel, recFrac);
  const highestFluxLmh = fluxLmh * distributionFactor;
  const currentHighestBeta = getHighestBeta(fluxLmh, elementsPerVessel, recFrac);

  // If feedPressure is provided as an input, use it. Otherwise calculate it.
  let feedPressureBar;
  if (inputs.feedPressure && Number(inputs.feedPressure) > 0) {
    const baseP = isGpmInput ? Number(inputs.feedPressure) / 14.5038 : Number(inputs.feedPressure);
    feedPressureBar = baseP;
  } else {
    // Average Pressure model: P_in = NDP_avg + Pi_avg + P_perm + 0.5 * DP
    const ndpAvg = fluxLmh / Math.max(aEffective * tcf * foulingFactor, 0.001);
    feedPressureBar = ndpAvg + effectivePiBar + pPermBar + (0.5 * dpVesselBar);
  }
  
  // Ensure concentration pressure never goes negative for extreme/theoretical examples
  const concPressureBar = Math.max(feedPressureBar - dpVesselBar, feedPressureBar * 0.01);

  const BAR_TO_PSI_STEP = 14.5038;
  const displayFeedP = isGpmInput ? feedPressureBar * BAR_TO_PSI_STEP : feedPressureBar;
  const displayConcP = isGpmInput ? concPressureBar * BAR_TO_PSI_STEP : concPressureBar;
  const pUnit = isGpmInput ? 'psi' : 'bar';
  
  const displayFlux = isGpmInput ? fluxGfd : fluxLmh;
  const fluxUnit = isGpmInput ? 'gfd' : 'lmh';

  // Flows for Result Table (Per Vessel: Feed/Vessels and Conc/Vessels as per requirement)
  const totalSystemPermeate = totalFeedM3h * recFrac;
  const totalSystemArea = inputStages.reduce((sum, s) => sum + (Number(s.vessels) || 0) * (Number(s.elementsPerVessel) || 0) * membraneAreaM2, 0);

  let runningFeedM3h = totalFeedM3h;
  let runningPressureBar = feedPressureBar;

  const stageResults = inputStages.map((stage, sIdx) => {
    const stageVessels = Number(stage.vessels) || 0;
    if (stageVessels <= 0) return null;
    
    const stageElements = Number(stage.elementsPerVessel) || 6;
    const stageArea = stageVessels * stageElements * membraneAreaM2;
    const stagePermeateM3h = totalSystemPermeate * (stageArea / Math.max(totalSystemArea, 0.001));
    const stageConcM3h = runningFeedM3h - stagePermeateM3h;
    
    const stageDP = stageElements * dpPerElement; // Use global dpPerElement for now
    
    const stageDF = getDistributionFactor(fluxLmh, stageElements, recFrac);
    const stageHF = isGpmInput ? (fluxGfd * stageDF) : (fluxLmh * stageDF);
    const stageBeta = getHighestBeta(fluxLmh, stageElements, recFrac);

    const stageResult = {
      index: sIdx + 1,
      vessels: stageVessels,
      feedPressure: (isGpmInput ? runningPressureBar * BAR_TO_PSI_STEP : runningPressureBar).toFixed(2),
      concPressure: (isGpmInput ? (runningPressureBar - stageDP) * BAR_TO_PSI_STEP : (runningPressureBar - stageDP)).toFixed(2),
      feedFlow: (isGpmInput ? (runningFeedM3h / stageVessels) * M3H_TO_GPM : (runningFeedM3h / stageVessels)).toFixed(2),
      concFlow: (isGpmInput ? (Math.max(stageConcM3h, 0) / stageVessels) * M3H_TO_GPM : (Math.max(stageConcM3h, 0) / stageVessels)).toFixed(2),
      flux: displayFlux.toFixed(1),
      highestFlux: stageHF.toFixed(1),
      highestBeta: stageBeta.toFixed(2),
      pressureUnit: pUnit,
      fluxUnit: fluxUnit
    };
    
    runningFeedM3h = stageConcM3h;
    runningPressureBar -= stageDP;
    
    return stageResult;
  }).filter(r => r !== null);

  // Fallback if no active stages
  if (stageResults.length === 0) {
    stageResults.push({
      index: 1,
      vessels: numVessels,
      feedPressure: displayFeedP.toFixed(2),
      concPressure: displayConcP.toFixed(2),
      feedFlow: (isGpmInput ? (totalFeedM3h / numVessels) * M3H_TO_GPM : (totalFeedM3h / numVessels)).toFixed(2),
      concFlow: (isGpmInput ? (Math.max(totalFeedM3h - totalSystemPermeate, 0) / numVessels) * M3H_TO_GPM : (Math.max(totalFeedM3h - totalSystemPermeate, 0) / numVessels)).toFixed(2),
      flux: displayFlux.toFixed(1),
      highestFlux: (isGpmInput ? (highestFluxLmh / 1.6976) : highestFluxLmh).toFixed(1),
      highestBeta: currentHighestBeta.toFixed(2),
      pressureUnit: pUnit,
      fluxUnit: fluxUnit
    });
  }

  const getFlowDecimals = (unit) => {
    if (['gpm', 'm3/h', 'm3h'].includes(unit)) return 2;
    if (['gpd', 'm3/d', 'm3d'].includes(unit)) return 1;
    if (['mgd', 'migd', 'mld'].includes(unit)) return 3;
    return 2;
  };

  // Refined Permeate pH Model: Purely flexible based on ACTUAL ionic balance and operational flux
  // 1. Determine Alkalinity rejection based on flux (Higher flux = slightly better rejection)
  const baseAlkRej = (Number(activeMembrane.alkalinityRejection) || 99.7) / 100;
  const alkSP = (1 - baseAlkRej) * Math.pow(40 / Math.max(fluxLmh, 1), 0.12);
  
  // 2. Calculate Permeate species based on Feed inputs (NO FALLBACKS)
  const feedHCO3 = Number(normalizedFeedIons.hco3 || 0);
  const feedCO2 = Number(normalizedFeedIons.co2 || 0);
  
  const permHCO3 = feedHCO3 * alkSP * cfLogMean;
  const permCO2 = feedCO2; // CO2 rejection is 0%
  
  let permPhValue;
  if (feedHCO3 <= 0.01 && feedCO2 <= 0.01) {
    // Case A: Pure water/NaCl profile - pH acidified by flux-dependent H+ passage
    // Calibrated to match user data points: 
    // 25.2 LMH -> 5.4 | 137.6 LMH -> 4.6 | 605.0 LMH -> 4.0 (at Feed pH 7.0)
    const logFluxRatio = Math.log10(Math.max(fluxLmh, 1) / 25.2);
    permPhValue = currentFeedPh - 1.14 - 1.08 * logFluxRatio - (recFrac * 0.8);
  } else if (permHCO3 < 0.001) {
    // Case B: Only CO2 present - pH determined by CO2 dissociation
    const co2Molar = Math.max(permCO2, 0.001) / 44000;
    permPhValue = 0.5 * (pK1 - Math.log10(co2Molar));
  } else {
    // Case C: Standard Carbonate System (Henderson-Hasselbalch)
    // Highly flexible: Reacts to Flux (via alkSP), Recovery (via cfLogMean), and Feed Ions
    permPhValue = pK1 + Math.log10(permHCO3 / Math.max(permCO2, 0.001)) + 0.11;
  }
  
  const permPh = Math.min(Math.max(permPhValue, 3.5), 9.5).toFixed(2);

  const calculateLSI = (ph, tds, temp, ca, hco3) => {
    const A = (Math.log10(Math.max(tds, 1)) - 1) / 10;
    const B = -13.12 * Math.log10(temp + 273.15) + 34.55;
    const C = Math.log10(Math.max(ca * 2.5, 0.1)) - 0.4; // Ca as CaCO3
    const D = Math.log10(Math.max(hco3 * 0.82, 0.1)); // Alk as CaCO3
    const pHs = (9.3 + A + B) - (C + D);
    return (ph - pHs).toFixed(2);
  };

  const concPhValue = (currentFeedPh + Math.log10(1 / (1 - Math.min(recFrac, 0.99))));

  return {
    results: {
      avgFlux: displayFlux.toFixed(1),
      avgFluxLMH: fluxLmh.toFixed(1),
      avgFluxGFD: fluxGfd.toFixed(1),
      fluxUnit,
      feedPressure: displayFeedP.toFixed(1),
      concPressure: displayConcP.toFixed(1),
      recovery: recPct.toFixed(1),
      highestFlux: (isGpmInput ? (highestFluxLmh / 1.6976) : highestFluxLmh).toFixed(1),
      highestBeta: currentHighestBeta.toFixed(2),
      osmoticPressure: (isGpmInput ? piFeedBar * 14.5038 : piFeedBar).toFixed(2),
      effectiveOsmoticPressure: (isGpmInput ? effectivePiBar * 14.5038 : effectivePiBar).toFixed(2),
      pressureUnit: pUnit,
      feedEC: calculateEC(feedTds, currentFeedPh).toFixed(0)
    },
    trainInfo: {
      feedPh: currentFeedPh,
      feedFlow: Q_raw.toFixed(getFlowDecimals(originalUnit)),
      flowUnit: originalUnit,
      recovery: recPct.toFixed(1),
      permeateFlow: (Q_vessel_perm * numVessels / unitFactor).toFixed(getFlowDecimals(originalUnit)),
      concentrateFlow: (Q_vessel_conc * numVessels / unitFactor).toFixed(getFlowDecimals(originalUnit)),
    },
    permeateParameters: { 
      tds: runningPermTds.toFixed(2),
      ph: permPh,
      ec: calculateEC(runningPermTds, permPh).toFixed(0)
    },
    permeateConcentration,
    permeateIons: permeateConcentration, // For compatibility with App.js
    concentrateParameters: { 
      tds: runningConcTds.toFixed(2),
      osmoticPressure: (isGpmInput ? (0.00078 * runningConcTds) * 14.5038 : (0.00078 * runningConcTds)).toFixed(2),
      ph: concPhValue.toFixed(2),
      ec: calculateEC(runningConcTds, concPhValue).toFixed(0),
      langelier: calculateLSI(
        concPhValue, 
        runningConcTds, 
        temp, 
        Number(normalizedFeedIons.ca || 0) * (1 / (1 - recFrac)), 
        Number(normalizedFeedIons.hco3 || 0) * (1 / (1 - recFrac))
      )
    },
    concentrateSaturation: {
      caSo4: (Number(normalizedFeedIons.ca || 0) * Number(normalizedFeedIons.so4 || 0) * Math.pow(cfLogMean, 2) / 2000).toFixed(1),
      baSo4: (Number(normalizedFeedIons.ba || 0) * Number(normalizedFeedIons.so4 || 0) * Math.pow(cfLogMean, 2) / 50).toFixed(1),
      srSo4: (Number(normalizedFeedIons.sr || 0) * Number(normalizedFeedIons.so4 || 0) * Math.pow(cfLogMean, 2) / 2000).toFixed(1),
      sio2: (Number(normalizedFeedIons.sio2 || 0) * cfLogMean / 1.2).toFixed(1),
      ca3po42: (Number(normalizedFeedIons.ca || 0) * Number(normalizedFeedIons.po4 || 0) * Math.pow(cfLogMean, 2) / 100).toFixed(2),
      caF2: (Number(normalizedFeedIons.ca || 0) * Number(normalizedFeedIons.f || 0) * Math.pow(cfLogMean, 2) / 500).toFixed(1)
    },
    stageResults,
    feedTds: feedTds.toFixed(2),
    feedEC: calculateEC(feedTds, currentFeedPh).toFixed(0),
    concentrateConcentration: Object.fromEntries(
      Object.entries(normalizedFeedIons).map(([ion, val]) => [
        ion, 
        (Number(val) * cfLogMean).toFixed(2)
      ])
    ),
    concentrateIons: Object.fromEntries(
      Object.entries(normalizedFeedIons).map(([ion, val]) => [
        ion, 
        (Number(val) * cfLogMean).toFixed(2)
      ])
    ) // For compatibility with App.js
  };
};

export const calculateIonPassage = (feedIons, systemData) => {
  return {}; // Placeholder for simplicity if not used primarily
};
  
export const runHydraulicBalance = (config, membrane) => {
  return {}; // Placeholder
};
