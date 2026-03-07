/*
 * MEMBRANE ENGINE
 * 
 * Industrial-grade membrane database and calculations
 * IMS/WAVE-class solver compatible
 * Centralized membrane management system.
 * - Single source of truth for all membrane properties
 * - Pure functions for membrane operations
 * - No business logic, only data and calculations
 * - Data-driven, easy to add new membranes
 * 
 * Migration Goal: Move all membrane-related logic here from scattered files
 */

// ============================================
// MEMBRANE DATABASE - Single Source of Truth
// ============================================

export const MEMBRANE_DATABASE = {
  '4040': {
    category: '4040',
    areaM2: 7.43,
    description: 'Small area membrane element'
  },
  '8040': {
    category: '8040',
    areaM2: 37.16,
    description: 'Standard membrane element'
  }
};

export const MEMBRANE_TYPES = {
  BRACKISH: 'Brackish',
  SEAWATER: 'Seawater',
  LOW_FOULING: 'Low Fouling',
  FOULING_RESISTANT: 'Fouling Resistant'
};

const DEFAULT_OSMOTIC_COEFF_BRACKISH = 0.0007925;
const DEFAULT_OSMOTIC_COEFF_SEAWATER = 0.00085;

/**
 * AUTOMATIC MEMBRANE CALIBRATION
 * Derives A and B transport parameters from manufacturer test data
 */
export const calculateA = (fluxLMH, pressureBar, tds, osmoticCoeff = 0.0007925, recovery = 0.15, isSeawater = false) => {
  const recoveryFraction = recovery > 1 ? recovery / 100 : recovery;
  const cf = 1 / Math.max(0.001, 1 - recoveryFraction);
  const cf_avg = recoveryFraction > 0.005 ? (cf - 1) / Math.log(cf) : (1 + cf) / 2;

  const k_mt = isSeawater ? 720 : 680;
  const beta = Math.exp(fluxLMH / k_mt);

  const osmoticPressureSurface = osmoticCoeff * tds * cf_avg * beta;
  const ndp = pressureBar - osmoticPressureSurface;
  
  if (ndp <= 0) return 0;
  // A = Jw / (P - Δπ_surface)
  return fluxLMH / ndp;
};

export const estimateMembraneB = (
  fluxLMH,
  tds,
  rejection,
  recovery,
  isSeawater = false,
  k_mt_ref = null
) => {
  // Normalize rejection input (99.5 or 0.995 both accepted)
  const rejectionFraction = rejection > 1 ? rejection / 100 : rejection;
  const saltPassage = 1 - rejectionFraction;

  // Convert recovery percent if needed
  const recoveryFraction = recovery > 1 ? recovery / 100 : recovery;

  // Concentration factor
  const cf = 1 / Math.max(0.001, 1 - recoveryFraction);

  // Log mean concentration factor
  const cf_avg = recoveryFraction > 0.005 
    ? (cf - 1) / Math.log(cf) 
    : (1 + cf) / 2;

  // Mass transfer coefficient (Industrial standard defaults)
  const k_mt = k_mt_ref || (isSeawater ? 720 : 680);

  // Concentration polarization factor
  const beta = Math.exp(fluxLMH / k_mt);

  // TDS correction (Salt permeability B increases with salinity)
  const bFactorTds = isSeawater ? 1.0 : 1.0 + 0.10 * (tds / 1000);

  const B_actual = (saltPassage * fluxLMH) / (cf_avg * beta - saltPassage);

  return B_actual / bFactorTds;
};

/**
 * Industrial-Grade Membrane Library
 * IMS/WAVE-class solver compatible
 * Single source of truth for membrane properties
 * Format: id → complete specification with test conditions, transport properties, and safety limits
 */
