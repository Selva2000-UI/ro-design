/**
 * MEMBRANE ENGINE
 * 
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
    area: 80,
    areaM2: 7.43,
    description: 'Small area membrane element'
  },
  '8040': {
    category: '8040',
    area: 400,
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

/**
 * Complete Membrane Library
 * Every property is defined here, centralized management
 * Format: id → complete specification
 */
export const MEMBRANES = {
  espa2ld: {
    id: 'espa2ld',
    name: 'ESPA2-LD-4040',
    category: '4040',
    type: MEMBRANE_TYPES.BRACKISH,
    area: 80,
    areaM2: 7.43,
    aValue: 4.43,
    rejection: 99.6,
    dpExponent: 1.75,
    membraneB: 0.145,
    nominalFlowDP: 6.0,
    maxFlux: 50.0,
    maxTds: 2000,
    maxTemp: 45,
    maxPressure: 600,
    monoRejection: 96.0,
    divalentRejection: 99.7,
    silicaRejection: 98.0,
    boronRejection: 90.0,
    alkalinityRejection: 99.5,
    co2Rejection: 0.0
  },

  cpa3: {
    id: 'cpa3',
    name: 'CPA3',
    category: '8040',
    type: MEMBRANE_TYPES.BRACKISH,
    area: 400,
    areaM2: 37.17,
    aValue: 3.21,
    rejection: 99.7,
    dpExponent: 1.18,
    membraneB: 0.136,
    nominalFlowDP: 15.5,
    maxFlux: 51.8,
    maxTds: 2000,
    maxTemp: 45,
    maxPressure: 600,
    monoRejection: 98.0,
    divalentRejection: 99.9,
    silicaRejection: 99.0,
    boronRejection: 92.0,
    alkalinityRejection: 99.8,
    co2Rejection: 0.0
  },

  cpa5max8040: {
    id: 'cpa5max8040',
    name: 'CPA5-MAX-8040',
    category: '8040',
    type: MEMBRANE_TYPES.BRACKISH,
    area: 440,
    areaM2: 40.9,
    aValue: 3.35,
    rejection: 99.7,
    dpExponent: 1.18,
    membraneB: 0.134,
    nominalFlowDP: 17.0,
    maxFlux: 53.0,
    maxTds: 1500,
    maxTemp: 45,
    maxPressure: 600,
    monoRejection: 98.5,
    divalentRejection: 99.9,
    silicaRejection: 99.2,
    boronRejection: 93.0,
    alkalinityRejection: 99.8,
    co2Rejection: 0.0
  },

  cpa5ld4040: {
    id: 'cpa5ld4040',
    name: 'CPA5LD-4040',
    category: '4040',
    type: MEMBRANE_TYPES.LOW_FOULING,
    area: 80,
    areaM2: 7.43,
    aValue: 4.25,
    rejection: 99.7,
    dpExponent: 1.75,
    membraneB: 0.139,
    nominalFlowDP: 6.5,
    maxFlux: 50.0,
    maxTds: 1500,
    maxTemp: 45,
    maxPressure: 600,
    monoRejection: 98.5,
    divalentRejection: 99.9,
    silicaRejection: 99.2,
    boronRejection: 93.0,
    alkalinityRejection: 99.8,
    co2Rejection: 0.0
  },

  lfc3ld4040: {
    id: 'lfc3ld4040',
    name: 'LFC3-LD-4040',
    category: '4040',
    type: MEMBRANE_TYPES.LOW_FOULING,
    area: 80,
    areaM2: 7.43,
    aValue: 4.40,
    rejection: 99.7,
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
    monoRejection: 98.0,
    divalentRejection: 99.9,
    silicaRejection: 99.8,
    boronRejection: 98.0,
    alkalinityRejection: 99.8,
    co2Rejection: 0.0
  },

  bwtds2k8040: {
    id: 'bwtds2k8040',
    name: 'BW-TDS-2K-8040',
    category: '8040',
    type: MEMBRANE_TYPES.BRACKISH,
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
    monoRejection: 97.5,
    divalentRejection: 99.8,
    silicaRejection: 99.0,
    boronRejection: 91.0,
    alkalinityRejection: 99.7,
    co2Rejection: 0.0
  },

  bwtds5k8040: {
    id: 'bwtds5k8040',
    name: 'BW-TDS-5K-8040',
    category: '8040',
    type: MEMBRANE_TYPES.BRACKISH,
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
    monoRejection: 97.5,
    divalentRejection: 99.8,
    silicaRejection: 99.0,
    boronRejection: 91.0,
    alkalinityRejection: 99.7,
    co2Rejection: 0.0
  },

  bwtds10kfr8040: {
    id: 'bwtds10kfr8040',
    name: 'BW-TDS-10K-FR-8040',
    category: '8040',
    type: MEMBRANE_TYPES.FOULING_RESISTANT,
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
    maxCod: 250,
    monoRejection: 97.5,
    divalentRejection: 99.8,
    silicaRejection: 99.0,
    boronRejection: 91.0,
    alkalinityRejection: 99.7,
    co2Rejection: 0.0
  },

  swtds32k8040: {
    id: 'swtds32k8040',
    name: 'SW-TDS-32K-8040',
    category: '8040',
    type: MEMBRANE_TYPES.SEAWATER,
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
    monoRejection: 97.5,
    divalentRejection: 99.8,
    silicaRejection: 99.0,
    boronRejection: 91.0,
    alkalinityRejection: 99.7,
    co2Rejection: 0.0
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
  return MEMBRANES[membraneId] || null;
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
 * Get membrane maximum flux
 * @param {object} membrane - Membrane object
 * @returns {number} Maximum flux in LMH
 */
export const getMaxFlux = (membrane) => {
  if (!membrane) return 48.5; // Safe default
  return Number(membrane.maxFlux) || 48.5;
};

/**
 * Get membrane A-value (properly sanitized)
 * @param {object} membrane - Membrane object
 * @returns {number} A-value in LMH/bar
 */
export const getAValue = (membrane) => {
  if (!membrane) return 3.40;
  let a = Number(membrane.aValue);
  if (isNaN(a) || a <= 0) return 3.40;
  if (a < 1.0) return a * 24.62; // Convert gfd/psi to lmh/bar
  return a;
};

/**
 * Get membrane DP exponent
 * @param {object} membrane - Membrane object
 * @returns {number} DP exponent
 */
export const getDPExponent = (membrane) => {
  return Number(membrane?.dpExponent) || 1.22;
};

/**
 * Get membrane B coefficient
 * @param {object} membrane - Membrane object
 * @returns {number} Membrane B value
 */
export const getMembraneB = (membrane) => {
  return Number(membrane?.membraneB) || 0.14;
};

/**
 * Get ion-specific rejection for a membrane
 * @param {object} membrane - Membrane object
 * @param {string} ionKey - Ion key (e.g., 'ca', 'na', 'silica')
 * @returns {number} Rejection percentage (0-100)
 */
export const getIonRejection = (membrane, ionKey) => {
  const rejectionKey = `${ionKey.toLowerCase()}Rejection`;
  const baseRejection = Number(membrane?.rejection) || 99.7;
  
  if (membrane?.[rejectionKey]) {
    return Number(membrane[rejectionKey]);
  }
  
  // Smart defaults based on ion type
  if (['ca', 'mg', 'sr', 'ba', 'so4', 'po4'].includes(ionKey.toLowerCase())) {
    return baseRejection; // Divalent ions
  }
  if (['na', 'k', 'cl', 'no3', 'f'].includes(ionKey.toLowerCase())) {
    return baseRejection - 2; // Monovalent ions (slightly lower)
  }
  if (['hco3', 'co3'].includes(ionKey.toLowerCase())) {
    return baseRejection - 0.2; // Alkalinity
  }
  if (ionKey.toLowerCase() === 'co2') {
    return 0; // CO2 not rejected
  }
  
  return baseRejection;
};

/**
 * Check if membrane is suitable for water type
 * @param {object} membrane - Membrane object
 * @param {string} waterType - Water type (e.g., 'Seawater', 'Brackish')
 * @returns {boolean} True if suitable
 */
export const isMembraneSuitableForWaterType = (membrane, waterType) => {
  if (!membrane) return false;
  
  const suitability = {
    'Seawater': [MEMBRANE_TYPES.SEAWATER],
    'Sea Well': [MEMBRANE_TYPES.SEAWATER],
    'Sea Surface': [MEMBRANE_TYPES.SEAWATER],
    'Municipal Waste': [MEMBRANE_TYPES.FOULING_RESISTANT, MEMBRANE_TYPES.LOW_FOULING],
    'Industrial Waste': [MEMBRANE_TYPES.FOULING_RESISTANT, MEMBRANE_TYPES.LOW_FOULING],
    'Brackish Surface': [MEMBRANE_TYPES.BRACKISH, MEMBRANE_TYPES.LOW_FOULING, MEMBRANE_TYPES.FOULING_RESISTANT],
    'Brackish Well Non-Fouling': [MEMBRANE_TYPES.BRACKISH, MEMBRANE_TYPES.LOW_FOULING],
    'Brackish Well High-Fouling': [MEMBRANE_TYPES.FOULING_RESISTANT, MEMBRANE_TYPES.LOW_FOULING]
  };
  
  const suitable = suitability[waterType] || [];
  return suitable.includes(membrane.type);
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
    .filter(m => tds <= (m.maxTds || 10000))
    .map(m => m.id);
};

/**
 * Validate membrane compatibility with conditions
 * @param {object} membrane - Membrane object
 * @param {object} conditions - Operating conditions (tds, temp, pressure, flux)
 * @returns {object} Validation result
 */
export const validateMembraneConditions = (membrane, conditions = {}) => {
  const issues = [];
  
  if (conditions.tds && membrane.maxTds && conditions.tds > membrane.maxTds) {
    issues.push(`TDS (${conditions.tds}) exceeds max (${membrane.maxTds})`);
  }
  
  if (conditions.temp && membrane.maxTemp && conditions.temp > membrane.maxTemp) {
    issues.push(`Temperature (${conditions.temp}°C) exceeds max (${membrane.maxTemp}°C)`);
  }
  
  if (conditions.pressure && membrane.maxPressure && conditions.pressure > membrane.maxPressure) {
    issues.push(`Pressure (${conditions.pressure}) exceeds max (${membrane.maxPressure})`);
  }
  
  if (conditions.flux && membrane.maxFlux && conditions.flux > membrane.maxFlux) {
    issues.push(`Flux (${conditions.flux}) exceeds max (${membrane.maxFlux})`);
  }
  
  return {
    valid: issues.length === 0,
    issues
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
    area: spec.area || 400,
    areaM2: spec.areaM2 || 37.16,
    aValue: spec.aValue || 3.2,
    rejection: spec.rejection || 99.7,
    dpExponent: spec.dpExponent || 1.22,
    membraneB: spec.membraneB || 0.14,
    nominalFlowDP: spec.nominalFlowDP || 15.5,
    maxFlux: spec.maxFlux || 48.5,
    maxTds: spec.maxTds || 2000,
    maxTemp: spec.maxTemp || 45,
    maxPressure: spec.maxPressure || 600
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
    area: { mem1: mem1.area, mem2: mem2.area, winner: mem1.area > mem2.area ? 'mem1' : 'mem2' },
    aValue: { mem1: mem1.aValue, mem2: mem2.aValue, winner: mem1.aValue > mem2.aValue ? 'mem1' : 'mem2' },
    rejection: { mem1: mem1.rejection, mem2: mem2.rejection, winner: mem1.rejection > mem2.rejection ? 'mem1' : 'mem2' },
    maxFlux: { mem1: mem1.maxFlux, mem2: mem2.maxFlux, winner: mem1.maxFlux > mem2.maxFlux ? 'mem1' : 'mem2' },
    maxTds: { mem1: mem1.maxTds, mem2: mem2.maxTds, winner: mem1.maxTds > mem2.maxTds ? 'mem1' : 'mem2' }
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
      area: m.area,
      aValue: m.aValue,
      rejection: m.rejection,
      maxFlux: m.maxFlux,
      maxTds: m.maxTds
    };
  });
};
