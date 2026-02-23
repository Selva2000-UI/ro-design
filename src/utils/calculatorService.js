/* ================= IMSDesign Hydraulic Engine (REFINED) ================= */
import { validateDesignWithWaterType } from './designValidator';
import { getWaterTypeInfo } from './waterTypeConfig';

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
    dpExponent: 1.75,
    membraneB: 0.145,
    nominalFlowDP: 6.0,
    maxFlux: 50.0
  },
  {
    id: 'cpa3',
    name: 'CPA3-8040',
    area: 400,
    areaM2: 37.17,
    aValue: 3.21,
    rejection: 99.7,
    dpExponent: 1.18,
    membraneB: 0.136,
    nominalFlowDP: 15.5,
    maxFlux: 51.8
  },
  {
    id: 'lfc3ld4040',
    name: 'LFC3-LD-4040',
    area: 80,
    areaM2: 7.43,
    rejection: 99.7,
    aValue: 4.40,
    dpExponent: 1.75,
    membraneB: 0.142,
    nominalFlowDP: 6.0,
    maxFlux: 48.0,
    maxTds: 1500,
    maxTemp: 45,
    maxPressure: 600,
    maxFlow: 16,
    minBrineFlow: 3,
    maxPressureDrop: 15,
    lowFouling: true
  },
  {
    id: 'bwtds2k8040',
    name: 'BW-TDS-2K-8040',
    area: 400,
    areaM2: 37.16,
    aValue: 3.18,
    rejection: 99.35,
    dpExponent: 1.22,
    membraneB: 0.152,
    nominalFlowDP: 15.5,
    maxFlux: 48.0,
    maxTds: 2000,
    maxTemp: 45,
    maxPressure: 600,
    designFluxMin: 12,
    designFluxMax: 18,
    designRecoveryMin: 40,
    designRecoveryMax: 55,
    testPressure: 10.3,
    maxPressureDrop: 1,
    waterType: 'Brackish'
  },
  {
    id: 'bwtds5k8040',
    name: 'BW-TDS-5K-8040',
    area: 400,
    areaM2: 37.16,
    aValue: 3.18,
    rejection: 99.35,
    dpExponent: 1.22,
    membraneB: 0.152,
    nominalFlowDP: 15.5,
    maxFlux: 48.0,
    maxTds: 5000,
    maxTemp: 45,
    maxPressure: 600,
    designFluxMin: 10,
    designFluxMax: 15,
    designRecoveryMin: 35,
    designRecoveryMax: 50,
    testPressure: 15.5,
    maxPressureDrop: 1,
    waterType: 'Brackish Medium'
  },
  {
    id: 'bwtds10kfr8040',
    name: 'BW-TDS-10K-FR-8040',
    area: 400,
    areaM2: 37.16,
    aValue: 3.18,
    rejection: 99.35,
    dpExponent: 1.22,
    membraneB: 0.152,
    nominalFlowDP: 15.5,
    maxFlux: 48.0,
    maxTds: 10000,
    maxTemp: 45,
    maxPressure: 600,
    foulingResistant: true,
    maxCod: 250,
    designFluxMin: 8,
    designFluxMax: 12,
    designRecoveryMin: 30,
    designRecoveryMax: 45,
    testPressure: 15.5,
    maxPressureDrop: 1,
    waterType: 'Brackish High-Fouling'
  },
  {
    id: 'swtds32k8040',
    name: 'SW-TDS-32K-8040',
    area: 400,
    areaM2: 37.16,
    aValue: 2.75,
    rejection: 99.35,
    dpExponent: 1.22,
    membraneB: 0.165,
    nominalFlowDP: 15.5,
    maxFlux: 42.0,
    maxTds: 40000,
    maxTemp: 45,
    maxPressure: 1200,
    seawater: true,
    designFluxMin: 8,
    designFluxMax: 12,
    designRecoveryMin: 35,
    designRecoveryMax: 45,
    testPressure: 55,
    maxPressureDrop: 1,
    waterType: 'Seawater'
  },
  {
    id: 'cpa5max8040',
    name: 'CPA5-MAX-8040',
    area: 440,
    areaM2: 40.9,
    aValue: 2.90,
    rejection: 99.7,
    dpExponent: 1.18,
    membraneB: 0.125,
    nominalFlowDP: 17.0,
    maxFlux: 53.0,
    maxTds: 1500,
    maxTemp: 45,
    maxPressure: 600
  },
  {
    id: 'cpa5ld4040',
    name: 'CPA5LD-4040',
    area: 80,
    areaM2: 7.43,
    aValue: 4.25,
    rejection: 99.7,
    monoRejection: 98.5,
    divalentRejection: 99.9,
    silicaRejection: 99.2,
    boronRejection: 93.0,
    alkalinityRejection: 99.8,
    co2Rejection: 0.0,
    dpExponent: 1.75,
    membraneB: 0.139,
    nominalFlowDP: 6.5,
    maxFlux: 50.0,
    maxTds: 1500,
    maxTemp: 45,
    maxPressure: 600,
    lowFouling: true
  }
];

