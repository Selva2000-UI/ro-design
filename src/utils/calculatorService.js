/* ================= IMSDesign Hydraulic Engine (REFINED) ================= */

export const FLOW_TO_M3H = {
  gpm: 0.22712,
  m3h: 1,
  'm3/h': 1,
  m3d: 1 / 24,
  'm3/d': 1 / 24,
  gpd: 0.00378541 / 24,
  mgd: 157.725,
  migd: 189.42,
  mld: 41.6667,
};

// Flux Constants for 400 ft2 membranes
export const FLUX_CONSTANTS = {
  gpm: 0.0556, // For GFD (Note: User formula uses 0.0556 for GPM to GFD)
  m3h: 0.0372, // For LMH
  m3d: 0.893,  // For LMH
};

export const MEMBRANES = [
  {
    id: 'espa2ld',
    name: 'ESPA2-LD',
    area: 400,
    rejection: 99.7,
    monoRejection: 99.3,
    divalentRejection: 99.8,
    boronRejection: 90,
    silicaRejection: 99,
    alkalinityRejection: 99.5,
    co2Rejection: 0,
    aValue: 0.12
  },
  {
    id: 'cpa3',
    name: 'CPA3-4040',
    area: 404,
    rejection: 99.7,
    monoRejection: 99.3,
    divalentRejection: 99.9,
    boronRejection: 90,
    silicaRejection: 99,
    alkalinityRejection: 99.5,
    co2Rejection: 0,
    aValue: 0.08
  },
  {
    id: 'lfc3ld4040',
    name: 'LFC3-LD-4040',
    area: 404,
    rejection: 99.6,
    monoRejection: 99.1,
    divalentRejection: 99.7,
    boronRejection: 87,
    silicaRejection: 98.0,
    alkalinityRejection: 99.0,
    co2Rejection: 0,
    aValue: 0.12
  }
];

export const BAR_TO_PSI = 14.5038;
export const M3H_TO_GPM = 1 / 0.2271;
export const LMH_TO_GFD = 1 / 1.699; 

