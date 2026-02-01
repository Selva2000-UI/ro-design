/* ================= IMSDesign Hydraulic Engine (REFINED) ================= */

const FLOW_TO_M3H = {
    gpm: 0.2271,
    gpd: 0.0001577,
    mgd: 157.725,
    migd: 189.27,
    'm3/h': 1,
    'm3/d': 1 / 24,
    mld: 41.667
  };
  
  export const runHydraulicBalance = (config, membrane) => {
    /* ---------- 1. RAW INPUTS & SAFETY ---------- */
    const permeateInput = Number(config.permeateFlow) || 0;
    const unit = config.flowUnit || 'm3/h';
    const unitFactor = FLOW_TO_M3H[unit] ?? 1;
  
    // Clamp recovery between 1% and 99% to prevent Infinity errors
    const recoveryPercent = Math.min(Math.max(Number(config.recovery) || 15, 1), 99);
    const recovery = recoveryPercent / 100;
  
    const vessels = Number(config.stage1Vessels) || 0;
    const elementsPerVessel = Number(config.elementsPerVessel) || 0;
    
    // Use membrane area from object, fallback to 400 if missing
    const elementArea = Number(membrane?.area) || 400;
  
    const membraneAge = Number(config.membraneAge) || 0;
    const fluxDeclinePct = Number(config.fluxDeclinePerYear) || 0;
  
    /* ---------- 2. HYDRAULIC BALANCE (m3/h) ---------- */
    const permeate_m3h = permeateInput * unitFactor;
    const feed_m3h = permeate_m3h / recovery;
    const concentrate_m3h = feed_m3h - permeate_m3h;
  
    /* ---------- 3. FLUX CALCULATIONS ---------- */
    const totalElements = vessels * elementsPerVessel;
    const totalArea_m2 = totalElements * elementArea;
  
    let avgFlux_LMH = 0;
    if (totalArea_m2 > 0) {
      avgFlux_LMH = (permeate_m3h * 1000) / totalArea_m2;
    }
  
    // IMSDesign uses 0.589 to convert LMH to GFD
    const flux_GFD = avgFlux_LMH * 0.589;
  
    /* ---------- 4. AGEING / FOULING ---------- */
    // Formula: (1 - decline)^age
    const foulingFactor = Math.pow(1 - fluxDeclinePct / 100, membraneAge) || 1;
  
    /* ---------- 5. CHEMICAL MASS FLOW ---------- */
    let chemical_kg_hr = 0;
    const dose = Number(config.chemicalDose) || 0;
    if (config.doseUnit === 'mg/l') {
      chemical_kg_hr = (dose * feed_m3h) / 1000;
    } else if (config.doseUnit === 'lb/hr') {
      chemical_kg_hr = dose * 0.4536;
    } else {
      chemical_kg_hr = dose;
    }
  
    /* ---------- 6. UNIT BACK-CONVERSION ---------- */
    // Convert m3/h results back to the user's display unit (e.g. gpm)
    const feedDisplay = feed_m3h / unitFactor;
    const concDisplay = concentrate_m3h / unitFactor;
  
    return {
      feedFlow: feedDisplay.toFixed(2),
      concentrateFlow: concDisplay.toFixed(2),
      permeateFlow: permeateInput.toFixed(2),
      totalElements: totalElements,
      unit: unit
    };
  };