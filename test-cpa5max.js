const { calculateSystem } = require('./src/utils/calculatorService');

console.log('Testing CPA5-MAX-8040 with reference parameters...\n');

const result = calculateSystem({
  feedFlow: 438.60,
  flowUnit: 'm3/h',
  recovery: 57,
  vessels: 4,
  elementsPerVessel: 4,
  membraneModel: 'cpa5max8040',
  feedPh: 7.0,
  temp: 25,
  feedIons: {
    ca: 0,
    mg: 0,
    na: 100,
    k: 0,
    sr: 0,
    ba: 0,
    hco3: 0,
    so4: 0,
    cl: 100,
    no3: 0,
    sio2: 0,
    po4: 0,
    f: 0,
    b: 0,
    co2: 0,
    co3: 0,
    nh4: 0
  },
  stages: [
    { membraneModel: 'cpa5max8040', elementsPerVessel: 4, vessels: 4 }
  ]
});

console.log('RESULTS COMPARISON:');
console.log('===================');
console.log('Parameter                  | Expected   | Calculated');
console.log('---------------------------|------------|----------');
console.log('Flux (lmh)                 | 382.0      | ' + result.results.avgFluxLMH);
console.log('Highest Flux (lmh)         | 420.3      | ' + result.results.highestFlux);
console.log('Highest Beta               | 1.27       | ' + result.results.highestBeta);
console.log('Feed Pressure (bar)        | 132.1      | ' + result.results.feedPressure);
console.log('Concentrate Pressure (bar) | 105.6      | ' + result.results.concPressure);
console.log('Recovery (%)               | 57.0       | ' + result.results.recovery);
console.log('Permeate TDS (mg/l)        | 0.48       | ' + result.permeateParameters.tds);
console.log('Permeate pH                | 4.1        | ' + result.permeateParameters.ph);
console.log('\nSTAGE RESULTS:');
console.log('==============');
if (result.stageResults && result.stageResults.length > 0) {
  const stage = result.stageResults[0];
  console.log('Vessels:', stage.vessels);
  console.log('Feed per vessel (m3/h):', stage.feedFlow);
  console.log('Concentrate per vessel (m3/h):', stage.concFlow);
  console.log('Flux per vessel (lmh):', stage.flux);
  console.log('Highest Flux per vessel (lmh):', stage.highestFlux);
  console.log('Beta Factor:', stage.highestBeta);
  console.log('Feed Pressure:', stage.feedPressure, stage.pressureUnit);
  console.log('Concentrate Pressure:', stage.concPressure, stage.pressureUnit);
}

console.log('\nPERMEATE ION CONCENTRATIONS:');
console.log('============================');
Object.entries(result.permeateConcentration || {}).forEach(([ion, value]) => {
  if (parseFloat(value) > 0.001) {
    console.log(ion + ':', value, 'mg/l');
  }
});