export const MEMBRANES = {
  espa2ld4040: {
    id: 'espa2ld4040',
    name: 'ESPA2-LD-4040',
    category: '4040',
    type: MEMBRANE_TYPES.BRACKISH,
    areaM2: 7.432,
    maxFlux: 50.0,
    calibration: {
      aMultiplier: 1.04
    },
    transport: {
      kMtRef: 450,
      soluteBFactors: {
        monovalent: 3.6,
        divalent: 0.1,
        silica: 0.8,
        boron: 1.4,
        co2: 999
      }
    },
    testConditions: {
      pressureBar: 10.3,
      temperatureC: 25,
      tds: 1500,
      recovery: 0.15,
      fluxLMH: 40.3,
      rejection: 0.996
    },
    hydraulics: {
      maxFeedFlowM3H: 3.6,
      minConcentrateFlowM3H: 0.7,
      maxElementRecovery: 0.15,
      maxPressureDropBar: 1.0,
      spacerMil: 34
    },
    pressureDropModel: {
      coefficient: 0.117, // Calibrated for 4040 vessels
      exponent: 1.20
    },
    designFlux: {
      min: 20,
      max: 40,
      recommended: 28
    },
    agingModel: {
      annualFluxDecline: 0.05,
      foulingFactorDefault: 1.0
    },
    osmoticModel: {
      type: 'industrial-linear',
      coefficient: 0.00078, // Calibrated for high-rejection brackish standards
      formula: 'π(bar) = 0.00078 × TDS',
      note: 'Calculated via calculateOsmoticPressure(tds, "bar")'
    },
    limits: {
      maxTds: 2000,
      maxTemp: 45,
      maxPressure: 600
    },
    compatibleWaterTypes: [
      'Brackish Well Non-Fouling',
      'Brackish Surface',
      'Municipal'
    ]
  },

  cpa3: {
    id: 'cpa3',
    name: 'CPA3-8040',
    category: '8040',
    type: MEMBRANE_TYPES.BRACKISH,
    areaM2: 37.16,
    rejection: 0.9970,
    maxFlux: 51.8,
    calibration: {
      aMultiplier: 1.00
    },
    transport: {
      kMtRef: 450,
      soluteBFactors: {
        monovalent: 1.25, 
        divalent: 0.6,
        silica: 0.8,
        boron: 1.4,
        co2: 999
      }
    },
    testConditions: {
      pressureBar: 15.5,
      temperatureC: 25,
      tds: 1500,
      recovery: 0.15,
      fluxLMH: 46.7,
      rejection: 0.9970
    },
    hydraulics: {
      maxFeedFlowM3H: 16,
      minConcentrateFlowM3H: 3,
      maxElementRecovery: 0.20,
      maxPressureDropBar: 1.0,
      spacerMil: 34
    },
    pressureDropModel: {
      coefficient: 0.0035, // Calibrated for CPA3 8040 vessel
      exponent: 1.70
    },
    designFlux: {
      min: 18,
      max: 35,
      recommended: 28
    },
    agingModel: {
      annualFluxDecline: 0.05,
      foulingFactorDefault: 1.0
    },
    osmoticModel: {
      type: 'industrial-linear',
      coefficient: 0.0007925,
      formula: 'π(bar) = 0.0007925 × TDS',
      note: 'Calculated via calculateOsmoticPressure(tds, "bar")'
    },
    limits: {
      maxTds: 2000,
      maxTemp: 45,
      maxPressure: 600
    },
    compatibleWaterTypes: [
      'Brackish Well Non-Fouling',
      'Brackish Surface',
      'Municipal'
    ]
  },

  cpa5ld8040: {
    id: 'cpa5ld8040',
    name: 'CPA5-LD-8040',
    category: '8040',
    type: MEMBRANE_TYPES.BRACKISH,
    areaM2: 37.16, // 400 sq ft
    maxFlux: 120.0,
    calibration: {
      aMultiplier: 0.975 // Aligned to 43.7 bar @ 112 LMH Case 1 (Industrial)
    },
    transport: {
      kMtRef: 680, // Matches beta 1.08 @ 112 LMH and 1.04 @ 18 LMH
      soluteBFactors: {
        monovalent: 1.25, // Aligned to Case 2 average (11.2 mg/l)
        divalent: 0.1,
        silica: 0.8,
        boron: 1.4,
        co2: 999
      }
    },
    testConditions: {
      pressureBar: 15.5,
      temperatureC: 25,
      tds: 1500,
      recovery: 0.15,
      fluxLMH: 46.7,
      rejection: 0.9970
    },
    hydraulics: {
      maxFeedFlowM3H: 70,
      minConcentrateFlowM3H: 3,
      maxElementRecovery: 0.30,
      maxPressureDropBar: 1.2,
      spacerMil: 34
    },
    pressureDropModel: {
      coefficient: 0.0022, // Matches 11.7 bar drop Case 1 and 2.7 psi drop Screenshot
      exponent: 1.70
    },
    designFlux: {
      min: 18,
      max: 35,
      recommended: 28
    },
    agingModel: {
      annualFluxDecline: 0.05,
      foulingFactorDefault: 1.0
    },
    osmoticModel: {
      type: 'industrial-linear',
      coefficient: 0.0007925,
      formula: 'π(bar) = 0.0007925 × TDS',
      note: 'Calculated via calculateOsmoticPressure(tds, "bar")'
    },
    limits: {
      maxTds: 5000,
      maxTemp: 45,
      maxPressure: 600
    },
    compatibleWaterTypes: [
      'Brackish Well Non-Fouling',
      'Brackish Surface',
      'Municipal'
    ]
  },

  lfc3ld4040: {
    id: 'lfc3ld4040',
    name: 'LFC3-LD-4040',
    category: '4040',
    type: MEMBRANE_TYPES.LOW_FOULING,
    areaM2: 7.432,
    maxFlux: 48.0,
    calibration: {
      aMultiplier: 1.00
    },
    transport: {
      kMtRef: 750,
      soluteBFactors: {
        monovalent: 2.3, 
        divalent: 0.6,
        silica: 0.75,
        boron: 1.3,
        co2: 999
      }
    },
    testConditions: {
      pressureBar: 10.3,
      temperatureC: 25,
      tds: 1500,
      recovery: 0.15,
      fluxLMH: 38.2,
      rejection: 0.9970
    },
    hydraulics: {
      maxFeedFlowM3H: 3.6,
      minConcentrateFlowM3H: 0.7,
      maxElementRecovery: 0.15,
      maxPressureDropBar: 1.0,
      spacerMil: 34
    },
    pressureDropModel: {
      coefficient: 0.117, // Calibrated for 4040 vessels
      exponent: 1.20
    },
    designFlux: {
      min: 20,
      max: 40,
      recommended: 28
    },
    agingModel: {
      annualFluxDecline: 0.05,
      foulingFactorDefault: 1.0
    },
    osmoticModel: {
      type: 'industrial-linear',
      coefficient: 0.00078, // Calibrated for high-rejection brackish standards
      formula: 'π(bar) = 0.00078 × TDS',
      note: 'Calculated via calculateOsmoticPressure(tds, "bar")'
    },
    limits: {
      maxTds: 2000,
      maxTemp: 45,
      maxPressure: 600
    },
    compatibleWaterTypes: [
      'Brackish Well Non-Fouling',
      'Brackish Surface',
      'Municipal'
    ]
  },

  lfc3ld8040: {
    id: 'lfc3ld8040',
    name: 'LFC3-LD-8040',
    category: '8040',
    type: MEMBRANE_TYPES.LOW_FOULING,
    areaM2: 37.16,
    maxFlux: 48.0,
    calibration: {
      aMultiplier: 1.03
    },
    transport: {
      kMtRef: 750,
      soluteBFactors: {
        monovalent: 2.3, 
        divalent: 0.6,
        silica: 0.75,
        boron: 1.3,
        co2: 999
      }
    },
    testConditions: {
      pressureBar: 15.5,
      temperatureC: 25,
      tds: 1500,
      recovery: 0.15,
      fluxLMH: 28,
      rejection: 0.9961
    },
    hydraulics: {
      maxFeedFlowM3H: 16,
      minConcentrateFlowM3H: 3,
      maxElementRecovery: 0.15,
      maxPressureDropBar: 1.0,
      spacerMil: 34
    },
    pressureDropModel: {
      coefficient: 0.0030, // Calibrated for high-flow 8040 vessel
      exponent: 1.70
    },
    designFlux: {
      min: 20,
      max: 40,
      recommended: 28
    },
    agingModel: {
      annualFluxDecline: 0.03,
      foulingFactorDefault: 0.95
    },
    osmoticModel: {
      type: 'industrial-linear',
      coefficient: 0.0007925,
      formula: 'π(bar) = 0.0007925 × TDS',
      note: 'Calculated via calculateOsmoticPressure(tds, "bar")'
    },
    limits: {
      maxTds: 6000,
      maxTemp: 45,
      maxPressure: 600
    },
    compatibleWaterTypes: [
      'Brackish Well Non-Fouling',
      'Brackish Well High-Fouling',
      'Brackish Surface',
      'Municipal Waste',
      'Industrial Waste'
    ]
  },

  bwtds2k8040: {
    id: 'bwtds2k8040',
    name: 'BW-TDS-2K-8040',
    category: '8040',
    type: MEMBRANE_TYPES.BRACKISH,
    areaM2: 37.16,
    calibration: {
      aMultiplier: 1.38
    },
    transport: {
      kMtRef: 450,
      soluteBFactors: {
        monovalent: 1.25, 
        divalent: 0.4,
        silica: 0.8,
        boron: 1.4,
        co2: 999
      }
    },
    testConditions: {
      pressureBar: 10.3,
      temperatureC: 25,
      tds: 1500,
      recovery: 0.15,
      fluxLMH: 40.37,
      rejection: 0.9935
    },
    hydraulics: {
      maxFeedFlowM3H: 16,
      minConcentrateFlowM3H: 3,
      maxElementRecovery: 0.20,
      maxPressureDropBar: 1.0,
      spacerMil: 34
    },
    pressureDropModel: {
      coefficient: 0.0030, // Calibrated for high-flow 8040 vessel
      exponent: 1.70
    },
    designFlux: {
      min: 12,
      max: 25,
      recommended: 18
    },
    agingModel: {
      annualFluxDecline: 0.05,
      foulingFactorDefault: 1.0
    },
    osmoticModel: {
      type: 'industrial-linear',
      coefficient: 0.0008,
      formula: 'π(bar) = 0.0008 × TDS',
      note: 'Calculated via calculateOsmoticPressure(tds, "bar")'
    },
    limits: {
      maxTds: 2000,
      maxTemp: 45,
      maxPressure: 600
    },
    compatibleWaterTypes: [
      'Brackish Well Non-Fouling',
      'Brackish Surface'
    ]
  },

  bwtds5k8040: {
    id: 'bwtds5k8040',
    name: 'BW-TDS-5K-8040',
    category: '8040',
    type: MEMBRANE_TYPES.BRACKISH,
    areaM2: 37.16,
    calibration: {
      aMultiplier: 1.38
    },
    transport: {
      kMtRef: 450,
      soluteBFactors: {
        monovalent: 1.25, 
        divalent: 0.4,
        silica: 0.8,
        boron: 1.4,
        co2: 999
      }
    },
    testConditions: {
      pressureBar: 15.5,
      temperatureC: 25,
      tds: 2000,
      recovery: 0.15,
      fluxLMH: 40.37,
      rejection: 0.9935
    },
    hydraulics: {
      maxFeedFlowM3H: 16,
      minConcentrateFlowM3H: 3,
      maxElementRecovery: 0.20,
      maxPressureDropBar: 1.0,
      spacerMil: 34
    },
    pressureDropModel: {
      coefficient: 0.0030, // Calibrated for high-flow 8040 vessel
      exponent: 1.70
    },
    designFlux: {
      min: 10,
      max: 18,
      recommended: 14
    },
    agingModel: {
      annualFluxDecline: 0.05,
      foulingFactorDefault: 1.0
    },
    osmoticModel: {
      type: 'industrial-linear',
      coefficient: 0.0008,
      formula: 'π(bar) = 0.0008 × TDS',
      note: 'Calculated via calculateOsmoticPressure(tds, "bar")'
    },
    limits: {
      maxTds: 5000,
      maxTemp: 45,
      maxPressure: 600
    },
    compatibleWaterTypes: [
      'Brackish Well Non-Fouling',
      'Brackish Surface'
    ]
  },

  bwtds10kfr8040: {
    id: 'bwtds10kfr8040',
    name: 'BW-TDS-10K-FR-8040',
    category: '8040',
    type: MEMBRANE_TYPES.FOULING_RESISTANT,
    areaM2: 37.16,
    calibration: {
      aMultiplier: 1.45
    },
    transport: {
      kMtRef: 750,
      soluteBFactors: {
        monovalent: 1.6, 
        divalent: 0.4,
        silica: 0.8,
        boron: 1.4,
        alkalinity: 2.1,
        co2: 999
      }
    },
    testConditions: {
      pressureBar: 15.5,
      temperatureC: 25,
      tds: 2000,
      recovery: 0.15,
      fluxLMH: 40.37,
      rejection: 0.9940
    },
    hydraulics: {
      maxFeedFlowM3H: 16,
      minConcentrateFlowM3H: 3,
      maxElementRecovery: 0.20,
      maxPressureDropBar: 1.0,
      spacerMil: 34
    },
    pressureDropModel: {
      coefficient: 0.00119, // Calibrated for high-flux benchmark (104 bar @ 187.5 m3/h per vessel)
      exponent: 1.70
    },
    designFlux: {
      min: 10,
      max: 18,
      recommended: 14
    },
    agingModel: {
      annualFluxDecline: 0.05,
      foulingFactorDefault: 1.0
    },
    osmoticModel: {
      type: 'industrial-linear',
      coefficient: 0.0008,
      formula: 'π(bar) = 0.0008 × TDS',
      note: 'Calculated via calculateOsmoticPressure(tds, "bar")'
    },
    limits: {
      maxTds: 10000,
      maxTemp: 45,
      maxPressure: 600
    },
    compatibleWaterTypes: [
      'Brackish Well Non-Fouling',
      'Brackish Surface',
      'Municipal'
    ]
  },

  swtds32k8040: {
    id: 'swtds32k8040',
    name: 'SW-TDS-32K-8040',
    category: '8040',
    type: MEMBRANE_TYPES.SEAWATER,
    areaM2: 37.16,
    maxFlux: 42.0,
    calibration: {
      aMultiplier: 1.02
    },
    transport: {
      kMtRef: 400,
      soluteBFactors: {
        monovalent: 1.4,
        divalent: 0.6,
        silica: 0.8,
        boron: 1.4,
        alkalinity: 1.8,
        co2: 999
      }
    },
    testConditions: {
      pressureBar: 55.16,
      temperatureC: 25,
      tds: 32000,
      recovery: 0.08,
      fluxLMH: 34.77,
      rejection: 0.9985
    },
    hydraulics: {
      maxFeedFlowM3H: 16,
      minConcentrateFlowM3H: 3,
      maxElementRecovery: 0.10,
      maxPressureDropBar: 1.0,
      spacerMil: 34
    },
    pressureDropModel: {
      coefficient: 0.012, // Calibrated for 3.5 psi drop @ 32.14 gpm (2 elements)
      exponent: 1.22
    },
    designFlux: {
      min: 8,
      max: 12,
      recommended: 10
    },
    agingModel: {
      annualFluxDecline: 0.05,
      foulingFactorDefault: 0.95
    },
    osmoticModel: {
      type: 'seawater-linear',
      coefficient: 0.00085, // Calibrated for seawater pi calculation (matches polynomial 27.2 bar @ 32k)
      formula: 'π(bar) = 0.00085 × TDS',
      note: 'Industrial seawater model. Calibrated for 20k-40k TDS range.'
    },
    limits: {
      maxTds: 40000,
      maxTemp: 45,
      maxPressure: 1200
    },
    compatibleWaterTypes: [
      'Seawater',
      'Sea Well',
      'Sea Surface'
    ]
  }
};

