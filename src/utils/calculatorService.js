/* ================= IMSDesign Hydraulic Engine (REFINED) ================= */
import { 
  calculateROStage,
  calculateIonComposition,
  calculateWaterSaturations,
  PRESSURE_CONVERSION,
  FLOW_CONVERSION,
  FLUX_CONVERSION
} from '../engines/calculationEngine';
import { 
  MEMBRANES, 
  getAValue, 
  getMembraneB, 
  getIonBFactor 
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
 * Calculate Electrical Conductivity from TDS
 * @param {number} tds - TDS in mg/L
 * @returns {number} EC in µS/cm
 */
export const calculateEC = (tds) => {
  const t = Number(tds) || 0;
  if (t >= 30000) return t * 1.54;
  if (t >= 10000) return t * 1.59;
  if (t >= 2500) return t * 1.83;
  if (t >= 1000) return t * 1.95;
  if (t >= 300) return t * 2.28;
  if (t >= 50) return t * 2.2;
  return t * 2.52;
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
    waterType = 'Well Water'
  } = inputs;

  // 1. UNIT NORMALIZATION
  const unitFactor = FLOW_CONVERSION[flowUnit] || 1;
  const trains = Math.max(Number(numTrains) || 1, 1);
  const totalFeedM3h = (Number(feedFlow) || 0) * unitFactor;
  const trainFeedM3h = totalFeedM3h / trains;
  
  const isImperial = isGpmInput(flowUnit);
  const pUnit = isImperial ? 'psi' : 'bar';
  const fluxUnit = isImperial ? 'gfd' : 'lmh';

  // 2. WATER ANALYSIS PREP
  const rawFeedTds = Object.values(feedIons).reduce((sum, v) => sum + (Number(v) || 0), 0) || Number(inputs.tds) || 500;

  // 3. AGING & FOULING FACTORS
  const ageYears = Math.max(Number(membraneAge) || 0, 0);
  const spFactor = Math.pow(1 + (Number(spIncreasePerYear) || 7) / 100, ageYears);
  
  // 4. MULTI-STAGE ITERATION
  let currentFeedM3h = trainFeedM3h;
  let currentFeedTds = rawFeedTds;
  
  const stageResults = [];
  let totalPermeateM3h = 0;
  let totalAreaM2 = 0;
  const stageIonsMap = []; 
  let stageFeedIons = { ...feedIons };
  
  const activeStages = Array.isArray(stages) && stages.length > 0 
    ? stages.filter(s => Number(s.vessels) > 0)
    : [];

  // Default to 1 stage if none provided (backward compatibility)
  if (activeStages.length === 0) {
    activeStages.push({
      vessels: inputs.vessels || 1,
      elementsPerVessel: inputs.elementsPerVessel || 6,
      membraneModel: inputs.membraneModel || 'cpa3'
    });
  }

  // Iterate through stages
  activeStages.forEach((stage, idx) => {
    const membrane = MEMBRANES[stage.membraneModel] || MEMBRANES['cpa3'];
    const vessels = Number(stage.vessels) || 0;
    const elements = Number(stage.elementsPerVessel) || 6;
    const stageAreaM2 = vessels * elements * (membrane.areaM2 || 37.16);
    totalAreaM2 += stageAreaM2;

    // Estimate stage recovery if not explicitly provided for multi-stage
    // In a typical system, total recovery is split across stages.
    // For now, we assume a simple split or use the total target if single stage.
    const stageTargetRecovery = activeStages.length === 1 
      ? (Number(recovery) / 100)
      : (1 - Math.pow(1 - (Number(recovery) / 100), 1 / activeStages.length));

    const stageInputs = {
      Qf: currentFeedM3h,
      Cf: currentFeedTds,
      R: stageTargetRecovery,
      T: Number(temp) || 25,
      A_ref: getAValue(membrane) * (Number(foulingFactor) || 1.0),
      B_ref: getMembraneB(membrane) * spFactor,
      Area: membrane.areaM2 || 37.16,
      elementsPerVessel: elements,
      vesselsPerStage: vessels,
      waterType: waterType,
      feedIons: stageFeedIons,
      soluteBFactors: membrane.transport?.soluteBFactors || {}
    };

    let stageRes;
    try {
      stageRes = calculateROStage(stageInputs);
    } catch (e) {
      console.warn(`Error in stage ${idx + 1}:`, e.message);
      return;
    }

    stageIonsMap.push({ 
        permeate: stageRes.permeateIons || {}, 
        concentrate: stageRes.concentrateIons || {} 
    });

    // Accumulate results
    totalPermeateM3h += stageRes.Qp;

    stageResults.push({
      stage: idx + 1,
      vessels: vessels,
      elements: elements,
      membrane: membrane.name,
      feedFlow: isImperial ? (currentFeedM3h * M3H_TO_GPM).toFixed(2) : currentFeedM3h.toFixed(2),
      permeateFlow: isImperial ? (stageRes.Qp * M3H_TO_GPM).toFixed(2) : stageRes.Qp.toFixed(2),
      concFlow: isImperial ? (stageRes.Qc * M3H_TO_GPM).toFixed(2) : stageRes.Qc.toFixed(2),
      feedFlowVessel: vessels > 0 ?  (currentFeedM3h / vessels).toFixed(2) : '0.00',
      concFlowVessel: vessels > 0 ? (stageRes.Qc / vessels).toFixed(2) : '0.00',
      feedPressure: isImperial ? (stageRes.Pfeed * BAR_TO_PSI).toFixed(2) : stageRes.Pfeed.toFixed(2),
      concPressure: isImperial ? ((stageRes.Pfeed - stageRes.deltaP_system) * BAR_TO_PSI).toFixed(2) : (stageRes.Pfeed - stageRes.deltaP_system).toFixed(2),
      flux: isImperial ? (stageRes.J * LMH_TO_GFD).toFixed(2) : stageRes.J.toFixed(2),
      avgFluxGFD: isImperial ? (stageRes.J * LMH_TO_GFD).toFixed(2) : (stageRes.J / 1.6976).toFixed(2),
      highestFlux: isImperial ? (stageRes.highestFlux * LMH_TO_GFD).toFixed(2) : stageRes.highestFlux.toFixed(2),
      highestBeta: stageRes.highestBeta.toFixed(2),
      recovery: (stageRes.Qp / currentFeedM3h * 100).toFixed(2),
      rejection: (stageRes.rejection * 100).toFixed(2),
      stageRejection: stageRes.rejection,
      tdsFeed: currentFeedTds.toFixed(2),
      tdsPerm: stageRes.Cp.toFixed(2),
      tdsConc: stageRes.Cc.toFixed(2),
      phPerm: stageRes.permeatePh.toFixed(2),
      pressureUnit: pUnit,
      fluxUnit: fluxUnit
    });

    // Update for next stage
    currentFeedM3h = stageRes.Qc;
    currentFeedTds = stageRes.Cc;
    stageFeedIons = stageRes.concentrateIons;
  });

  // 5. SYSTEM AGGREGATION
  const systemRecovery = trainFeedM3h > 0 ? totalPermeateM3h / trainFeedM3h : 0;
  const avgFluxLMH = totalAreaM2 > 0 ? (totalPermeateM3h * 1000) / totalAreaM2 : 0;

  const totalPermeateFlowUnits = totalPermeateM3h * (isImperial ? M3H_TO_GPM : 1);
  const permeateIons = {};

  // Calculate flow-weighted average for system permeate ions
  Object.keys(feedIons).forEach(ion => {
    let weightedSum = 0;
    stageResults.forEach((s, idx) => {
        const stageQp = Number(s.permeateFlow);
        weightedSum += (stageIonsMap[idx]?.permeate[ion] || 0) * stageQp;
    });
    permeateIons[ion] = Number((weightedSum / (totalPermeateFlowUnits || 1)).toFixed(4));
  });

  const permeateTds = Object.entries(permeateIons).reduce((sum, [key, val]) => {
    return sum + (key.toLowerCase() === 'co2' ? 0 : val);
  }, 0);
  
  // Flow-weighted average for system permeate pH
  let totalWeightedPh = 0;
  stageResults.forEach(s => {
    totalWeightedPh += Number(s.phPerm) * Number(s.permeateFlow);
  });
  const permeatePh = totalWeightedPh / (totalPermeateFlowUnits || 1);

  const concIons = stageIonsMap.length > 0 ? stageIonsMap[stageIonsMap.length - 1].concentrate : { ...feedIons };
  const cfActual = 1 / (1 - Math.min(systemRecovery, 0.99));

  const feedSaturations = calculateWaterSaturations(feedIons, temp, inputs.feedPh || 7.0);
  const concPh = Number(inputs.feedPh || 7.0) + Math.log10(cfActual);
  const concSaturations = calculateWaterSaturations(concIons, temp, concPh);
  const permSaturations = calculateWaterSaturations(permeateIons, temp, 7.0);

  const firstStagePfeed = stageResults.length > 0 ? Number(stageResults[0].feedPressure) : 0;

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

  // 7. FLOW DIAGRAM POINTS
  const flowDiagramPoints = [
    { 
      id: 1, 
      name: 'Feed Inlet', 
      flow: isImperial ? (totalFeedM3h * M3H_TO_GPM).toFixed(2) : totalFeedM3h.toFixed(2), 
      pressure: '0.00', 
      tds: rawFeedTds.toFixed(2), 
      ph: inputs.feedPh || '7.00', 
      ec: calculateEC(rawFeedTds).toFixed(2) 
    },
    { 
      id: 2, 
      name: 'After Pump', 
      flow: isImperial ? (totalFeedM3h * M3H_TO_GPM).toFixed(2) : totalFeedM3h.toFixed(2), 
      pressure: firstStagePfeed.toFixed(2), 
      tds: rawFeedTds.toFixed(2), 
      ph: inputs.feedPh || '7.00', 
      ec: calculateEC(rawFeedTds).toFixed(2) 
    },
    { 
      id: 3, 
      name: 'Concentrate', 
      flow: isImperial ? ((trainFeedM3h - totalPermeateM3h) * trains * M3H_TO_GPM).toFixed(2) : ((trainFeedM3h - totalPermeateM3h) * trains).toFixed(2), 
      pressure: stageResults.length > 0 ? stageResults[stageResults.length - 1].concPressure : '0.00', 
      tds: currentFeedTds.toFixed(2), 
      ph: (7.0 + Math.log10(Math.max(1 / (1 - systemRecovery), 1))).toFixed(2), 
      ec: calculateEC(currentFeedTds).toFixed(2) 
    },
    { 
      id: 4, 
      name: 'Permeate', 
      flow: isImperial ? (totalPermeateM3h * trains * M3H_TO_GPM).toFixed(2) : (totalPermeateM3h * trains).toFixed(2), 
      pressure: isImperial ? (Number(permeatePressure) * BAR_TO_PSI).toFixed(2) : Number(permeatePressure).toFixed(2), 
      tds: permeateTds.toFixed(2), 
      ph: permeatePh.toFixed(2), 
      ec: calculateEC(permeateTds).toFixed(2) 
    }
    
  ];

  return {
    results: {
      avgFluxLMH,
      avgFlux: isImperial ? avgFluxLMH * LMH_TO_GFD : avgFluxLMH,
      calcFluxGfd: (avgFluxLMH * LMH_TO_GFD).toFixed(2),
      fluxUnit: fluxUnit,
      feedPressure: firstStagePfeed,
      calcFeedPressurePsi: (firstStagePfeed * (isImperial ? BAR_TO_PSI : 1)).toFixed(2),
      totalPower: (firstStagePfeed * (isImperial ? 1/BAR_TO_PSI : 1) * totalFeedM3h) / (36.7 * 0.75),
      monthlyEnergyCost: ((firstStagePfeed * (isImperial ? 1/BAR_TO_PSI : 1) * totalFeedM3h) / (36.7 * 0.75)) * (Number(inputs.energyCostPerKwh) || 0.12) * 24 * 30,
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
    concentrateParameters: {
      tds: currentFeedTds,
      osmoticPressure: concSaturations.osmoticPressureBar * (isImperial ? BAR_TO_PSI : 1),
      ph: concPh.toFixed(2),
      ions: concIons,
      saturation: concSaturations
    },
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
