/* ================= IMSDesign Hydraulic Engine (REFINED) ================= */

export const FLOW_TO_M3H = {
  gpm: 0.2271247,
  m3h: 1,
  m3d: 1 / 24,
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
export const M3H_TO_GPM = 4.402867;

  export const calculateSystem = (inputs) => {  
  const {
    totalFlow,
    recovery,
    vessels = 0,
    membraneId,
    elementsPerVessel = 0,
    feedPH = 7.0,
    tempF = 77,
    feedIons = {},
    stages = [],
    membranes = [],
    flowUnit = 'gpm',
    membraneAge = 0,
    fluxDeclinePerYear = 0,
    spIncreasePerYear = 0,
    foulingFactor = 1
  } = inputs;

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
    normalizedFeedIons.co2 = Number(co2Value < 0.001 ? '<0.001' : co2Value.toFixed(3));
  }
  if (co3Val === 0 && hco3Val > 0 && feedPhValue >= 8.2) {
    const pKa2 = 10.33;
    const ratio = Math.pow(10, feedPhValue - pKa2);
    const co3Value = hco3Val * ratio;
    normalizedFeedIons.co3 = Number(co3Value < 0.001 ? '<0.001' : co3Value.toFixed(3));
  }
  const tempC = (Number(tempF) - 32) * (5 / 9);
  
  // Master Unit Rule: All flows must match the permeate flow unit
  const unitFactor = FLOW_TO_M3H[flowUnit] || 1;
  const totalFlowM3h = Number(totalFlow) * unitFactor; // Ensure we work with m3/h internally if totalFlow was not already m3h
  
  // We assume totalFlow passed from App.js is in m3/h based on current App.js logic, 
  // but let's make it robust. If flowUnit is 'gpm', and totalFlow is numeric, we need to know what unit it is.
  // Actually, App.js passes perTrainProduct_m3h as totalFlow.
  const feedFlowTotalM3h = recFrac > 0 ? totalFlowM3h / recFrac : 0;
  const concentrateFlowTotalM3h = feedFlowTotalM3h - totalFlowM3h;

  const activeStages = Array.isArray(stages) ? stages.filter(stage => Number(stage?.vessels) > 0) : [];

  const firstStageVessels = Number(activeStages[0]?.vessels) || Number(vessels) || 1;
  const lastStageVessels = Number(activeStages[activeStages.length - 1]?.vessels) || Number(vessels) || 1;

  const feedFlowPerVesselM3h = feedFlowTotalM3h / firstStageVessels;
  const concFlowPerVesselM3h = concentrateFlowTotalM3h / lastStageVessels;
  const avgFlowPerVesselM3h = (feedFlowPerVesselM3h + concFlowPerVesselM3h) / 2;

  const activeMembraneId = activeStages[0]?.membraneModel || inputs.membraneModel;
  const activeMembrane = membranes.find(m => m.id === activeMembraneId) || membranes[0] || {};
  const areaPerElement = Number(activeMembrane.area) || 400;

  let totalElements = 0;
  let totalAreaSqFt = 0;
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
  } else {
    totalElements = (Number(vessels) || 0) * (Number(elementsPerVessel) || 0);
    totalAreaSqFt = totalElements * areaPerElement;
  }

  const effectiveAreaSqFt = totalAreaSqFt > 0 ? totalAreaSqFt : (totalElements * areaPerElement);
  
  // Flux Calculation Rule:
  // gpm -> GFD = (gpm * 1440) / areaSqFt
  // m3/h or m3/d -> LMH = (m3/h * 1000) / areaM2
  let avgFlux = 0;
  const totalAreaM2 = effectiveAreaSqFt * 0.09290304;
  const totalFlowGpm = totalFlowM3h * M3H_TO_GPM;

  if (flowUnit === 'gpm') {
    avgFlux = effectiveAreaSqFt > 0 ? (totalFlowGpm * 1440) / effectiveAreaSqFt : 0;
  } else {
    avgFlux = totalAreaM2 > 0 ? (totalFlowM3h * 1000) / totalAreaM2 : 0;
  }

  const highestFlux = avgFlux * 1.15;
  const recFracVessel = totalFlowM3h / feedFlowTotalM3h;
  // const highestBeta = Math.exp(0.7 * ((feedFlowPerVessel * vessels)));
  // const highestBeta = Math.exp(0.7 * recFrac);
  const highestBeta =
  avgFlux > 0 ? highestFlux / avgFlux : 1;
  const beta = highestBeta;
  const cf = 1 / (1 - recFrac);
  const avgConcFactor = (cf + 1) / 2;

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
    if (['na', 'k', 'cl', 'no3', 'f', 'nh4'].includes(ionKey)) return defaultMono;
    if (['hco3', 'co3'].includes(ionKey)) return alkalinityRejection;
    if (ionKey === 'sio2') return silicaRejection;
    if (ionKey === 'b') return boronRejection;
    if (ionKey === 'co2') return co2Rejection;
    return membraneRejection;
  };

  const formatConc = (value) => Number(value).toFixed(3);
  const permeateIons = {};
  const concentrateIons = {};
  
  
  // Calculate Feed TDS and Concentrate TDS using formula: concTds = feedTds / (1 - R)
  const feedTDS = Object.values(normalizedFeedIons || {}).reduce((sum, val) => sum + (Number(val) || 0), 0);
  const concentrateTDS = recFrac < 1 ? feedTDS / (1 - recFrac) : feedTDS;

 
  // Step 1: Feed Osmotic Pressure (Rule: 0.01 * TDS)
  const piFeed = 0.0115 * feedTDS;
  // Step 2: Concentrate Osmotic Pressure
  const piConc = 0.0115 * concentrateTDS;
  // Step 3: Average Osmotic Pressure
  const piAvgSystem = (piFeed + piConc) / 2;
  // Step 4: Net Driving Pressure (NDP) - selected value for BWRO
  const systemNDP = 125;
  // Step 5: Transmembrane Pressure (TMP)
  const systemTMP = systemNDP + piAvgSystem;
  // Step 6: Feed Pressure (Clean pressure drop ΔP = 15 psi)
  const systemDeltaP = 15;
  const calcSystemFeedP = systemTMP + (systemDeltaP / 2);
  // Step 7: Concentrate Pressure
  const calcSystemConcP = calcSystemFeedP - systemDeltaP;

  const osmoticPressureFeed = piFeed; 
  const osmoticPressure = piConc;
  


  Object.keys(normalizedFeedIons || {}).forEach((ion) => {
    const feedConc = Number(normalizedFeedIons[ion]) || 0;
     let rejection = getIonRejection(ion) / 100; 

    let permVal = feedConc * (1 - rejection) * (feedTDS / concentrateTDS);

    // Calculate concentrate value
    const concVal = recFrac > 0 && recFrac < 1 ? feedConc / (1 - recFrac) : feedConc;

    // Assign values
    if (['na', 'cl'].includes(ion)) {
      permeateIons[ion] = Number(permVal).toFixed(2);
    } else {
      permeateIons[ion] = formatConc(permVal);
    }
    concentrateIons[ion] = formatConc(concVal);
  });
  
  let permeateTDS;

  permeateTDS = Object.values(permeateIons).reduce((sum, val) => sum + Number(val || 0), 0);

  
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
    osmoticPressure: osmoticPressure.toFixed(1),
    ccpp: Number(ccpp).toFixed(1),
    langelier: lsi.toFixed(2),
    ph: concentratePh.toFixed(1),
    tds: concentrateTDS.toFixed(1)
  };

  const permeateParameters = {
    ph: permeatePh.toFixed(1),
    tds: permeateTDS.toFixed(1)
  };

  const TCF = Math.exp(2640 * (1 / 298.15 - 1 / (tempC + 273.15)));
  const membraneAgeYears = Math.max(Number(membraneAge) || 0, 0);
  const fluxDeclinePct = Math.min(Math.max(Number(fluxDeclinePerYear) || 0, 0), 99);
  const spIncreasePct = Math.min(Math.max(Number(spIncreasePerYear) || 0, 0), 200);
  const foulingFactorRaw = Number(foulingFactor);
  const foulingFactorValue = Number.isFinite(foulingFactorRaw)
    ? Math.min(Math.max(foulingFactorRaw, 0.35), 1)
    : 1;
  const aBase = Number(activeMembrane.aValue) || 0.12;
  const aEffective = aBase * Math.pow(1 - fluxDeclinePct / 100, membraneAgeYears);
  const spFactor = Math.pow(1 + spIncreasePct / 100, membraneAgeYears);

  let currentFeedFlowM3h = feedFlowTotalM3h;
  let currentFeedPressureBar = 0;
  const stageResults = [];

  activeStages.forEach((stage, index) => {
    const stageVessels = Number(stage?.vessels) || 0;
    const stageElements = Number(stage?.elementsPerVessel) || 0;
    const stageMembrane = membranes.find(m => m.id === stage?.membraneModel) || activeMembrane;

    if (stageVessels === 0 || stageElements === 0) return;

    const perVesselFeedFlowM3h = feedFlowTotalM3h / firstStageVessels;
    const perVesselConcFlowM3h = concentrateFlowTotalM3h / lastStageVessels;
    const perVesselAvgFlowM3h = (perVesselFeedFlowM3h + perVesselConcFlowM3h) / 2;

    const perVesselFeedFlow = perVesselFeedFlowM3h / unitFactor;
    const perVesselConcFlow = perVesselConcFlowM3h / unitFactor;

    const stagePermeateFlowGpm = (index === 0 ? totalFlowM3h : currentFeedFlowM3h * recFrac) * M3H_TO_GPM;
    const stagePermeateFlowM3h = (index === 0 ? totalFlowM3h : currentFeedFlowM3h * recFrac);
    
    let stageAvgFlux = 0;
    const stageAreaSqFt = stageVessels * stageElements * stageMembrane.area;
    const stageAreaM2 = stageAreaSqFt * 0.09290304;

    if (flowUnit === 'gpm') {
      stageAvgFlux = stageAreaSqFt > 0 ? (stagePermeateFlowGpm * 1440) / stageAreaSqFt : 0;
    } else {
      stageAvgFlux = stageAreaM2 > 0 ? (stagePermeateFlowM3h * 1000) / stageAreaM2 : 0;
    }
    
    const stageRecovery = stagePermeateFlowM3h / currentFeedFlowM3h;
    const stageHighestFlux = stageAvgFlux * 1.13;
    const stageBetaInternal = Math.exp(0.7 * stageRecovery);
    const stageHighestBetaValue = stageHighestFlux / stageAvgFlux;

    const numStages = activeStages.length;
    const stageDeltaP = systemDeltaP / numStages;
    const stageFeedPressurePsi = calcSystemFeedP - (index * stageDeltaP);
    const stageConcPressurePsi = stageFeedPressurePsi - stageDeltaP;
    
    const stageFeedPressureBar = stageFeedPressurePsi / BAR_TO_PSI;
    const stageConcPressureBar = stageConcPressurePsi / BAR_TO_PSI;

    const flowExponent = perVesselFeedFlowM3h > 4.5 ? Math.max(stageMembrane.dpExponent || 1.75, 1.75) : stageMembrane.dpExponent || 1.75;
    const stagePressureDropBar = stageElements * (stageMembrane.kFb || 0.315) * Math.pow(perVesselAvgFlowM3h, flowExponent) * (1 + 0.1 * (stageBetaInternal - 1));
    
    stageResults.push({
      index: index + 1,
      vessels: stageVessels,
      feedPressurePsi: (stageFeedPressureBar * BAR_TO_PSI).toFixed(1),
      concPressurePsi: (stageConcPressureBar * BAR_TO_PSI).toFixed(1),
      feedFlow: perVesselFeedFlow.toFixed(2),
      concFlow: perVesselConcFlow.toFixed(2),
      flux: stageAvgFlux.toFixed(1),
      highestFlux: stageHighestFlux.toFixed(1),
      highestBeta: stageHighestBetaValue.toFixed(2),
      unit: flowUnit,
      fluxUnit: flowUnit === 'gpm' ? 'GFD' : 'LMH'
    });

    currentFeedFlowM3h = currentFeedFlowM3h - stagePermeateFlowM3h;
    currentFeedPressureBar = stageConcPressureBar;
  });

  const systemHighestFlux = stageResults.length > 0 ? Math.max(...stageResults.map(s => Number(s.highestFlux))) : highestFlux;
  const systemHighestBeta = stageResults.length > 0 ? Math.max(...stageResults.map(s => Number(s.highestBeta))) : beta;
  
  const systemFeedPressurePsi = stageResults.length > 0 ? Number(stageResults[0].feedPressurePsi) : 0;
  const systemConcPressurePsi = stageResults.length > 0 ? Number(stageResults[stageResults.length - 1].concPressurePsi) : 0;

  const designWarnings = [];
  
  if (systemHighestFlux > 20 && flowUnit === 'gpm') designWarnings.push('Design limits exceeded: Flux too high');
  if (systemHighestFlux > 34 && flowUnit !== 'gpm') designWarnings.push('Design limits exceeded: Flux too high');
  if (feedFlowPerVesselM3h > 4.5) designWarnings.push('Design limits exceeded: Feed flow per vessel too high');
  if (systemConcPressurePsi < 0) designWarnings.push('Design limits exceeded: Concentrate pressure is negative');
  if (!Number.isFinite(osmoticPressureFeed) || osmoticPressureFeed < 0) designWarnings.push('Design limits exceeded: Osmotic pressure invalid');

 

  const fluxUnit = flowUnit === 'gpm' ? 'GFD' : 'LMH';

  return {
    results: {
      avgFlux: Number(avgFlux.toFixed(2)),
      calcFlux: avgFlux.toFixed(1),
      fluxUnit,
      highestFlux: Number(systemHighestFlux.toFixed(2)),
      feedFlowVessel: Number((feedFlowPerVesselM3h / unitFactor).toFixed(2)),
      concFlowVessel: Number((concFlowPerVesselM3h / unitFactor).toFixed(2)),
      feedPressure: systemFeedPressurePsi.toFixed(1),
      concPressure: systemConcPressurePsi.toFixed(1),
      highestBeta: systemHighestBeta < 0.001 ? '<0.001' : systemHighestBeta.toFixed(3),
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
  const { recovery, tempC, vessels, feedPH } = systemData;
  const feedPhValue = Number(feedPH) || 7.0;
  const recoveryPct = Math.min(Math.max(Number(recovery) || 0, 1), 99);
  const recFrac = recoveryPct / 100;

  // 1. Beta Factor (Concentration Polarization)
  const beta = Math.exp(0.7 * recFrac);

  // 2. Average Concentrate Concentration Factor (CF)
  const cf = 1 / (1 - recFrac);
  // 3. Membrane Rejection Characteristics (Standard for ESPA2-LD)
  const rejections = {
    Ca: 0.994,
    Mg: 0.994,
    Na: 0.990,
    K: 0.985,
    Cl: 0.988,
    SO4: 0.997,
    HCO3: 0.980,
    NO3: 0.920,
    CO2: 0.0
  };

  let permeateTDS = 0;
  const permeateIons = {};
  const concentrateIons = {};

  Object.keys(feedIons || {}).forEach((ion) => {
    const feedConc = Number(feedIons[ion]) || 0;
    if (ion === 'CO2' || ion === 'co2') {
      permeateIons[ion] = feedConc;
      concentrateIons[ion] = feedConc;
      permeateTDS += feedConc;
      return;
    }
    let rej = rejections[ion] != null ? rejections[ion] : 0.99;
    if (ion === 'NH4' || ion === 'nh4') {
      const nh3Fraction = Math.min(Math.max((feedPhValue - 7.2) / (11.5 - 7.2), 0), 1);
      rej = rej * (1 - nh3Fraction);
    }

    // Salt Passage = (1 - Rejection) * CF * Beta
   const passage = 1 - rej;
   const saltPassage = passage * beta;



    permeateIons[ion] = feedConc * saltPassage;
    concentrateIons[ion] = recFrac > 0 && recFrac < 1 ? feedConc / (1 - recFrac) : feedConc;
    permeateTDS += permeateIons[ion];
  });

  // 4. Langelier Saturation Index (LSI) Approximation
  const tds_conc = Object.values(concentrateIons).reduce((a, b) => a + (Number(b) || 0), 0);
  const pCa = -Math.log10((concentrateIons.Ca || 0) / 40080 || 1);
  const pAlk = -Math.log10((concentrateIons.HCO3 || 0) / 61010 || 1);
  const C_const = (Math.log10(tds_conc || 1) - 1) / 10;
  const pHs = (9.3 + C_const) + pCa + pAlk;

  const lsi = 7.3 - pHs;

  return {
    permeateIons,
    concentrateIons,
    permeateTDS: permeateTDS.toFixed(2),
    lsi: lsi.toFixed(2),
    beta: beta.toFixed(2),
    tempC,
    vessels
  };
};
  
  export const runHydraulicBalance = (config, membrane) => {
  /* ---------- 1. RAW INPUTS & SAFETY ---------- */
  const permeateInput = Number(config.permeateFlow) || 0; // user input
  const unit = config.flowUnit || 'gpm';
  const unitFactor = FLOW_TO_M3H[unit] ?? 1;
 
  // Clamp recovery between 1% and 99%
  const recoveryPercent = Math.min(Math.max(Number(config.recovery) || 15, 1), 99);
  const recovery = recoveryPercent / 100;
  const CF = 1 / (1 - recovery);

  const vessels = Number(config.stage1Vessels) || 1; // default 1 vessel
  const elementsPerVessel = Number(config.elementsPerVessel) || 7; // default 7 membranes/vessel

  // Membrane area calculations
  const elementArea_ft2 = Number(membrane?.area) || 400;
  const elementArea_m2 = elementArea_ft2 * 0.09290304;

  /* ---------- 2. HYDRAULIC BALANCE ---------- */
  // Convert permeate flow to m3/h for internal calculations
  const permeate_m3h = permeateInput * unitFactor;
  const feed_m3h = permeate_m3h / recovery;
  const concentrate_m3h = feed_m3h - permeate_m3h;

  /* ---------- 3. AVERAGE FLUX CALCULATION (UNIT & MEMBRANE AWARE) ---------- */
  let calcFlux = 0;
  const totalElements = vessels * elementsPerVessel;
  const totalArea_ft2 = totalElements * elementArea_ft2;
  const totalArea_m2 = totalElements * elementArea_m2;
  
  // Convert permeate flow to GPM for internal calculations
  const permeate_gpm = permeate_m3h * M3H_TO_GPM;

  if (totalElements > 0) {
    if (unit === 'gpm') {
      // Case 1: Permeate Flow Unit = gpm -> Flux unit: GFD
      // Formula: Average Flux (gfd) = Permeate Flow (gpm) ÷ (No. of Vessels × Membranes per Vessel × 0.0556)
      calcFlux = permeateInput / (vessels * elementsPerVessel * 0.0556);
    } else {
      // Case 2 & 3: Permeate Flow Unit = m³/h or m³/d -> Flux unit: LMH
      // Convert m³/d to m³/h if needed
      const permeate_m3h_for_flux = unit === 'm3/d' ? permeate_m3h : permeate_m3h;
      // Formula: Average Flux (LMH) = Permeate Flow (m³/h) × 1000 ÷ Total Active Area (m²)
      calcFlux = (permeate_m3h_for_flux * 1000) / totalArea_m2;
    }
  }

  /* ---------- 4. UNIT BACK-CONVERSION ---------- */
  const feedDisplay = feed_m3h / unitFactor;
  const concDisplay = concentrate_m3h / unitFactor;

  return {
    feedFlow: feedDisplay.toFixed(2),
    concentrateFlow: concDisplay.toFixed(2),
    permeateFlow: permeateInput.toFixed(2),
    totalElements: totalElements,
    totalArea_ft2: totalArea_ft2.toFixed(2),
    totalArea_m2: totalArea_m2.toFixed(2),
    elementArea_ft2: elementArea_ft2,
    elementArea_m2: elementArea_m2.toFixed(2),
    calcFlux: calcFlux.toFixed(1), 
    unit: unit,
    fluxUnit: unit === 'gpm' ? 'GFD' : 'LMH'
  };
};