// ============================================
// PURE FUNCTIONS - Membrane Operations
// ============================================

/**
 * Get membrane by ID
 * @param {string} membraneId - Membrane ID (e.g., 'cpa3')
 * @returns {object|null} Membrane object or null if not found
 */
export const getMembrane = (membraneId) => {
  if (!membraneId) return null;
  
  // 1. Direct match
  if (MEMBRANES[membraneId]) return MEMBRANES[membraneId];
  
  // 2. Normalized match (lowercase, no dashes)
  const id = membraneId.toLowerCase().replace(/-/g, '');
  if (MEMBRANES[id]) return MEMBRANES[id];
  
  // 3. Search by name or normalized ID in values
  return Object.values(MEMBRANES).find(m => 
    m.id.toLowerCase().replace(/-/g, '') === id || 
    m.name.toLowerCase().replace(/-/g, '') === id
  ) || null;
};

/**
 * Get all membranes
 * @returns {array} Array of all membrane objects
 */
export const getAllMembranes = () => {
  return Object.values(MEMBRANES);
};

/**
 * Get membranes by type
 * @param {string} type - Membrane type (e.g., 'Brackish', 'Seawater')
 * @returns {array} Filtered membranes
 */
export const getMembranesByType = (type) => {
  return Object.values(MEMBRANES).filter(m => m.type === type);
};

