export const WATER_TYPES = {
  BRACKISH_WELL_NON_FOULING: 'Brackish Well Non-Fouling',
  BRACKISH_WELL_HIGH_FOULING: 'Brackish Well High-Fouling',
  BRACKISH_SURFACE: 'Brackish Surface',
  SEA_WELL: 'Sea Well',
  SEA_SURFACE: 'Sea Surface',
  MUNICIPAL_WASTE: 'Municipal Waste',
  INDUSTRIAL_WASTE: 'Industrial Waste',
  RO_PERMEATE: 'RO Permeate',
  WELL_WATER: 'Well Water'
};

export const MEMBRANE_CATEGORIES = {
  BRACKISH: 'Brackish',
  LOW_FOULING: 'Low Fouling',
  SEAWATER: 'Seawater',
  HYBRID: 'Hybrid'
};

export const WATER_TYPE_TO_MEMBRANES = {
  [WATER_TYPES.BRACKISH_WELL_NON_FOULING]: {
    recommended: ['cpa3', 'bwtds2k8040', 'bwtds5k8040'],
    category: MEMBRANE_CATEGORIES.BRACKISH,
    description: 'Low to moderate fouling potential, standard brackish water treatment',
    sdiMax: 5,
    tdsRange: { min: 500, max: 5000 },
    pretreatmentRequired: ['Cartridge Filter', 'Softener']
  },
  [WATER_TYPES.BRACKISH_WELL_HIGH_FOULING]: {
    recommended: ['lfc3ld4040', 'bwtds10kfr8040'],
    category: MEMBRANE_CATEGORIES.LOW_FOULING,
    description: 'High fouling potential from dissolved organics/colloids, requires low-fouling membrane',
    sdiMax: 3,
    tdsRange: { min: 500, max: 10000 },
    pretreatmentRequired: ['Ultra Filtration', 'Cartridge Filter', 'Activated Carbon']
  },
  [WATER_TYPES.BRACKISH_SURFACE]: {
    recommended: ['lfc3ld4040', 'bwtds10kfr8040', 'bwtds5k8040'],
    category: MEMBRANE_CATEGORIES.LOW_FOULING,
    description: 'Surface water with high organic load and variability, low-fouling recommended',
    sdiMax: 2,
    tdsRange: { min: 500, max: 5000 },
    pretreatmentRequired: ['Coagulation', 'Filtration', 'Ultra Filtration']
  },
  [WATER_TYPES.SEA_WELL]: {
    recommended: ['swtds32k8040'],
    category: MEMBRANE_CATEGORIES.SEAWATER,
    description: 'Seawater from subsurface wells, relatively stable composition',
    sdiMax: 3,
    tdsRange: { min: 15000, max: 42000 },
    pretreatmentRequired: ['Multi-Media Filter', 'Ultra Filtration', 'Cartridge Filter']
  },
  [WATER_TYPES.SEA_SURFACE]: {
    recommended: ['swtds32k8040'],
    category: MEMBRANE_CATEGORIES.SEAWATER,
    description: 'Surface seawater with high variability and organic content',
    sdiMax: 2,
    tdsRange: { min: 15000, max: 42000 },
    pretreatmentRequired: ['Coagulation', 'Multi-Media Filter', 'Ultra Filtration']
  },
  [WATER_TYPES.MUNICIPAL_WASTE]: {
    recommended: ['lfc3ld4040', 'bwtds10kfr8040'],
    category: MEMBRANE_CATEGORIES.LOW_FOULING,
    description: 'Treated municipal wastewater, requires low-fouling membrane',
    sdiMax: 2,
    tdsRange: { min: 1000, max: 8000 },
    pretreatmentRequired: ['Ultra Filtration', 'Cartridge Filter']
  },
  [WATER_TYPES.INDUSTRIAL_WASTE]: {
    recommended: ['lfc3ld4040', 'bwtds10kfr8040'],
    category: MEMBRANE_CATEGORIES.LOW_FOULING,
    description: 'Industrial wastewater recycle, high fouling potential',
    sdiMax: 2,
    tdsRange: { min: 2000, max: 15000 },
    pretreatmentRequired: ['Ultra Filtration', 'Cartridge Filter', 'Pre-treatment specific to industry']
  },
  [WATER_TYPES.RO_PERMEATE]: {
    recommended: ['cpa3', 'lfc3ld4040'],
    category: MEMBRANE_CATEGORIES.BRACKISH,
    description: 'RO permeate reprocessing for polishing, minimal fouling risk',
    sdiMax: 5,
    tdsRange: { min: 10, max: 500 },
    pretreatmentRequired: []
  },
  [WATER_TYPES.WELL_WATER]: {
    recommended: ['cpa3', 'bwtds2k8040', 'bwtds5k8040'],
    category: MEMBRANE_CATEGORIES.BRACKISH,
    description: 'Standard groundwater treatment',
    sdiMax: 5,
    tdsRange: { min: 300, max: 5000 },
    pretreatmentRequired: ['Cartridge Filter']
  }
};

