import { getWaterTypeInfo, isMembraneCompatible } from './waterTypeConfig';
import { isGpmInput } from './calculatorService';
import * as MembraneEngine from '../engines/membraneEngine.js';

const { getMembrane, MEMBRANES } = MembraneEngine;

export const MEMBRANE_SPECIFIC_CONSTRAINTS = {
  'espa2ld': {
    fluxMin: 15,
    fluxMax: 50,
    recoveryMin: 40,
    recoveryMax: 75,
    pressureMin: 100,
    pressureMax: 600,
    optimalFlux: 30
  },
  'lfc3ld4040': {
    fluxMin: 12,
    fluxMax: 25,
    recoveryMin: 10,
    recoveryMax: 15,
    pressureMin: 100,
    pressureMax: 600,
    optimalFlux: 18
  },
  'cpa5ld8040': {
    fluxMin: 15,
    fluxMax: 53,
    recoveryMin: 40,
    recoveryMax: 75,
    pressureMin: 100,
    pressureMax: 600,
    optimalFlux: 35
  },
  'cpa3': {
    fluxMin: 12,
    fluxMax: 51.8,
    recoveryMin: 45,
    recoveryMax: 75,
    pressureMin: 100,
    pressureMax: 600,
    optimalFlux: 40
  },
  'lfc3ld8040': {
    fluxMin: 8,
    fluxMax: 35,
    recoveryMin: 40,
    recoveryMax: 85,
    pressureMin: 100,
    pressureMax: 600,
    optimalFlux: 18
  },
  'swtds32k8040': {
    fluxMin: 8,
    fluxMax: 42,
    recoveryMin: 35,
    recoveryMax: 50,
    pressureMin: 800,
    pressureMax: 1200,
    optimalFlux: 10
  }
};

export const DESIGN_CONSTRAINTS_BY_WATER_TYPE = {
  'Brackish Well Non-Fouling': {
    fluxMin: 10,
    fluxMax: 25,
    recoveryMin: 45,
    recoveryMax: 75,
    pressureMin: 150,
    pressureMax: 600,
    pretreatmentRequired: ['Cartridge Filter', 'Softener']
  },
  'Brackish Well High-Fouling': {
    fluxMin: 8,
    fluxMax: 18,
    recoveryMin: 40,
    recoveryMax: 65,
    pressureMin: 150,
    pressureMax: 600,
    pretreatmentRequired: ['Ultra Filtration', 'Cartridge Filter', 'Activated Carbon']
  },
  'Brackish Surface': {
    fluxMin: 8,
    fluxMax: 16,
    recoveryMin: 40,
    recoveryMax: 60,
    pressureMin: 150,
    pressureMax: 600,
    pretreatmentRequired: ['Coagulation', 'Filtration', 'Ultra Filtration']
  },
  'Sea Well': {
    fluxMin: 12,
    fluxMax: 20,
    recoveryMin: 35,
    recoveryMax: 50,
    pressureMin: 800,
    pressureMax: 1200,
    pretreatmentRequired: ['Multi-Media Filter', 'Ultra Filtration', 'Cartridge Filter']
  },
  'Sea Surface': {
    fluxMin: 10,
    fluxMax: 18,
    recoveryMin: 30,
    recoveryMax: 45,
    pressureMin: 800,
    pressureMax: 1200,
    pretreatmentRequired: ['Coagulation', 'Multi-Media Filter', 'Ultra Filtration']
  },
  'Municipal Waste': {
    fluxMin: 8,
    fluxMax: 15,
    recoveryMin: 40,
    recoveryMax: 60,
    pressureMin: 150,
    pressureMax: 600,
    pretreatmentRequired: ['Ultra Filtration', 'Cartridge Filter']
  },
  'Industrial Waste': {
    fluxMin: 6,
    fluxMax: 12,
    recoveryMin: 35,
    recoveryMax: 55,
    pressureMin: 150,
    pressureMax: 600,
    pretreatmentRequired: ['Ultra Filtration', 'Cartridge Filter', 'Pre-treatment specific to industry']
  },
  'RO Permeate': {
    fluxMin: 15,
    fluxMax: 35,
    recoveryMin: 50,
    recoveryMax: 85,
    pressureMin: 50,
    pressureMax: 300,
    pretreatmentRequired: []
  },
  'Well Water': {
    fluxMin: 10,
    fluxMax: 25,
    recoveryMin: 45,
    recoveryMax: 75,
    pressureMin: 150,
    pressureMax: 600,
    pretreatmentRequired: ['Cartridge Filter']
  }
};