/**
 * Get membranes by category
 * @param {string} category - Membrane category (e.g., '4040', '8040')
 * @returns {array} Filtered membranes
 */
export const getMembranesByCategory = (category) => {
  return Object.values(MEMBRANES).filter(m => m.category === category);
};

/**
 * Get membrane area in m2 (sanitized)
 * @param {object} membrane - Membrane object
 * @returns {number} Area in m2
 */
export const getArea = (membrane) => {
  if (!membrane) return 37.16;
  
  const is4040 = 
    (membrane.id && membrane.id.toLowerCase().includes('4040')) || 
    (membrane.name && membrane.name.toLowerCase().includes('4040')) ||
    membrane.category === '4040';

  const is8040 = 
    (membrane.id && membrane.id.toLowerCase().includes('8040')) || 
    (membrane.name && membrane.name.toLowerCase().includes('8040')) ||
    membrane.category === '8040';

  let area = Number(membrane.areaM2);
  if (area > 0) return area;

  // Use area property (sq ft) if present
  if (membrane.area) {
     const areaVal = Number(membrane.area);
     // If it's a 4040 but area is 400, it's a mismatch in the data, it should be ~80
     if (is4040 && areaVal > 300) return 7.432; 
     if (is8040 && areaVal < 300) return 37.16;
     return areaVal * 0.09290304;
  }
  
  if (is4040) return 7.432;
  return 37.16;
};