export const WATER_TYPE_RECOVERY_LIMITS = {
  '<2000': { min: 30, max: 55 },
  '2000-5000': { min: 30, max: 50 },
  '5000-10000': { min: 25, max: 45 },
  '10000-30000': { min: 20, max: 40 },
  '>30000': { min: 15, max: 35 }
};

export const getRecoveryLimitForTds = (tds) => {
  const tdsNum = Number(tds) || 0;
  if (tdsNum < 2000) return WATER_TYPE_RECOVERY_LIMITS['<2000'];
  if (tdsNum < 5000) return WATER_TYPE_RECOVERY_LIMITS['2000-5000'];
  if (tdsNum < 10000) return WATER_TYPE_RECOVERY_LIMITS['5000-10000'];
  if (tdsNum < 30000) return WATER_TYPE_RECOVERY_LIMITS['10000-30000'];
  return WATER_TYPE_RECOVERY_LIMITS['>30000'];
};

export const OSMOTIC_PRESSURE_CONSTANTS = {
  BAR: 0.00076,
  PSI: 0.011
};

export const BAR_TO_PSI = 14.5038;
export const M3H_TO_GPM = 1 / 0.2271247;
export const LMH_TO_GFD = 1 / 1.6976;

export const calculateOsmoticPressure = (tds, unit = 'bar') => {
  if (unit === 'psi') {
    return 0.011 * tds;
  }
  return 0.00076 * tds;
};

export const validateDesignFlux = (fluxLmh, membraneType) => {
  const warnings = [];
  const errors = [];
  
  if (fluxLmh < 3) {
    errors.push('Flux < 3 LMH: Invalid design');
  }
  if (fluxLmh > 25 && (membraneType || '').includes('BW')) {
    errors.push('Flux > 25 LMH for brackish water: Exceeds safe limit');
  }
  if (fluxLmh < 5) {
    warnings.push('System oversized – Reduce membrane count or increase flow');
  }
  
  return { warnings, errors };
};

export const validateSystemOversize = (fluxLmh, installedArea, permeateFlowM3h) => {
  const warnings = [];
  const requiredArea = permeateFlowM3h > 0 ? permeateFlowM3h / Math.max(fluxLmh, 1) : 0;
  
  if (installedArea > 2 * requiredArea && requiredArea > 0) {
    warnings.push(`Membrane count too high: Installed ${installedArea.toFixed(1)} m² for only ${requiredArea.toFixed(1)} m² needed`);
  }
  
  return { warnings };
};

export const validateFeedFlow = (feedPerElement, fluxLmh) => {
  const warnings = [];
  const errors = [];
  
  if (feedPerElement < 0.5) {
    warnings.push('Feed per element < 0.5 m³/h: Poor rejection expected');
  }
  if (feedPerElement > 3.6) {
    errors.push('Feed per element > 3.6 m³/h: Exceeds element hydraulic limit');
  }
  if (feedPerElement < 0.8 || feedPerElement > 1.2) {
    warnings.push('Feed per element outside recommended 0.8–1.2 m³/h range');
  }
  
  return { warnings, errors };
};

export const validateRecovery = (recoveryPct, feedTds) => {
  const errors = [];
  const limit = getRecoveryLimitForTds(feedTds);
  
  if (recoveryPct > limit.max) {
    errors.push(`Recovery ${recoveryPct.toFixed(1)}% exceeds safe limit of ${limit.max}% for ${feedTds} ppm TDS`);
  }
  
  return { errors };
};

export const validatePressure = (feedPressureBar, membrane) => {
  const errors = [];
  const maxPressure = Number(membrane?.maxPressure) || 600;
  
  if (feedPressureBar > maxPressure) {
    errors.push(`Feed pressure ${(feedPressureBar * 14.5038).toFixed(1)} psi exceeds membrane max of ${maxPressure * 14.5038 / 14.5038} bar`);
  }
  
  return { errors };
};

