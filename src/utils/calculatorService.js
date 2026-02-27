/* ================= IMSDesign Hydraulic Engine (REFINED) ================= */
import { 
  calculateROStageGivenPressure,
  calculateWaterSaturations,
  PRESSURE_CONVERSION,
  FLOW_CONVERSION,
  FLUX_CONVERSION
} from '../engines/calculationEngine';
import { 
  MEMBRANES, 
  getAValue, 
  getMembraneB, 
  getKdp,
  getKmt,
  getPExp,
  getOsmoticCoefficient
} from '../engines/membraneEngine';

export const BAR_TO_PSI = PRESSURE_CONVERSION.bar_to_psi;
export const M3H_TO_GPM = 1 / FLOW_CONVERSION.gpm;
export const LMH_TO_GFD = FLUX_CONVERSION.lmh_to_gfd;

export const FLOW_CONVERSION_MAP = FLOW_CONVERSION;

/**
 * Applies a TDS profile (Na-Cl model) to water data
 * @param {number} tdsValue - Target TDS in mg/L
 * @param {object} existingWaterData - Current water analysis
 * @returns {object} Updated water analysis
 */
export const applyTdsProfile = (tdsValue, existingWaterData) => {
  const tds = Number(tdsValue) || 0;
  if (tds <= 0) return existingWaterData;

  // Equivalent weights (from EQ_WEIGHTS)
  const EW_NA = 23.00;
  const EW_CL = 35.45;

  const totalMeq = tds / (EW_NA + EW_CL);
  const na = totalMeq * EW_NA;
  const cl = totalMeq * EW_CL;

  return {
    ...existingWaterData,
    calculatedTds: Math.round(tds),
    ca: 0, mg: 0, k: 0, hco3: 0, so4: 0, no3: 0, sio2: 0,
    na: Number(na.toFixed(2)),
    cl: Number(cl.toFixed(2)),
    // Preserve trace species
    nh4: existingWaterData.nh4 || 0,
    sr: existingWaterData.sr || 0,
    ba: existingWaterData.ba || 0,
    po4: existingWaterData.po4 || 0,
    f: existingWaterData.f || 0,
    b: existingWaterData.b || 0,
    co2: existingWaterData.co2 || 0,
    co3: existingWaterData.co3 || 0
  };
};

/**
 * Calculate Electrical Conductivity from TDS with temperature and pH compensation
 * @param {number} tds - TDS in mg/L
 * @param {number} temp - Temperature in °C
 * @param {number} ph - pH value
 * @returns {number} EC in µS/cm
 */
export const calculateEC = (tds, temp = 25, ph = 7.0) => {
  const t = Number(tds) || 0;
  let factor = 2.0;
  
  // Refined EC factor for seawater range (matches 1.587 at 20k, 1.539 at 33k)
  if (t >= 30000) factor = 1.539;
  else if (t >= 15000) factor = 1.587;
  else if (t >= 5000) factor = 1.75;
  else if (t >= 2500) factor = 1.83;
  else if (t >= 1000) factor = 1.95;
  else if (t >= 300) factor = 2.28;
  else if (t >= 50) factor = 2.23;
  else factor = 2.52;

  let ec = t * factor;

  // Temperature compensation (approx 2% per degree C from 25C)
  const tempCorrection = 1 + 0.02 * (temp - 25);
  ec *= tempCorrection;

  // pH adjustment (simplified: extreme pH increases conductivity)
  if (ph < 4 || ph > 10) {
    const phDev = ph < 4 ? 4 - ph : ph - 10;
    ec *= (1 + 0.05 * phDev);
  }

  return ec;
};

/**
 * Check if the unit is a GPM-based unit (Imperial)
 * @param {string} flowUnit 
 * @returns {boolean}
 */
export const isGpmInput = (flowUnit) => {
  const unit = (flowUnit || '').toLowerCase().trim();
  return ['gpm', 'gpd', 'mgd', 'migd'].includes(unit.replace('/', ''));
};

/**
 * Main System Calculation Orchestrator
 * Handles multi-stage logic, units, ion rejection, aging, and chemical dosing.
 * @param {object} inputs - System configuration and water data
 * @returns {object} Full calculation results
 */