/**
 * Get membrane A-value (properly sanitized)
 * @param {object} membrane - Membrane object
 * @returns {number} A-value in LMH/bar
 */
export const getAValue = (membrane) => {
  if (!membrane) return 3.40;
  
  // 1. Try explicit reference value
  let a = Number(membrane.transport?.aValueRef) || Number(membrane.aValue);
  
  // 2. Dynamic calibration from test conditions if reference missing
  if ((isNaN(a) || a <= 0) && membrane.testConditions) {
    const tc = membrane.testConditions;
    const isSeawater = membrane.type === MEMBRANE_TYPES.SEAWATER;
    const osmoticCoeff = membrane.osmoticModel?.coefficient || (isSeawater ? DEFAULT_OSMOTIC_COEFF_SEAWATER : DEFAULT_OSMOTIC_COEFF_BRACKISH);
    const aMultiplier = membrane.calibration?.aMultiplier || 1.0;
    
    a = calculateA(tc.fluxLMH, tc.pressureBar, tc.tds, osmoticCoeff, tc.recovery, isSeawater) * aMultiplier;
  }
  
  if (isNaN(a) || a <= 0) {
    return membrane.category === '4040' ? 3.11 : 3.40;
  }
  return a;
};

/**
 * Get membrane B coefficient (physically dominant transport parameter)
 * @param {object} membrane - Membrane object
 * @param {object} inputs - Optional simulation inputs for dynamic calibration {tds, feedPressure, recovery, flux}
 * @returns {number} Membrane B value
 */
export const getMembraneB = (membrane, inputs = null) => {
  if (!membrane) return 0.14;
  
  const bRef = membrane?.transport?.membraneBRef || membrane?.membraneB;
  
  // If it's a function (dynamic calibrator), call it with inputs or defaults
  if (typeof bRef === 'function') {
    const A = getAValue(membrane);
    const pressure = inputs?.feedPressure ? Number(inputs.feedPressure) : (membrane?.testConditions?.pressureBar || 55.16);
    const tds = inputs?.tds ? Number(inputs.tds) : (membrane?.testConditions?.tds || 32000);
    const rejection = membrane.rejection || membrane?.testConditions?.rejection || 0.9985;
    return bRef(A, pressure, tds, rejection);
  }

  // If reference value exists, use it
  if (bRef && !isNaN(Number(bRef)) && Number(bRef) > 0) {
    return Number(bRef);
  }

  // Dynamic calibration from test conditions if reference missing
  if (membrane.testConditions) {
    const tc = membrane.testConditions;
    const isSeawater = membrane.type === MEMBRANE_TYPES.SEAWATER;
    const kMtRef = membrane.transport?.kMtRef || (isSeawater ? 720 : 1000);
    
    return estimateMembraneB(
      tc.fluxLMH, 
      tc.tds, 
      tc.rejection, 
      tc.recovery, 
      isSeawater, 
      kMtRef
    );
  }
  
  return 0.14;
};

/**
 * Get ion-specific B factor (solute permeability multiplier)
 * @param {object} membrane - Membrane object
 * @param {string} ionKey - Ion key
 * @returns {number} B-factor for ion (0-2.0 range typically)
 */
