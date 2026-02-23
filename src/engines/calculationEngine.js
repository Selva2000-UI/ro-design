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
 * Calculate osmotic pressure from TDS - Dual unit support
 * Industrial approximation: π = k × TDS
 * For PSI: π(psi) = 0.011 × TDS
 * For BAR: π(bar) = 0.00076 × TDS
 * @param {number} tds - Total dissolved solids in mg/L
 * @param {string} unit - 'psi' or 'bar' (default: 'bar')
 * @returns {number} Osmotic pressure in specified unit
 */
export const calculateOsmoticPressure = (tds, unit = 'bar') => {
  if (unit === 'psi') {
    return 0.011 * tds;
  }
  return 0.00076 * tds;
};

/**
 * Calculate average osmotic pressure across membrane element
 * Using concentration factor and recovery
 * @param {number} feedTds - Feed TDS in mg/L
 * @param {number} recovery - Recovery fraction (0-1)
 * @param {string} unit - 'psi' or 'bar'
 * @returns {object} {feedOsmotic, concentrateOsmotic, avgOsmotic}
 */
export const calculateAverageOsmoticPressure = (feedTds, recovery, unit = 'bar') => {
  const recoveryFrac = Math.min(recovery, 0.99);
  const cf = 1 / (1 - recoveryFrac);
  
  const feedOsmotic = calculateOsmoticPressure(feedTds, unit);
  const concentrateOsmotic = feedOsmotic * cf;
  const avgOsmotic = (feedOsmotic + concentrateOsmotic) / 2;
  
  return {
    feedOsmotic,
    concentrateOsmotic,
    avgOsmotic,
    concentrationFactor: cf
  };
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
 * Calculate salt passage using A/B transport model
 * B = solute permeability (mg/L-min or equivalent)
 * J = solute flux (permeate flux in LMH)
 * Salt passage fraction = B / (J + B)
 * @param {number} flux - Permeate flux in LMH
 * @param {number} membraneB - Membrane B coefficient (solute permeability)
 * @returns {number} Salt passage fraction (0-1)
 */
export const calculateSaltPassage = (flux, membraneB) => {
  if (flux === 0) return membraneB / (0.001 + membraneB);
  if (membraneB === 0) return 0;
  return membraneB / (flux + membraneB);
};

/**
 * Calculate rejection from flux and B-value using A/B model
 * R = 1 - B / (J + B)
 * Where: J = flux, B = solute permeability
 * @param {number} flux - Permeate flux in LMH
 * @param {number} membraneB - Membrane B coefficient
 * @returns {number} Rejection fraction (0-1)
 */
export const calculateRejectionFromFlux = (flux, membraneB) => {
  if (membraneB === 0) return 1;
  const saltPassage = calculateSaltPassage(flux, membraneB);
  return 1 - saltPassage;
};

/**
 * Calculate actual rejection percentage
 * @param {number} saltPassage - Salt passage fraction (0-1)
 * @returns {number} Rejection percentage (0-100)
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
 * Calculate net driving pressure - CORRECT INDUSTRIAL FORMULA
 * NDP = P_feed - π_avg - 0.5×ΔP
 * Where π_avg = (π_feed + π_concentrate) / 2
 * @param {number} feedPressure - Feed pressure in bar
 * @param {number} avgOsmotic - Average osmotic pressure (not just feed) in bar
 * @param {number} permeate - Permeate back pressure in bar
 * @param {number} pressureDrop - System pressure drop in bar
 * @returns {number} NDP in bar
 */
export const calculateNDP = (feedPressure, avgOsmotic, permeate = 0, pressureDrop = 0) => {
  const ndp = feedPressure - avgOsmotic - permeate - (0.5 * pressureDrop);
  
  if (ndp <= 0) {
    throw new Error(`Net Driving Pressure <= 0. Feed pressure (${feedPressure.toFixed(1)}) must exceed average osmotic pressure (${avgOsmotic.toFixed(1)}) + pressure drop effect.`);
  }
  
  return Math.max(ndp, 0);
};

/**
 * Calculate required feed pressure
 * @param {number} flux - Flux in LMH
 * @param {number} aValue - A-value from membrane
 * @param {number} avgOsmotic - Average osmotic pressure
 * @param {number} pressureDrop - Pressure drop
 * @param {number} permeate - Permeate back pressure
 * @returns {number} Required feed pressure in bar
 */
export const calculateRequiredFeedPressure = (flux, aValue, avgOsmotic, pressureDrop, permeate = 0) => {
  if (aValue === 0) return 0;
  const ndp = flux / aValue;
  return ndp + avgOsmotic + permeate + (0.5 * pressureDrop);
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

// ============================================
// DYNAMIC A & B NORMALIZATION ENGINE
// ============================================

/**
 * Temperature correction factor using Arrhenius equation
 * @param {number} tempCelsius - Operating temperature in °C
 * @param {string} type - 'A' or 'B' value type
 * @returns {number} Temperature correction factor
 */
export const calculateTCF = (tempCelsius, type = 'A') => {
  const tempKelvin = tempCelsius + 273.15;
  const refTempKelvin = 25 + 273.15; // 298.15 K
  
  const ERatio = type === 'A' ? 2640 : 3000;
  
  const exponent = ERatio * (1 / refTempKelvin - 1 / tempKelvin);
  return Math.exp(exponent);
};

/**
 * Calculate dynamic A-value with temperature and aging
 * @param {object} params - {aValue25, tempCelsius, fluxDeclinePercent, membraneAgeYears}
 * @returns {number} Actual A-value at operating conditions
 */
export const calculateDynamicAValue = (params) => {
  const {
    aValue25,
    tempCelsius = 25,
    fluxDeclinePercent = 0,
    membraneAgeYears = 0
  } = params;
  
  const tcf = calculateTCF(tempCelsius, 'A');
  const agingFactor = 1 - (fluxDeclinePercent / 100) * membraneAgeYears;
  
  return aValue25 * tcf * Math.max(agingFactor, 0.7);
};

/**
 * Calculate dynamic B-value with temperature correction
 * @param {object} params - {bValue25, tempCelsius}
 * @returns {number} Actual B-value at operating conditions
 */
export const calculateDynamicBValue = (params) => {
  const {
    bValue25,
    tempCelsius = 25
  } = params;
  
  const tcf = calculateTCF(tempCelsius, 'B');
  return bValue25 * tcf;
};

/**
 * Normalize membrane A-value to reference conditions (25°C, 225 psi BW, Δπ=0)
 * @param {number} aValueAtConditions - A-value at operating conditions
 * @param {number} tempCelsius - Operating temperature
 * @param {string} sourceType - 'A' or 'B' normalization
 * @returns {number} Normalized A-value at 25°C
 */
export const normalizeAValueTo25C = (aValueAtConditions, tempCelsius, sourceType = 'A') => {
  const tcf = calculateTCF(tempCelsius, sourceType);
  if (tcf === 0) return aValueAtConditions;
  return aValueAtConditions / tcf;
};

// ============================================
// IONIC-BASED OSMOTIC PRESSURE CALCULATION
// ============================================

const MOLECULAR_WEIGHTS = {
  na: 22.99,
  k: 39.10,
  ca: 40.08,
  mg: 24.31,
  cl: 35.45,
  so4: 96.06,
  hco3: 61.01,
  co3: 60.01,
  f: 19.00,
  no3: 62.00,
  po4: 94.97,
  sr: 87.62,
  ba: 137.33
};

const ION_CHARGES = {
  na: 1, k: 1, cl: -1, f: -1, no3: -1,
  ca: 2, mg: 2, sr: 2, ba: 2,
  so4: -2, co3: -2, po4: -3, hco3: -1
};

/**
 * Convert mg/L to molarity (mol/L)
 * @param {number} mgPerL - Concentration in mg/L
 * @param {string} ionKey - Ion name (e.g., 'na', 'cl', 'ca')
 * @returns {number} Molarity in mol/L
 */
export const convertToMolarity = (mgPerL, ionKey) => {
  const mw = MOLECULAR_WEIGHTS[ionKey.toLowerCase()];
  if (!mw) return 0;
  return mgPerL / (mw * 1000);
};

/**
 * Calculate ionic strength from ion composition
 * @param {object} ions - Ion concentrations {na, ca, mg, k, cl, so4, hco3} in mg/L
 * @returns {number} Ionic strength
 */
export const calculateIonicStrength = (ions) => {
  let sumMiZi2 = 0;
  
  Object.entries(ions).forEach(([ionKey, mgPerL]) => {
    if (!mgPerL) return;
    
    const molarity = convertToMolarity(mgPerL, ionKey);
    const charge = ION_CHARGES[ionKey.toLowerCase()] || 0;
    
    sumMiZi2 += molarity * (charge * charge);
  });
  
  return sumMiZi2 / 2;
};

/**
 * Calculate total molarity from ionic composition
 * @param {object} ions - Ion concentrations in mg/L
 * @returns {number} Total molarity
 */
export const calculateTotalMolarity = (ions) => {
  let totalMolarity = 0;
  
  Object.entries(ions).forEach(([ionKey, mgPerL]) => {
    if (!mgPerL) return;
    const molarity = convertToMolarity(mgPerL, ionKey);
    totalMolarity += molarity;
  });
  
  return totalMolarity;
};

/**
 * Calculate osmotic pressure from ionic composition (Van't Hoff equation)
 * π = i × M_total × R × T
 * @param {object} params - {ions, tempCelsius, iDissociation}
 * @returns {number} Osmotic pressure in bar
 */
export const calculateOsmoticPressureFromIons = (params) => {
  const {
    ions,
    tempCelsius = 25,
    iDissociation = 1.9
  } = params;
  
  const tempKelvin = tempCelsius + 273.15;
  const R = 0.08314; // bar·L/mol·K
  
  const totalMolarity = calculateTotalMolarity(ions);
  const osmotic = iDissociation * totalMolarity * R * tempKelvin;
  
  return osmotic;
};

/**
 * Get osmotic pressure contribution from specific ion
 * @param {string} ionKey - Ion name
 * @param {number} mgPerL - Ion concentration in mg/L
 * @param {number} tempCelsius - Temperature in °C
 * @returns {number} Osmotic pressure contribution in bar
 */
export const getIonOsmoticContribution = (ionKey, mgPerL, tempCelsius = 25) => {
  const tempKelvin = tempCelsius + 273.15;
  const R = 0.08314;
  const molarity = convertToMolarity(mgPerL, ionKey);
  const charge = Math.abs(ION_CHARGES[ionKey.toLowerCase()] || 0);
  
  return charge * molarity * R * tempKelvin;
};

// ============================================
// ADVANCED FLUX & SALT PASSAGE EQUATIONS
// ============================================

/**
 * Calculate permeate flux using improved equation
 * J = A × NDP
 * Where NDP = P_feed - π_avg - 0.5×ΔP
 * @param {object} params - {aValueActual, feedPressure, avgOsmotic, permeateOsmotic, systemDP}
 * @returns {number} Flux in LMH
 */
export const calculateFluxImproved = (params) => {
  const {
    aValueActual,
    feedPressure,
    avgOsmotic = 0,
    permeateOsmotic = 0,
    systemDP = 0
  } = params;
  
  const ndp = feedPressure - avgOsmotic - permeateOsmotic - (0.5 * systemDP);
  
  if (ndp <= 0) {
    return 0;
  }
  if (aValueActual <= 0) return 0;
  
  return aValueActual * Math.max(ndp, 0);
};

/**
 * Calculate salt passage with improved B-value method
 * J_s = B_actual × (C_avg)
 * @param {number} bValueActual - B-value at operating conditions
 * @param {number} avgFeedConcentration - Average feed concentration in mg/L
 * @returns {number} Salt passage in mg/L
 */
export const calculateSaltPassageAdvanced = (bValueActual, avgFeedConcentration) => {
  return bValueActual * avgFeedConcentration;
};

/**
 * Calculate permeate concentration from salt passage
 * @param {number} fluxLmh - Permeate flux in LMH
 * @param {number} saltPassageMgL - Salt passage in mg/L
 * @returns {number} Permeate concentration in mg/L
 */
export const calculatePermeateFromSaltPassage = (fluxLmh, saltPassageMgL) => {
  if (fluxLmh <= 0) return 0;
  return saltPassageMgL / fluxLmh;
};

// ============================================
// STAGE-BY-STAGE HYDRAULIC BALANCING
// ============================================

/**
 * Calculate stage-specific parameters with normalization
 * @param {object} params - {
 *   feedFlow, feedPressure, feedOsmotic, feedConc, feedIons,
 *   recovery, membrane, tempCelsius, stageIndex
 * }
 * @returns {object} Stage results with all parameters
 */
export const calculateStageHydraulics = (params) => {
  const {
    feedFlow,
    feedPressure,
    feedOsmotic,
    feedConc,
    feedIons = {},
    recovery = 0.5,
    membrane,
    tempCelsius = 25,
    stageIndex = 0,
    vessels = 1,
    elementsPerVessel = 4,
    fluxDeclinePercent = 0,
    membraneAgeYears = 0
  } = params;
  
  const permeateFlow = feedFlow * recovery;
  const concentrateFlow = feedFlow * (1 - recovery);
  
  const logMeanCF = calculateLogMeanCF(recovery);
  
  const dynamicAValue = calculateDynamicAValue({
    aValue25: membrane.aValue,
    tempCelsius,
    fluxDeclinePercent,
    membraneAgeYears
  });
  
  const dynamicBValue = calculateDynamicBValue({
    bValue25: membrane.membraneB,
    tempCelsius
  });
  
  const elements = vessels * elementsPerVessel;
  const flowPerVessel = feedFlow / Math.max(vessels, 1);
  
  const pressureDrop = calculatePressureDrop(
    flowPerVessel,
    elementsPerVessel,
    membrane.dpExponent || 1.22,
    membrane.nominalFlowDP || 15.5
  );
  
  const concentration = feedConc * logMeanCF;
  const concentrateOsmotic = calculateOsmoticPressure(concentration);
  const avgFeedOsmotic = (feedOsmotic + concentrateOsmotic) / 2;
  
  const permeateFlux = calculateFluxImproved({
    aValueActual: dynamicAValue,
    feedPressure,
    avgOsmotic: avgFeedOsmotic,
    systemDP: pressureDrop * vessels
  });
  
  const avgFeedConc = feedConc * logMeanCF;
  const saltPassage = calculateSaltPassageAdvanced(dynamicBValue, avgFeedConc);
  const permeateConc = calculatePermeateFromSaltPassage(permeateFlux, saltPassage);
  
  return {
    stageIndex,
    feedFlow,
    permeateFlow,
    concentrateFlow,
    feedPressure,
    feedOsmotic,
    avgFeedOsmotic,
    permeateOsmotic: calculateOsmoticPressure(permeateConc),
    pressureDrop: pressureDrop * vessels,
    flux: permeateFlux,
    recovery,
    logMeanCF,
    dynamicAValue,
    dynamicBValue,
    feedConc,
    permeateConc,
    concentrateConc: concentration,
    saltPassage,
    tempCelsius,
    vessels,
    elementsPerVessel,
    elements,
    flowPerVessel
  };
};

/**
 * Design multi-stage RO system (1-6 stages)
 * @param {object} params - Design specifications
 * @returns {object} Complete multi-stage design
 */
export const designMultiStageSystem = (params) => {
  const {
    feedFlow,
    feedPressure,
    feedOsmotic,
    feedConc,
    feedIons = {},
    targetRecovery = 0.75,
    maxRecoveryPerStage = 0.85,
    membrane,
    tempCelsius = 25,
    numStages = 2,
    fluxDeclinePercent = 0,
    membraneAgeYears = 0
  } = params;
  
  if (numStages < 1 || numStages > 6) {
    throw new Error('Number of stages must be between 1 and 6');
  }
  
  const stages = [];
  let currentFlow = feedFlow;
  let currentPressure = feedPressure;
  let currentOsmotic = feedOsmotic;
  let currentConc = feedConc;
  let totalRecovery = 0;
  let totalPressureDrop = 0;
  
  const stageRecoveries = distributeRecovery(targetRecovery, numStages, maxRecoveryPerStage);
  
  for (let i = 0; i < numStages; i++) {
    const stageRecovery = stageRecoveries[i];
    
    const stageResult = calculateStageHydraulics({
      feedFlow: currentFlow,
      feedPressure: currentPressure,
      feedOsmotic: currentOsmotic,
      feedConc: currentConc,
      feedIons,
      recovery: stageRecovery,
      membrane,
      tempCelsius,
      stageIndex: i,
      vessels: 2,
      elementsPerVessel: 4,
      fluxDeclinePercent,
      membraneAgeYears
    });
    
    stages.push(stageResult);
    
    totalRecovery = 1 - (1 - totalRecovery) * (1 - stageRecovery);
    totalPressureDrop += stageResult.pressureDrop;
    
    currentFlow = stageResult.concentrateFlow;
    currentPressure = currentPressure - stageResult.pressureDrop;
    currentOsmotic = calculateOsmoticPressure(stageResult.concentrateConc);
    currentConc = stageResult.concentrateConc;
  }
  
  const finalPermeateConc = stages[0].permeateConc;
  
  return {
    feedFlow,
    feedPressure,
    feedOsmotic,
    feedConc,
    numStages,
    stages,
    totalRecovery,
    totalPressureDrop,
    finalPressure: currentPressure,
    finalPermeateConc,
    finalConcentrateConc: currentConc,
    finalConcentrateFlow: currentFlow,
    totalPower: calculatePumpPower(feedPressure, feedFlow),
    valid: validateMultiStageDesign(stages, targetRecovery, currentPressure)
  };
};

/**
 * Distribute overall recovery across stages
 * @param {number} totalRecovery - Target overall recovery
 * @param {number} numStages - Number of stages
 * @param {number} maxPerStage - Max recovery per stage
 * @returns {array} Array of recovery rates per stage
 */
export const distributeRecovery = (totalRecovery, numStages, maxPerStage = 0.85) => {
  const recoveries = [];
  let remainingRecovery = totalRecovery;
  
  for (let i = 0; i < numStages; i++) {
    const stageRecovery = Math.min(
      remainingRecovery / (numStages - i),
      maxPerStage
    );
    recoveries.push(stageRecovery);
    remainingRecovery -= stageRecovery;
  }
  
  return recoveries;
};

/**
 * Validate multi-stage design
 * @param {array} stages - Stage array from design
 * @param {number} targetRecovery - Target recovery
 * @param {number} finalPressure - Final stage pressure
 * @returns {object} Validation results
 */
export const validateMultiStageDesign = (stages, targetRecovery, finalPressure) => {
  const issues = [];
  
  stages.forEach((stage, idx) => {
    if (stage.flux > 50) {
      issues.push(`Stage ${idx + 1}: Flux ${stage.flux.toFixed(1)} LMH exceeds practical limit`);
    }
    if (stage.recovery > 0.85) {
      issues.push(`Stage ${idx + 1}: Recovery ${(stage.recovery * 100).toFixed(1)}% exceeds recommended 85%`);
    }
    if (stage.pressureDrop > 3.5) {
      issues.push(`Stage ${idx + 1}: Pressure drop ${stage.pressureDrop.toFixed(2)} bar too high`);
    }
  });
  
  if (finalPressure < 0) {
    issues.push(`Design requires excessive pressure drop - increase vessel count or reduce recovery`);
  }
  
  return {
    valid: issues.length === 0,
    issues,
    warnings: []
  };
};
