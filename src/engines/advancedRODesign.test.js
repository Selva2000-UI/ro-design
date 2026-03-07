import {
  calculateTCF,
  calculateDynamicAValue,
  calculateDynamicBValue,
  convertToMolarity,
  calculateIonicStrength,
  calculateTotalMolarity,
  calculateOsmoticPressureFromIons,
  calculateFluxImproved,
  calculateSaltPassageAdvanced,
  calculateStageHydraulics,
  designMultiStageSystem,
  distributeRecovery,
  validateMultiStageDesign,
  getIonOsmoticContribution
} from './calculationEngine';

import { getMembrane } from './membraneEngine';

describe('Dynamic A & B Normalization Engine', () => {
  describe('Temperature Correction Factor', () => {
    it('should calculate TCF correctly for A-value at 25°C', () => {
      const tcf = calculateTCF(25, 'A');
      expect(tcf).toBeCloseTo(1.0, 4);
    });

    it('should calculate TCF correctly for A-value at higher temperature', () => {
      const tcf = calculateTCF(35, 'A');
      expect(tcf).toBeGreaterThan(1.0);
      expect(tcf).toBeLessThan(1.5);
    });

    it('should calculate TCF correctly for B-value at 25°C', () => {
      const tcf = calculateTCF(25, 'B');
      expect(tcf).toBeCloseTo(1.0, 4);
    });

    it('should apply different E/R for A and B values', () => {
      const tcfA = calculateTCF(35, 'A');
      const tcfB = calculateTCF(35, 'B');
      expect(tcfA).not.toEqual(tcfB);
      expect(tcfB).toBeGreaterThan(tcfA);
    });
  });

  describe('Dynamic A-value Calculation', () => {
    it('should return base A-value at 25°C with no aging', () => {
      const aValue = calculateDynamicAValue({
        aValue25: 3.0,
        tempCelsius: 25,
        fluxDeclinePercent: 0,
        membraneAgeYears: 0
      });
      expect(aValue).toBeCloseTo(3.0, 2);
    });

    it('should increase A-value at higher temperature', () => {
      const aValue35 = calculateDynamicAValue({
        aValue25: 3.0,
        tempCelsius: 35,
        fluxDeclinePercent: 0,
        membraneAgeYears: 0
      });
      expect(aValue35).toBeGreaterThan(3.0);
    });

    it('should account for membrane aging', () => {
      const noAging = calculateDynamicAValue({
        aValue25: 3.0,
        tempCelsius: 25,
        fluxDeclinePercent: 5,
        membraneAgeYears: 0
      });

      const aged2years = calculateDynamicAValue({
        aValue25: 3.0,
        tempCelsius: 25,
        fluxDeclinePercent: 5,
        membraneAgeYears: 2
      });

      expect(aged2years).toBeLessThan(noAging);
    });

    it('should enforce minimum aging factor of 0.7', () => {
      const heavily = calculateDynamicAValue({
        aValue25: 3.0,
        tempCelsius: 25,
        fluxDeclinePercent: 20,
        membraneAgeYears: 10
      });
      expect(heavily).toBeGreaterThanOrEqual(3.0 * 0.7);
    });
  });

  describe('Dynamic B-value Calculation', () => {
    it('should return base B-value at 25°C', () => {
      const bValue = calculateDynamicBValue({
        bValue25: 0.14,
        tempCelsius: 25
      });
      expect(bValue).toBeCloseTo(0.14, 3);
    });

    it('should increase B-value at higher temperature', () => {
      const bValue35 = calculateDynamicBValue({
        bValue25: 0.14,
        tempCelsius: 35
      });
      expect(bValue35).toBeGreaterThan(0.14);
    });
  });
});