export const MEMBRANE_SPECIFICATIONS = {
  cpa3: {
    name: 'CPA3-8040',
    size: '8"',
    area: 400,
    areaM2: 37.17,
    ratedFlow: 2.1,
    ratedFlowM3h: 7.95,
    saltRejection: 99.7,
    classification: MEMBRANE_CATEGORIES.BRACKISH,
    suitableFor: [WATER_TYPES.BRACKISH_WELL_NON_FOULING, WATER_TYPES.WELL_WATER, WATER_TYPES.RO_PERMEATE],
    constraints: {
      maxTds: 2000,
      maxTemp: 45,
      maxPressure: 600,
      maxFlow: 70
    }
  },
  lfc3ld4040: {
    name: 'LFC3-LD-4040',
    size: '4"',
    area: 80,
    areaM2: 7.43,
    ratedFlow: 0.5,
    ratedFlowM3h: 1.89,
    saltRejection: 99.7,
    classification: MEMBRANE_CATEGORIES.LOW_FOULING,
    suitableFor: [WATER_TYPES.BRACKISH_WELL_HIGH_FOULING, WATER_TYPES.BRACKISH_SURFACE, WATER_TYPES.MUNICIPAL_WASTE, WATER_TYPES.INDUSTRIAL_WASTE],
    constraints: {
      maxTds: 1500,
      maxTemp: 45,
      maxPressure: 600,
      maxFlow: 16,
      minBrineFlow: 3,
      maxPressureDrop: 15
    }
  },
  bwtds2k8040: {
    name: 'BW-TDS-2K-8040',
    size: '8"',
    area: 400,
    areaM2: 37.16,
    ratedFlow: 2.1,
    ratedFlowM3h: 7.95,
    saltRejection: 99.35,
    classification: MEMBRANE_CATEGORIES.BRACKISH,
    suitableFor: [WATER_TYPES.BRACKISH_WELL_NON_FOULING, WATER_TYPES.WELL_WATER],
    constraints: {
      maxTds: 2000,
      maxTemp: 45,
      maxPressure: 600,
      maxFlow: 85
    }
  },
  bwtds5k8040: {
    name: 'BW-TDS-5K-8040',
    size: '8"',
    area: 400,
    areaM2: 37.16,
    ratedFlow: 2.1,
    ratedFlowM3h: 7.95,
    saltRejection: 99.35,
    classification: MEMBRANE_CATEGORIES.BRACKISH,
    suitableFor: [WATER_TYPES.BRACKISH_WELL_NON_FOULING, WATER_TYPES.BRACKISH_SURFACE, WATER_TYPES.WELL_WATER],
    constraints: {
      maxTds: 5000,
      maxTemp: 45,
      maxPressure: 600,
      maxFlow: 85
    }
  },
  bwtds10kfr8040: {
    name: 'BW-TDS-10K-FR-8040',
    size: '8"',
    area: 400,
    areaM2: 37.16,
    ratedFlow: 2.1,
    ratedFlowM3h: 7.95,
    saltRejection: 99.35,
    classification: MEMBRANE_CATEGORIES.LOW_FOULING,
    suitableFor: [WATER_TYPES.BRACKISH_WELL_HIGH_FOULING, WATER_TYPES.BRACKISH_SURFACE, WATER_TYPES.MUNICIPAL_WASTE, WATER_TYPES.INDUSTRIAL_WASTE],
    constraints: {
      maxTds: 10000,
      maxTemp: 45,
      maxPressure: 600,
      maxFlow: 85,
      maxCod: 250
    }
  },
};

export const getMembranesByWaterType = (waterType) => {
  const config = WATER_TYPE_TO_MEMBRANES[waterType];
  if (!config) return [];
  return config.recommended;
};

export const getWaterTypeInfo = (waterType) => {
  return WATER_TYPE_TO_MEMBRANES[waterType] || null;
};

export const getMembraneBrief = (membraneId) => {
  return MEMBRANE_SPECIFICATIONS[membraneId] || null;
};

export const isMembraneCompatible = (membraneId, waterType) => {
  const membrane = MEMBRANE_SPECIFICATIONS[membraneId];
  if (!membrane) return false;
  return membrane.suitableFor.includes(waterType);
};

export const validateDesign = (waterType, membraneId, tds, sdi, temp) => {
  const waterInfo = getWaterTypeInfo(waterType);
  const membraneBrief = getMembraneBrief(membraneId);
  
  if (!waterInfo || !membraneBrief) return { valid: false, warnings: [] };

  const warnings = [];

  if (tds > waterInfo.tdsRange.max) {
    warnings.push(`⚠️ TDS (${tds}) exceeds water type max (${waterInfo.tdsRange.max})`);
  }
  
  if (sdi > waterInfo.sdiMax) {
    warnings.push(`⚠️ SDI (${sdi}) exceeds recommended max (${waterInfo.sdiMax})`);
  }

  if (tds > membraneBrief.constraints.maxTds) {
    warnings.push(`⚠️ TDS exceeds membrane max operating TDS (${membraneBrief.constraints.maxTds})`);
  }

  if (temp > membraneBrief.constraints.maxTemp) {
    warnings.push(`⚠️ Temperature exceeds membrane max (${membraneBrief.constraints.maxTemp}°C)`);
  }

  return {
    valid: warnings.length === 0,
    warnings,
    compatible: isMembraneCompatible(membraneId, waterType)
  };
};