export const getIonBFactor = (membrane, ionKey) => {
  const factors = membrane?.transport?.soluteBFactors || {};
  const ionLower = ionKey.toLowerCase();
  
  if (ionLower === 'co2') return factors.co2 || 999;
  if (['hco3', 'co3'].includes(ionLower)) {
    return factors.alkalinity || factors.monovalent || 1.0;
  }
  if (['ca', 'mg', 'sr', 'ba', 'so4', 'po4'].includes(ionLower)) {
    return factors.divalent || 0.6;
  }
  if (['silica', 'sio2'].includes(ionLower)) {
    return factors.silica || 0.8;
  }
  if (['boron', 'h3bo3', 'b'].includes(ionLower)) {
    return factors.boron || 1.4;
  }
  
  return factors.monovalent || 1.0;
};

/**
 * Calculate A-value at actual conditions (from test reference)
 * Industrial-grade normalization: A_actual = J_test / (P_test - π_avg_test)
 * @param {object} membrane - Membrane object
 * @param {number} testPressureBar - Test pressure in bar
 * @param {number} testOsmoticBar - Test osmotic pressure in bar
 * @returns {number} Actual A-value
 */
export const calculateActualAValue = (membrane, testPressureBar, testOsmoticBar) => {
  if (!membrane?.testConditions) {
    return getAValue(membrane);
  }
  
  const testFlux = Number(membrane.testConditions.fluxLMH) || 28;
  const testNdp = testPressureBar - testOsmoticBar;
  
  if (testNdp <= 0) return getAValue(membrane);
  
  return testFlux / testNdp;
};

/**
 * Get design flux range for membrane
 * @param {object} membrane - Membrane object
 * @returns {object} {min, max, recommended}
 */
export const getDesignFluxRange = (membrane) => {
  return membrane?.designFlux || { min: 10, max: 30, recommended: 20 };
};

/**
 * Get hydraulic limits for element
 * @param {object} membrane - Membrane object
 * @returns {object} Hydraulic constraints
 */
export const getHydraulicLimits = (membrane) => {
  return membrane?.hydraulics || {
    maxFeedFlowM3H: 16,
    minConcentrateFlowM3H: 3,
    maxElementRecovery: 0.20,
    maxPressureDropBar: 1.0,
    spacerMil: 34
  };
};

/**
 * Check if membrane is suitable for water type
 * @param {object} membrane - Membrane object
 * @param {string} waterType - Water type
 * @returns {boolean} True if suitable
 */
export const isMembraneSuitableForWaterType = (membrane, waterType) => {
  if (!membrane) return false;
  
  const compatible = membrane?.compatibleWaterTypes || [];
  return compatible.includes(waterType) || compatible.includes('All');
};

/**
 * Get recommended membranes for water type
 * @param {string} waterType - Water type
 * @param {number} tds - Total dissolved solids
 * @returns {array} Recommended membrane IDs
 */
export const getRecommendedMembranes = (waterType, tds = 0) => {
  return Object.values(MEMBRANES)
    .filter(m => isMembraneSuitableForWaterType(m, waterType))
    .filter(m => tds <= (m.limits?.maxTds || 10000))
    .map(m => m.id);
};

/**
 * Enhanced validation with critical safety checks
 * @param {object} membrane - Membrane object
 * @param {object} conditions - {tds, temp, pressure, flux, feedFlowM3h, recoveryPct, elementCount}
 * @returns {object} {valid, critical, warnings}
 */
export const validateMembraneConditions = (membrane, conditions = {}) => {
  const critical = [];
  const warnings = [];
  
  if (!membrane) {
    critical.push('Membrane not found');
    return { valid: false, critical, warnings };
  }
  
  const limits = membrane.limits || {};
  const hydraulics = membrane.hydraulics || {};
  const designFlux = membrane.designFlux || {};
  
  if (conditions.tds && limits.maxTds && conditions.tds > limits.maxTds) {
    critical.push(`TDS (${conditions.tds}) exceeds max (${limits.maxTds})`);
  }
  
  if (conditions.temp && limits.maxTemp && conditions.temp > limits.maxTemp) {
    critical.push(`Temperature (${conditions.temp}°C) exceeds max (${limits.maxTemp}°C)`);
  }
  
  if (conditions.pressure && limits.maxPressure && conditions.pressure > limits.maxPressure) {
    critical.push(`Pressure (${conditions.pressure}) exceeds max (${limits.maxPressure})`);
  }
  
  if (conditions.flux) {
    if (conditions.flux < 3) {
      critical.push(`Flux ${conditions.flux} LMH: Below minimum 3 LMH`);
    }
    if (conditions.flux > 25 && membrane.type === MEMBRANE_TYPES.BRACKISH) {
      critical.push(`Flux ${conditions.flux} LMH: Exceeds brackish water safe limit of 25 LMH`);
    }
    if (conditions.flux < designFlux.min) {
      warnings.push(`Flux ${conditions.flux} below design minimum ${designFlux.min} LMH`);
    }
    if (conditions.flux > designFlux.max) {
      warnings.push(`Flux ${conditions.flux} above design maximum ${designFlux.max} LMH`);
    }
  }
  
  if (conditions.feedFlowM3h && hydraulics.maxFeedFlowM3H && conditions.feedFlowM3h > hydraulics.maxFeedFlowM3H) {
    critical.push(`Feed flow ${conditions.feedFlowM3h} m³/h exceeds max ${hydraulics.maxFeedFlowM3H} m³/h`);
  }
  
  if (conditions.elementRecovery && hydraulics.maxElementRecovery && conditions.elementRecovery > hydraulics.maxElementRecovery) {
    critical.push(`Element recovery ${(conditions.elementRecovery * 100).toFixed(1)}% exceeds max ${(hydraulics.maxElementRecovery * 100).toFixed(0)}%`);
  }
  
  if (conditions.pressureDrop && hydraulics.maxPressureDropBar && conditions.pressureDrop > hydraulics.maxPressureDropBar) {
    critical.push(`Pressure drop ${conditions.pressureDrop} bar exceeds max ${hydraulics.maxPressureDropBar} bar per element`);
  }
  
  return {
    valid: critical.length === 0,
    critical,
    warnings
  };
};

