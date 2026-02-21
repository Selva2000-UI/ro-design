/**
 * INTEGRATION EXAMPLE: Water Type Architecture
 * 
 * This file demonstrates how to integrate water type validation
 * into the RO membrane calculator workflow.
 * 
 * Architecture Overview:
 * 
 * 1. User Input Layer (App.js)
 *    - waterType: selected from WATER_TYPES enum
 *    - systemConfig: membrane, vessels, elements, recovery, etc.
 *    - waterData: TDS, pH, temperature, ions, etc.
 * 
 * 2. Calculation Layer (calculatorService.js)
 *    - calculateSystem() now accepts waterType parameter
 *    - Returns designWarnings in results object
 *    - Uses membrane-specific parameters (dpExponent, membraneB, nominalFlowDP)
 * 
 * 3. Validation Layer (designValidator.js)
 *    - validateDesignWithWaterType(): comprehensive design validation
 *    - DESIGN_CONSTRAINTS_BY_WATER_TYPE: water-specific operating limits
 *    - getWaterTypeAdjustedParameters(): modifies design based on water type
 *    - checkPretreatmentAlignment(): verifies pretreatment adequacy
 * 
 * 4. Configuration Layer (waterTypeConfig.js)
 *    - WATER_TYPES: enumerated water source types
 *    - WATER_TYPE_TO_MEMBRANES: maps water types to suitable membranes
 *    - MEMBRANE_SPECIFICATIONS: membrane properties and constraints
 */

import { calculateSystem } from './calculatorService';
import { validateDesignWithWaterType, checkPretreatmentAlignment } from './designValidator';
import { WATER_TYPES, getMembranesByWaterType } from './waterTypeConfig';

/**
 * EXAMPLE 1: Basic Flow - Calculate with Water Type
 * 
 * Pass waterType to calculateSystem and get warnings
 */
export function exampleBasicCalculation() {
  const inputs = {
    feedFlow: 100,
    flowUnit: 'gpm',
    recovery: 50,
    membraneModel: 'cpa3',
    temp: 25,
    feedPh: 7.5,
    tds: 2100,
    waterType: WATER_TYPES.BRACKISH_WELL_NON_FOULING,  // ADDED
    stages: [
      { membraneModel: 'cpa3', elementsPerVessel: 6, vessels: 4 }
    ],
    feedIons: {
      ca: 60, mg: 20, na: 250, k: 15,
      hco3: 250, so4: 100, cl: 300
    }
  };

  const results = calculateSystem(inputs);
  
  // NEW: Get design warnings that include water type constraints
  console.log('Design Warnings:', results.designWarnings);
  // Output example:
  // [
  //   "⚠️  Recovery (50%) below recommended min (45%) for Brackish Well Non-Fouling",
  //   "ℹ️  Recommended membranes for Brackish Well Non-Fouling: CPA3-8040, BW-TDS-2K-8040, ..."
  // ]

  return results;
}

/**
 * EXAMPLE 2: Comprehensive Validation
 * 
 * Use validateDesignWithWaterType for detailed design validation
 */
export function exampleComprehensiveValidation() {
  const inputs = {
    membraneModel: 'lfc3ld4040',  // Low-fouling membrane
    tds: 1500,
    temp: 35,
    feedPh: 7.0,
    recovery: 55,
    flowUnit: 'gpm'
  };

  const results = {
    avgFlux: 16.5,
    feedPressure: 250  // in PSI
  };

  const waterType = WATER_TYPES.BRACKISH_WELL_HIGH_FOULING;

  const validation = validateDesignWithWaterType(inputs, results, waterType);
  
  console.log('Is Design Valid?', validation.isValid);
  console.log('Errors:', validation.errors);
  console.log('Warnings:', validation.warnings);
  console.log('Recommendations:', validation.recommendations);
  
  // Output example:
  // Is Design Valid? true
  // Errors: []
  // Warnings: ["TDS (1500 mg/L) is below typical range for Brackish Well High-Fouling (500 mg/L)"]
  // Recommendations: []

  return validation;
}