describe('Ionic-based Osmotic Pressure Calculation', () => {
  const typicalBrackishIons = {
    na: 200,
    k: 20,
    ca: 100,
    mg: 50,
    cl: 400,
    so4: 100,
    hco3: 150
  };

  const typicalSeawaterIons = {
    na: 11000,
    k: 400,
    ca: 400,
    mg: 1300,
    cl: 19000,
    so4: 2700,
    hco3: 150
  };

  describe('Molarity Conversion', () => {
    it('should convert mg/L to molarity correctly for sodium', () => {
      const molarity = convertToMolarity(100, 'na');
      expect(molarity).toBeCloseTo(100 / (22.99 * 1000), 6);
    });

    it('should handle divalent ions (calcium)', () => {
      const molarity = convertToMolarity(100, 'ca');
      expect(molarity).toBeCloseTo(100 / (40.08 * 1000), 6);
    });

    it('should return 0 for unknown ions', () => {
      const molarity = convertToMolarity(100, 'unknown');
      expect(molarity).toBe(0);
    });
  });

  describe('Ionic Strength', () => {
    it('should calculate ionic strength for typical water', () => {
      const ionicStrength = calculateIonicStrength(typicalBrackishIons);
      expect(ionicStrength).toBeGreaterThan(0);
      expect(ionicStrength).toBeLessThan(1); // Typical range
    });

    it('should increase with higher ion concentrations', () => {
      const low = calculateIonicStrength({ cl: 100, na: 50 });
      const high = calculateIonicStrength({ cl: 1000, na: 500 });
      expect(high).toBeGreaterThan(low);
    });
  });

  describe('Total Molarity', () => {
    it('should sum all ion molarities', () => {
      const molarity = calculateTotalMolarity(typicalBrackishIons);
      expect(molarity).toBeGreaterThan(0);
    });

    it('should handle missing ions gracefully', () => {
      const partial = calculateTotalMolarity({ na: 100 });
      expect(partial).toBeGreaterThan(0);
    });
  });

  describe('Osmotic Pressure from Ions', () => {
    it('should calculate osmotic pressure for brackish water', () => {
      const osmotic = calculateOsmoticPressureFromIons({
        ions: typicalBrackishIons,
        tempCelsius: 25
      });
      expect(osmotic).toBeGreaterThan(1); // bar
      expect(osmotic).toBeLessThan(5); // Reasonable for brackish
    });

    it('should calculate osmotic pressure for seawater', () => {
      const osmotic = calculateOsmoticPressureFromIons({
        ions: typicalSeawaterIons,
        tempCelsius: 25
      });
      expect(osmotic).toBeGreaterThan(25); // bar
      expect(osmotic).toBeLessThan(55); // Typical seawater (high dissociation factor)
    });

    it('should increase osmotic pressure at higher temperature', () => {
      const osmotic25 = calculateOsmoticPressureFromIons({
        ions: typicalBrackishIons,
        tempCelsius: 25
      });
      const osmotic35 = calculateOsmoticPressureFromIons({
        ions: typicalBrackishIons,
        tempCelsius: 35
      });
      expect(osmotic35).toBeGreaterThan(osmotic25);
    });

    it('should use dissociation factor correctly', () => {
      const withFactor = calculateOsmoticPressureFromIons({
        ions: typicalBrackishIons,
        tempCelsius: 25,
        iDissociation: 2.0
      });
      const baseFactor = calculateOsmoticPressureFromIons({
        ions: typicalBrackishIons,
        tempCelsius: 25,
        iDissociation: 1.9
      });
      expect(withFactor).toBeGreaterThan(baseFactor);
    });
  });

  describe('Ion Osmotic Contribution', () => {
    it('should calculate osmotic pressure from individual ion', () => {
      const contribution = getIonOsmoticContribution('na', 100, 25);
      expect(contribution).toBeGreaterThan(0);
    });

    it('should return same for divalent ions with double contribution', () => {
      const naContribution = getIonOsmoticContribution('na', 100, 25);
      const caContribution = getIonOsmoticContribution('ca', 100, 25);
      expect(caContribution).toBeGreaterThan(naContribution);
    });
  });
});

describe('Advanced Flux & Salt Passage Equations', () => {
  it('should calculate flux using improved equation', () => {
    const flux = calculateFluxImproved({
      aValueActual: 3.0,
      feedPressure: 20,
      avgFeedOsmotic: 2,
      systemDP: 1,
      permeateOsmotic: 0.1
    });
    expect(flux).toBeGreaterThan(0);
  });

  it('should return 0 flux with zero NDP', () => {
    const flux = calculateFluxImproved({
      aValueActual: 3.0,
      feedPressure: 2,
      avgFeedOsmotic: 2,
      systemDP: 0
    });
    expect(flux).toBeLessThanOrEqual(0.1);
  });

  it('should calculate salt passage correctly', () => {
    const saltPassage = calculateSaltPassageAdvanced(0.14, 500);
    expect(saltPassage).toBeCloseTo(70, 0);
  });
});

describe('Stage-by-Stage Hydraulic Balancing', () => {
  const cpa3Membrane = {
    aValue: 3.21,
    membraneB: 0.136,
    dpExponent: 1.18,
    nominalFlowDP: 15.5
  };

  it('should calculate stage hydraulics', () => {
    const stage = calculateStageHydraulics({
      feedFlow: 10,
      feedOsmotic: 2,
      feedConc: 1000,
      recovery: 0.5,
      membrane: cpa3Membrane,
      tempCelsius: 25,
      vessels: 2,
      elementsPerVessel: 4
    });

    expect(stage.flux).toBeGreaterThan(0);
    expect(stage.permeateFlow).toBeCloseTo(5, 1);
    expect(stage.concentrateFlow).toBeCloseTo(5, 1);
    expect(stage.dynamicAValue).toBeCloseTo(3.21, 1);
  });

  it('should account for temperature in stage hydraulics', () => {
    const stage25 = calculateStageHydraulics({
      feedFlow: 10,
      feedOsmotic: 2,
      feedConc: 1000,
      recovery: 0.5,
      membrane: cpa3Membrane,
      tempCelsius: 25
    });

    const stage35 = calculateStageHydraulics({
      feedFlow: 10,
      feedOsmotic: 2,
      feedConc: 1000,
      recovery: 0.5,
      membrane: cpa3Membrane,
      tempCelsius: 35
    });

    expect(stage35.dynamicAValue).toBeGreaterThan(stage25.dynamicAValue);
  });
});

