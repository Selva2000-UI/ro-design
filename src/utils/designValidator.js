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
    fluxMax: 120,
    recoveryMin: 5,
    recoveryMax: 50,
    pressureMin: 100,
    pressureMax: 600,
    optimalFlux: 112
  },
  'swtds32k8040': {
    fluxMin: 8,
    fluxMax: 42,
    recoveryMin: 35,
    recoveryMax: 50,
    pressureMin: 800,
    pressureMax: 1200,
    optimalFlux: 10
  },
  'swc5ld8040': {
    fluxMin: 8,
    fluxMax: 14,
    recoveryMin: 8,
    recoveryMax: 12,
    pressureMin: 600,
    pressureMax: 1200,
    optimalFlux: 10
  },
  'proxr18040': {
    fluxMin: 16,
    fluxMax: 30,
    recoveryMin: 10,
    recoveryMax: 18,
    pressureMin: 100,
    pressureMax: 600,
    optimalFlux: 22
  },
  'bwtds10kfr8040': {
    fluxMin: 10,
    fluxMax: 500,
    recoveryMin: 5,
    recoveryMax: 50,
    pressureMin: 100,
    pressureMax: 1200,
    optimalFlux: 144
  }
};

export const DESIGN_CONSTRAINTS_BY_WATER_TYPE = {
  'Brackish Well Non-Fouling': {
    avgFluxMax: 27,
    elementFluxMax: 46,
    fluxDeclineTypical: 5,
    saltPassageIncreaseTypical: 7,
    betaStandard: 1.2,
    betaFullFit: 1.5,
    recoveryMax: 75,
    lsiMax: 2.5,
    caSo4Max: 400,
    srSo4Max: 1200,
    baSo4Max: 10000,
    ca3po42Max: 2.4,
    sio2Max: 140,
    caF2Max: 50000
  },
  'Brackish Well High-Fouling': {
    avgFluxMax: 22,
    elementFluxMax: 32,
    fluxDeclineTypical: 7,
    saltPassageIncreaseTypical: 7,
    betaStandard: 1.2,
    betaFullFit: 1.5,
    recoveryMax: 65,
    lsiMax: 2.5,
    caSo4Max: 400,
    srSo4Max: 1200,
    baSo4Max: 10000,
    ca3po42Max: 2.4,
    sio2Max: 140,
    caF2Max: 50000
  },
  'Brackish Surface': {
    avgFluxMax: 20,
    elementFluxMax: 31,
    fluxDeclineTypical: 7,
    saltPassageIncreaseTypical: 10,
    betaStandard: 1.2,
    betaFullFit: 1.5,
    recoveryMax: 60,
    lsiMax: 2.5,
    caSo4Max: 400,
    srSo4Max: 1200,
    baSo4Max: 10000,
    ca3po42Max: 2.4,
    sio2Max: 140,
    caF2Max: 50000
  },
  'Sea Well': {
    avgFluxMax: 17,
    elementFluxMax: 42,
    fluxDeclineTypical: 5,
    saltPassageIncreaseTypical: 7,
    betaStandard: 1.2,
    betaFullFit: 1.5,
    recoveryMax: 50,
    lsiMax: 2.5,
    caSo4Max: 400,
    srSo4Max: 1200,
    baSo4Max: 10000,
    ca3po42Max: 2.4,
    sio2Max: 140,
    caF2Max: 50000
  },
  'Sea Surface': {
    avgFluxMax: 14,
    elementFluxMax: 34,
    fluxDeclineTypical: 7,
    saltPassageIncreaseTypical: 10,
    betaStandard: 1.2,
    betaFullFit: 1.5,
    recoveryMax: 45,
    lsiMax: 2.5,
    caSo4Max: 400,
    srSo4Max: 1200,
    baSo4Max: 10000,
    ca3po42Max: 2.4,
    sio2Max: 140,
    caF2Max: 50000
  },
  'Municipal Waste': {
    avgFluxMax: 17,
    elementFluxMax: 26,
    fluxDeclineTypical: 15,
    saltPassageIncreaseTypical: 12,
    betaStandard: 1.2,
    betaFullFit: 1.3,
    recoveryMax: 60,
    lsiMax: 2.5,
    caSo4Max: 400,
    srSo4Max: 1200,
    baSo4Max: 10000,
    ca3po42Max: 2.4,
    sio2Max: 140,
    caF2Max: 50000
  },
  'RO Permeate': {
    avgFluxMax: 36,
    elementFluxMax: 56,
    fluxDeclineTypical: 3,
    saltPassageIncreaseTypical: 5,
    betaStandard: 1.5,
    betaFullFit: 2.2,
    recoveryMax: 85,
    lsiMax: 2.5,
    caSo4Max: 400,
    srSo4Max: 1200,
    baSo4Max: 10000,
    ca3po42Max: 2.4,
    sio2Max: 140,
    caF2Max: 50000
  },
  'Well Water': {
    avgFluxMax: 27,
    elementFluxMax: 46,
    fluxDeclineTypical: 5,
    saltPassageIncreaseTypical: 7,
    betaStandard: 1.2,
    betaFullFit: 1.5,
    recoveryMax: 75,
    lsiMax: 2.5,
    caSo4Max: 400,
    srSo4Max: 1200,
    baSo4Max: 10000,
    ca3po42Max: 2.4,
    sio2Max: 140,
    caF2Max: 50000
  }
};

