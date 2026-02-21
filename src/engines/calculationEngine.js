/**
 * CALCULATION ENGINE
 * 
 * Pure calculation functions - the mathematical core of the system.
 * - Single source of truth for all calculations
 * - Pure functions (no side effects)
 * - Testable, predictable, framework-independent
 * - Organized by concern
 * 
 * Goal: Replace scattered calculations in App.js, calculatorService.js, components
 */



// ============================================
// UNIT CONVERSION CONSTANTS
// ============================================

export const FLOW_CONVERSION = {
  gpm: 0.2271247,
  gpd: 0.00378541 / 24,
  mgd: 157.725,
  migd: 189.42,
  'm3/h': 1,
  'm3/d': 1 / 24,
  mld: 41.6667
};

export const FLUX_CONVERSION = {
  lmh_to_gfd: 1 / 1.6976,
  gfd_to_lmh: 1.6976
};

export const PRESSURE_CONVERSION = {
  bar_to_psi: 14.5038,
  psi_to_bar: 1 / 14.5038
};

// ============================================
// UNIT CONVERSION FUNCTIONS
// ============================================

/**
 * Convert flow between units
 * @param {number} value - Value to convert
 * @param {string} fromUnit - Source unit
 * @param {string} toUnit - Target unit
 * @returns {number} Converted value
 */
export const convertFlow = (value, fromUnit = 'gpm', toUnit = 'm3/h') => {
  const fromFactor = FLOW_CONVERSION[fromUnit] || 1;
  const toFactor = FLOW_CONVERSION[toUnit] || 1;
  return (value * fromFactor) / toFactor;
};

/**
 * Convert flux between units
 * @param {number} value - Value to convert
 * @param {string} fromUnit - 'lmh' or 'gfd'
 * @returns {number} Converted value
 */
export const convertFlux = (value, fromUnit = 'lmh') => {
  if (fromUnit === 'lmh') {
    return value * FLUX_CONVERSION.lmh_to_gfd;
  }
  return value * FLUX_CONVERSION.gfd_to_lmh;
};

/**
 * Convert pressure between units
 * @param {number} value - Value to convert
 * @param {string} fromUnit - 'bar' or 'psi'
 * @returns {number} Converted value
 */
export const convertPressure = (value, fromUnit = 'bar') => {
  if (fromUnit === 'bar') {
    return value * PRESSURE_CONVERSION.bar_to_psi;
  }
  return value * PRESSURE_CONVERSION.psi_to_bar;
};

// ============================================
// MEMBRANE AREA CALCULATION
// ============================================

/**
 * Calculate total membrane area
 * @param {number} stages - Number of active stages
 * @param {number} vesselPerStage - Vessels per stage
 * @param {number} elementsPerVessel - Elements per vessel
 * @param {number} membraneArea - Area per element (ft²)
 * @returns {number} Total area in m²
 */
export const calculateTotalArea = (stages, vesselPerStage, elementsPerVessel, membraneArea) => {
  const totalElements = stages * vesselPerStage * elementsPerVessel;
  const totalAreaFt2 = totalElements * membraneArea;
  return totalAreaFt2 * 0.09290304; // Convert to m²
};

/**
 * Calculate elements per stage
 * @param {number} vessels - Vessels in stage
 * @param {number} elementsPerVessel - Elements per vessel
 * @returns {number} Total elements
 */
export const calculateElements = (vessels, elementsPerVessel) => {
  return vessels * elementsPerVessel;
};

// ============================================
// FLUX CALCULATION
// ============================================

/**
 * Calculate flux from flow and area
 * @param {number} flow - Flow in m³/h
 * @param {number} area - Area in m²
 * @returns {number} Flux in LMH
 */
export const calculateFluxLmh = (flow, area) => {
  if (area === 0) return 0;
  return (flow * 1000) / area;
};

/**
 * Calculate flux in GFD from LMH
 * @param {number} fluxLmh - Flux in LMH
 * @returns {number} Flux in GFD
 */
export const calculateFluxGfd = (fluxLmh) => {
  return fluxLmh / FLUX_CONVERSION.gfd_to_lmh;
};