export const calculateSystem = (inputs) => {  
  const {
    totalFlow,
    recovery,
    vessels = 0,
    elementsPerVessel = 0,
    feedPH = 7.0,
    feedIons = {},
    stages = [],
    membranes = [],
    flowUnit = 'gpm',
    permeatePressure = 0,
    feedPressure = null,
  } = inputs;

  const isGpm = ['gpm', 'gpd', 'mgd', 'migd'].includes(flowUnit);
  const recoveryPct = Math.min(Math.max(Number(recovery) || 0, 1), 99);
  const recFrac = recoveryPct / 100;
  const feedPhValue = Number(feedPH) || 7.0;
  const normalizedFeedIons = { ...(feedIons || {}) };
  const hco3Val = Number(normalizedFeedIons.hco3) || 0;
  const co2Val = Number(normalizedFeedIons.co2) || 0;
  const co3Val = Number(normalizedFeedIons.co3) || 0;
  
  if (co2Val === 0 && hco3Val > 0) {
    const pKa1 = 6.35;
    const ratio = Math.pow(10, pKa1 - feedPhValue);
    const co2Value = hco3Val * ratio;
    normalizedFeedIons.co2 = co2Value;
  }
  if (co3Val === 0 && hco3Val > 0 && feedPhValue >= 8.2) {
    const pKa2 = 10.33;
    const ratio = Math.pow(10, feedPhValue - pKa2);
    const co3Value = hco3Val * ratio;
    normalizedFeedIons.co3 = co3Value;
  }
  
  // Master Unit Rule: All flows must match the permeate flow unit
  const unitFactor = FLOW_TO_M3H[flowUnit] || 1;
  const totalFlowM3h = Number(totalFlow) * unitFactor; 
  
  // Basic Flow Balance (Internal m3/h)
  const feedFlowTotalM3h = recFrac > 0 ? totalFlowM3h / recFrac : 0;
  const concentrateFlowTotalM3h = Math.max(feedFlowTotalM3h - totalFlowM3h, 0);

  const activeStages = Array.isArray(stages) ? stages.filter(stage => Number(stage?.vessels) > 0) : [];

  const firstStageVessels = Number(activeStages[0]?.vessels) || Number(vessels) || 1;
  const lastStageVessels = Number(activeStages[activeStages.length - 1]?.vessels) || Number(vessels) || 1;

  const feedFlowPerVesselM3h = feedFlowTotalM3h / firstStageVessels;

  const activeMembraneId = activeStages[0]?.membraneModel || inputs.membraneModel;
  const activeMembrane = membranes.find(m => m.id === activeMembraneId) || membranes[0] || {};
  const areaPerElement = Number(activeMembrane.area) || 400;

  let totalElements = 0;
  let totalAreaSqFt = 0;
  let totalAreaM2 = 0;
  if (activeStages.length > 0) {
    totalElements = activeStages.reduce((sum, stage) => {
      const stageVessels = Number(stage?.vessels) || 0;
      const stageElements = Number(stage?.elementsPerVessel) || 0;
      return sum + stageVessels * stageElements;
    }, 0);
    totalAreaSqFt = activeStages.reduce((sum, stage) => {
      const stageVessels = Number(stage?.vessels) || 0;
      const stageElements = Number(stage?.elementsPerVessel) || 0;
      const stageMembrane = membranes.find(m => m.id === stage?.membraneModel) || activeMembrane;
      const stageArea = Number(stageMembrane?.area) || areaPerElement;
      return sum + stageVessels * stageElements * stageArea;
    }, 0);
    totalAreaM2 = activeStages.reduce((sum, stage) => {
      const stageVessels = Number(stage?.vessels) || 0;
      const stageElements = Number(stage?.elementsPerVessel) || 0;
      const stageMembrane = membranes.find(m => m.id === stage?.membraneModel) || activeMembrane;
      const stageAreaM2 = Number(stageMembrane?.areaM2) || (Number(stageMembrane?.area || 400) * (37 / 400));
      return sum + stageVessels * stageElements * stageAreaM2;
    }, 0);
  } else {
    totalElements = (Number(vessels) || 0) * (Number(elementsPerVessel) || 0);
    totalAreaSqFt = totalElements * areaPerElement;
    totalAreaM2 = totalElements * (Number(activeMembrane?.areaM2) || (areaPerElement * (37 / 400)));
  }

  const effectiveAreaSqFt = Math.max(totalAreaSqFt, 1);
  const effectiveAreaM2 = Math.max(totalAreaM2, 1);
  
  // Flux Calculation (Refined per User Specs)
  const totalElements_num = Math.max(totalElements, 1);
  const areaFactor = areaPerElement / 400;
  
  let fluxValue = 0;
  let fluxUnit = isGpm ? 'GFD' : 'LMH';

  if (flowUnit === 'gpm') {
    fluxValue = Number(totalFlow) / (totalElements_num * FLUX_CONSTANTS.gpm * areaFactor);
  } else if (flowUnit === 'm3/h' || flowUnit === 'm3h') {
    fluxValue = Number(totalFlow) / (totalElements_num * FLUX_CONSTANTS.m3h * areaFactor);
  } else if (flowUnit === 'm3/d' || flowUnit === 'm3d') {
    fluxValue = Number(totalFlow) / (totalElements_num * FLUX_CONSTANTS.m3d * areaFactor);
  } else {
    // Default fallback - Use master unit m3/h
    fluxValue = (totalFlowM3h * 1000) / effectiveAreaM2;
    if (isGpm) fluxValue = fluxValue * LMH_TO_GFD;
  }

  const displayFlux = fluxValue;
  
  // For internal calculations (Salt Passage, Pressure), we still need internal LMH/GFD
  const avgFluxLMH_calc = isGpm ? displayFlux * 1.699 : displayFlux;
  const avgFluxGFD_calc = isGpm ? displayFlux : displayFlux / 1.699; 
  
  // Beta Factor (Concentration Polarization)
  const beta = Math.exp(0.7 * recFrac);
  const highestFlux = displayFlux * beta;
  const highestBeta = highestFlux > 0 ? (displayFlux / highestFlux) : 0; 

  const membraneRejection = Math.min(Math.max(Number(activeMembrane?.rejection) || 99.7, 80), 99.9);
  const defaultMono = Math.max(Math.min((Number(activeMembrane?.monoRejection) || (membraneRejection - 6)), 99.9), 80);
  const defaultDivalent = Math.max(Math.min((Number(activeMembrane?.divalentRejection) || membraneRejection), 99.9), 80);
  const silicaRejection = Math.max(Math.min((Number(activeMembrane?.silicaRejection) || (membraneRejection - 1)), 99.9), 80);
  const boronRejection = Math.max(Math.min((Number(activeMembrane?.boronRejection) || (membraneRejection - 8)), 99.9), 60);
  const alkalinityRejection = Math.max(Math.min((Number(activeMembrane?.alkalinityRejection) || (membraneRejection - 0.2)), 99.9), 80);
  const co2Rejection = Math.max(Math.min((Number(activeMembrane?.co2Rejection) || 0), 99.9), 0);

  const getIonRejection = (ionKey) => {
    const overrides = activeMembrane?.ionRejectionOverrides || {};
    if (overrides[ionKey] != null) return Number(overrides[ionKey]);
    if (['ca', 'mg', 'sr', 'ba', 'so4', 'po4'].includes(ionKey)) return defaultDivalent;
    if (['na', 'cl'].includes(ionKey)) return membraneRejection; // Use full rejection for Na/Cl
    if (['k', 'no3', 'f', 'nh4'].includes(ionKey)) return defaultMono;
    if (['hco3', 'co3'].includes(ionKey)) return alkalinityRejection;
    if (ionKey === 'sio2') return silicaRejection;
    if (ionKey === 'b') return boronRejection;
    if (ionKey === 'co2') return co2Rejection;
    return membraneRejection;
  };

  const formatConc = (value) => Number(value).toFixed(3);
  const permeateIons = {};
  const concentrateIons = {};

  const cf = recFrac < 1 ? 1 / (1 - recFrac) : 1;
  let runningConcTDS = 0;
  let runningPermTDS = 0;

  Object.keys(normalizedFeedIons || {}).forEach((ion) => {
    const feedConc = Number(normalizedFeedIons[ion]) || 0;
    const rejection = getIonRejection(ion) / 100; 
    
    // Permeate concentration based on Step 4
    const permVal = feedConc * (1 - rejection);
    
    // Concentrate concentration based on Step 5 mass balance
    // Cc = (Qf*Cf - Qp*Cp) / Qc
    const Qf = feedFlowTotalM3h;
    const Qp = totalFlowM3h;
    const Qc = concentrateFlowTotalM3h;
    const concVal = Qc > 0 ? (Qf * feedConc - Qp * permVal) / Qc : feedConc * cf;

    if (['na', 'cl'].includes(ion)) {
      permeateIons[ion] = Number(permVal).toFixed(2);
    } else {
      permeateIons[ion] = formatConc(permVal);
    }
    concentrateIons[ion] = formatConc(concVal);
    runningConcTDS += concVal;
    runningPermTDS += permVal;
  });
  
  const permeateTDS = runningPermTDS;
  const concentrateTDS = runningConcTDS;
  const feedTDS = Object.values(normalizedFeedIons || {}).reduce((sum, val) => sum + (Number(val) || 0), 0);

  // Osmotic Pressure Logic (Refined per Scenarios 1, 2, 3)
  // bar = 0.036 * TDS(g/L) * 22.1
  // psi = 0.52 * TDS(g/L) * 22.1
  const tdsGL = concentrateTDS / 1000;
  const tdsFeedGL = feedTDS / 1000;

  const OSMOTIC_COEFF_BAR = 0.036 * 22.1;
  const OSMOTIC_COEFF_PSI = 0.52 * 22.1;

  const piFeedBar = OSMOTIC_COEFF_BAR * tdsFeedGL;
  const piConcBar = OSMOTIC_COEFF_BAR * tdsGL;
  const piAvgBar = (piFeedBar + piConcBar) / 2;

  // Convert permeate pressure input to bar for internal calculation
  const permPressInput = Number(permeatePressure) || 0;
  const permPressBar = isGpm ? permPressInput / BAR_TO_PSI : permPressInput;

  // Total pressure required = TMP + DeltaP/2 + Permeate Backpressure
  const awGfdPsi = Number(activeMembrane.aValue) || 0.15;
  const awLmhBar = awGfdPsi * 24.64;
  
  const systemTMPBar = (avgFluxLMH_calc / awLmhBar) + piAvgBar;
  const systemDeltaPBar = 1.0; // Clean pressure drop ~15 psi
  
  let feedPressureBar = systemTMPBar + (systemDeltaPBar / 2) + permPressBar;
  
  // Manual Feed Pressure Override
  if (feedPressure != null && Number(feedPressure) > 0) {
    const manualFeedInput = Number(feedPressure);
    // User wants to add Permeate Pressure to the Feed Pressure input
    const totalFeedP = manualFeedInput + permPressInput;
    feedPressureBar = isGpm ? totalFeedP / BAR_TO_PSI : totalFeedP;
  }
  
  const concPressureBar = Math.max(feedPressureBar - systemDeltaPBar, 0);

  // Unit Conversion for Display
  const pressureUnit = isGpm ? 'psi' : 'bar';
  const displayFeedP = isGpm ? feedPressureBar * BAR_TO_PSI : feedPressureBar;
  const displayConcP = isGpm ? concPressureBar * BAR_TO_PSI : concPressureBar;
  
  // Specific fix for Osmotic Pressure display
  let displayOsmoticValue = 0;
  if (isGpm) {
    displayOsmoticValue = OSMOTIC_COEFF_PSI * tdsGL;
  } else {
    displayOsmoticValue = piConcBar;
  }
  const displayOsmotic = displayOsmoticValue;

  const permeatePh = Math.min(Math.max(feedPhValue - 1.69, 0), 14);
  const concentratePh = Math.min(Math.max(feedPhValue + Math.log10(Math.max(cf, 1)), 0), 14);

  const pCa = -Math.log10((Number(concentrateIons.ca) || 0) / 40080 || 1);
  const pAlk = -Math.log10((Number(concentrateIons.hco3) || 0) / 61010 || 1);
  const C_const = (Math.log10(Math.max(concentrateTDS, 1)) - 1) / 10;
  const pHs = (9.3 + C_const) + pCa + pAlk;
  const lsi = concentratePh - pHs;
  const ccpp = lsi > 0 ? lsi * 50 : 0;

  const caConc = Number(concentrateIons.ca) || 0;
  const so4Conc = Number(concentrateIons.so4) || 0;
  const baConc = Number(concentrateIons.ba) || 0;
  const srConc = Number(concentrateIons.sr) || 0;
  const sio2Conc = Number(concentrateIons.sio2) || 0;
  const po4Conc = Number(concentrateIons.po4) || 0;
  const fConc = Number(concentrateIons.f) || 0;

  const concentrateSaturation = {
    caSo4: Number((caConc * so4Conc) / 1000).toFixed(1),
    baSo4: Number((baConc * so4Conc) / 50).toFixed(1),
    srSo4: Number((srConc * so4Conc) / 2000).toFixed(1),
    sio2: Number((sio2Conc / 120) * 100).toFixed(1),
    ca3po42: Number((caConc * po4Conc) / 100).toFixed(2),
    caF2: Number((caConc * fConc) / 500).toFixed(1)
  };

  const concentrateParameters = {
    osmoticPressure: displayOsmotic.toFixed(1),
    ccpp: Number(ccpp).toFixed(1),
    langelier: lsi.toFixed(2),
    ph: concentratePh.toFixed(1),
    tds: (feedTDS / (1 - recFrac)).toFixed(1) // Updated per user formula: TDSc = TDSf / (1 - Recovery)
  };

  const permeateParameters = {
    ph: permeatePh.toFixed(1),
    tds: (feedTDS * (1 - membraneRejection / 100)).toFixed(1) // Method 1: From salt rejection
  };

  let currentFeedFlowM3h = feedFlowTotalM3h;
  const stageResults = [];

  activeStages.forEach((stage, index) => {
    const stageVessels = Number(stage?.vessels) || 0;
    const stageElements = Number(stage?.elementsPerVessel) || 0;
    const stageMembrane = membranes.find(m => m.id === stage?.membraneModel) || activeMembrane;

    if (stageVessels === 0 || stageElements === 0) return;

    const stagePermeateFlowM3h = totalFlowM3h / activeStages.length;
    const stageConcFlowTotalM3h = currentFeedFlowM3h - stagePermeateFlowM3h;
    
    const perVesselFeedFlow = (currentFeedFlowM3h / stageVessels) / unitFactor;
    const perVesselConcFlow = (stageConcFlowTotalM3h / stageVessels) / unitFactor;
    
    const stageAreaSqFt = stageVessels * stageElements * (Number(stageMembrane.area) || 400);
    const stageAreaM2 = stageAreaSqFt * 0.092903;
    const stageAreaFactor = Number(stageMembrane.area) / 400;

    const stageGpmConst = 0.0556 * stageAreaFactor;
    const stageM3hConst = 0.0372 * stageAreaFactor;
    const stageM3dConst = 0.893 * stageAreaFactor;

    let stageAvgFluxValue = 0;
    const stagePermeateFlow = totalFlow / activeStages.length;

    if (flowUnit === 'gpm') {
      stageAvgFluxValue = (stagePermeateFlow) / (stageVessels * stageElements * stageGpmConst);
    } else if (flowUnit === 'm3/h' || flowUnit === 'm3h') {
      stageAvgFluxValue = (stagePermeateFlow) / (stageVessels * stageElements * stageM3hConst);
    } else if (flowUnit === 'm3/d' || flowUnit === 'm3d') {
      stageAvgFluxValue = (stagePermeateFlow) / (stageVessels * stageElements * stageM3dConst);
    } else {
      const stageAvgFluxLMH = (stagePermeateFlowM3h * 1000) / stageAreaM2;
      stageAvgFluxValue = isGpm ? stageAvgFluxLMH / 1.699 : stageAvgFluxLMH;
    }

    const stageHighestFlux = stageAvgFluxValue * beta;
    const stageHighestBeta = stageHighestFlux > 0 ? (stageAvgFluxValue / stageHighestFlux) : 0;

    const numStages = activeStages.length;
    const stageDeltaP = systemDeltaPBar / numStages;
    const stageFeedPressureBar = feedPressureBar - (index * stageDeltaP);
    const stageConcPressureBar = stageFeedPressureBar - stageDeltaP;
    
    stageResults.push({
      index: index + 1,
      vessels: stageVessels,
      feedPressure: (isGpm ? stageFeedPressureBar * BAR_TO_PSI : stageFeedPressureBar).toFixed(1),
      concPressure: (isGpm ? stageConcPressureBar * BAR_TO_PSI : stageConcPressureBar).toFixed(1),
      feedFlow: perVesselFeedFlow.toFixed(2),
      concFlow: perVesselConcFlow.toFixed(2),
      flux: stageAvgFluxValue.toFixed(1),
      highestFlux: stageHighestFlux.toFixed(1),
      highestBeta: stageHighestBeta.toFixed(2),
      unit: flowUnit,
      fluxUnit: fluxUnit
    });

    currentFeedFlowM3h = currentFeedFlowM3h - stagePermeateFlowM3h;
  });

  const systemHighestFlux = stageResults.length > 0 ? Math.max(...stageResults.map(s => Number(s.highestFlux))) : highestFlux;
  
  const designWarnings = [];
  if (systemHighestFlux > 20 && isGpm) designWarnings.push('Design limits exceeded: Flux too high');
  if (systemHighestFlux > 34 && !isGpm) designWarnings.push('Design limits exceeded: Flux too high');
  if (feedFlowPerVesselM3h > 4.5) designWarnings.push('Design limits exceeded: Feed flow per vessel too high');
  if (displayConcP < 0) designWarnings.push('Design limits exceeded: Concentrate pressure is negative');

  return {
    results: {
      avgFlux: Number(displayFlux.toFixed(isGpm ? 3 : 1)),
      avgFluxGFD: Number(avgFluxGFD_calc.toFixed(3)),
      avgFluxLMH: Number(avgFluxLMH_calc.toFixed(1)),
      calcFlux: displayFlux.toFixed(isGpm ? 3 : 1),
      fluxUnit,
      highestFlux: Number(highestFlux.toFixed(1)),
      highestBeta: Number(highestBeta.toFixed(3)),
      feedFlowVessel: Number((feedFlowPerVesselM3h / unitFactor).toFixed(2)),
      concFlowVessel: Number((concentrateFlowTotalM3h / lastStageVessels / unitFactor).toFixed(2)),
      feedPressure: displayFeedP.toFixed(1),
      concPressure: displayConcP.toFixed(1),
      osmoticPressure: displayOsmotic.toFixed(1),
      pressureUnit,
      lsi: Number(lsi.toFixed(2)),
      permTDS: Number(permeateTDS.toFixed(2)),
      concTDS: Number(concentrateTDS.toFixed(2)),
      permPH: Number(permeatePh.toFixed(1)),
      flowUnit
    },
    permeateIons,
    concentrateIons,
    concentrateSaturation,
    concentrateParameters,
    permeateParameters,
    stageResults,
    designWarnings
  };
};

