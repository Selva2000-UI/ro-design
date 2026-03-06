/* ================= IMSDesign Hydraulic Engine (REFINED) ================= */
import { 
  calculateROStageGivenPressure,
  calculateWaterSaturations,
  PRESSURE_CONVERSION,
  FLOW_CONVERSION,
  FLUX_CONVERSION
} from '../engines/calculationEngine.js';
import * as MembraneEngine from '../engines/membraneEngine.js';

const { 
  getMembrane,
  getArea,
  getAValue, 
  getMembraneB, 
  getKdp,
  getKmt,
  getPExp,
  getOsmoticCoefficient
} = MembraneEngine;

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
  if (!Number.isFinite(t) || t < 0) return 0;
  
  // Refined EC factor points for interpolation to match benchmark
  const points = [
    { t: 0, f: 2.222 },
    { t: 50, f: 2.23 },
    { t: 300, f: 2.28 },
    { t: 1000, f: 2.063 },
    { t: 1500, f: 1.9687 },
    { t: 2000, f: 1.918 },
    { t: 2500, f: 1.868 },
    { t: 4000, f: 1.782 },
    { t: 5000, f: 1.75 },
    { t: 15000, f: 1.587 },
    { t: 30000, f: 1.539 }
  ];

  let factor = 2.0;
  if (t <= points[0].t) {
    factor = points[0].f;
  } else if (t >= points[points.length - 1].t) {
    factor = points[points.length - 1].f;
  } else {
    for (let i = 0; i < points.length - 1; i++) {
      if (t >= points[i].t && t < points[i + 1].t) {
        const p1 = points[i];
        const p2 = points[i + 1];
        factor = p1.f + (p2.f - p1.f) * (t - p1.t) / (p2.t - p1.t);
        break;
      }
    }
  }

  let ec = t * factor;

  // Temperature compensation (approx 2% per degree C from 25C)
  const tempCorrection = 1 + 0.02 * (temp - 25);
  ec *= tempCorrection;

  // Add H+ and OH- contribution to EC (Significant at extreme pH)
  // Specific conductance of H+ ~ 350 S*cm2/mol, OH- ~ 199 S*cm2/mol
  // κ (µS/cm) = λ (S*cm2/mol) * c (mol/l) * 1000
  const safePh = Math.max(0, Math.min(ph, 14));
  const hConc = Math.pow(10, -safePh);
  const ohConc = Math.pow(10, -(14 - safePh));
  const ionicEC = (350 * hConc + 199 * ohConc) * 1000;
  ec += ionicEC;

  return Number.isFinite(ec) ? ec : 0;
};

/**
 * Check if the unit is a GPM-based unit (Imperial)
 * @param {string} flowUnit 
 * @returns {boolean}
 */
export const isGpmInput = (flowUnit) => {
  const unit = (flowUnit || '').toLowerCase().trim().replace('/', '');
  return ['gpm', 'gpd', 'mgd', 'migd'].includes(unit);
};

/**
 * Main System Calculation Orchestrator
 * Handles multi-stage logic, units, ion rejection, aging, and chemical dosing.
 * @param {object} inputs - System configuration and water data
 * @param {array} allMembranes - Optional membrane database (for custom models)
 * @returns {object} Full calculation results
 */