/**
 * EXAMPLE 3: Get Membrane Recommendations
 * 
 * Show user which membranes work best for their water type
 */
export function exampleGetRecommendations() {
  const waterType = WATER_TYPES.SEA_SURFACE;

  // Get recommended membrane IDs
  const recommendedIds = getMembranesByWaterType(waterType);
  // Output: ['swtds32k8040']

  return recommendedIds;
}

/**
 * EXAMPLE 4: Check Pretreatment Alignment
 * 
 * Verify that selected pretreatment matches water type requirements
 */
export function exampleCheckPretreatment() {
  const waterType = WATER_TYPES.BRACKISH_SURFACE;
  const appliedPretreatment = ['Cartridge Filter', 'Activated Carbon'];
  // Missing: Ultra Filtration is recommended for surface water

  const alignment = checkPretreatmentAlignment(waterType, appliedPretreatment);
  
  console.log('Pretreatment Aligned?', alignment.aligned);
  console.log('Missing Critical Steps:', alignment.missing);
  console.log('Recommended:', alignment.recommended);
  
  // Output:
  // Pretreatment Aligned? false
  // Missing Critical Steps: ['Coagulation', 'Filtration', 'Ultra Filtration']
  // Recommended: ['Coagulation', 'Filtration', 'Ultra Filtration']

  return alignment;
}

/**
 * EXAMPLE 5: Integration in App.js Component
 * 
 * How to integrate into React component
 */
export function exampleAppJsIntegration() {
  /*
  // In App.js useEffect or calculation handler:
  
  const handleCalculateDesign = () => {
    const calculationInputs = {
      feedFlow: systemConfig.feedFlow,
      flowUnit: systemConfig.flowUnit,
      recovery: systemConfig.recovery,
      membraneModel: systemConfig.membraneModel,
      temp: waterData.temp,
      feedPh: waterData.feedPh,
      tds: waterData.calculatedTds,
      waterType: waterData.waterType,  // ADDED
      stages: systemConfig.stages,
      feedIons: {
        ca: waterData.ca,
        mg: waterData.mg,
        // ... other ions
      }
    };

    const results = calculateSystem(calculationInputs);
    
    // NEW: Display design warnings
    if (results.designWarnings && results.designWarnings.length > 0) {
      setDesignWarnings(results.designWarnings);
    }

    setSystemResults(results);
  };
  */
}

/**
 * DATA FLOW DIAGRAM
 * 
 * User Input (App.js state)
 *   ├── waterData
 *   │   ├── waterType: "Brackish Well Non-Fouling"
 *   │   ├── tds: 2100
 *   │   ├── temp: 25
 *   │   ├── pH: 7.5
 *   │   └── ions: {...}
 *   └── systemConfig
 *       ├── membraneModel: "cpa3"
 *       ├── recovery: 50
 *       ├── stages: [...]
 *       └── flowUnit: "gpm"
 *
 * Calculation (calculatorService.calculateSystem)
 *   ├── Uses membrane-specific parameters
 *   │   ├── dpExponent: 1.18
 *   │   ├── membraneB: 0.136
 *   │   └── nominalFlowDP: 15.5
 *   └── Calls getDesignWarnings(inputs, results, waterType)
 *
 * Validation (designValidator.validateDesignWithWaterType)
 *   ├── Checks water type constraints
 *   │   ├── TDS range: 500-5000 mg/L
 *   │   ├── Flux limits: 10-25 GFD/LMH
 *   │   ├── Recovery: 45-75%
 *   │   └── Pressure: 150-600 psi
 *   ├── Validates membrane compatibility
 *   ├── Checks pretreatment alignment
 *   └── Returns errors, warnings, recommendations
 *
 * Output (App.js display)
 *   ├── Design Results (pressures, flows, quality)
 *   ├── Design Warnings (errors, cautions, info)
 *   ├── Recommended Membranes
 *   └── Pretreatment Recommendations
 */