/**
 * Calculate required area for target flux
 * @param {number} flow - Flow in m³/h
 * @param {number} targetFlux - Target flux in LMH
 * @returns {number} Required area in m²
 */
export const calculateRequiredArea = (flow, targetFlux) => {
  if (targetFlux === 0) return 0;
  return (flow * 1000) / targetFlux;
};

// ============================================
// OSMOTIC PRESSURE CALCULATION
// ============================================

/**
 * Calculate osmotic pressure from TDS
 * @param {number} tds - Total dissolved solids in mg/L
 * @returns {number} Osmotic pressure in bar
 */
export const calculateOsmoticPressure = (tds) => {
  const OSMOTIC_CONSTANT = 0.00076; // bar/(mg/L)
  return tds * OSMOTIC_CONSTANT;
};

/**
 * Calculate log-mean concentration factor
 * @param {number} recovery - Recovery fraction (0-1)
 * @returns {number} Log-mean CF
 */
export const calculateLogMeanCF = (recovery) => {
  if (recovery < 0.01) return 1;
  return -Math.log(1 - Math.min(recovery, 0.99)) / recovery;
};

/**
 * Calculate effective osmotic pressure
 * @param {number} feedOsmotic - Feed osmotic pressure
 * @param {number} logMeanCF - Log-mean concentration factor
 * @param {number} beta - Concentration polarization factor
 * @returns {number} Effective osmotic pressure
 */
export const calculateEffectiveOsmoticPressure = (feedOsmotic, logMeanCF, beta = 1.1) => {
  return feedOsmotic * logMeanCF * beta;
};

// ============================================
// PRESSURE DROP CALCULATION
// ============================================

/**
 * Calculate pressure drop across elements
 * @param {number} flow - Flow per vessel in m³/h
 * @param {number} elements - Number of elements
 * @param {number} dpExponent - DP exponent from membrane
 * @param {number} nominalFlowDP - Nominal flow DP from membrane
 * @returns {number} Pressure drop in bar
 */
export const calculatePressureDrop = (flow, elements, dpExponent, nominalFlowDP) => {
  if (nominalFlowDP === 0) return 0;
  
  const flowFactor = Math.pow(Math.max(flow, 0.01) / nominalFlowDP, dpExponent);
  const dpPerElement = 0.35 * flowFactor;
  return elements * Math.max(dpPerElement, 0.0001);
};

/**
 * Calculate system pressure drop (all stages)
 * @param {array} stages - Stage configurations
 * @param {number} membrane - Membrane object
 * @param {number} totalFeed - Total feed flow m³/h
 * @returns {number} Total system DP in bar
 */
export const calculateSystemPressureDrop = (stages, membrane, totalFeed) => {
  let totalDP = 0;
  let runningFlow = totalFeed;
  
  stages.forEach((stage, idx) => {
    const vessels = Math.max(stage.vessels || 1, 1);
    const elements = stage.elementsPerVessel || 4;
    const flowPerVessel = runningFlow / vessels;
    
    const dp = calculatePressureDrop(
      flowPerVessel,
      elements,
      membrane.dpExponent || 1.22,
      membrane.nominalFlowDP || 15.5
    );
    
    totalDP += dp;
    runningFlow = runningFlow * (1 - stage.recovery || 0.5); // Approximate next stage feed
  });
  
  return totalDP;
};

// ============================================
// PERMEATE FLOW & RECOVERY CALCULATION
// ============================================

/**
 * Calculate permeate flow from recovery
 * @param {number} feedFlow - Feed flow in m³/h
 * @param {number} recovery - Recovery fraction (0-1)
 * @returns {number} Permeate flow in m³/h
 */
export const calculatePermeateFlow = (feedFlow, recovery) => {
  return feedFlow * recovery;
};

/**
 * Calculate concentrate flow
 * @param {number} feedFlow - Feed flow in m³/h
 * @param {number} permeateFlow - Permeate flow in m³/h
 * @returns {number} Concentrate flow in m³/h
 */
export const calculateConcentrateFlow = (feedFlow, permeateFlow) => {
  return feedFlow - permeateFlow;
};

/**
 * Calculate recovery from flux
 * @param {number} flux - Flux in LMH
 * @param {number} feedDensity - Feed density (approximated from TDS)
 * @returns {number} Recovery fraction
 */