export const validateDesignWithWaterType = (inputs, results, waterType) => {
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    recommendations: [],
    fieldErrors: {} // New: track which fields are invalid
  };

  if (!waterType) {
    validation.warnings.push('⚠️ Water type not specified - design constraints cannot be fully validated');
    return validation;
  }

  const {
    recovery = 0,
    feedPh = 7.0,
  } = inputs;

  const avgFlux = parseFloat(results?.avgFluxLMH || results?.avgFlux) || 0;
  const highestFlux = parseFloat(results?.highestFlux) || 0;
  const highestBeta = parseFloat(results?.highestBeta) || 0;

  const constraints = DESIGN_CONSTRAINTS_BY_WATER_TYPE[waterType];
  
  if (constraints) {
    // 1. System Average Flux
    if (avgFlux > constraints.avgFluxMax) {
      validation.errors.push(`Average Flux (${avgFlux.toFixed(1)} LMH) exceeds recommended max (${constraints.avgFluxMax} LMH) for ${waterType}`);
      validation.isValid = false;
      validation.fieldErrors.averageFlux = {
        value: avgFlux,
        limit: constraints.avgFluxMax,
        parameter: 'System Average flux'
      };
    }

    // 2. Max Element Flux
    if (highestFlux > constraints.elementFluxMax) {
      validation.errors.push(`Max Element Flux (${highestFlux.toFixed(1)} LMH) exceeds recommended max (${constraints.elementFluxMax} LMH) for ${waterType}`);
      validation.isValid = false;
      validation.fieldErrors.highestFlux = {
        value: highestFlux,
        limit: constraints.elementFluxMax,
        parameter: 'Max Element flux'
      };
    }

    // 3. Recovery
    if (recovery > constraints.recoveryMax) {
      validation.errors.push(`Recovery (${recovery}%) exceeds recommended max (${constraints.recoveryMax}%) for ${waterType}`);
      validation.isValid = false;
      validation.fieldErrors.recovery = {
        value: recovery,
        limit: constraints.recoveryMax,
        parameter: 'Recovery'
      };
    }

    // 4. Beta (Concentration Polarization)
    const betaLimit = constraints.betaFullFit || constraints.betaStandard || 1.2;
    if (highestBeta > betaLimit) {
      validation.errors.push(`Concentration Polarization Beta (${highestBeta.toFixed(2)}) exceeds recommended max (${betaLimit}) for ${waterType}`);
      validation.isValid = false;
      validation.fieldErrors.highestBeta = {
        value: highestBeta,
        limit: betaLimit,
        parameter: 'Beta'
      };
    }

    // 5. Saturation Limits
    if (results?.concentrateSaturation) {
      const sats = results.concentrateSaturation;
      
      if (parseFloat(sats.caSo4) > constraints.caSo4Max) {
        validation.errors.push(`CaSO4 Saturation (${sats.caSo4}%) exceeds limit (${constraints.caSo4Max}%)`);
        validation.isValid = false;
        validation.fieldErrors.caSo4 = { value: sats.caSo4, limit: constraints.caSo4Max, parameter: 'CaSO4 (%)' };
      }
      if (parseFloat(sats.srSo4) > constraints.srSo4Max) {
        validation.errors.push(`SrSO4 Saturation (${sats.srSo4}%) exceeds limit (${constraints.srSo4Max}%)`);
        validation.isValid = false;
        validation.fieldErrors.srSo4 = { value: sats.srSo4, limit: constraints.srSo4Max, parameter: 'SrSO4 (%)' };
      }
      if (parseFloat(sats.baSo4) > constraints.baSo4Max) {
        validation.errors.push(`BaSO4 Saturation (${sats.baSo4}%) exceeds limit (${constraints.baSo4Max}%)`);
        validation.isValid = false;
        validation.fieldErrors.baSo4 = { value: sats.baSo4, limit: constraints.baSo4Max, parameter: 'BaSO4 (%)' };
      }
      if (parseFloat(sats.sio2) > constraints.sio2Max) {
        validation.errors.push(`SiO2 Saturation (${sats.sio2}%) exceeds limit (${constraints.sio2Max}%)`);
        validation.isValid = false;
        validation.fieldErrors.sio2 = { value: sats.sio2, limit: constraints.sio2Max, parameter: 'SiO2 (%)' };
      }
      if (parseFloat(sats.ca3po42) > constraints.ca3po42Max) {
        validation.errors.push(`Ca3(PO4)2 SI (${sats.ca3po42}) exceeds limit (${constraints.ca3po42Max})`);
        validation.isValid = false;
        validation.fieldErrors.ca3po42 = { value: sats.ca3po42, limit: constraints.ca3po42Max, parameter: 'Ca3(PO4)2 SI' };
      }
      if (parseFloat(sats.caF2) > constraints.caF2Max) {
        validation.errors.push(`CaF2 Saturation (${sats.caF2}%) exceeds limit (${constraints.caF2Max}%)`);
        validation.isValid = false;
        validation.fieldErrors.caF2 = { value: sats.caF2, limit: constraints.caF2Max, parameter: 'CaF2 (%)' };
      }
    }
    
    // 6. LSI
    if (results?.concentrateParameters?.langelier > constraints.lsiMax) {
      const lsi = results.concentrateParameters.langelier;
      validation.errors.push(`LSI (${lsi}) exceeds limit (${constraints.lsiMax})`);
      validation.isValid = false;
      validation.fieldErrors.lsi = { value: lsi, limit: constraints.lsiMax, parameter: 'LSI (< 10000 ppm TDS)' };
    }
  }

  if (feedPh < 2 || feedPh > 11) {
    validation.errors.push(`pH (${feedPh}) is outside operating range (2.0 - 11.0)`);
    validation.isValid = false;
    validation.fieldErrors.feedPh = { value: feedPh, limit: '2.0-11.0', parameter: 'pH' };
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