describe('Multi-Stage Design Engine', () => {
  const cpa3 = {
    aValue: 3.21,
    membraneB: 0.136,
    dpExponent: 1.18,
    nominalFlowDP: 15.5
  };

  it('should reject invalid number of stages', () => {
    expect(() => {
      designMultiStageSystem({
        feedFlow: 10,
        feedPressure: 20,
        feedOsmotic: 2,
        feedConc: 1000,
        membrane: cpa3,
        numStages: 7
      });
    }).toThrow();
  });

  it('should design 2-stage system', () => {
    const design = designMultiStageSystem({
      feedFlow: 10,
      feedPressure: 20,
      feedOsmotic: 2,
      feedConc: 1000,
      targetRecovery: 0.75,
      membrane: cpa3,
      numStages: 2
    });

    expect(design.numStages).toBe(2);
    expect(design.stages.length).toBe(2);
    expect(design.totalRecovery).toBeLessThanOrEqual(0.75);
    expect(design.totalRecovery).toBeGreaterThan(0.5);
  });

  it('should design 3-stage system', () => {
    const design = designMultiStageSystem({
      feedFlow: 10,
      feedPressure: 25,
      feedOsmotic: 2,
      feedConc: 1000,
      targetRecovery: 0.80,
      membrane: cpa3,
      numStages: 3
    });

    expect(design.numStages).toBe(3);
    expect(design.stages.length).toBe(3);
    expect(design.totalRecovery).toBeGreaterThan(0.50);
    expect(design.totalRecovery).toBeLessThanOrEqual(0.801);
  });

  it('should enforce recovery limits per stage', () => {
    const design = designMultiStageSystem({
      feedFlow: 10,
      feedPressure: 30,
      feedOsmotic: 2,
      feedConc: 1000,
      targetRecovery: 0.9,
      maxRecoveryPerStage: 0.85,
      membrane: cpa3,
      numStages: 2
    });

    design.stages.forEach(stage => {
      expect(stage.recovery).toBeLessThanOrEqual(0.85);
    });
  });

  it('should account for membrane aging across stages', () => {
    const noAging = designMultiStageSystem({
      feedFlow: 10,
      feedOsmotic: 2,
      feedConc: 1000,
      targetRecovery: 0.75,
      membrane: cpa3,
      numStages: 2,
      fluxDeclinePercent: 0,
      membraneAgeYears: 0
    });

    const aged = designMultiStageSystem({
      feedFlow: 10,
      feedOsmotic: 2,
      feedConc: 1000,
      targetRecovery: 0.75,
      membrane: cpa3,
      numStages: 2,
      fluxDeclinePercent: 5,
      membraneAgeYears: 3
    });

    expect(noAging.stages[0].dynamicAValue).toBeGreaterThan(aged.stages[0].dynamicAValue);
  });

  it('should validate multi-stage design', () => {
    const design = designMultiStageSystem({
      feedFlow: 10,
      feedPressure: 20,
      feedOsmotic: 2,
      feedConc: 1000,
      membrane: cpa3,
      numStages: 2
    });

    expect(design.valid).toBeDefined();
    expect(design.valid.valid).toBeDefined();
    expect(Array.isArray(design.valid.issues)).toBe(true);
  });
});

describe('Recovery Distribution', () => {
  it('should distribute recovery evenly across stages', () => {
    const recoveries = distributeRecovery(0.75, 2);
    expect(recoveries.length).toBe(2);
    expect(recoveries.every(r => r <= 0.85)).toBe(true);
  });

  it('should handle high overall recovery with multiple stages', () => {
    const recoveries = distributeRecovery(0.90, 3, 0.85);
    expect(recoveries.length).toBe(3);
    expect(recoveries.every(r => r <= 0.85)).toBe(true);
  });

  it('should sum to approximately target recovery', () => {
    const recoveries = distributeRecovery(0.75, 3);
    const totalRec = 1 - recoveries.reduce((acc, r) => acc * (1 - r), 1);
    expect(totalRec).toBeLessThanOrEqual(0.75);
    expect(totalRec).toBeGreaterThan(0.50);
  });
});