/**
 * Create custom membrane (for user-added membranes)
 * @param {object} spec - Membrane specification
 * @returns {object} Validated membrane object
 */
export const createCustomMembrane = (spec) => {
  if (!spec.id || !spec.name) {
    throw new Error('Membrane must have id and name');
  }
  
  return {
    id: spec.id,
    name: spec.name,
    category: spec.category || '8040',
    type: spec.type || MEMBRANE_TYPES.BRACKISH,
    areaM2: spec.areaM2 || 37.16,
    transport: {
      aValueRef: spec.aValue || 3.2,
      membraneBRef: typeof spec.membraneB === 'function' ? spec.membraneB : (A, P, TDS, SP) => estimateMembraneB(A, P, TDS, SP || spec.rejection || 0.996),
      soluteBFactors: spec.soluteBFactors || {
        monovalent: 1.0,
        divalent: 0.6,
        silica: 0.8,
        boron: 1.4,
        co2: 999
      }
    },
    testConditions: spec.testConditions || {
      pressureBar: 15.5,
      temperatureC: 25,
      tds: 2000,
      recovery: 0.15,
      fluxLMH: 28
    },
    hydraulics: spec.hydraulics || {
      maxFeedFlowM3H: 16,
      minConcentrateFlowM3H: 3,
      maxElementRecovery: 0.20,
      maxPressureDropBar: 1.0,
      spacerMil: 34
    },
    pressureDropModel: spec.pressureDropModel || {
      coefficient: 0.0042,
      exponent: 1.22
    },
    designFlux: spec.designFlux || {
      min: 12,
      max: 25,
      recommended: 18
    },
    agingModel: spec.agingModel || {
      annualFluxDecline: 0.05,
      foulingFactorDefault: 1.0
    },
    osmoticModel: spec.osmoticModel || {
      type: 'industrial-linear',
      formula: 'π(bar) = 0.0008 × TDS',
      note: 'Calculated via calculateOsmoticPressure(tds, "bar")'
    },
    limits: spec.limits || {
      maxTds: 2000,
      maxTemp: 45,
      maxPressure: 600
    },
    compatibleWaterTypes: spec.compatibleWaterTypes || [
      'Brackish Well Non-Fouling',
      'Brackish Surface'
    ]
  };
};

/**
 * Compare two membranes
 * @param {object} mem1 - First membrane
 * @param {object} mem2 - Second membrane
 * @returns {object} Comparison result
 */
export const compareMembranes = (mem1, mem2) => {
  if (!mem1 || !mem2) return null;
  
  return {
    name1: mem1.name,
    name2: mem2.name,
    aValue: { 
      mem1: getAValue(mem1), 
      mem2: getAValue(mem2), 
      winner: getAValue(mem1) > getAValue(mem2) ? 'mem1' : 'mem2' 
    },
    membraneB: { 
      mem1: getMembraneB(mem1), 
      mem2: getMembraneB(mem2), 
      winner: getMembraneB(mem1) < getMembraneB(mem2) ? 'mem1' : 'mem2' 
    },
    area: { 
      mem1: mem1.areaM2, 
      mem2: mem2.areaM2, 
      winner: mem1.areaM2 > mem2.areaM2 ? 'mem1' : 'mem2' 
    },
    designFlux: { 
      mem1: mem1.designFlux?.recommended, 
      mem2: mem2.designFlux?.recommended 
    },
    maxTds: { 
      mem1: mem1.limits?.maxTds, 
      mem2: mem2.limits?.maxTds, 
      winner: mem1.limits?.maxTds > mem2.limits?.maxTds ? 'mem1' : 'mem2' 
    }
  };
};

/**
 * Get membrane-specific pressure drop coefficient
 * @param {object} membrane - Membrane object
 * @returns {number} Pressure drop coefficient
 */
export const getKdp = (membrane) => {
  if (!membrane) return 0.0042;
  if (membrane.pressureDropModel?.coefficient) return membrane.pressureDropModel.coefficient;
  
  // High-fidelity fallback based on category
  const category = membrane.category || '';
  if (category === '4040') return 0.082; // Standard 4040 calibrated coefficient
  
  if (membrane.nominalFlowDP) {
    const exp = getPExp(membrane);
    return membrane.nominalFlowDP / Math.pow(16.0, exp);
  }
  return 0.0042;
};

/**
 * Get membrane-specific mass transfer coefficient
 * @param {object} membrane - Membrane object
 * @returns {number} Mass transfer coefficient
 */
