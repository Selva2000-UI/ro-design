import {
  calculateTCF,
  calculateDynamicAValue,
  calculateDynamicBValue,
  calculateOsmoticPressureFromIons,
  designMultiStageSystem,
  calculateStageHydraulics,
  validateMultiStageDesign
} from './calculationEngine';

import { getMembrane } from './membraneEngine';

export const RO_DESIGN_EXAMPLES = {
  
  typicalBrackishWells: {
    name: 'Typical Brackish Wells (2000 TDS)',
    ions: {
      na: 200,
      k: 20,
      ca: 100,
      mg: 50,
      cl: 400,
      so4: 100,
      hco3: 150
    },
    targetRecovery: 0.75,
    feedTemperature: 25,
    feedPressure: 20
  },

  industrialBrackish: {
    name: 'Industrial Brackish (5000 TDS)',
    ions: {
      na: 500,
      k: 50,
      ca: 250,
      mg: 125,
      cl: 1000,
      so4: 250,
      hco3: 300
    },
    targetRecovery: 0.70,
    feedTemperature: 30,
    feedPressure: 25
  },

  seawaterDesalination: {
    name: 'Seawater Desalination (35000 TDS)',
    ions: {
      na: 11000,
      k: 400,
      ca: 400,
      mg: 1300,
      cl: 19000,
      so4: 2700,
      hco3: 150
    },
    targetRecovery: 0.45,
    feedTemperature: 20,
    feedPressure: 60
  },

  lowSalinityBrackish: {
    name: 'Low Salinity Brackish (800 TDS)',
    ions: {
      na: 80,
      k: 10,
      ca: 40,
      mg: 20,
      cl: 160,
      so4: 40,
      hco3: 60
    },
    targetRecovery: 0.80,
    feedTemperature: 25,
    feedPressure: 15
  }
};

export const MEMBRANE_RECOMMENDATIONS = {
  brackish2k: {
    membraneId: 'cpa3',
    minTds: 0,
    maxTds: 2000,
    optimalRecovery: 0.75,
    description: 'CPA3 for 2000 TDS brackish waters'
  },
  brackish5k: {
    membraneId: 'bwtds5k8040',
    minTds: 2000,
    maxTds: 5000,
    optimalRecovery: 0.70,
    description: 'BW-TDS-5K for high TDS brackish'
  },
  brackish10k: {
    membraneId: 'bwtds10kfr8040',
    minTds: 5000,
    maxTds: 10000,
    optimalRecovery: 0.65,
    description: 'BW-TDS-10K-FR for very high TDS'
  },
  seawater: {
    membraneId: 'swtds32k8040',
    minTds: 30000,
    maxTds: 40000,
    optimalRecovery: 0.45,
    description: 'SW-TDS-32K for seawater'
  }
};

export const getRecommendedMembrane = (averageTds) => {
  for (const [key, config] of Object.entries(MEMBRANE_RECOMMENDATIONS)) {
    if (averageTds >= config.minTds && averageTds <= config.maxTds) {
      return config;
    }
  }
  return MEMBRANE_RECOMMENDATIONS.brackish2k;
};

export const designBrackishSystem = (params) => {
  const {
    feedFlow = 10,
    feedTemperature = 25,
    feedPressure = 20,
    targetRecovery = 0.75,
    numStages = 2,
    feedIons = {},
    membraneId = 'cpa3'
  } = params;

  const membrane = getMembrane(membraneId);
  if (!membrane) throw new Error(`Membrane ${membraneId} not found`);

  const osmotic = calculateOsmoticPressureFromIons({
    ions: feedIons,
    tempCelsius: feedTemperature,
    iDissociation: 1.85
  });

  const feedConc = Object.values(feedIons).reduce((a, b) => a + b, 0);

  const design = designMultiStageSystem({
    feedFlow,
    feedPressure,
    feedOsmotic: osmotic,
    feedConc,
    feedIons,
    targetRecovery,
    maxRecoveryPerStage: 0.85,
    membrane,
    tempCelsius: feedTemperature,
    numStages,
    fluxDeclinePercent: 0,
    membraneAgeYears: 0
  });

  return {
    ...design,
    feedOsmotic: osmotic,
    membrane,
    membraneId,
    designation: `${numStages}-Stage ${membraneId.toUpperCase()}`
  };
};