export const calculateRecoveryFromFlux = (flux, feedDensity = 1.0) => {
  // This is a simplified approximation
  const maxFlux = 100; // Rough maximum flux
  return Math.min(flux / maxFlux, 0.99);
};

// ============================================
// SALT PASSAGE & REJECTION CALCULATION
// ============================================

/**
 * Calculate salt passage (solute flux)
 * @param {number} flux - Permeate flux in LMH
 * @param {number} membraneB - Membrane B coefficient
 * @param {number} beta - Concentration polarization factor
 * @returns {number} Salt passage fraction (0-1)
 */
export const calculateSaltPassage = (flux, membraneB, beta = 1.1) => {
  if (flux === 0) return 0;
  return (membraneB * beta) / (flux + membraneB * beta);
};

/**
 * Calculate actual rejection
 * @param {number} saltPassage - Salt passage fraction
 * @returns {number} Rejection percentage
 */
export const calculateRejection = (saltPassage) => {
  return (1 - saltPassage) * 100;
};

/**
 * Calculate permeate ion concentration
 * @param {number} feedIon - Feed ion concentration
 * @param {number} saltPassage - Ion-specific salt passage
 * @param {number} logMeanCF - Log-mean concentration factor
 * @returns {number} Permeate ion concentration
 */
export const calculatePermeateIon = (feedIon, saltPassage, logMeanCF) => {
  const concentratedFeedIon = feedIon * logMeanCF;
  return concentratedFeedIon * saltPassage;
};

// ============================================
// TDS CALCULATION
// ============================================

/**
 * Calculate feed TDS from ions
 * @param {object} ions - Ion concentrations {ca, mg, na, cl, ...}
 * @returns {number} Total dissolved solids in mg/L
 */
export const calculateFeedTds = (ions) => {
  return Object.values(ions).reduce((sum, val) => sum + (Number(val) || 0), 0);
};

/**
 * Calculate permeate TDS
 * @param {number} feedTds - Feed TDS
 * @param {number} rejection - Membrane rejection percentage
 * @returns {number} Permeate TDS
 */
export const calculatePermeateGlobalTds = (feedTds, rejection) => {
  return feedTds * (1 - rejection / 100);
};

/**
 * Calculate concentrate TDS
 * @param {number} feedTds - Feed TDS
 * @param {number} logMeanCF - Log-mean concentration factor
 * @returns {number} Concentrate TDS
 */
export const calculateConcentrateTds = (feedTds, logMeanCF) => {
  return feedTds * logMeanCF;
};

// ============================================
// pH CALCULATION
// ============================================

/**
 * Calculate permeate pH (simplified)
 * @param {number} feedPh - Feed pH
 * @param {number} flux - Flux in LMH
 * @param {number} recovery - Recovery fraction
 * @returns {number} Estimated permeate pH
 */
export const calculatePermeatePhSimplified = (feedPh, flux, recovery) => {
  // Simplified flux-dependent pH model
  const logFluxRatio = Math.log10(Math.max(flux, 1) / 25.2);
  const phDrop = 1.14 + 1.08 * logFluxRatio + (recovery * 0.8);
  return Math.max(Math.min(feedPh - phDrop, 9.5), 3.5);
};

/**
 * Calculate concentrate pH
 * @param {number} feedPh - Feed pH
 * @param {number} recovery - Recovery fraction
 * @returns {number} Concentrate pH
 */
export const calculateConcentratePh = (feedPh, recovery) => {
  if (recovery >= 0.99) return feedPh;
  return feedPh + Math.log10(1 / (1 - Math.min(recovery, 0.99)));
};

// ============================================
// NET DRIVING PRESSURE CALCULATION
// ============================================

/**
 * Calculate net driving pressure
 * @param {number} feedPressure - Feed pressure in bar
 * @param {number} osmotic - Osmotic pressure in bar
 * @param {number} permeate - Permeate back pressure in bar
 * @param {number} pressureDrop - System pressure drop in bar
 * @returns {number} NDP in bar
 */
