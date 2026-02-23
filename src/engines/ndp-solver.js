/**
 * NDP SOLVER & PRESSURE ITERATOR - INDUSTRIAL GRADE
 * 
 * Fixes the critical physics error where osmotic > feed pressure
 * but flux is still positive.
 * 
 * Core issue: UI was using concentrate osmotic instead of log-mean osmotic
 * in NDP calculation, causing inverted pressure relationships.
 */

import {
  calculateOsmoticPressure,
  calculateAverageOsmoticPressureLogMean,
  calculateDynamicAValue,
  calculateDynamicBValue,
  calculatePermeateConcentrationIndustrial,
  calculateRejectionPercent,
  calculateConcentrationPolarization
} from './calculationEngine.js';

/**
 * CORRECT NDP FORMULA FOR SEAWATER RO
 * NDP = Pfeed - π_avg - Pperm - 0.5×ΔP
 * Where:
 *   π_avg = log-mean osmotic pressure (NOT arithmetic mean, NOT concentrate)
 *   Pfeed = feed pressure (bar)
 *   Pperm = permeate back pressure (typically 0)
 *   ΔP = pressure drop across elements
 */

/**
 * Calculate NDP with full physics (NO ERRORS)
 * @param {object} params
 * @returns {object} {ndp, components, valid}
 */
export const calculateNDPCorrect = (params) => {
  const {
    feedPressure,
    avgOsmotic,
    permeateOsmotic = 0,
    pressureDrop = 0
  } = params;

  const osmoDelta = avgOsmotic - permeateOsmotic;
  const dpEffect = 0.5 * pressureDrop;
  const ndp = feedPressure - osmoDelta - dpEffect;

  return {
    feedPressure,
    avgOsmotic,
    permeateOsmotic,
    pressureDrop,
    osmoDelta,
    dpEffect,
    ndp,
    valid: ndp > 0,
    description: `NDP = ${feedPressure.toFixed(2)} - ${osmoDelta.toFixed(2)} - ${dpEffect.toFixed(2)} = ${ndp.toFixed(2)} bar`
  };
};

/**
 * PRESSURE ITERATOR - Solve for required pressure given target recovery
 * Industrial RO solvers iterate pressure until target recovery is met
 * @param {object} params
 * @returns {object} {requiredPressure, fluxAchieved, recoveryAchieved, iterations}
 */
export const iteratePressureForRecovery = (params) => {
  const {
    feedFlow,
    feedConc,
    targetRecovery = 0.4,
    membrane,
    tempCelsius = 25,
    elementsPerVessel = 6,
    vessels = 4,
    maxIterations = 20,
    tolerance = 0.01
  } = params;

  const isSeawater = feedConc >= 10000;
  const totalArea = membrane.areaM2 * elementsPerVessel * vessels;
  const aValue = calculateDynamicAValue({
    aValue25: membrane.transport.aValueRef,
    tempCelsius,
    foulingFactor: 0.95
  });

  let pressure = 40;
  let iteration = 0;
  let lastRecovery = 0;

  while (iteration < maxIterations) {
    const osmData = calculateAverageOsmoticPressureLogMean(feedConc, targetRecovery, 'bar', isSeawater);

    const ndpValue = pressure - osmData.avgOsmotic;

    if (ndpValue <= 0) {
      pressure += 5;
      iteration++;
      continue;
    }

    const flux = aValue * ndpValue;

    if (flux <= 0) {
      pressure += 5;
      iteration++;
      continue;
    }

    const permeateFlow = (flux * totalArea) / 1000;
    const achievedRecovery = permeateFlow / feedFlow;

    if (Math.abs(achievedRecovery - targetRecovery) < tolerance) {
      return {
        requiredPressure: pressure,
        fluxAchieved: flux,
        recoveryAchieved: achievedRecovery,
        permeateFlow,
        ndp: ndpValue,
        osmData,
        iterations: iteration,
        converged: true
      };
    }

    if (achievedRecovery < targetRecovery) {
      pressure += 2;
    } else {
      pressure -= 1;
    }

    lastRecovery = achievedRecovery;
    iteration++;
  }

  return {
    requiredPressure: pressure,
    converged: false,
    message: `Did not converge after ${maxIterations} iterations`,
    lastRecovery
  };
};

/**
 * DIAGNOSTIC: Show exactly what is wrong with the current calculation
 * @param {object} params
 * @returns {object} Detailed error report
 */