export const calculateSystem = (inputs, allMembranes = []) => {
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
    pressureUnit: inputPUnit
  } = inputs;

  // 1. UNIT NORMALIZATION
  const unitFactor = FLOW_CONVERSION[flowUnit] || 1;
  const trains = Math.max(Number(numTrains) || 1, 1);
  const totalFeedM3h = (Number(feedFlow) || 0) * unitFactor;
  const trainFeedM3h = totalFeedM3h / trains;
  
  const isImperial = isGpmInput(flowUnit);
  const pUnit = inputPUnit || (isImperial ? 'psi' : 'bar');
  const fluxUnit = isImperial ? 'gfd' : 'lmh';
  const usePsi = pUnit.toLowerCase() === 'psi';
  const useGfd = fluxUnit.toLowerCase() === 'gfd';

  // Normalize permeate pressure to bar for calculation engine
  const pBackBar = usePsi ? (Number(permeatePressure) || 0) / BAR_TO_PSI : (Number(permeatePressure) || 0);

  // 2. WATER ANALYSIS PREP
  const rawFeedTds = Object.values(feedIons).reduce((sum, v) => sum + (Number(v) || 0), 0) || Number(inputs.tds) || 500;

  // 3. AGING & FOULING FACTORS
  const ageYears = Math.max(Number(membraneAge) || 0, 0);
  const spFactor = Math.pow(1 + (Number(spIncreasePerYear) || 7) / 100, ageYears);
  
  // 4. MULTI-STAGE ITERATION
  let activeStages = Array.isArray(stages) && stages.length > 0 
    ? stages
    : [];

  // Default to 1 stage if none provided (backward compatibility)
  if (activeStages.length === 0) {
    activeStages = [{
      vessels: inputs.vessels || 1,
      elementsPerVessel: inputs.elementsPerVessel || 6,
      membraneModel: inputs.membraneModel || 'cpa3'
    }];
  }

  const isSeawaterSystem = (waterType && waterType.toLowerCase().includes('sea')) || rawFeedTds >= 2000;
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
    let hasNegativePressure = false;
    
    activeStages.forEach((stage, idx) => {
      const getModelId = (model) => (model || '').toLowerCase().replace(/-/g, '').trim();
      const targetId = getModelId(stage.membraneModel);
      const membrane = (allMembranes && allMembranes.length > 0)
        ? allMembranes.find(m => getModelId(m.id) === targetId || getModelId(m.name) === targetId) || getMembrane(stage.membraneModel) || getMembrane('cpa3')
        : getMembrane(stage.membraneModel) || getMembrane('cpa3');
      const vessels = Number(stage.vessels) || 0;
      const elements = Number(stage.elementsPerVessel) || Number(inputs.elementsPerVessel) || 6;
      
      const actualArea = getArea(membrane);
      
      const stageRes = calculateROStageGivenPressure({
        Qf: currentFeedM3h,
        Cf: currentFeedTds,
        Pfeed: Math.max(currentPfeed, 0.1),
        T: Number(temp) || 25,
        A_ref: getAValue(membrane) * (Number(foulingFactor) || 1.0),
        B_ref: getMembraneB(membrane) * spFactor,
        Area: actualArea,
        membrane: membrane,
        elementsPerVessel: elements,
        vesselsPerStage: vessels,
        waterType: waterType,
        feedPh: currentStagePh,
        feedIons: stageFeedIons,
        soluteBFactors: membrane?.transport?.soluteBFactors || {},
        k_dp: getKdp(membrane),
        k_mt: getKmt(membrane),
        p_exp: getPExp(membrane),
        osmoticCoeff: getOsmoticCoefficient(membrane),
        permeatePressure: pBackBar
      });
      
      results.push(stageRes);
      sysQp += stageRes.Qp;

      if (stageRes.Pfeed - stageRes.deltaP_system < 0) {
        hasNegativePressure = true;
      }
      
      const currentMembraneObj = (allMembranes && allMembranes.length > 0)
        ? allMembranes.find(m => m.id === stage.membraneModel) || getMembrane(stage.membraneModel) || getMembrane('cpa3')
        : getMembrane(stage.membraneModel) || getMembrane('cpa3');
      const mArea = getArea(currentMembraneObj);
      const mElements = Number(stage.elementsPerVessel) || Number(inputs.elementsPerVessel) || 6;
      sysArea += vessels * mElements * mArea;
      
      // Next stage
      currentFeedM3h = stageRes.Qc;
      currentFeedTds = stageRes.Cc;
      stageFeedIons = stageRes.concentrateIons;
      currentPfeed = stageRes.Pfeed - stageRes.deltaP_system;
      currentStagePh = stageRes.concentratePh;
    });
    
    return { results, sysQp, sysArea, lastIons: stageFeedIons, lastTds: currentFeedTds, lastPh: currentStagePh, hasNegativePressure };
  };

  // Iterate startPfeed to hit target recovery (Bisection method)
  let lowP = 0.1;
  let highP = 1500; // Increased to handle extreme designs (e.g. 532 bar in user benchmark)
  let finalSystemRun = null;
  
  for (let i = 0; i < 50; i++) {
    let midP = (lowP + highP) / 2;
    let run = runSystemAtPressure(midP);
    finalSystemRun = run;
    
    const recoveryDiff = run.sysQp - targetQp;
    if (Math.abs(recoveryDiff) < 0.000001 * Math.max(targetQp, 1)) break;
    
    if (run.sysQp < targetQp) {
      lowP = midP;
    } else {
      highP = midP;
    }
  }

  // 4. MULTI-STAGE ITERATION
  const stageResults = [];
  const stageIonsMap = [];
  const totalPermeateM3h = finalSystemRun.sysQp;
  const totalAreaM2 = finalSystemRun.sysArea;

  finalSystemRun.results.forEach((stageRes, idx) => {
    const vessels = Number(activeStages[idx].vessels) || 0;
    const elements = Number(activeStages[idx].elementsPerVessel) || Number(inputs.elementsPerVessel) || 6;
    const membrane = (allMembranes && allMembranes.length > 0)
      ? allMembranes.find(m => m.id === activeStages[idx].membraneModel) || getMembrane(activeStages[idx].membraneModel) || getMembrane('cpa3')
      : getMembrane(activeStages[idx].membraneModel) || getMembrane('cpa3');

    stageIonsMap.push({ 
        permeate: stageRes.permeateIons || {}, 
        concentrate: stageRes.concentrateIons || {} 
    });

    // Use display unit factor for per-vessel flows
    const flowDisplayFactor = 1 / (FLOW_CONVERSION[flowUnit] || 1);

    stageResults.push({
      stage: idx + 1,
      array: `1 - ${idx + 1}`,
      vessels: vessels,
      elements: elements,
      membrane: membrane.name,
      feedFlow: vessels > 0 ? (stageRes.Qf / vessels * flowDisplayFactor).toFixed(2) : '0.00',
      permeateFlow: vessels > 0 ? (stageRes.Qp / vessels * flowDisplayFactor).toFixed(2) : '0.00',
      concFlow: vessels > 0 ? (stageRes.Qc / vessels * flowDisplayFactor).toFixed(2) : '0.00',
      feedFlowVessel: vessels > 0 ? (stageRes.Qf / vessels * flowDisplayFactor).toFixed(2) : '0.00',
      permeateFlowVessel: vessels > 0 ? (stageRes.Qp / vessels * flowDisplayFactor).toFixed(2) : '0.00',
      concFlowVessel: vessels > 0 ? (stageRes.Qc / vessels * flowDisplayFactor).toFixed(2) : '0.00',
      totalFeedFlow: (stageRes.Qf * flowDisplayFactor).toFixed(2),
      totalPermeateFlow: (stageRes.Qp * flowDisplayFactor).toFixed(2),
      totalConcFlow: (stageRes.Qc * flowDisplayFactor).toFixed(2),
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

  // Calculate flow-weighted average for system bulk permeate TDS
  let totalWeightedTds = 0;
  finalSystemRun.results.forEach(res => {
    totalWeightedTds += Number(res.Cp) * res.Qp;
  });
  const permeateTds = Number((totalWeightedTds / (totalPermeateM3h || 1)).toFixed(2));
  
  // Calculate flow-weighted average for system permeate pH
  let totalWeightedPh = 0;
  finalSystemRun.results.forEach(stageRes => {
    totalWeightedPh += Number(stageRes.permeatePh) * stageRes.Qp;
  });
  const permeatePh = Number((totalWeightedPh / (totalPermeateM3h || 1)).toFixed(2));

  const concIons = finalSystemRun.lastIons || { ...feedIons };
  const lastMembraneModel = activeStages.length > 0 ? activeStages[activeStages.length - 1].membraneModel : activeStages[0]?.membraneModel;
  const osmoticCoeff = getMembrane(lastMembraneModel)?.osmoticModel?.coefficient || 0.000792;
  
  const systemConcentrateTds = Number((finalSystemRun.lastTds || 0).toFixed(2));
  const concentrateOsmotic = (finalSystemRun.lastTds || 0) * osmoticCoeff;
  const concentrateOsmoticDisplay = usePsi ? concentrateOsmotic * BAR_TO_PSI : concentrateOsmotic;
  
  const cfActual = 1 / (1 - Math.min(systemRecovery, 0.99));
  const feedSaturations = calculateWaterSaturations(feedIons, temp, inputs.feedPh || 7.0, osmoticCoeff, rawFeedTds);
  const concPh = Number(inputs.feedPh || 7.0) + Math.log10(cfActual);
  const concSaturations = calculateWaterSaturations(concIons, temp, concPh, osmoticCoeff, systemConcentrateTds);
  const permSaturations = calculateWaterSaturations(permeateIons, temp, 7.0, osmoticCoeff, permeateTds);

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

  // 7. DYNAMIC FLOW DIAGRAM GENERATION (Matches benchmark points 1-15)
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
    ec: calculateEC(rawFeedTds, temp, inputs.feedPh).toFixed(0) 
  });

  // Point 2: After Pump
  flowDiagramPoints.push({ 
    id: 2, 
    name: 'After Pump', 
    flow: (totalFeedM3h * displayFactor).toFixed(2), 
    pressure: usePsi ? (firstStagePfeed * BAR_TO_PSI).toFixed(3) : firstStagePfeed.toFixed(3), 
    tds: rawFeedTds.toFixed(1), 
    ph: (Number(inputs.feedPh) || 7.00).toFixed(2), 
    ec: calculateEC(rawFeedTds, temp, inputs.feedPh).toFixed(0) 
  });

  // Inter-Stage Concentration Points (Points 3, 4, 5, ...)
  finalSystemRun.results.forEach((stageRes, idx) => {
    flowDiagramPoints.push({
      id: 3 + idx,
      name: `Stage ${idx + 1} Conc`,
      flow: (stageRes.Qc * trains * displayFactor).toFixed(isImperial ? 1 : 2),
      pressure: usePsi ? ((stageRes.Pfeed - stageRes.deltaP_system) * BAR_TO_PSI).toFixed(3) : (stageRes.Pfeed - stageRes.deltaP_system).toFixed(3),
      tds: stageRes.Cc.toFixed(1),
      ph: stageRes.concentratePh.toFixed(2),
      ec: calculateEC(stageRes.Cc, temp, stageRes.concentratePh).toFixed(0)
    });
  });

  // Stage Permeate Points (Continues the sequence)
  const nextId = 3 + finalSystemRun.results.length;
  finalSystemRun.results.forEach((stageRes, idx) => {
    // Show TDS even for negative/zero flow if requested (matches industrial diagnostic mode)
    const isActuallyZero = Math.abs(stageRes.Qp) < 1e-10;
    flowDiagramPoints.push({
      id: nextId + idx,
      name: `Stage ${idx + 1} Perm`,
      flow: (stageRes.Qp * trains * displayFactor).toFixed(isImperial ? 2 : 2),
      pressure: '0.00',
      tds: isActuallyZero ? '0.00' : stageRes.Cp.toFixed(2),
      ph: isActuallyZero ? '0.00' : stageRes.permeatePh.toFixed(2),
      ec: isActuallyZero ? '0.0' : calculateEC(stageRes.Cp, temp, stageRes.permeatePh).toFixed(1)
    });
  });

  // Final Total Permeate Point
  const totalId = nextId + finalSystemRun.results.length;
  flowDiagramPoints.push({
    id: totalId,
    name: 'Total Permeate',
    flow: (totalPermeateM3h * trains * displayFactor).toFixed(2),
    pressure: '0.00',
    tds: permeateTds.toFixed(2),
    ph: permeatePh.toFixed(2),
    ec: calculateEC(permeateTds, temp, permeatePh).toFixed(1)
  });

  const finalConcFlow = finalSystemRun.results[finalSystemRun.results.length - 1].Qc;
  const finalConcPressure = usePsi ? ((finalSystemRun.results[finalSystemRun.results.length - 1].Pfeed - finalSystemRun.results[finalSystemRun.results.length - 1].deltaP_system) * BAR_TO_PSI) : (finalSystemRun.results[finalSystemRun.results.length - 1].Pfeed - finalSystemRun.results[finalSystemRun.results.length - 1].deltaP_system);

  const systemWarnings = [];
  if (finalSystemRun.hasNegativePressure) {
    systemWarnings.push("Concentrate pressure is negative. This indicates excessive pressure drop for the current design.");
  }

  return {
    system: {
      trainFlow: trainFeedM3h.toFixed(2),
      numTrains: trains,
      totalProductFlow: (totalPermeateM3hFullSystem).toFixed(2),
      flowUnit: isImperial ? 'gpm' : 'm3/h',
      stages: activeStages.map((s, idx) => {
        const membrane = (allMembranes && allMembranes.length > 0)
          ? allMembranes.find(m => m.id === s.membraneModel) || getMembrane(s.membraneModel) || getMembrane('cpa3')
          : getMembrane(s.membraneModel) || getMembrane('cpa3');
        return {
          stage: idx + 1,
          membrane: membrane?.name || s.membraneModel,
          elementsPerVessel: s.elementsPerVessel,
          vessels: s.vessels
        };
      })
    },
    warnings: systemWarnings,
    results: {
      avgFluxLMH,
      avgFlux: useGfd ? avgFluxLMH * LMH_TO_GFD : avgFluxLMH,
      activeMembrane: activeStages.length > 0 ? getMembrane(activeStages[0].membraneModel) : null,
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
      chemicalUsage: chemicalSolution_kg_hr,
      // Single Train Flows (for Train Information panel)
      trainPermeateFlow: (totalPermeateM3h * displayFactor).toFixed(2),
      trainConcentrateFlow: (finalSystemRun.results[finalSystemRun.results.length - 1].Qc * displayFactor).toFixed(2),
      trainFeedFlow: (trainFeedM3h * displayFactor).toFixed(2),
      // Total System Flows
      totalPermeateFlow: (totalPermeateM3h * trains * displayFactor).toFixed(2),
      totalConcentrateFlow: (finalSystemRun.results[finalSystemRun.results.length - 1].Qc * trains * displayFactor).toFixed(2),
      totalFeedFlow: (totalFeedM3h * displayFactor).toFixed(2)
    },
    permeateParameters: {
      tds: permeateTds,
      ph: permeatePh,
      ions: permeateIons,
      saturation: permSaturations
    },
    permeateConcentration: permeateIons,
    concentrateParameters: {
      tds: systemConcentrateTds,
      osmoticPressure: Number(concentrateOsmoticDisplay.toFixed(2)),
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