export const designSeawaterSystem = (params) => {
  const {
    feedFlow = 5,
    feedTemperature = 20,
    feedPressure = 60,
    targetRecovery = 0.45,
    numStages = 3,
    feedIons = {},
    membraneId = 'swtds32k8040'
  } = params;

  const membrane = getMembrane(membraneId);
  if (!membrane) throw new Error(`Membrane ${membraneId} not found`);

  const osmotic = calculateOsmoticPressureFromIons({
    ions: feedIons,
    tempCelsius: feedTemperature,
    iDissociation: 1.9
  });

  const feedConc = Object.values(feedIons).reduce((a, b) => a + b, 0);

  const design = designMultiStageSystem({
    feedFlow,
    feedPressure,
    feedOsmotic: osmotic,
    feedConc,
    feedIons,
    targetRecovery,
    maxRecoveryPerStage: 0.75,
    membrane,
    tempCelsius: feedTemperature,
    numStages,
    fluxDeclinePercent: 0,
    membraneAgeYears: 0
  });

  return {
    ...design,
    feedOsmotic: osmotic,
    membrane,
    membraneId,
    designation: `${numStages}-Stage Seawater ${membraneId.toUpperCase()}`
  };
};

export const analyzeSystemTemperatureSensitivity = (design, tempRange = [15, 45]) => {
  const results = [];
  
  for (let temp = tempRange[0]; temp <= tempRange[1]; temp += 5) {
    const tempDesign = designMultiStageSystem({
      feedFlow: design.feedFlow,
      feedPressure: design.feedPressure,
      feedOsmotic: design.feedOsmotic,
      feedConc: design.feedConc,
      targetRecovery: design.targetRecovery || 0.75,
      membrane: design.membrane,
      tempCelsius: temp,
      numStages: design.numStages
    });

    results.push({
      temperature: temp,
      stages: tempDesign.stages.map(s => ({
        flux: parseFloat(s.flux.toFixed(2)),
        recovery: parseFloat((s.recovery * 100).toFixed(1))
      })),
      totalRecovery: parseFloat((tempDesign.totalRecovery * 100).toFixed(1)),
      totalPressureDrop: parseFloat(tempDesign.totalPressureDrop.toFixed(2))
    });
  }

  return results;
};

export const analyzeMembraneAging = (design, yearsOfOperation = [0, 2, 5]) => {
  const results = [];

  yearsOfOperation.forEach(years => {
    const agedDesign = designMultiStageSystem({
      feedFlow: design.feedFlow,
      feedPressure: design.feedPressure,
      feedOsmotic: design.feedOsmotic,
      feedConc: design.feedConc,
      targetRecovery: design.targetRecovery || 0.75,
      membrane: design.membrane,
      tempCelsius: design.tempCelsius || 25,
      numStages: design.numStages,
      fluxDeclinePercent: 5,
      membraneAgeYears: years
    });

    results.push({
      yearsOfOperation: years,
      stages: agedDesign.stages.map(s => ({
        flux: parseFloat(s.flux.toFixed(2)),
        dynamicAValue: parseFloat(s.dynamicAValue.toFixed(3))
      })),
      totalRecovery: parseFloat((agedDesign.totalRecovery * 100).toFixed(1)),
      totalPressureDrop: parseFloat(agedDesign.totalPressureDrop.toFixed(2))
    });
  });

  return results;
};