export const calculateIonPassage = (feedIons, systemData) => {
  const { recovery, vessels, feedPH } = systemData;
  const feedPhValue = Number(feedPH) || 7.0;
  const recoveryPct = Math.min(Math.max(Number(recovery) || 0, 1), 99);
  const recFrac = recoveryPct / 100;
  const beta = Math.exp(0.7 * recFrac);

  const rejections = {
    Ca: 0.994, Mg: 0.994, Na: 0.990, K: 0.985, Cl: 0.988, SO4: 0.997, HCO3: 0.980, NO3: 0.920, CO2: 0.0
  };

  let permeateTDS = 0;
  const permeateIons = {};
  const concentrateIons = {};

  Object.keys(feedIons || {}).forEach((ion) => {
    const feedConc = Number(feedIons[ion]) || 0;
    if (ion.toLowerCase() === 'co2') {
      permeateIons[ion] = feedConc;
      concentrateIons[ion] = feedConc;
      permeateTDS += feedConc;
      return;
    }
    let rej = rejections[ion] != null ? rejections[ion] : 0.99;
    if (ion.toLowerCase() === 'nh4') {
      const nh3Fraction = Math.min(Math.max((feedPhValue - 7.2) / (11.5 - 7.2), 0), 1);
      rej = rej * (1 - nh3Fraction);
    }
    const passage = 1 - rej;
    const saltPassage = passage * beta;

    permeateIons[ion] = feedConc * saltPassage;
    concentrateIons[ion] = recFrac > 0 && recFrac < 1 ? feedConc / (1 - recFrac) : feedConc;
    permeateTDS += permeateIons[ion];
  });

  const tds_conc = Object.values(concentrateIons).reduce((a, b) => a + (Number(b) || 0), 0);
  const pCa = -Math.log10((concentrateIons.Ca || 0) / 40080 || 1);
  const pAlk = -Math.log10((concentrateIons.HCO3 || 0) / 61010 || 1);
  const C_const = (Math.log10(tds_conc || 1) - 1) / 10;
  const pHs = (9.3 + C_const) + pCa + pAlk;
  const lsi = 7.3 - pHs;

  return {
    permeateIons, concentrateIons, permeateTDS: permeateTDS.toFixed(2), lsi: lsi.toFixed(2), beta: beta.toFixed(2), vessels
  };
};
  