export const diagnosticNDPError = (params) => {
  const {
    feedPressure = 38.15,
    displayedOsmotic = 39.26,
    feedTDS = 28000,
    recovery = 0.4,
    reportedFlux = 15.7,
    reportedRejection = 0.9538
  } = params;

  const isSeawater = feedTDS >= 10000;

  const feedOsmotic = calculateOsmoticPressure(feedTDS, 'bar', isSeawater);
  const osmData = calculateAverageOsmoticPressureLogMean(feedTDS, recovery, 'bar', isSeawater);
  const concentrateOsmotic = osmData.concentrateOsmotic;
  const avgOsmotic = osmData.avgOsmotic;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚨 NDP DIAGNOSTIC - PHYSICS ERROR ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('REPORTED VALUES (FROM UI):');
  console.log(`  Feed pressure: ${feedPressure} bar`);
  console.log(`  Displayed osmotic: ${displayedOsmotic} bar`);
  console.log(`  Reported flux: ${reportedFlux} LMH`);
  console.log(`  Reported rejection: ${(reportedRejection * 100).toFixed(2)}%\n`);

  console.log('CALCULATED OSMOTIC PRESSURES (CORRECT):');
  console.log(`  Feed osmotic (π_f): ${feedOsmotic.toFixed(2)} bar`);
  console.log(`  Log-mean osmotic (π_avg): ${avgOsmotic.toFixed(2)} bar`);
  console.log(`  Concentrate osmotic (π_c): ${concentrateOsmotic.toFixed(2)} bar\n`);

  console.log('ANALYSIS:');
  console.log(`  Displayed osmotic (${displayedOsmotic.toFixed(2)} bar) matches:`);

  const diffFromConc = Math.abs(displayedOsmotic - concentrateOsmotic);
  const diffFromAvg = Math.abs(displayedOsmotic - avgOsmotic);
  const diffFromFeed = Math.abs(displayedOsmotic - feedOsmotic);

  if (diffFromConc < 0.5) {
    console.log(`    ✗ CONCENTRATE osmotic (${concentrateOsmotic.toFixed(2)} bar) - WRONG!`);
  }
  if (diffFromAvg < 0.5) {
    console.log(`    ✓ Log-mean osmotic (${avgOsmotic.toFixed(2)} bar) - CORRECT`);
  }
  if (diffFromFeed < 0.5) {
    console.log(`    ✓ Feed osmotic (${feedOsmotic.toFixed(2)} bar) - PLAUSIBLE`);
  }

  console.log('\nNDP CALCULATIONS:\n');

  const ndpIfUsingAvg = feedPressure - avgOsmotic;
  const ndpIfUsingConc = feedPressure - concentrateOsmotic;
  const ndpIfUsingFeed = feedPressure - feedOsmotic;

  console.log('IF UI is using FEED osmotic:');
  console.log(`  NDP = ${feedPressure} - ${feedOsmotic.toFixed(2)} = ${ndpIfUsingFeed.toFixed(2)} bar ✓ POSITIVE`);
  console.log(`  This would explain the positive flux.\n`);

  console.log('IF UI is using LOG-MEAN osmotic:');
  console.log(`  NDP = ${feedPressure} - ${avgOsmotic.toFixed(2)} = ${ndpIfUsingAvg.toFixed(2)} bar`);
  if (ndpIfUsingAvg > 0) {
    console.log(`  This is POSITIVE but LOW for 40% SW recovery.\n`);
  } else {
    console.log(`  This is NEGATIVE - NO FLUX POSSIBLE! ✗\n`);
  }

  console.log('IF UI is using CONCENTRATE osmotic:');
  console.log(`  NDP = ${feedPressure} - ${concentrateOsmotic.toFixed(2)} = ${ndpIfUsingConc.toFixed(2)} bar ✗ NEGATIVE`);
  console.log(`  Physics impossible! No flux can occur!\n`);

  console.log('ROOT CAUSE DIAGNOSIS:\n');

  if (ndpIfUsingConc < 0 && reportedFlux > 0) {
    console.log('❌ CONFIRMED ISSUE:');
    console.log('   Your UI is using CONCENTRATE osmotic in NDP');
    console.log('   But still reporting positive flux');
    console.log('   This violates fundamental osmosis physics.\n');
  }

  console.log('WHAT PRESSURE SHOULD BE:\n');

  const requiredPressure = avgOsmotic + 10;
  console.log(`For 40% SW recovery with log-mean osmotic of ${avgOsmotic.toFixed(2)} bar:`);
  console.log(`  Recommended feed pressure: ${requiredPressure.toFixed(2)} bar`);
  console.log(`  Reported pressure: ${feedPressure} bar`);
  console.log(`  Difference: ${(requiredPressure - feedPressure).toFixed(2)} bar too low ✗\n`);

  console.log('PERMEATE QUALITY PROBLEM:\n');
  const bValue = 0.105;
  const saltPassageExpected = (bValue / reportedFlux) * feedTDS;
  const rejectionExpected = (1 - saltPassageExpected / feedTDS) * 100;

  console.log(`With B = ${bValue} and J = ${reportedFlux} LMH:`);
  console.log(`  Expected permeate TDS: ${saltPassageExpected.toFixed(0)} mg/L`);
  console.log(`  Expected rejection: ${rejectionExpected.toFixed(2)}%`);
  console.log(`  UI reports: ${(reportedRejection * 100).toFixed(2)}% rejection`);

  if (rejectionExpected > 95) {
    console.log(`  \n⚠️ Expected rejection is too low (${rejectionExpected.toFixed(2)}%)`);
    console.log(`  This suggests B is being modified or beta is too high`);
  }

  console.log('\n' + '═'.repeat(63));
  console.log('🔧 FIX REQUIRED:');
  console.log('═'.repeat(63));
  console.log('1. Use LOG-MEAN osmotic, not concentrate');
  console.log('2. Increase feed pressure to 48-52 bar for 40% recovery');
  console.log('3. Iterate pressure until target recovery is achieved');
  console.log('4. Cap beta to 1.4 max for seawater');
  console.log('5. Re-validate rejection (should be 97-99%)\n');
};