export const calculateNDP = (feedPressure, osmotic, permeate = 0, pressureDrop = 0) => {
  return Math.max(feedPressure - osmotic - permeate - (0.5 * pressureDrop), 0);
};

/**
 * Calculate required feed pressure
 * @param {number} flux - Flux in LMH
 * @param {number} aValue - A-value from membrane
 * @param {number} osmotic - Osmotic pressure
 * @param {number} pressureDrop - Pressure drop
 * @param {number} permeate - Permeate back pressure
 * @returns {number} Required feed pressure in bar
 */
export const calculateRequiredFeedPressure = (flux, aValue, osmotic, pressureDrop, permeate = 0) => {
  if (aValue === 0) return 0;
  const ndp = flux / aValue;
  return ndp + osmotic + permeate + (0.5 * pressureDrop);
};

// ============================================
// POWER & ENERGY CALCULATION
// ============================================

/**
 * Calculate pump power requirement
 * @param {number} pressure - Operating pressure in bar
 * @param {number} flow - Flow in m³/h
 * @param {number} pumpEfficiency - Pump efficiency (0-1, default 0.75)
 * @returns {number} Power in kW
 */
export const calculatePumpPower = (pressure, flow, pumpEfficiency = 0.75) => {
  // Power (kW) = (Pressure (bar) × Flow (m³/h)) / (36.7 × Efficiency)
  return (pressure * flow) / (36.7 * pumpEfficiency);
};

/**
 * Calculate monthly energy cost
 * @param {number} powerKw - Power in kW
 * @param {number} costPerKwh - Cost per kWh in dollars
 * @returns {number} Monthly cost in dollars
 */
export const calculateMonthlyCost = (powerKw, costPerKwh) => {
  const hoursPerMonth = 24 * 30;
  return powerKw * hoursPerMonth * costPerKwh;
};

// ============================================
// CHEMICAL DOSING CALCULATION
// ============================================

/**
 * Calculate chemical dose in kg/hr
 * @param {number} flow - Flow in m³/h
 * @param {number} dose - Dose in mg/L
 * @returns {number} Dose in kg/hr
 */
export const calculateChemicalDose = (flow, dose) => {
  // (Flow m³/h × Dose mg/L) / 1000 = kg/hr
  return (flow * dose) / 1000;
};

/**
 * Calculate monthly chemical usage
 * @param {number} doseKgHr - Dose in kg/hr
 * @returns {number} Monthly usage in kg
 */
export const calculateMonthlyChemicalUsage = (doseKgHr) => {
  const hoursPerMonth = 24 * 30;
  return doseKgHr * hoursPerMonth;
};

// ============================================
// CONCENTRATION FACTOR CALCULATIONS
// ============================================

/**
 * Calculate concentration factor at stage outlet
 * @param {number} feedConc - Feed concentration
 * @param {number} recovery - Stage recovery
 * @returns {number} Stage concentration factor
 */
export const calculateStageCF = (feedConc, recovery) => {
  if (recovery >= 0.99) return feedConc;
  return feedConc / (1 - recovery);
};

/**
 * Calculate multi-stage concentration
 * @param {number} feedConc - Initial feed concentration
 * @param {array} stageLosses - Array of salt losses per stage
 * @returns {number} Final concentrate concentration
 */
export const calculateMultiStageConcent = (feedConc, stageLosses) => {
  let conc = feedConc;
  stageLosses.forEach(loss => {
    conc = conc + loss;
  });
  return conc;
};

// ============================================
// VALIDATION & CONSTRAINTS CHECKING
// ============================================

/**
 * Validate design against limits
 * @param {object} design - Design parameters
 * @param {object} membrane - Membrane specification
 * @returns {object} Validation results
 */
export const validateDesign = (design, membrane) => {
  const issues = [];
  
  if (design.flux > membrane.maxFlux) {
    issues.push(`Flux ${design.flux} exceeds limit ${membrane.maxFlux}`);
  }
  
  if (design.pressure > membrane.maxPressure) {
    issues.push(`Pressure ${design.pressure} exceeds limit ${membrane.maxPressure}`);
  }
  
  if (design.tds > (membrane.maxTds || 10000)) {
    issues.push(`TDS ${design.tds} exceeds limit ${membrane.maxTds}`);
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
};