export const getKmt = (membrane) => {
  if (membrane?.transport?.kMtRef) return membrane.transport.kMtRef;
  const isSeawater = (membrane?.type === MEMBRANE_TYPES.SEAWATER || membrane?.id?.toLowerCase().includes('sw'));
  return isSeawater ? 720 : 1000;
};

/**
 * Get membrane-specific osmotic pressure coefficient
 * @param {object} membrane - Membrane object
 * @returns {number} Osmotic coefficient
 */
export const getOsmoticCoefficient = (membrane) => {
  if (membrane?.osmoticModel?.coefficient) return membrane.osmoticModel.coefficient;
  const isSeawater = (membrane?.type === MEMBRANE_TYPES.SEAWATER);
  return isSeawater ? 0.0007925 : 0.00077;
};

/**
 * Get pressure drop exponent for membrane
 * @param {object} m - Membrane object
 * @returns {number} exponent
 */
export const getPExp = (m) => {
  if (m?.pressureDropModel?.exponent) return m.pressureDropModel.exponent;
  if (m?.dpExponent) return m.dpExponent;
  
  const category = m?.category || '';
  if (category === '4040') return 1.40; // Standard 4040 calibrated exponent
  return 1.22;
};

/**
 * Calculate ion rejection and permeate concentration
 * Industrial-grade solute transport model
 * 
 * @param {object} membrane - Membrane object
 * @param {object} feedIons - { Na: 12000, Cl: 18000, Ca: 400, ... }
 * @param {number} fluxLMH - Water flux (LMH)
 * @param {number} beta - Concentration polarization factor (1.0–2.0)
 * @param {number} recovery - Element recovery (fraction 0-1)
 * @returns {object} { ionResults, permeateTDS, averageRejection }
 */
export const calculateIonTransport = (membrane, feedIons, fluxLMH, beta = 1.0, recovery = 0.15) => {

  const baseB = getMembraneB(membrane);
  const results = {};
  
  // Account for concentration factor along the element
  const cf = 1 / Math.max(0.001, 1 - recovery);
  const cf_avg = recovery > 0.005 ? (cf - 1) / Math.log(cf) : (1 + cf) / 2;

  const totalFeedTDS = Object.values(feedIons).reduce((sum, val) => sum + val, 0);
  let totalPermeateTDS = 0;

  Object.entries(feedIons).forEach(([ion, feedConc]) => {

    const ionBFactor = getIonBFactor(membrane, ion);
    const Bion = baseB * ionBFactor;

    // Cm = Cf * CF_avg * beta
    const Cmembrane = feedConc * cf_avg * beta;

    // Salt transport B corrected for TDS
    const isSeawater = (membrane?.type === MEMBRANE_TYPES.SEAWATER);
    const bFactorTds = isSeawater ? 1.0 : 1.0 + 0.10 * (totalFeedTDS / 1000);
    const BionOperating = Bion * bFactorTds;

    let Cp;

    if (ion.toLowerCase() === 'co2') {
      Cp = feedConc; // Dissolved gas passes 100%
    } else {

      // ✅ CORRECT RO SOLUTION-DIFFUSION EQUATION
      // Cp = (B / (Flux + B)) * Cm
      Cp = (BionOperating / (fluxLMH + BionOperating)) * Cmembrane;

    }

    const rejection = feedConc > 0
      ? 1 - (Cp / feedConc)
      : 0;

    results[ion] = {
      feed: feedConc,
      permeate: Cp,
      rejection: rejection
    };

    totalPermeateTDS += Cp;

  });

  const averageRejection = totalFeedTDS > 0
    ? 1 - (totalPermeateTDS / totalFeedTDS)
    : 0;

  return {
    ionResults: results,
    permeateTDS: totalPermeateTDS,
    averageRejection
  };
};

/**
 * Validate ion transport results for industrial safety
 * @param {object} transportResult - Result from calculateIonTransport
 * @param {object} membrane - Membrane object
 * @returns {object} { safe, warnings }
 */
export const validateIonTransportResult = (transportResult, membrane) => {
  const warnings = [];
  
  if (membrane.type === MEMBRANE_TYPES.SEAWATER) {
    if (getMembraneB(membrane) > 0.15) {
      warnings.push("Seawater B too high (>0.15) — rejection may fall below 97%");
    }
    if (transportResult.averageRejection < 0.96) {
      warnings.push("Seawater rejection unusually low. Check B scaling or flux.");
    }
  }
  
  if (membrane.type === MEMBRANE_TYPES.BRACKISH && transportResult.averageRejection < 0.85) {
    warnings.push("Brackish rejection unusually low. Verify feed water quality.");
  }
  
  return {
    safe: warnings.length === 0,
    warnings
  };
};

/**
 * Get membrane specifications as table data
 * @param {array} membraneIds - Array of membrane IDs
 * @returns {array} Table row data
 */
export const getMembranesToTableData = (membraneIds) => {
  return membraneIds.map(id => {
    const m = getMembrane(id);
    return {
      id: m.id,
      name: m.name,
      type: m.type,
      category: m.category,
      areaM2: m.areaM2,
      aValue: getAValue(m),
      membraneB: getMembraneB(m),
      designFlux: m.designFlux?.recommended,
      maxTds: m.limits?.maxTds
    };
  });
};