export const validateDesignWithWaterType = (inputs, results, waterType) => {
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    recommendations: []
  };

  if (!waterType) {
    validation.warnings.push('⚠️ Water type not specified - design constraints cannot be fully validated');
    return validation;
  }

  const waterInfo = getWaterTypeInfo(waterType);
  if (!waterInfo) {
    validation.warnings.push(`⚠️ Unknown water type: ${waterType}`);
    return validation;
  }

  const {
    membraneModel = 'cpa3',
    tds = 2100,
    temp = 25,
    feedPh = 7.0,
    recovery = 50,
    flowUnit = 'gpm'
  } = inputs;

  const avgFlux = parseFloat(results?.avgFlux) || 0;
  const feedPressure = parseFloat(results?.feedPressure) || 0;
  const displayPressure = isGpmInput(flowUnit) ? feedPressure : feedPressure * 14.5038;

  const activeMembrane = getMembrane(membraneModel);
  const membraneId = (activeMembrane?.id || membraneModel || '').toLowerCase();
  const membraneConstraints = MEMBRANE_SPECIFIC_CONSTRAINTS[membraneId];
  const waterTypeConstraints = DESIGN_CONSTRAINTS_BY_WATER_TYPE[waterType];
  
  const constraints = {
    ...(waterTypeConstraints || {}),
    ...(membraneConstraints || {}),
    ...(activeMembrane?.maxFlux ? { fluxMax: activeMembrane.maxFlux } : {})
  };

  if (tds > waterInfo.tdsRange.max) {
    validation.errors.push(`TDS (${tds} mg/L) exceeds water type maximum (${waterInfo.tdsRange.max} mg/L)`);
    validation.isValid = false;
  }

  if (tds < waterInfo.tdsRange.min) {
    validation.warnings.push(`TDS (${tds} mg/L) is below typical range for ${waterType} (${waterInfo.tdsRange.min} mg/L)`);
  }

  if (constraints) {
    if (avgFlux > constraints.fluxMax) {
      validation.errors.push(`Flux (${avgFlux.toFixed(1)} LMH) exceeds recommended max (${constraints.fluxMax}) for ${activeMembrane?.name || waterType}`);
      validation.isValid = false;
    }

    if (avgFlux < constraints.fluxMin) {
      validation.warnings.push(`Flux (${avgFlux.toFixed(1)} LMH) below recommended min (${constraints.fluxMin}) for ${activeMembrane?.name || waterType}`);
    }

    if (recovery > constraints.recoveryMax) {
      validation.errors.push(`Recovery (${recovery}%) exceeds recommended max (${constraints.recoveryMax}%) for ${waterType}`);
      validation.isValid = false;
    }

    if (recovery < constraints.recoveryMin) {
      validation.warnings.push(`Recovery (${recovery}%) below recommended min (${constraints.recoveryMin}%) for ${waterType}`);
    }

    if (displayPressure > constraints.pressureMax) {
      validation.errors.push(`Pressure (${displayPressure.toFixed(0)} psi) exceeds recommended max (${constraints.pressureMax}) for ${waterType}`);
      validation.isValid = false;
    }

    if (displayPressure < constraints.pressureMin) {
      validation.warnings.push(`Pressure (${displayPressure.toFixed(0)} psi) below recommended min (${constraints.pressureMin}) for ${waterType}`);
    }
  }

  if (activeMembrane) {
    if (activeMembrane.maxTds && tds > activeMembrane.maxTds) {
      validation.errors.push(`TDS exceeds membrane maximum operating TDS (${tds} > ${activeMembrane.maxTds} mg/L)`);
      validation.isValid = false;
    }

    if (activeMembrane.maxTemp && temp > activeMembrane.maxTemp) {
      validation.errors.push(`Temperature (${temp}°C) exceeds membrane maximum (${activeMembrane.maxTemp}°C)`);
      validation.isValid = false;
    }

    if (activeMembrane.maxPressure && displayPressure > activeMembrane.maxPressure) {
      validation.errors.push(`Pressure (${displayPressure.toFixed(0)} psi) exceeds membrane maximum (${activeMembrane.maxPressure} psi)`);
      validation.isValid = false;
    }

    const isCompatible = isMembraneCompatible(membraneModel, waterType);
    if (!isCompatible) {
      validation.recommendations.push(`${activeMembrane.name} is not recommended for ${waterType}. Consider: ${getRecommendedMembraneName(waterType)}`);
    }
  }

  if (feedPh < 2 || feedPh > 10.8) {
    validation.errors.push(`pH (${feedPh}) is outside operating range (2.0 - 10.8)`);
    validation.isValid = false;
  }

  return validation;
};

export const getRecommendedMembraneName = (waterType) => {
  const waterInfo = getWaterTypeInfo(waterType);
  if (!waterInfo?.recommended) return 'contact supplier';
  
  return waterInfo.recommended
    .map(id => getMembrane(id)?.name)
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');
};

export const getWaterTypeAdjustedParameters = (waterType, baseParameters) => {
  const constraints = DESIGN_CONSTRAINTS_BY_WATER_TYPE[waterType];
  if (!constraints) return baseParameters;

  return {
    ...baseParameters,
    maxFlux: constraints.fluxMax,
    minFlux: constraints.fluxMin,
    maxRecovery: constraints.recoveryMax,
    minRecovery: constraints.recoveryMin,
    maxPressure: constraints.pressureMax,
    minPressure: constraints.pressureMin,
    requiredPretreatment: constraints.pretreatmentRequired
  };
};

export const checkPretreatmentAlignment = (waterType, appliedPretreatment) => {
  const constraints = DESIGN_CONSTRAINTS_BY_WATER_TYPE[waterType];

  if (!constraints?.pretreatmentRequired) {
    return { aligned: true, missing: [] };
  }

  const criticalSteps = ['Ultra Filtration', 'Coagulation'];
  const missing = constraints.pretreatmentRequired.filter(req => 
    criticalSteps.includes(req) && !appliedPretreatment?.includes?.(req)
  );

  return {
    aligned: missing.length === 0,
    missing,
    recommended: constraints.pretreatmentRequired
  };
};