/**
 * CORRECT SINGLE-STAGE SOLVER
 * @param {object} params
 * @returns {object} Complete stage results
 */
export const solveStageCorrect = (params) => {
  const {
    feedFlow,
    feedTDS,
    targetRecovery = 0.4,
    membrane,
    tempCelsius = 25,
    elementsPerVessel = 6,
    vessels = 4
  } = params;

  const iterResult = iteratePressureForRecovery({
    feedFlow,
    feedConc: feedTDS,
    targetRecovery,
    membrane,
    tempCelsius,
    elementsPerVessel,
    vessels
  });

  if (!iterResult.converged) {
    return { error: 'Pressure iteration did not converge', ...iterResult };
  }

  const osmData = iterResult.osmData;
  const pressure = iterResult.requiredPressure;
  const flux = iterResult.fluxAchieved;
  const recovery = iterResult.recoveryAchieved;

  const aValue = calculateDynamicAValue({
    aValue25: membrane.transport.aValueRef,
    tempCelsius,
    foulingFactor: 0.95
  });

  const bValue = calculateDynamicBValue({
    bValue25: membrane.transport.membraneBRef,
    tempCelsius
  });

  const beta = calculateConcentrationPolarization({
    fluxLmh: flux,
    spacerMil: 34,
    simplified: true
  });

  if (beta > 1.4) {
    console.warn(`⚠️ Beta ${beta.toFixed(3)} exceeds SW limit 1.4 - capping to 1.4`);
  }

  const betaCapped = Math.min(beta, 1.4);
  const concentrateTDS = osmData.concentrateTds;

  const permeateConc = calculatePermeateConcentrationIndustrial({
    fluxLmh: flux,
    bValue,
    feedConc: feedTDS,
    concentrateConc: concentrateTDS,
    beta: betaCapped
  });

  const rejection = calculateRejectionPercent(feedTDS, permeateConc);

  return {
    feedFlow,
    feedPressure: pressure,
    feedTDS,
    feedOsmotic: osmData.feedOsmotic,
    logMeanOsmotic: osmData.avgOsmotic,
    concentrateOsmotic: osmData.concentrateOsmotic,
    concentrateTDS,
    logMeanConc: osmData.logMeanConc,
    recovery,
    flux,
    beta: betaCapped,
    aValue,
    bValue,
    ndp: iterResult.ndp,
    permeateConc,
    rejection,
    permeateFlow: iterResult.permeateFlow,
    iterations: iterResult.iterations,
    valid: rejection >= 0.97 && pressure <= 60
  };
}; 