export const calculateSystem = (inputs) => {
  const {
    feedFlow = 100,
    flowUnit = 'gpm',
    recovery = 52,
    feedIons = {},
    temp = 25,
    stages = [],
    numTrains = 1,
    membraneAge = 0,
    spIncreasePerYear = 7,
    foulingFactor = 1.0,
    chemicalDose = 0,
    chemicalConcentration = 100,
    doseUnit = 'mg/l',
    permeatePressure = 0,
    waterType = 'Well Water',
    pressureUnit: inputPUnit,
    fluxUnit: inputFluxUnit
  } = inputs;

  // 1. UNIT NORMALIZATION
  const unitFactor = FLOW_CONVERSION[flowUnit] || 1;
  const trains = Math.max(Number(numTrains) || 1, 1);
  const totalFeedM3h = (Number(feedFlow) || 0) * unitFactor;
  const trainFeedM3h = totalFeedM3h / trains;
  
  const isImperial = isGpmInput(flowUnit);
  const pUnit = inputPUnit || (isImperial ? 'psi' : 'bar');
  const fluxUnit = inputFluxUnit || (isImperial ? 'gfd' : 'lmh');
  const usePsi = pUnit.toLowerCase() === 'psi';
  const useGfd = fluxUnit.toLowerCase() === 'gfd';

  // 2. WATER ANALYSIS PREP
  const rawFeedTds = Object.values(feedIons).reduce((sum, v) => sum + (Number(v) || 0), 0) || Number(inputs.tds) || 500;

  // 3. AGING & FOULING FACTORS
  const ageYears = Math.max(Number(membraneAge) || 0, 0);
  const spFactor = Math.pow(1 + (Number(spIncreasePerYear) || 7) / 100, ageYears);
  
  // 4. MULTI-STAGE ITERATION
  let activeStages = Array.isArray(stages) && stages.length > 0 
    ? stages.filter(s => Number(s.vessels) > 0)
    : [];

  // Default to 1 stage if none provided (backward compatibility)
  if (activeStages.length === 0) {
    activeStages = [{
      vessels: inputs.vessels || 1,
      elementsPerVessel: inputs.elementsPerVessel || 6,
      membraneModel: inputs.membraneModel || 'cpa3'
    }];
  }

  const isSeawaterSystem = (waterType && waterType.toLowerCase().includes('sea')) || rawFeedTds >= 10000;
  const targetQp = trainFeedM3h * (Number(recovery) / 100);

  // Helper to calculate whole system for a given first-stage feed pressure
  const runSystemAtPressure = (startPfeed) => {
    let currentFeedM3h = trainFeedM3h;
    let currentFeedTds = rawFeedTds;
    let stageFeedIons = { ...feedIons };
    let currentPfeed = startPfeed;
    let currentStagePh = Number(inputs.feedPh) || 7.0;
    
    const results = [];
    let sysQp = 0;
    let sysArea = 0;
    
    activeStages.forEach((stage, idx) => {
      const membrane = MEMBRANES[stage.membraneModel] || MEMBRANES['bwtds10kfr8040'] || MEMBRANES['cpa3'];
      const vessels = Number(stage.vessels) || 0;
      const elements = Number(stage.elementsPerVessel) || 7;
      
      const stageRes = calculateROStageGivenPressure({
        Qf: currentFeedM3h,
        Cf: currentFeedTds,
        Pfeed: Math.max(currentPfeed, 0.1),
        T: Number(temp) || 25,
        A_ref: getAValue(membrane) * (Number(foulingFactor) || 1.0),
        B_ref: getMembraneB(membrane) * spFactor,
        Area: membrane.areaM2 || 37.16,
        elementsPerVessel: elements,
        vesselsPerStage: vessels,
        waterType: waterType,
        feedPh: currentStagePh,
        feedIons: stageFeedIons,
        soluteBFactors: membrane.transport?.soluteBFactors || {},
        k_dp: getKdp(membrane),
        k_mt: getKmt(membrane),
        p_exp: getPExp(membrane),
        osmoticCoeff: getOsmoticCoefficient(membrane)
      });
      
      results.push(stageRes);
      sysQp += stageRes.Qp;
      sysArea += vessels * elements * (membrane.areaM2 || 37.16);
      
      // Next stage
      currentFeedM3h = stageRes.Qc;
      currentFeedTds = stageRes.Cc;
      stageFeedIons = stageRes.concentrateIons;
      currentPfeed = stageRes.Pfeed - stageRes.deltaP_system;
      currentStagePh = stageRes.concentratePh;
    });
    
    return { results, sysQp, sysArea, lastIons: stageFeedIons, lastTds: currentFeedTds, lastPh: currentStagePh };
  };

  // Iterate startPfeed to hit target recovery (Bisection method)
  let lowP = 0.1;
  let highP = isSeawaterSystem ? 80 : 40;
  let finalSystemRun = null;
  
  for (let i = 0; i < 40; i++) {
    let midP = (lowP + highP) / 2;
    let run = runSystemAtPressure(midP);
    finalSystemRun = run;
    console.log(`Bisection iteration ${i}: P=${midP.toFixed(4)}, Qp=${run.sysQp.toFixed(4)}, target=${targetQp.toFixed(4)}`);
    if (Math.abs(run.sysQp - targetQp) < 0.00001 * Math.max(targetQp, 1)) break;
    if (run.sysQp < targetQp) lowP = midP;
    else highP = midP;
  }

  const stageResults = [];
  const stageIonsMap = [];
  const totalPermeateM3h = finalSystemRun.sysQp;
  const totalAreaM2 = finalSystemRun.sysArea;

  finalSystemRun.results.forEach((stageRes, idx) => {
    const vessels = Number(activeStages[idx].vessels) || 0;
    const elements = Number(activeStages[idx].elementsPerVessel) || 6;
    const membrane = MEMBRANES[activeStages[idx].membraneModel] || MEMBRANES['cpa3'];

    stageIonsMap.push({ 
        permeate: stageRes.permeateIons || {}, 
        concentrate: stageRes.concentrateIons || {} 
    });

    stageResults.push({
      stage: idx + 1,
      array: `1 - ${idx + 1}`,
      vessels: vessels,
      elements: elements,
      membrane: membrane.name,
      feedFlow: isImperial ? (stageRes.Qf * M3H_TO_GPM).toFixed(2) : stageRes.Qf.toFixed(2),
      permeateFlow: isImperial ? (stageRes.Qp * M3H_TO_GPM).toFixed(2) : stageRes.Qp.toFixed(2),
      concFlow: isImperial ? (stageRes.Qc * M3H_TO_GPM).toFixed(2) : stageRes.Qc.toFixed(2),
      feedFlowVessel: vessels > 0 ?  (stageRes.Qf / vessels).toFixed(2) : '0.00',
      concFlowVessel: vessels > 0 ? (stageRes.Qc / vessels).toFixed(2) : '0.00',
      feedPressure: usePsi ? (stageRes.Pfeed * BAR_TO_PSI).toFixed(2) : stageRes.Pfeed.toFixed(2),
      concPressure: usePsi ? ((stageRes.Pfeed - stageRes.deltaP_system) * BAR_TO_PSI).toFixed(2) : (stageRes.Pfeed - stageRes.deltaP_system).toFixed(2),
      flux: useGfd ? (stageRes.J * LMH_TO_GFD).toFixed(2) : stageRes.J.toFixed(2),
      avgFluxGFD: (stageRes.J * LMH_TO_GFD).toFixed(2),
      highestFlux: useGfd ? (stageRes.highestFlux * LMH_TO_GFD).toFixed(1) : stageRes.highestFlux.toFixed(1),
      highestBeta: stageRes.highestBeta.toFixed(2),
      recovery: (stageRes.Qp / stageRes.Qf * 100).toFixed(2),
      rejection: (stageRes.rejection * 100).toFixed(2),
      stageRejection: stageRes.rejection,
      tdsFeed: stageRes.Cf.toFixed(2),
      tdsPerm: stageRes.Cp.toFixed(2),
      tdsConc: stageRes.Cc.toFixed(2),
      phPerm: stageRes.permeatePh.toFixed(2),
      pi_c: stageRes.pi_c,
      pressureUnit: pUnit,
      fluxUnit: fluxUnit
    });
  });

  // 5. SYSTEM AGGREGATION
  const totalPermeateM3hFullSystem = totalPermeateM3h * trains;
  const systemRecovery = trainFeedM3h > 0 ? totalPermeateM3h / trainFeedM3h : 0;
  const avgFluxLMH = totalAreaM2 > 0 ? (totalPermeateM3h * 1000) / totalAreaM2 : 0;

  const permeateIons = {};
  const allIonKeys = [
    'ca', 'mg', 'na', 'k', 'nh4', 'ba', 'sr', 
    'co3', 'hco3', 'so4', 'cl', 'f', 'no3', 'po4', 
    'sio2', 'b', 'co2'
  ];

  // Calculate flow-weighted average for system permeate ions
  allIonKeys.forEach(ion => {
    let weightedSum = 0;
    finalSystemRun.results.forEach((stageRes) => {
        weightedSum += (stageRes.permeateIons[ion] || 0) * stageRes.Qp;
    });
    permeateIons[ion] = Number((weightedSum / (totalPermeateM3h || 1)).toFixed(4));
  });

  const permeateTds = Number(allIonKeys.reduce((sum, key) => {
    return sum + (key.toLowerCase() === 'co2' ? 0 : permeateIons[key] || 0);
  }, 0).toFixed(2));
  
  // Flow-weighted average for system permeate pH
  let totalWeightedPh = 0;
  finalSystemRun.results.forEach(stageRes => {
    totalWeightedPh += Number(stageRes.permeatePh) * stageRes.Qp;
  });
  const permeatePh = Number((totalWeightedPh / (totalPermeateM3h || 1)).toFixed(2));

  const concIons = finalSystemRun.lastIons || { ...feedIons };
  const currentFeedTds = Number(Object.entries(concIons).reduce((sum, [key, val]) => {
    return sum + (key.toLowerCase() === 'co2' ? 0 : Number(val) || 0);
  }, 0).toFixed(2));
  const lastStageRes = stageResults.length > 0 ? stageResults[stageResults.length - 1] : null;
  const concentrateOsmotic = lastStageRes ? lastStageRes.pi_c : 0;
  
  const cfActual = 1 / (1 - Math.min(systemRecovery, 0.99));

  const feedSaturations = calculateWaterSaturations(feedIons, temp, inputs.feedPh || 7.0);
  const concPh = Number(inputs.feedPh || 7.0) + Math.log10(cfActual);
  const concSaturations = calculateWaterSaturations(concIons, temp, concPh);
  const permSaturations = calculateWaterSaturations(permeateIons, temp, 7.0);

  const firstStagePfeed = finalSystemRun.results.length > 0 ? finalSystemRun.results[0].Pfeed : 0;

  // 6. CHEMICAL DOSING
  const doseValue = Number(chemicalDose) || 0;
  const concPct = Math.min(Math.max(Number(chemicalConcentration) || 100, 1), 100);
  let chemicalActive_kg_hr = 0;
  if (doseUnit === 'mg/l') {
    chemicalActive_kg_hr = (doseValue * trainFeedM3h) / 1000;
  } else if (doseUnit === 'lb/hr') {
    chemicalActive_kg_hr = doseValue * 0.45359237;
  } else if (doseUnit === 'kg/hr') {
    chemicalActive_kg_hr = doseValue;
  }
  const chemicalSolution_kg_hr = chemicalActive_kg_hr / (concPct / 100);

  // 7. FLOW DIAGRAM POINTS (MATCHING BENCHMARK 1-7 FOR 2-STAGE)
  const displayFactor = isImperial ? M3H_TO_GPM : (1 / unitFactor);
  const flowDiagramPoints = [];
  
  // Point 1: Raw Feed
  flowDiagramPoints.push({ 
    id: 1, 
    name: 'Feed Inlet', 
    flow: (totalFeedM3h * displayFactor).toFixed(2), 
    pressure: '0.00', 
    tds: rawFeedTds.toFixed(2), 
    ph: (Number(inputs.feedPh) || 7.00).toFixed(2), 
    ec: calculateEC(rawFeedTds, temp, inputs.feedPh).toFixed(2) 
  });

  // Point 2: After High Pressure Pump
  flowDiagramPoints.push({ 
    id: 2, 
    name: 'After Pump', 
    flow: (totalFeedM3h * displayFactor).toFixed(2), 
    pressure: usePsi ? (firstStagePfeed * BAR_TO_PSI).toFixed(2) : firstStagePfeed.toFixed(2), 
    tds: rawFeedTds.toFixed(2), 
    ph: (Number(inputs.feedPh) || 7.00).toFixed(2), 
    ec: calculateEC(rawFeedTds, temp, inputs.feedPh).toFixed(2) 
  });

  // Stage-wise Concentrate/Feed points
  finalSystemRun.results.forEach((stageRes, idx) => {
    const isLast = idx === finalSystemRun.results.length - 1;
    flowDiagramPoints.push({
      id: 3 + idx,
      name: isLast ? 'Final Concentrate' : `Stage ${idx + 1} Concentrate`,
      flow: (stageRes.Qc * trains * displayFactor).toFixed(2),
      pressure: usePsi ? ((stageRes.Pfeed - stageRes.deltaP_system) * BAR_TO_PSI).toFixed(2) : (stageRes.Pfeed - stageRes.deltaP_system).toFixed(2),
      tds: stageRes.Cc.toFixed(2),
      ph: stageRes.concentratePh.toFixed(2),
      ec: calculateEC(stageRes.Cc, temp, stageRes.concentratePh).toFixed(2)
    });
  });

  // Stage-wise Permeate points (Only for multi-stage)
  if (finalSystemRun.results.length > 1) {
    finalSystemRun.results.forEach((stageRes, idx) => {
      flowDiagramPoints.push({
        id: 3 + finalSystemRun.results.length + idx,
        name: `Stage ${idx + 1} Permeate`,
        flow: (stageRes.Qp * trains * displayFactor).toFixed(2),
        pressure: '0.00',
        tds: stageRes.Cp.toFixed(2),
        ph: stageRes.permeatePh.toFixed(2),
        ec: calculateEC(stageRes.Cp, temp, stageRes.permeatePh).toFixed(2)
      });
    });
  }

  // Total Permeate point
  flowDiagramPoints.push({ 
    id: 3 + (finalSystemRun.results.length > 1 ? 2 * finalSystemRun.results.length : finalSystemRun.results.length), 
    name: 'Total Permeate', 
    flow: (totalPermeateM3h * trains * displayFactor).toFixed(2), 
    pressure: usePsi ? (Number(permeatePressure) * BAR_TO_PSI).toFixed(2) : Number(permeatePressure).toFixed(2), 
    tds: permeateTds.toFixed(2), 
    ph: permeatePh.toFixed(2), 
    ec: calculateEC(permeateTds, temp, permeatePh).toFixed(2) 
  });

  return {
    system: {
      trainFlow: trainFeedM3h.toFixed(2),
      numTrains: trains,
      totalProductFlow: (totalPermeateM3hFullSystem).toFixed(2),
      flowUnit: isImperial ? 'gpm' : 'm3/h',
      stages: activeStages.map((s, idx) => ({
        stage: idx + 1,
        membrane: MEMBRANES[s.membraneModel]?.name || s.membraneModel,
        elementsPerVessel: s.elementsPerVessel,
        vessels: s.vessels
      }))
    },
    results: {
      avgFluxLMH,
      avgFlux: useGfd ? avgFluxLMH * LMH_TO_GFD : avgFluxLMH,
      calcFluxGfd: (avgFluxLMH * LMH_TO_GFD).toFixed(2),
      fluxUnit: fluxUnit,
      feedPressure: usePsi ? firstStagePfeed * BAR_TO_PSI : firstStagePfeed,
      calcFeedPressurePsi: (firstStagePfeed * BAR_TO_PSI).toFixed(2),
      calcFeedPressureBar: firstStagePfeed.toFixed(2),
      pressureUnit: pUnit,
      totalPower: (firstStagePfeed * totalFeedM3h) / (36.7 * 0.75),
      monthlyEnergyCost: ((firstStagePfeed * totalFeedM3h) / (36.7 * 0.75)) * (Number(inputs.energyCostPerKwh) || 0.12) * 24 * 30,
      recovery: systemRecovery * 100,
      totalAreaM2,
      chemicalUsage: chemicalSolution_kg_hr
    },
    permeateParameters: {
      tds: permeateTds,
      ph: permeatePh,
      ions: permeateIons,
      saturation: permSaturations
    },
    permeateConcentration: permeateIons,
    concentrateParameters: {
      tds: currentFeedTds,
      osmoticPressure: concentrateOsmotic * (isImperial ? BAR_TO_PSI : 1),
      ph: concPh.toFixed(2),
      ions: concIons,
      saturation: concSaturations
    },
    concentrateConcentration: concIons,
    concentrateSaturations: concSaturations,
    feedParameters: {
      tds: rawFeedTds,
      ph: inputs.feedPh || 7.0,
      ions: feedIons,
      saturation: feedSaturations
    },
    stageResults,
    flowDiagramPoints,
    chemicalResults: {
      active_kg_hr: chemicalActive_kg_hr,
      solution_kg_hr: chemicalSolution_kg_hr
    }
  };
};
