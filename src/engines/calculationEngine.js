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
 * Calculate osmotic pressure from TDS - Industrial seawater polynomial model
 * Linear base: π(bar) = 0.0008 × TDS (valid for all TDS ranges, matches van't Hoff)
 * Seawater polynomial (TDS ≥ 10,000): π(bar) = 0.0008 × TDS + 1.5×10^-9 × TDS²
 * (Small polynomial correction for slight nonlinearity in concentrated seawater)
 * @param {number} tds - Total dissolved solids in mg/L
 * @param {string} unit - 'psi' or 'bar' (default: 'bar')
 * @param {boolean} usePolynomial - Use seawater polynomial model (default: auto-detect for TDS > 10000)
 * @returns {number} Osmotic pressure in specified unit
 */
export const calculateOsmoticPressure = (tds, unit = 'bar', usePolynomial = null) => {
  if (!tds || tds < 0) return 0;
  
  const isSeawater = usePolynomial !== null ? usePolynomial : (tds >= 10000);
  
  let osmoticBar;
  if (isSeawater) {
    osmoticBar = (0.0008 * tds) + (1.5e-9 * tds * tds);
  } else {
    osmoticBar = 0.0008 * tds;
  }
  
  if (unit === 'psi') {
    return osmoticBar * 14.5038;
  }
  return osmoticBar;
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

// ============================================
// ION REJECTION & WATER CHEMISTRY
// ============================================

/**
 * Calculate specific ion rejections based on membrane properties and flux
 * @param {object} feedIons - Feed ion concentrations (mg/L)
 * @param {number} globalRejection - Global TDS rejection (%)
 * @param {number} fluxLmh - Current operating flux (LMH)
 * @param {number} spFactor - Aging/fouling salt passage factor
 * @param {object} membrane - Membrane property object
 * @returns {object} { permeateIons, permeateTds }
 */
export const calculateIonComposition = (feedIons, globalRejection, fluxLmh, spFactor, membrane = {}) => {
  const testFluxLMH = 25; // Standard test flux
  const membraneRejection = Math.min(Math.max(Number(membrane.rejection) || globalRejection, 80), 99.9);
  
  // Rejection defaults based on ion valence and type
  const defaultMono = Math.max(Math.min((Number(membrane.monoRejection) || (membraneRejection - 6)), 99.9), 80);
  const defaultDivalent = Math.max(Math.min((Number(membrane.divalentRejection) || membraneRejection), 99.9), 80);
  const silicaRejection = Math.max(Math.min((Number(membrane.silicaRejection) || (membraneRejection - 1)), 99.9), 80);
  const boronRejection = Math.max(Math.min((Number(membrane.boronRejection) || (membraneRejection - 8)), 99.9), 60);
  const alkalinityRejection = Math.max(Math.min((Number(membrane.alkalinityRejection) || (membraneRejection - 0.2)), 99.9), 80);
  const co2Rejection = Math.max(Math.min((Number(membrane.co2Rejection) || 0), 99.9), 0);

  const getBaseRejection = (ionKey) => {
    const overrides = membrane.ionRejectionOverrides || {};
    if (overrides[ionKey] != null) return Number(overrides[ionKey]);
    if (['ca', 'mg', 'sr', 'ba', 'so4', 'po4'].includes(ionKey)) return defaultDivalent;
    if (['na', 'k', 'cl', 'no3', 'f'].includes(ionKey)) return defaultMono;
    if (['hco3', 'co3'].includes(ionKey)) return alkalinityRejection;
    if (ionKey === 'sio2') return silicaRejection;
    if (ionKey === 'b') return boronRejection;
    if (ionKey === 'co2') return co2Rejection;
    return membraneRejection;
  };

  const permeateIons = {};
  let permeateTds = 0;

  Object.entries(feedIons).forEach(([key, value]) => {
    const ionVal = Number(value) || 0;
    const rejection = getBaseRejection(key);
    const saltPassageTest = Math.max(1 - rejection / 100, 0);
    
    // Concentration polarization and flux-dependent salt passage
    // Simplified model: B = Flux_test * SP_test * AgeFactor
    // SP_actual = B / (Flux_actual + B)
    const ionB = testFluxLMH * saltPassageTest * spFactor;
    const ionSPActual = ionB / (Math.max(fluxLmh, 0.1) + ionB);
    
    // For permeate, we use average concentration across element which is feed * CF_avg
    // but here we just use the simplified SP * Feed for a single step calculation
    const permVal = ionVal * ionSPActual;
    permeateIons[key] = Number(permVal.toFixed(3));
    if (key !== 'co2') { // CO2 is dissolved gas, doesn't contribute to TDS typically
        permeateTds += permVal;
    }
  });

  return { permeateIons, permeateTds: Number(permeateTds.toFixed(2)) };
};

/**
 * Calculate saturation indices and scale potential
 * @param {object} ions - Ion concentrations in mg/L
 * @param {number} temp - Temperature in °C
 * @param {number} ph - pH value
 * @returns {object} Saturation results
 */
export const calculateWaterSaturations = (ions, temp, ph) => {
  const tds = Object.entries(ions).reduce((sum, [k, v]) => sum + (k === 'co2' ? 0 : Number(v) || 0), 0);
  
  const getNum = (key) => Number(ions[key]) || 0;
  
  const ca = getNum('ca');
  const hco3 = getNum('hco3');
  const so4 = getNum('so4');
  const sio2 = getNum('sio2');
  const ba = getNum('ba');
  const sr = getNum('sr');
  const po4 = getNum('po4');
  const f = getNum('f');

  // Langelier Saturation Index (LSI)
  // LSI = pH - pHs
  // pHs = (pK2 - pKs) + pCa + pAlk
  const pCa = 5.0 - Math.log10(Math.max(ca * 2.5, 0.0001));
  const pAlk = 5.0 - Math.log10(Math.max(hco3 * 0.82, 0.0001));
  const C = (Math.log10(Math.max(tds, 1)) - 1) / 10 + (temp > 25 ? 2.0 : 2.3);
  const phs = C + pCa + pAlk;
  const lsi = ph - phs;
  const ccpp = lsi > 0 ? lsi * 50 : 0;

  return {
    tds: Number(tds.toFixed(2)),
    lsi: Number(lsi.toFixed(2)),
    phs: Number(phs.toFixed(2)),
    ccpp: Number(ccpp.toFixed(2)),
    osmoticPressureBar: Number((tds * 0.0008).toFixed(3)),
    saturations: {
      caSo4: Number(((ca * so4) / 1000).toFixed(2)),
      baSo4: Number(((ba * so4) / 50).toFixed(2)),
      srSo4: Number(((sr * so4) / 2000).toFixed(2)),
      sio2: Number(((sio2 / 120) * 100).toFixed(2)),
      ca3po42: Number(((ca * po4) / 100).toFixed(2)),
      caF2: Number(((ca * f) / 500).toFixed(2))
    }
  };
};

export const calculateLogMeanCF = (recovery) => {
  if (recovery < 0.01) return 1;
  return -Math.log(1 - Math.min(recovery, 0.99)) / recovery;
};

/**
 * Calculate log-mean concentration (MANDATORY for industrial seawater)
 * Cavg = (Cc - Cf) / ln(Cc/Cf)
 * Where: Cc = Cf × 1/(1 - stageRecovery)
 * @param {number} feedConc - Feed concentration in mg/L
 * @param {number} recovery - Stage recovery fraction (0-1)
 * @returns {number} Log-mean concentration in mg/L
 */
export const calculateLogMeanConcentration = (feedConc, recovery) => {
  if (recovery < 0.01 || !feedConc || feedConc <= 0) return feedConc;
  
  const recoveryLimited = Math.min(recovery, 0.99);
  const cc = feedConc / (1 - recoveryLimited);
  
  if (cc <= feedConc || feedConc <= 0) return feedConc;
  
  const ratio = cc / feedConc;
  const lnRatio = Math.log(ratio);
  
  if (Math.abs(lnRatio) < 1e-10) return feedConc;
  
  return (cc - feedConc) / lnRatio;
};

/**
 * Calculate average osmotic pressure using LOG-MEAN CONCENTRATION (INDUSTRIAL SEAWATER REQUIRED)
 * Uses proper log-mean averaging instead of arithmetic mean
 * @param {number} feedTds - Feed TDS in mg/L
 * @param {number} recovery - Stage recovery fraction (0-1)
 * @param {string} unit - 'psi' or 'bar' (default: 'bar')
 * @param {boolean} usePolynomial - Force polynomial seawater model (auto-detect by default)
 * @returns {object} {feedOsmotic, concentrateOsmotic, avgOsmotic, logMeanConc, concentrationFactor}
 */
export const calculateAverageOsmoticPressureLogMean = (feedTds, recovery, unit = 'bar', usePolynomial = null) => {
  const recoveryLimited = Math.min(recovery, 0.99);
  const cf = 1 / (1 - recoveryLimited);
  
  const feedOsmotic = calculateOsmoticPressure(feedTds, unit, usePolynomial);
  const concentrateTds = feedTds * cf;
  const concentrateOsmotic = calculateOsmoticPressure(concentrateTds, unit, usePolynomial);
  
  const logMeanConc = calculateLogMeanConcentration(feedTds, recovery);
  const avgOsmotic = calculateOsmoticPressure(logMeanConc, unit, usePolynomial);
  
  return {
    feedOsmotic,
    concentrateOsmotic,
    avgOsmotic,
    logMeanConc,
    concentrationFactor: cf,
    concentrateTds
  };
};

/**
 * Calculate effective osmotic pressure (INDUSTRIAL SEAWATER MODEL)
 * Combines log-mean concentration with concentration polarization
 * π_eff = π(C_avg) × β
 * @param {number} feedOsmotic - Feed osmotic pressure
 * @param {number} logMeanCF - Log-mean concentration factor (or feed conc if calc separately)
 * @param {number} beta - Concentration polarization factor (1.1-1.6 typical)
 * @returns {number} Effective osmotic pressure
 */
export const calculateEffectiveOsmoticPressure = (feedOsmotic, logMeanCF, beta = 1.1) => {
  return feedOsmotic * logMeanCF * beta;
};

/**
 * Calculate concentration polarization factor β (INDUSTRIAL SEAWATER)
 * β = exp(Jw / k)
 * Where k = mass transfer coefficient (depends on crossflow, spacer, diffusion)
 * @param {object} params - {fluxLmh, spacerMil, crossflowMSec, ionicStrength}
 * @returns {number} Beta factor (typical 1.1-1.6, must be < 2.0)
 */
export const calculateConcentrationPolarization = (params) => {
  const {
    fluxLmh = 10,
    spacerMil = 34,
    crossflowMSec = null,
    ionicStrength = null,
    simplified = true
  } = params;
  
  if (simplified) {
    return Math.min(Math.exp(fluxLmh / 30), 1.6);
  }
  
  if (!crossflowMSec || !ionicStrength) {
    return Math.min(Math.exp(fluxLmh / 30), 1.6);
  }
  
  const diffusivity = 1.0e-5 * Math.pow(crossflowMSec, 0.5);
  const spacerThicknessM = (spacerMil * 0.0254) / 1000;
  
  const k = diffusivity / spacerThicknessM;
  
  const beta = Math.exp(Math.max(fluxLmh / k, 0));
  
  return Math.min(Math.max(beta, 1.0), 2.0);
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
// SALT PASSAGE & REJECTION CALCULATION (TRUE INDUSTRIAL MODEL)
// ============================================

/**
 * Calculate permeate concentration using TRUE industrial B/J transport model
 * Cp = (B_eff / J) × C_avg
 * Where: 
 *   B_eff = B × β (effective B considering concentration polarization)
 *   β = concentration polarization factor (typically 1.1-1.6 for seawater)
 *   C_avg = log-mean concentration across membrane
 * @param {object} params - {fluxLmh, bValue, feedConc, concentrateConc, beta=1.0}
 * @returns {number} Permeate TDS in mg/L
 */
export const calculatePermeateConcentrationIndustrial = ({
  fluxLmh,
  bValue,
  feedConc,
  concentrateConc,
  beta = 1.0
}) => {
  if (!fluxLmh || fluxLmh <= 0) return 0;
  if (!feedConc || feedConc <= 0) return 0;
  
  // Use LOG-MEAN concentration (INDUSTRIAL SEAWATER MODEL)
  // Log-mean correctly accounts for exponential concentration profile across membrane
  const ratio = concentrateConc / feedConc;
  let avgConc;
  
  if (ratio > 1.001) {
    avgConc = (concentrateConc - feedConc) / Math.log(ratio);
  } else {
    avgConc = (feedConc + concentrateConc) / 2;
  }
  
  // CRITICAL: Apply concentration polarization to B-value
  // B_eff = B × β (higher concentration at membrane surface due to boundary layer)
  const effectiveBValue = bValue * beta;
  
  // Salt transport: Cp = (B_eff/J) × C_avg
  return (effectiveBValue / fluxLmh) * avgConc;
};

/**
 * Calculate salt rejection percentage from concentrations
 * R = (1 - Cp/Cf) × 100
 * @param {number} feedConc - Feed concentration in mg/L
 * @param {number} permeateConc - Permeate concentration in mg/L
 * @returns {number} Rejection percentage (0-100)
 */
export const calculateRejectionPercent = (feedConc, permeateConc) => {
  if (!feedConc || feedConc <= 0) return 0;
  return Math.max(0, Math.min(100, (1 - permeateConc / feedConc) * 100));
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
    throw new Error(`Net Driving Pressure <= 0. Feed pressure (${feedPressure.toFixed(2)}) must exceed average osmotic pressure (${avgOsmotic.toFixed(2)}) + pressure drop effect.`);
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

/**
 * Validate seawater membrane flux (SW-TDS-32K-8040 specific)
 * Design: 10 LMH, Min: 8 LMH, Max: 12 LMH
 * @param {number} fluxLmh - Flux in LMH
 * @returns {object} {valid, warning, status}
 */
export const validateSeawaterFlux = (fluxLmh) => {
  const MIN_FLUX = 8;
  const DESIGN_FLUX = 10;
  const MAX_FLUX = 12;
  
  return {
    valid: fluxLmh >= MIN_FLUX && fluxLmh <= MAX_FLUX,
    warning: fluxLmh > MAX_FLUX ? '⚠️ High SW flux — rejection may drop' : null,
    status: fluxLmh < MIN_FLUX ? 'Too low' : (fluxLmh > MAX_FLUX ? 'Too high' : 'Optimal'),
    fluxLmh,
    designFlux: DESIGN_FLUX,
    minFlux: MIN_FLUX,
    maxFlux: MAX_FLUX
  };
};

/**
 * Validate hydraulic limits per element (INDUSTRIAL GRADE)
 * Per element: Feed < 16 m³/h, Min brine > 3 m³/h, ΔP < 1 bar
 * @param {object} params - {feedFlowPerElement, brineFlowPerElement, pressureDropBar}
 * @returns {object} Validation results with warnings
 */
export const validateHydraulicLimits = (params) => {
  const {
    feedFlowPerElement = 0,
    brineFlowPerElement = 0,
    pressureDropBar = 0
  } = params;
  
  const issues = [];
  const warnings = [];
  
  const MAX_FEED_FLOW = 16;
  const MIN_BRINE_FLOW = 3;
  const MAX_PRESSURE_DROP = 1.0;
  
  if (feedFlowPerElement > MAX_FEED_FLOW) {
    issues.push(`Feed flow ${feedFlowPerElement.toFixed(2)} m³/h > max ${MAX_FEED_FLOW} m³/h`);
  }
  
  if (brineFlowPerElement < MIN_BRINE_FLOW) {
    issues.push(`Brine flow ${brineFlowPerElement.toFixed(2)} m³/h < min ${MIN_BRINE_FLOW} m³/h`);
  }
  
  if (pressureDropBar > MAX_PRESSURE_DROP) {
    warnings.push(`Pressure drop ${pressureDropBar.toFixed(2)} bar exceeds recommended ${MAX_PRESSURE_DROP} bar`);
  }
  
  return {
    valid: issues.length === 0,
    issues,
    warnings,
    feedFlowPerElement,
    brineFlowPerElement,
    pressureDropBar
  };
};

/**
 * Calculate ionic-weighted B-value for salt passage (INDUSTRIAL SEAWATER)
 * Monovalent: ×1.0, Divalent: ×0.6, Silica: ×0.8, Boron: ×1.4
 * @param {object} params - {baseB, ionComposition}
 * @returns {number} Weighted B-value
 */
export const calculateIonicWeightedBValue = (params) => {
  const {
    baseB = 0.105,
    ionComposition = {}
  } = params;
  
  const monovalent = (ionComposition.na || 0) + (ionComposition.k || 0) + (ionComposition.cl || 0);
  const divalent = (ionComposition.ca || 0) + (ionComposition.mg || 0) + (ionComposition.so4 || 0);
  const silica = ionComposition.sio2 || 0;
  const boron = ionComposition.b || 0;
  
  const totalIons = monovalent + divalent + silica + boron;
  if (totalIons <= 0) return baseB;
  
  const weightedB = baseB * (
    (monovalent / totalIons) * 1.0 +
    (divalent / totalIons) * 0.6 +
    (silica / totalIons) * 0.8 +
    (boron / totalIons) * 1.4
  );
  
  return weightedB;
};

/**
 * Validate expected seawater performance (QUALITY CHECK)
 * For TDS=28000, Recovery=40%: Expect Rejection 97-99%, Permeate 300-700 mg/L
 * @param {object} params - {feedTds, recovery, rejectionPercent, permeateConc}
 * @returns {object} Performance assessment
 */
export const validateSeawaterPerformance = (params) => {
  const {
    feedTds = 28000,
    rejectionPercent = 99,
    permeateConc = 400
  } = params;
  
  const issues = [];
  const warnings = [];
  
  const MIN_REJECTION = 97;
  const MAX_REJECTION = 99.5;
  const MAX_PERMEATE_TDS = 1500;
  
  if (rejectionPercent < MIN_REJECTION) {
    issues.push(`Rejection ${rejectionPercent.toFixed(2)}% < acceptable minimum ${MIN_REJECTION}%`);
  }
  
  if (rejectionPercent > MAX_REJECTION) {
    warnings.push(`Rejection ${rejectionPercent.toFixed(2)}% seems unrealistically high`);
  }
  
  if (permeateConc > MAX_PERMEATE_TDS) {
    issues.push(`Permeate TDS ${permeateConc.toFixed(0)} mg/L > max ~${MAX_PERMEATE_TDS} mg/L`);
  }
  
  const expectedPermeate = feedTds * (1 - rejectionPercent / 100);
  const permeateDeviation = Math.abs(permeateConc - expectedPermeate) / expectedPermeate * 100;
  
  if (permeateDeviation > 20) {
    warnings.push(`Permeate TDS deviation ${permeateDeviation.toFixed(1)}% from expected`);
  }
  
  return {
    valid: issues.length === 0,
    issues,
    warnings,
    rejectionPercent,
    permeateConc,
    expectedPermeate: expectedPermeate.toFixed(0)
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
 * Calculate dynamic A-value with temperature, fouling, and aging (INDUSTRIAL GRADE)
 * Acorrected = Aref × TCF × foulingFactor × agingFactor
 * @param {object} params - {aValue25, tempCelsius, fluxDeclinePercent, membraneAgeYears, foulingFactor}
 * @returns {number} Actual A-value at operating conditions
 */
export const calculateDynamicAValue = (params) => {
  const {
    aValue25,
    tempCelsius = 25,
    fluxDeclinePercent = 0,
    membraneAgeYears = 0,
    foulingFactor = 1.0
  } = params;
  
  const tcf = calculateTCF(tempCelsius, 'A');
  const agingFactor = 1 - (fluxDeclinePercent / 100) * membraneAgeYears;
  
  return aValue25 * tcf * Math.max(agingFactor, 0.7) * foulingFactor;
};

/**
 * Calculate dynamic B-value with temperature correction (INDUSTRIAL GRADE)
 * Includes ionic weighting for different solutes
 * @param {object} params - {bValue25, tempCelsius, ionicWeighting, foulingFactor}
 * @returns {number} Actual B-value at operating conditions
 */
export const calculateDynamicBValue = (params) => {
  const {
    bValue25,
    tempCelsius = 25,
    ionicWeighting = 1.0,
    foulingFactor = 1.0
  } = params;
  
  const tcf = calculateTCF(tempCelsius, 'B');
  return bValue25 * tcf * ionicWeighting * foulingFactor;
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
    aValue25: membrane.transport?.aValueRef || membrane.aValue || 3.2,
    tempCelsius,
    fluxDeclinePercent,
    membraneAgeYears
  });
  
  const dynamicBValue = calculateDynamicBValue({
    bValue25: membrane.transport?.membraneBRef || membrane.membraneB || 0.14,
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
  
  const isSeawater = feedConc >= 10000;
  
  const osmPressureData = calculateAverageOsmoticPressureLogMean(feedConc, recovery, 'bar', isSeawater);
  const concentrateTds = osmPressureData.concentrateTds;
  const logMeanConc = osmPressureData.logMeanConc;
  
  const avgFeedOsmotic = osmPressureData.avgOsmotic;
  
  const permeateFlux = calculateFluxImproved({
    aValueActual: dynamicAValue,
    feedPressure,
    avgOsmotic: avgFeedOsmotic,
    systemDP: pressureDrop * vessels
  });
  
  // FIXED: Calculate beta using actual flux (not incorrect feedConc/100)
  const concentrationPolarization = calculateConcentrationPolarization({
    fluxLmh: Math.max(permeateFlux, 1),
    spacerMil: membrane.hydraulics?.spacerMil || 34,
    simplified: true
  });
  
  const permeateConc = calculatePermeateConcentrationIndustrial({
    fluxLmh: permeateFlux,
    bValue: dynamicBValue,
    feedConc,
    concentrateConc: concentrateTds,
    beta: concentrationPolarization
  });
  const rejectionPercent = calculateRejectionPercent(feedConc, permeateConc);
  
  return {
    stageIndex,
    feedFlow,
    permeateFlow,
    concentrateFlow,
    feedPressure,
    feedOsmotic,
    osmPressureData,
    logMeanConc,
    concentrationPolarization,
    avgFeedOsmotic,
    permeateOsmotic: calculateOsmoticPressure(permeateConc, 'bar', isSeawater),
    pressureDrop: pressureDrop * vessels,
    flux: permeateFlux,
    recovery,
    logMeanCF,
    dynamicAValue,
    dynamicBValue,
    feedConc,
    permeateConc,
    concentrateConc: concentrateTds,
    rejectionPercent,
    tempCelsius,
    vessels,
    elementsPerVessel,
    elements,
    flowPerVessel,
    isSeawater
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
    const isSeawater = stageResult.concentrateConc >= 10000;
    currentOsmotic = calculateOsmoticPressure(stageResult.concentrateConc, 'bar', isSeawater);
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

// ============================================
// 9-STEP RO CALCULATION PROCEDURE (IMS/WAVE Compatible)
// ============================================

/**
 * STEP 1: Calculate permeate and concentrate flows
 * @param {number} feedFlow - Feed flow in m³/h
 * @param {number} recovery - Recovery fraction (0-1)
 * @returns {object} {permeateFlow, concentrateFlow}
 */
export const step1_FlowBalance = (feedFlow, recovery) => {
  const permeateFlow = recovery * feedFlow;
  const concentrateFlow = feedFlow - permeateFlow;
  return { permeateFlow, concentrateFlow };
};

/**
 * STEP 2: Initial concentrate TDS approximation + Step 7: Refine with exact mass balance
 * Two-step process:
 * 1. Initial: Cc = Cf / (1 - R)
 * 2. Refined (after Cp calculated): Cc = (Qf×Cf - Qp×Cp) / Qc
 * @param {number} feedTds - Feed TDS
 * @param {number} recovery - Recovery fraction
 * @param {number} permeateFlow - Permeate flow
 * @param {number} concentrateFlow - Concentrate flow
 * @param {number} permeateTds - Permeate TDS (for refinement)
 * @returns {object} {initial, refined}
 */
export const step2_ConcentrateTDS = (feedTds, recovery, permeateFlow, concentrateFlow, permeateTds = null) => {
  const initial = feedTds / (1 - Math.min(recovery, 0.99));
  
  let refined = initial;
  if (permeateTds !== null && concentrateFlow > 0) {
    refined = (feedTds - (permeateFlow / (permeateFlow + concentrateFlow)) * permeateTds) / 
              (concentrateFlow / (permeateFlow + concentrateFlow));
  }
  
  return { initial, refined };
};

/**
 * STEP 3: Calculate total membrane area and flux
 * @param {number} numMembranes - Total number of membrane elements
 * @param {number} areaPerElement - Area per element in m²
 * @param {number} permeateFlow - Permeate flow in m³/h
 * @returns {object} {totalArea, fluxLmh}
 */
export const step3_MembraneAreaFlux = (numMembranes, areaPerElement, permeateFlow) => {
  const totalArea = numMembranes * areaPerElement;
  const fluxLmh = totalArea > 0 ? (permeateFlow * 1000) / totalArea : 0;
  return { totalArea, fluxLmh };
};

/**
 * STEP 4: Calculate average osmotic pressure
 * π_feed = 0.0008 × TDS (bar)
 * π_concentrate = 0.0008 × TDS_concentrate
 * π_avg = (π_feed + π_concentrate) / 2
 * @param {number} feedTds - Feed TDS in mg/L
 * @param {number} concentrateTds - Concentrate TDS in mg/L
 * @returns {object} {feedOsmotic, concentrateOsmotic, average}
 */
export const step4_OsmoticPressure = (feedTds, concentrateTds) => {
  const feedOsmotic = 0.0008 * feedTds;
  const concentrateOsmotic = 0.0008 * concentrateTds;
  const average = (feedOsmotic + concentrateOsmotic) / 2;
  return { feedOsmotic, concentrateOsmotic, average };
};

/**
 * STEP 5: Calculate required feed pressure
 * ΔP = J/A + π_avg
 * Where J is flux in LMH, A is A-value in LMH/bar
 * @param {number} flux - Flux in LMH
 * @param {number} aValue - A-value in LMH/bar
 * @param {number} avgOsmotic - Average osmotic pressure in bar
 * @returns {number} Feed pressure in bar
 */
export const step5_FeedPressure = (flux, aValue, avgOsmotic) => {
  const ndp = aValue > 0 ? flux / aValue : 0;
  return ndp + avgOsmotic;
};

/**
 * STEP 6: Calculate permeate TDS using B/J model
 * Cp = (B / J) × C_avg
 * Where C_avg = (Cf + Cc) / 2
 * @param {number} membraneB - B coefficient in LMH
 * @param {number} flux - Flux in LMH
 * @param {number} feedTds - Feed TDS
 * @param {number} concentrateTds - Concentrate TDS
 * @returns {number} Permeate TDS in mg/L
 */
export const step6_PermeateTDS = (membraneB, flux, feedTds, concentrateTds) => {
  if (flux <= 0) return 0;
  const avgConc = (feedTds + concentrateTds) / 2;
  return (membraneB / flux) * avgConc;
};

/**
 * STEP 8: Calculate salt rejection
 * R = (1 - Cp/Cf) × 100
 * @param {number} permeateTds - Permeate TDS
 * @param {number} feedTds - Feed TDS
 * @returns {number} Rejection percentage (0-100)
 */
export const step8_SaltRejection = (permeateTds, feedTds) => {
  if (feedTds <= 0) return 0;
  return (1 - (permeateTds / feedTds)) * 100;
};

/**
 * STEP 9: Calculate concentrate pressure
 * ΔP_drop ≈ k × (Q_vessel)^exponent
 * P_concentrate = P_feed - ΔP_drop
 * @param {number} feedPressure - Feed pressure in bar
 * @param {number} flowPerVessel - Flow per vessel in m³/h
 * @param {number} numElements - Number of elements per vessel
 * @param {number} dpCoefficient - Pressure drop coefficient (typical 0.0042)
 * @param {number} dpExponent - Pressure drop exponent (typical 1.22)
 * @returns {object} {pressureDrop, concentratePressure}
 */
export const step9_ConcentratePressure = (feedPressure, flowPerVessel, numElements, dpCoefficient = 0.0042, dpExponent = 1.22) => {
  const flowFactor = Math.pow(Math.max(flowPerVessel, 0.01), dpExponent);
  const pressureDrop = dpCoefficient * flowFactor * numElements;
  const concentratePressure = Math.max(feedPressure - pressureDrop, 0.01);
  return { pressureDrop, concentratePressure };
};

// ============================================
// SINGLE-PASS RO STAGE ENGINE (INDUSTRIAL)
// ============================================

/**
 * PHYSICALLY CONSISTENT RO STAGE ENGINE
 * Implements the 10-step industrial calculation procedure.
 * 
 * @param {object} inputs - { Qf, Cf, R, membraneType, T, A_ref, B_ref, Area, spacerThickness, elementsPerVessel, vesselsPerStage, waterType }
 * @returns {object} Results of the RO stage calculation
 */
export const calculateROStage = (inputs) => {
  const {
    Qf,                 // Feed Flow (m3/h)
    Cf,                 // Feed TDS (mg/L)
    R,                  // Permeate Recovery (fraction 0-1)
    T,                  // Temperature (°C)
    A_ref,              // Membrane A-value at 25°C (LMH/bar)
    B_ref,              // Membrane B-value (LMH)
    Area,               // Membrane Area per element (m2)
    elementsPerVessel = 6,
    vesselsPerStage = 1
  } = inputs;

  // STEP 2 — MASS BALANCE (ONLY ONCE)
  const Qp = Qf * R;
  const Qc = Qf - Qp;
  const Cc = Cf / (1 - Math.min(R, 0.99));
  // Do NOT apply beta here.

  // STEP 3 — LOG-MEAN BULK CONCENTRATION
  // Cavg = (Cc - Cf) / ln(Cc/Cf)
  const Cavg = (Cc - Cf) / Math.log(Cc / Cf);

  // STEP 4 — OSMOTIC PRESSURE (LOG-MEAN)
  // Use high-fidelity seawater polynomial model for accuracy
  const isSeawater = (inputs.waterType && inputs.waterType.toLowerCase().includes('sea')) || Cf >= 10000;
  const pi_f = calculateOsmoticPressure(Cf, 'bar', isSeawater);
  const pi_c = calculateOsmoticPressure(Cc, 'bar', isSeawater);
  
  let pi_avg;
  if (Math.abs(pi_c - pi_f) > 0.01) {
    pi_avg = (pi_c - pi_f) / Math.log(pi_c / pi_f);
  } else {
    pi_avg = (pi_f + pi_c) / 2;
  }

  // STEP 5 — TEMPERATURE CORRECTION (ONLY ONCE)
  const TCF = Math.exp(2640 * (1 / 298.15 - 1 / (T + 273.15)));
  const A = A_ref * TCF;
  // Do NOT apply TCF anywhere else.

  // STEP 6 — PRESSURE DROP (ONLY ONCE)
  // k_dp is a pressure drop coefficient.
  // Industrial seawater elements (34-mil) typically exhibit higher ΔP per element at equivalent flow.
  const k_dp = isSeawater ? 0.0082 : 0.0042; 
  const Q_vessel = Qf / vesselsPerStage;
  const deltaP_element = k_dp * Math.pow(Math.max(Q_vessel, 0.01), 1.22);
  const deltaP_vessel = deltaP_element * elementsPerVessel;
  const deltaP_system = deltaP_vessel;
  // Do NOT multiply by vessels again.

  // STEP 8 — FLUX (Calculated from recovery and area)
  const totalArea = vesselsPerStage * elementsPerVessel * Area;
  const J = totalArea > 0 ? (Qp * 1000) / totalArea : 0;

  // STEP 7 — NET DRIVING PRESSURE
  // NDP = Pfeed − πavg − 0.5ΔP
  // STEP 10 — FEED PRESSURE (IF SOLVING)
  // Pfeed = J/A + πavg + 0.5ΔP
  const Pfeed = (J / A) + pi_avg + (0.5 * deltaP_system);
  const NDP = Pfeed - pi_avg - (0.5 * deltaP_system);

  // STEP 9 — SALT TRANSPORT
  // k_mt (mass transfer coefficient) depends on spacer and conditions.
  // Standard industrial value for 34-mil seawater spacer at nominal flow: ~400 LMH
  const k_mt = 400; 
  let beta = Math.exp(J / k_mt);
  beta = Math.max(1.0, Math.min(1.4, beta)); // Clamp: 1.0 ≤ β ≤ 1.4
  
  const Csurface = beta * Cavg;
  const Cp = (B_ref / J) * Csurface;
  
  // Rejection: R = 1 − Cp/Cf
  const rejection = 1 - (Cp / Cf);

  // helper function
const round2 = (value) => 
  Number.isFinite(value) ? Number(value.toFixed(2)) : 0;

return {
  Qp: round2(Qp),
  Qc: round2(Qc),
  Cc: round2(Cc),
  Cavg: round2(Cavg),
  pi_f: round2(pi_f),
  pi_c: round2(pi_c),
  pi_avg: round2(pi_avg),
  TCF: round2(TCF),
  A: round2(A),
  deltaP_system: round2(deltaP_system),
  NDP: round2(NDP),
  J: round2(J),
  beta: round2(beta),
  Csurface: round2(Csurface),
  Cp: round2(Cp),
  rejection: round2(rejection),
  Pfeed: round2(Pfeed),
  totalArea: round2(totalArea)
};

  
};