export const compareMembraneOptions = (feedFlow, feedIons, targetRecovery, membraneIds) => {
  const osmotic = calculateOsmoticPressureFromIons({
    ions: feedIons,
    tempCelsius: 25,
    iDissociation: 1.85
  });

  const feedConc = Object.values(feedIons).reduce((a, b) => a + b, 0);

  const results = [];

  membraneIds.forEach(membraneId => {
    const membrane = getMembrane(membraneId);
    if (!membrane) return;

    try {
      const design = designMultiStageSystem({
        feedFlow,
        feedPressure: 20,
        feedOsmotic: osmotic,
        feedConc,
        targetRecovery,
        membrane,
        numStages: 2
      });

      results.push({
        membraneId,
        membraneName: membrane.name,
        achievedRecovery: parseFloat((design.totalRecovery * 100).toFixed(1)),
        stage1Flux: parseFloat(design.stages[0].flux.toFixed(2)),
        stage2Flux: parseFloat(design.stages[1].flux.toFixed(2)),
        totalPressureDrop: parseFloat(design.totalPressureDrop.toFixed(2)),
        totalPower: parseFloat(design.totalPower.toFixed(2))
      });
    } catch (e) {
      console.error(`Failed to design with ${membraneId}:`, e.message);
    }
  });

  return results;
};

export const quickDesignBrackish = (feedFlowGpm, feedTds) => {
  const feedFlowM3h = feedFlowGpm * 0.2271247;
  
  const estimatedIons = {
    na: feedTds * 0.30,
    k: feedTds * 0.02,
    ca: feedTds * 0.15,
    mg: feedTds * 0.08,
    cl: feedTds * 0.30,
    so4: feedTds * 0.10,
    hco3: feedTds * 0.05
  };

  const membrane = getRecommendedMembrane(feedTds);
  
  return designBrackishSystem({
    feedFlow: feedFlowM3h,
    feedTemperature: 25,
    feedPressure: 20,
    targetRecovery: membrane.optimalRecovery,
    numStages: feedTds > 3000 ? 3 : 2,
    feedIons: estimatedIons,
    membraneId: membrane.membraneId
  });
};

export const quickDesignSeawater = (feedFlowGpm, feedTemp = 20) => {
  const feedFlowM3h = feedFlowGpm * 0.2271247;
  
  const seawaterIons = {
    na: 11000,
    k: 400,
    ca: 400,
    mg: 1300,
    cl: 19000,
    so4: 2700,
    hco3: 150
  };

  return designSeawaterSystem({
    feedFlow: feedFlowM3h,
    feedTemperature: feedTemp,
    feedPressure: 60,
    targetRecovery: 0.45,
    numStages: 3,
    feedIons: seawaterIons,
    membraneId: 'swtds32k8040'
  });
};

export const performanceMetrics = (design) => {
  const permeateFlow = design.feedFlow * design.totalRecovery;
  const concentrateFlow = design.feedFlow - permeateFlow;
  
  const avgFlux = design.stages.reduce((sum, s) => sum + s.flux, 0) / design.stages.length;
  const avgRecovery = design.stages.reduce((sum, s) => sum + s.recovery, 0) / design.stages.length;

  return {
    feedFlow: parseFloat(design.feedFlow.toFixed(2)),
    permeateFlow: parseFloat(permeateFlow.toFixed(2)),
    concentrateFlow: parseFloat(concentrateFlow.toFixed(2)),
    totalRecovery: parseFloat((design.totalRecovery * 100).toFixed(1)),
    averageFlux: parseFloat(avgFlux.toFixed(2)),
    averageRecoveryPerStage: parseFloat((avgRecovery * 100).toFixed(1)),
    totalPressureDrop: parseFloat(design.totalPressureDrop.toFixed(2)),
    totalPower: parseFloat(design.totalPower.toFixed(2)),
    permeateQuality: {
      estimatedTds: parseFloat(design.finalPermeateConc.toFixed(0)),
      rejection: parseFloat((99.5).toFixed(1))
    },
    concentrateQuality: {
      estimatedTds: parseFloat(design.finalConcentrateConc.toFixed(0))
    }
  };
};