export const runHydraulicBalance = (config, membrane) => {
  const permeateInput = Number(config.permeateFlow) || 0;
  const unit = config.flowUnit || 'gpm';
  const unitFactor = FLOW_TO_M3H[unit] ?? 1;
  const recoveryPercent = Math.min(Math.max(Number(config.recovery) || 15, 1), 99);
  const recovery = recoveryPercent / 100;
  const vessels = Number(config.stage1Vessels) || 1;
  const elementsPerVessel = Number(config.elementsPerVessel) || 7;
  const elementArea_ft2 = Number(membrane?.area) || 400;
  const elementArea_m2 = elementArea_ft2 * 0.092903;

  const permeate_m3h = permeateInput * unitFactor;
  const feed_m3h = permeate_m3h / recovery;
  const concentrate_m3h = feed_m3h - permeate_m3h;

  let calcFlux = 0;
  const totalElements = vessels * elementsPerVessel;
  const areaFactor = elementArea_ft2 / 400;
  const totalArea_ft2 = totalElements * elementArea_ft2;
  const totalArea_m2 = totalElements * elementArea_m2;

  if (totalElements > 0) {
    if (unit === 'gpm') {
      calcFlux = permeateInput / (totalElements * 0.0556 * areaFactor);
    } else if (unit === 'm3/h') {
      calcFlux = permeateInput / (totalElements * 0.0372 * areaFactor);
    } else if (unit === 'm3/d') {
      calcFlux = permeateInput / (totalElements * 0.893 * areaFactor);
    } else {
      calcFlux = (permeate_m3h * 1000) / totalArea_m2;
    }
  }

  return {
    feedFlow: (feed_m3h / unitFactor).toFixed(2),
    concentrateFlow: (concentrate_m3h / unitFactor).toFixed(2),
    permeateFlow: permeateInput.toFixed(2),
    totalElements, totalArea_ft2: totalArea_ft2.toFixed(2), totalArea_m2: totalArea_m2.toFixed(2),
    elementArea_ft2, elementArea_m2: elementArea_m2.toFixed(2), calcFlux: calcFlux.toFixed(1), unit, fluxUnit: unit === 'gpm' ? 'GFD' : 'LMH'
  };
};