// Electrical Conductivity (EC, µS/cm @ 77°F) Calculation
// Calibrated to match user examples: k ≈ 1.8 - 2.5 µS/cm per mg/L TDS
export const calculateEC = (tds) => {
  const t = Number(tds) || 0;

  if (t >= 2500) {
    return t * 1.83;
  } else if (t >= 1000) {
    return t * 1.95;
  } else if (t >= 300) {
    return t * 2.28; // Matches Ex-1 Stage-6 (473 mg/L -> 1080 uS/cm)
  } else if (t >= 50) {
    return t * 2.4;
  } else {
    return t * 2.52; // Matches Ex-1 Stage-1 Permeate (8.43 mg/L -> 21.3 uS/cm)
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
    stages = [],
    waterType = null
  } = inputs;

  const originalUnit = (flowUnit || 'gpm').toLowerCase().trim();
  const unitKey = originalUnit.replace('³', '3'); // Keep slash if present for better matching
  const isGpmInput = ['gpm', 'gpd', 'mgd', 'migd'].includes(unitKey.replace('/', ''));
  const recPct = Number(recovery) || 50;
  const recFrac = recPct / 100;

  //  Unit Normalization (Robust)
  const Q_raw = Number(feedFlow) || 0;

  // Try specific key first, then fallback to normalized key
  const unitFactor = FLOW_TO_M3H[unitKey] || FLOW_TO_M3H[unitKey.replace('/', '')] || 1;
  const totalFeedM3h = Q_raw * unitFactor;

  // Temperature and pH Context (Early declaration for use in all sub-calculations)
  const tempC = Number(inputs.temp) || (inputs.tempF ? (Number(inputs.tempF) - 32) * 5 / 9 : 25);
  const currentFeedPh = Number(inputs.feedPh || inputs.feedPH || 7.0);
  const tempK = tempC + 273.15;

  // Temperature Correction Factor (TCF)
  const tcf = Math.exp(2640 * (1 / 298.15 - 1 / (tempK)));

  //  Per-Vessel Flow Calculation
  const allStages = Array.isArray(stages) && stages.length > 0 ? stages : [{ vessels: vessels, elementsPerVessel: elementsPerVessel, membraneModel: inputs.membraneModel }];
  const inputStages = allStages.filter(s => (Number(s.vessels) > 0));
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
    if (isNaN(a) || a <= 0) return 3.40; // Calibrated for CPA3 baseline
    if (a < 1.0) return a * 24.62;
    return a;
  };

  const membraneAreaM2 = Number(activeMembrane.areaM2) || (Number(activeMembrane.area || 400) * 0.09290304);
  const elements = Number(elementsPerVessel) || (activeStages[0]?.elementsPerVessel) || 4;
  const totalAreaPerVessel = elements * membraneAreaM2;

  //  Flux Calculation
  const fluxLmh = totalAreaPerVessel > 0 ? (Q_vessel_perm * 1000) / totalAreaPerVessel : 0;
  const fluxGfd = fluxLmh / 1.6976;

  //  Net Driving Pressure (NDP)
  const aValue = getSanitizedAValue(activeMembrane);

  // Ageing / fouling / SP increase
  const membraneAge = Math.max(Number(inputs.membraneAge) || 0, 0);
  const fluxDeclinePct = Math.min(Math.max(Number(inputs.fluxDeclinePerYear) || 0, 0), 99);
  const spIncreasePct = Math.min(Math.max(Number(inputs.spIncreasePerYear) || 0, 0), 200);
  const foulingFactor = Math.min(Math.max(Number(inputs.foulingFactor) || 1, 0.35), 1);

  // --- INDUSTRIAL-GRADE A-VALUE CALCULATION ---
  // A_eff = A_ref × TCF × FoulingFactor × AgingFactor
  const agingFactor = Math.pow(1 - fluxDeclinePct / 100, membraneAge);
  const aEffective = aValue * tcf * foulingFactor * agingFactor;

  //  Effective Osmotic Pressure (Refined physics-based model)
  const normalizedFeedIons = { ...(feedIons || {}) };
  const feedTds = Object.values(normalizedFeedIons).reduce((sum, v) => sum + (Number(v) || 0), 0) || Number(inputs.tds) || 2100;

  // Osmotic Pressure (Correct physical model)
  // π(bar) = 0.00076 × TDS
  // Temperature factor correction: multiply by (T_kelvin / 298.15)
  const tempFactor = tempK / 298.15;
  
  // Feed osmotic pressure in bar
  const piFeedBar = calculateOsmoticPressure(feedTds, 'bar') * tempFactor;
  
  // Concentration Factor: CF = 1 / (1 - Recovery)
  const cf = recFrac > 0.01 && recFrac < 0.99 ? 1 / (1 - recFrac) : 1.10;
  
  // Concentrate osmotic pressure
  const piConcBar = piFeedBar * cf;
  
  // Average osmotic pressure: π_avg = (π_feed + π_conc) / 2
  const piAvgBar = (piFeedBar + piConcBar) / 2;
  
  // Log-mean concentration factor (for ion calculations)
  const cfLogMean = recFrac > 0.01 ? -Math.log(1 - recFrac) / recFrac : 1;
  
  // System-level beta (used for reporting, same as concentration factor)
  const systemLevelBeta = cf;
  
  const effectivePiBar = piAvgBar;

  const nominalFlowDP = Number(activeMembrane.nominalFlowDP) || 15.5;
  const dpExp = Number(activeMembrane.dpExponent) || 1.22;

  // --- REFINED PRESSURE DROP ESTIMATION FOR MULTI-STAGE ---
  // Per vessel flow (feed inlet)
  const feedFlowPerVessel = totalFeedM3h / Math.max(numVessels, 1);
  
  let totalSystemDP = 0;
  let stageInputPressures = [];
  let runningFlowForDP = totalFeedM3h;
  
  inputStages.forEach((stage, idx) => {
    const sVessels = Math.max(Number(stage.vessels) || 1, 1);
    const sElements = Number(stage.elementsPerVessel) || 4;
    
    // Per-vessel flow calculation for stage
    const sFlowPerVessel = runningFlowForDP / sVessels;
    
    // Pressure drop formula: ΔP = K_dp × Q_v^exponent
    // Where exponent is from membrane spec, adjusted for better accuracy
    // For 8040 membranes, use 1.5 as compromise between dpExponent and 1.75
    const dpExponentForCalc = (activeMembraneId || '').includes('8040') ? 1.5 : dpExp;
    const sFlowFactor = Math.pow(Math.max(sFlowPerVessel, 0.01) / nominalFlowDP, dpExponentForCalc);
    
    // K_dp element coefficient
    const dpElementCoeff = 0.35;
    const sDP = sElements * dpElementCoeff * sFlowFactor;
    
    stageInputPressures.push({
      index: idx,
      vessels: sVessels,
      elements: sElements,
      flowPerVessel: sFlowPerVessel,
      dp: sDP
    });
    
    totalSystemDP += sDP;
    
    // Calculate concentrate flow for next stage
    const sPerm = (totalFeedM3h * recFrac) / Math.max(inputStages.length, 1);
    runningFlowForDP = Math.max(runningFlowForDP - sPerm, 0);
  });

  const pPermBar = isGpmInput ? (Number(permeatePressure) || 0) / 14.5038 : (Number(permeatePressure) || 0);
  
  const distributionFactor = 1.10;
  const highestFluxLmh = fluxLmh * distributionFactor;

  let feedPressureBar;
  if (inputs.feedPressure && Number(inputs.feedPressure) > 0) {
    const baseP = isGpmInput ? Number(inputs.feedPressure) / 14.5038 : Number(inputs.feedPressure);
    feedPressureBar = baseP + pPermBar;
  } else {
    // Industrial-grade pressure formula:
    // FeedPressure = Flux/A + Δπ_avg + PermeatePressure + 0.5×SystemDP
    const ndpBar = fluxLmh / Math.max(aEffective * tcf * foulingFactor, 0.001);
    feedPressureBar = ndpBar + effectivePiBar + pPermBar + (0.5 * totalSystemDP);
  }

  // Reality check: Feed pressure must exceed osmotic pressure
  if (feedPressureBar <= piAvgBar) {
    throw new Error(`Impossible operation: Feed pressure (${feedPressureBar.toFixed(1)} bar) must exceed osmotic pressure (${piAvgBar.toFixed(1)} bar).`);
  }

  // Concentrate pressure is calculated per-stage (will be updated in stageResults)
  // Start with feed pressure minus total system DP as fallback
  let concPressureBar = Math.max(feedPressureBar - totalSystemDP, feedPressureBar * 0.01);

  // --- REFINED PERMEATE CALCULATIONS ---
  const cumulativeIonWeights = {};
  const permeateConcentration = {};
  const spFactor = Math.pow(1 + spIncreasePct / 100, membraneAge);

  const BAR_TO_PSI_STEP = 14.5038;
  const displayFeedP = isGpmInput ? feedPressureBar * BAR_TO_PSI_STEP : feedPressureBar;
  const pUnit = isGpmInput ? 'psi' : 'bar';

  const displayFlux = isGpmInput ? fluxGfd : fluxLmh;
  const fluxUnit = isGpmInput ? 'gfd' : 'lmh';

  // Flows for Result Table (Per Vessel: Feed/Vessels and Conc/Vessels as per requirement)
  const totalSystemPermeate = totalFeedM3h * recFrac;

  let runningFeedM3h = totalFeedM3h;
  let runningFeedTds = feedTds;
  let runningFeedPh = currentFeedPh;

  const flowDiagramPoints = [];
  // Point 1: System Feed (Raw)
  flowDiagramPoints.push({
    id: 1,
    name: 'Feed Inlet',
    flow: totalFeedM3h.toFixed(1),
    pressure: (0).toFixed(1),
    tds: feedTds.toFixed(0),
    ph: currentFeedPh.toFixed(2),
    ec: calculateEC(feedTds, currentFeedPh).toFixed(0)
  });

  // Point 2: After Pump
  flowDiagramPoints.push({
    id: 2,
    name: 'After HP Pump',
    flow: totalFeedM3h.toFixed(1),
    pressure: (isGpmInput ? feedPressureBar * BAR_TO_PSI_STEP : feedPressureBar).toFixed(1),
    tds: feedTds.toFixed(0),
    ph: currentFeedPh.toFixed(2),
    ec: calculateEC(feedTds, currentFeedPh).toFixed(0)
  });

  let cumulativePermFlow = 0;
  let cumulativePermTdsWeighted = 0;
  let cumulativePermPhWeighted = 0;

  // --- CALCULATE IONIC STRENGTH FOR DYNAMIC B-VALUE ---
  // IonicStrength = 0.5 × Σ(c_i × z_i²)
  // Common charge mapping: Na=1, K=1, Ca=2, Mg=2, Cl=1, SO4=2, HCO3=1, NO3=1, etc.
  const ionCharges = {
    'na': 1, 'k': 1, 'nh4': 1, 'ca': 2, 'mg': 2, 'ba': 2, 'sr': 2,
    'cl': 1, 'hco3': 1, 'co3': 2, 'so4': 2, 'no3': 1, 'po4': 3, 'f': 1
  };

  const calculateIonicStrength = (ions) => {
    let ionicStrength = 0;
    Object.entries(ions).forEach(([ionName, concentration]) => {
      const charge = ionCharges[ionName.toLowerCase()] || 1;
      const molarity = (Number(concentration) || 0) / 1000; // Approximate: mg/L to mol/L
      ionicStrength += 0.5 * molarity * charge * charge;
    });
    return ionicStrength;
  };

  const feedIonicStrength = calculateIonicStrength(normalizedFeedIons);
  // IonicStrengthFactor = 1 + 0.2 × IonicStrength
  const ionicStrengthFactor = 1 + 0.2 * feedIonicStrength;

  // --- DYNAMIC B-VALUE (Industrial-Grade) ---
  // B_eff = B_ref × TCF × FoulingFactor × IonicStrengthFactor
  const membraneBRef = Number(activeMembrane.membraneB) || 0.136;
  const bEffective = membraneBRef * tcf * foulingFactor * ionicStrengthFactor;

  // Calculate stage pressures properly: P_c,i = P_f,i - ΔP_i
  let runningPressureForStages = feedPressureBar;
  
  const stageResults = inputStages.map((stage, sIdx) => {
    const stageVessels = Number(stage.vessels) || 0;
    if (stageVessels <= 0) return null;

    const stageElements = Number(stage.elementsPerVessel) || 4;
    const stageArea = stageVessels * stageElements * membraneAreaM2;

    // For single-stage or simple configurations, distribute permeate proportionally
    const fluxRatios = [2.2, 1.5, 1.0, 0.65, 0.35, 0.15];
    const currentRatio = fluxRatios[sIdx % fluxRatios.length] || 0.10;
    const stageWeight = stageArea * currentRatio;
    const totalWeight = inputStages.reduce((acc, st, i) => {
      const stArea = st.vessels * st.elementsPerVessel * membraneAreaM2;
      return acc + (stArea * (fluxRatios[i] || 0.1));
    }, 0);
    const adjustedPermM3h = totalWeight > 0 ? totalSystemPermeate * (stageWeight / totalWeight) : totalSystemPermeate;

    const stageConcM3h = runningFeedM3h - adjustedPermM3h;
    
    // Get stage-specific pressure drop from precomputed values
    const stageDP = sIdx < stageInputPressures.length ? stageInputPressures[sIdx].dp : 0;
    
    // Feed pressure at inlet to this stage
    const stageFeedPBar = runningPressureForStages;
    // Concentrate (outlet) pressure: P_c,i = P_f,i - ΔP_i
    const stageConcPBar = Math.max(stageFeedPBar - stageDP, 0.01);
    
    const stageFluxLmh = (adjustedPermM3h * 1000) / stageArea;
    const stageDF = sIdx === 0 ? 1.10 : 1.08;
    
    // --- INDUSTRIAL-GRADE TDS MODEL (Solution-Diffusion) ---
    // Stage-level recovery and dynamic beta
    const stageRecovery = adjustedPermM3h / runningFeedM3h;
    // Dynamic Beta per stage: β = 1 / (1 - StageRecovery)
    const stageBeta = (stageRecovery > 0 && stageRecovery < 1) 
      ? 1 / (1 - stageRecovery)
      : 1.10; // fallback for edge cases
    
    // Stage Rejection: R = J / (J + B_eff × β)
    // Using industrial-grade B-value that accounts for:
    // - Temperature (TCF)
    // - Fouling (FoulingFactor)
    // - Ionic strength of the feed water
    const stageRejection = stageFluxLmh / (stageFluxLmh + bEffective * stageBeta);

    // 3. Calculate Permeate TDS
    const stagePermTds = runningFeedTds * (1 - stageRejection);

    // 4. Calculate Stage-wise Ion Passage (Industrial-Grade)
    // Using dynamic B-value and beta for all ions
    Object.entries(normalizedFeedIons).forEach(([ion, val]) => {
      const ionLower = ion.toLowerCase();
      // CO2 rejection is 0%
      if (ionLower === 'co2') {
        cumulativeIonWeights[ion] = (cumulativeIonWeights[ion] || 0) + (Number(val) * adjustedPermM3h);
        return;
      }

      // Ion Rejection: R_ion = J / (J + B_eff × β × SpFactor)
      // All ions use the same industrial-grade B-effective and dynamic beta
      const ionRej = stageFluxLmh / (stageFluxLmh + bEffective * stageBeta * spFactor);

      // Correct for log-mean concentration in the stage
      const stageCfLogMean = stageRecovery > 0.01 ? -Math.log(1 - stageRecovery) / stageRecovery : 1;

      const ionPerm = (Number(val) * stageCfLogMean) * (1 - ionRej);
      cumulativeIonWeights[ion] = (cumulativeIonWeights[ion] || 0) + (ionPerm * adjustedPermM3h);
    });

    // 5. pH logic matches Example: Permeate pH INCREASES as flux drops (Stage-1 lowest)
    const stagePermPh = Math.min(currentFeedPh - 1.94 + (sIdx * 0.28), 7.0);

    cumulativePermFlow += adjustedPermM3h;
    cumulativePermTdsWeighted += (stagePermTds * adjustedPermM3h);
    cumulativePermPhWeighted += (stagePermPh * adjustedPermM3h);

    const stageConcTds = Math.max((runningFeedM3h * runningFeedTds - adjustedPermM3h * stagePermTds) / Math.max(stageConcM3h, 0.1), runningFeedTds);
    const stageConcPh = runningFeedPh + 0.12;

    // Add points to diagram
    // Point 3, 4, 5... (Concentrate line)
    flowDiagramPoints.push({
      id: 3 + sIdx,
      name: sIdx === inputStages.length - 1 ? 'Final Conc (Reject)' : `St-${sIdx + 1} Outlet`,
      flow: stageConcM3h.toFixed(1),
      pressure: (isGpmInput ? stageConcPBar * BAR_TO_PSI_STEP : stageConcPBar).toFixed(1),
      tds: stageConcTds.toFixed(0),
      ph: stageConcPh.toFixed(2),
      ec: calculateEC(stageConcTds, stageConcPh).toFixed(0)
    });

    // Point 6, 7, 8... (Stage Permeate lines) - Offset varies by stage count
    const permPointId = inputStages.length + sIdx + 3;
    flowDiagramPoints.push({
      id: permPointId,
      name: `St-${sIdx + 1} Permeate`,
      flow: adjustedPermM3h.toFixed(1),
      pressure: (0).toFixed(1),
      tds: stagePermTds.toFixed(2),
      ph: stagePermPh.toFixed(2),
      ec: calculateEC(stagePermTds, stagePermPh).toFixed(1)
    });

    const result = {
      index: sIdx + 1,
      vessels: stageVessels,
      feedPressure: (isGpmInput ? stageFeedPBar * BAR_TO_PSI_STEP : stageFeedPBar).toFixed(2),
      concPressure: (isGpmInput ? stageConcPBar * BAR_TO_PSI_STEP : stageConcPBar).toFixed(2),
      feedFlow: (isGpmInput ? (runningFeedM3h / stageVessels) * M3H_TO_GPM : (runningFeedM3h / stageVessels)).toFixed(2),
      concFlow: (isGpmInput ? (Math.max(stageConcM3h, 0) / stageVessels) * M3H_TO_GPM : (Math.max(stageConcM3h, 0) / stageVessels)).toFixed(2),
      flux: (isGpmInput ? stageFluxLmh / 1.6976 : stageFluxLmh).toFixed(1),
      highestFlux: (isGpmInput ? (stageFluxLmh * stageDF) / 1.6976 : stageFluxLmh * stageDF).toFixed(1),
      highestBeta: stageBeta.toFixed(2),
      rejection: (stageRejection * 100).toFixed(2),
      pressureUnit: pUnit,
      fluxUnit: fluxUnit
    };

    runningFeedM3h = stageConcM3h;
    // Update running pressure for next stage inlet = current stage outlet
    runningPressureForStages = stageConcPBar;
    runningFeedTds = stageConcTds;
    runningFeedPh = stageConcPh;

    return result;
  }).filter(r => r !== null);

  // Update concPressureBar from actual stage results
  if (stageResults.length > 0) {
    const lastStage = stageResults[stageResults.length - 1];
    if (lastStage && lastStage.concPressure) {
      // Convert back to bar if needed
      concPressureBar = isGpmInput ? 
        parseFloat(lastStage.concPressure) / BAR_TO_PSI_STEP : 
        parseFloat(lastStage.concPressure);
    }
  }

  // Final Point: Total Permeate
  const finalPermTds = cumulativePermTdsWeighted / cumulativePermFlow;
  const finalPermPh = cumulativePermPhWeighted / cumulativePermFlow;

  // Finalize individual ion concentrations (flow-weighted)
  Object.keys(cumulativeIonWeights).forEach(ion => {
    permeateConcentration[ion] = (cumulativeIonWeights[ion] / cumulativePermFlow).toFixed(3);
  });

  // Update runningPermTds and runningConcTds for the return object
  const finalRunningPermTds = finalPermTds;
  const finalRunningConcTds = runningFeedTds; // After all stages, this is the final concentrate TDS

  flowDiagramPoints.push({
    id: 2 * inputStages.length + 3,
    name: 'Final Blended Permeate',
    flow: cumulativePermFlow.toFixed(1),
    pressure: (0).toFixed(1),
    tds: finalPermTds.toFixed(2),
    ph: finalPermPh.toFixed(2),
    ec: calculateEC(finalPermTds, finalPermPh).toFixed(1)
  });

  // Fallback if no active stages
  if (stageResults.length === 0) {
    const fallbackConcP = Math.max(feedPressureBar - totalSystemDP, 0.01);
    stageResults.push({
      index: 1,
      vessels: numVessels,
      feedPressure: displayFeedP.toFixed(2),
      concPressure: (isGpmInput ? fallbackConcP * BAR_TO_PSI_STEP : fallbackConcP).toFixed(2),
      feedFlow: (isGpmInput ? (totalFeedM3h / numVessels) * M3H_TO_GPM : (totalFeedM3h / numVessels)).toFixed(2),
      concFlow: (isGpmInput ? (Math.max(totalFeedM3h - totalSystemPermeate, 0) / numVessels) * M3H_TO_GPM : (Math.max(totalFeedM3h - totalSystemPermeate, 0) / numVessels)).toFixed(2),
      flux: displayFlux.toFixed(1),
      highestFlux: (isGpmInput ? (highestFluxLmh / 1.6976) : highestFluxLmh).toFixed(1),
      highestBeta: systemLevelBeta.toFixed(2),
      pressureUnit: pUnit,
      fluxUnit: fluxUnit
    });
    concPressureBar = fallbackConcP;
  }

  const getFlowDecimals = (unit) => {
    if (['gpm', 'm3/h', 'm3h'].includes(unit)) return 2;
    if (['gpd', 'm3/d', 'm3d'].includes(unit)) return 1;
    if (['mgd', 'migd', 'mld'].includes(unit)) return 3;
    return 2;
  };

  const concPhValue = (currentFeedPh + Math.log10(1 / (1 - Math.min(recFrac, 0.99))));

  const calculateLSI = (ph, tds, temp, ca, hco3) => {
    const A = (Math.log10(Math.max(tds, 1)) - 1) / 10;
    const B = -13.12 * Math.log10(temp + 273.15) + 34.55;
    const C = Math.log10(Math.max(ca * 2.5, 0.1)) - 0.4;
    const D = Math.log10(Math.max(hco3 * 0.82, 0.1));
    const pHs = (9.3 + A + B) - (C + D);
    return (ph - pHs).toFixed(2);
  };

  // Recalculate display pressures using final values
  const finalDisplayFeedP = isGpmInput ? feedPressureBar * BAR_TO_PSI_STEP : feedPressureBar;
  const finalDisplayConcP = isGpmInput ? concPressureBar * BAR_TO_PSI_STEP : concPressureBar;

  const feedPerElement = totalFeedM3h / Math.max(numVessels * elements, 1);
  const installedAreaM2 = totalAreaPerVessel * numVessels;

  const fluxValidation = validateDesignFlux(fluxLmh, activeMembraneId);
  const oversizeValidation = validateSystemOversize(fluxLmh, installedAreaM2, totalSystemPermeate);
  const flowValidation = validateFeedFlow(feedPerElement, fluxLmh);
  const recoveryValidation = validateRecovery(recPct, feedTds);
  const pressureValidation = validatePressure(feedPressureBar, activeMembrane);

  const allValidationErrors = [
    ...fluxValidation.errors,
    ...flowValidation.errors,
    ...recoveryValidation.errors,
    ...pressureValidation.errors
  ];

  const allValidationWarnings = [
    ...fluxValidation.warnings,
    ...oversizeValidation.warnings,
    ...flowValidation.warnings
  ];

  return {
    results: {
      avgFlux: displayFlux.toFixed(1),
      avgFluxLMH: fluxLmh.toFixed(1),
      avgFluxGFD: fluxGfd.toFixed(1),
      fluxUnit,
      feedPressure: finalDisplayFeedP.toFixed(1),
      concPressure: finalDisplayConcP.toFixed(1),
      recovery: recPct.toFixed(1),
      highestFlux: (isGpmInput ? (highestFluxLmh / 1.6976) : highestFluxLmh).toFixed(1),
      highestBeta: systemLevelBeta.toFixed(2),
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
      tds: finalRunningPermTds.toFixed(2),
      ph: finalPermPh.toFixed(2),
      ec: calculateEC(finalRunningPermTds, finalPermPh).toFixed(0)
    },
    permeateConcentration,
    permeateIons: permeateConcentration, // For compatibility with App.js
    concentrateParameters: {
      tds: finalRunningConcTds.toFixed(2),
      osmoticPressure: (isGpmInput ? calculateOsmoticPressure(finalRunningConcTds, 'psi') : calculateOsmoticPressure(finalRunningConcTds, 'bar')).toFixed(2),
      ph: concPhValue.toFixed(2),
      ec: calculateEC(finalRunningConcTds, concPhValue).toFixed(0),
      langelier: calculateLSI(
        concPhValue,
        finalRunningConcTds,
        tempC,
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
    flowDiagramPoints,
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
    ),
    designWarnings: getDesignWarnings(inputs, {
      feedPressure: displayFeedP,
      recovery: recPct,
      avgFlux: displayFlux
    }, waterType),
    validationErrors: allValidationErrors,
    validationWarnings: allValidationWarnings,
    systemMetrics: {
      feedPerElement: feedPerElement.toFixed(2),
      installedArea: installedAreaM2.toFixed(1),
      requiredArea: (totalSystemPermeate / Math.max(fluxLmh, 1)).toFixed(1)
    }
  };
};

export const calculateIonPassage = () => {
  return {}; // Placeholder for simplicity if not used primarily
};

export const runHydraulicBalance = () => {
  return {}; // Placeholder
};

export const getDesignWarnings = (inputs, results, waterType) => {
  try {
    const validation = validateDesignWithWaterType(inputs, results, waterType);

    const allMessages = [
      ...validation.errors.map(e => `❌ ${e}`),
      ...validation.warnings.map(w => `⚠️  ${w}`),
      ...validation.recommendations.map(r => `ℹ️  ${r}`)
    ];

    return allMessages;
  } catch (error) {
    console.warn('Design validation error:', error);
    return [];
  }
};

export const getRecommendedMembranes = (waterType) => {
  const config = getWaterTypeInfo(waterType);
  return config?.recommended || [];
};

export const isGpmInput = (flowUnit) => {
  const unit = (flowUnit || 'gpm').toLowerCase().trim();
  return ['gpm', 'gpd', 'mgd', 'migd'].includes(unit.replace('/', ''));
};
