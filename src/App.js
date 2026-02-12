import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import WaterAnalysis from './components/WaterAnalysis';
import PreTreatment from './components/PreTreatment';
import SystemDesign from './components/SystemDesign';
import PostTreatment from './components/PostTreatment';
import Report from './components/Report';
import MembraneEditor from './components/MembraneEditor';
import DesignGuidelines from './components/DesignGuidelines';
import ValidationBanner from './components/ValidationBanner';
import { calculateSystem } from './utils/calculatorService';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isGuidelineOpen, setIsGuidelineOpen] = useState(false);
  const fileInputRef = useRef(null);

  const FLOW_TO_M3H = useMemo(() => ({
    gpm: 0.2271247,
    gpd: 0.00378541 / 24,
    mgd: 157.725,
    migd: 189.42,
    'm3/h': 1,
    'm3/d': 1 / 24,
    mld: 41.6667
  }), []);

  const DEFAULT_SYSTEM_CONFIG = useMemo(() => ({
    // Inputs (follow IMSDesign layout: System-level total + trains; Train values are calculated)
    feedPh: 7.0,
    recovery: 52,
    flowUnit: 'gpm', // gpm/gpd/mgd/migd/m3/h/m3/d/mld
    feedFlow: 100,
    averageFlux: 15.0,
    permeateFlow: 0, // train permeate flow in selected unit
    numTrains: 1,

    // Array specification
    stage1Vessels: 4,
    stage2Vessels: 0,
    elementsPerVessel: 6,
    membraneModel: 'cpa3',
    pass1Stages: 1, // Initially only 1 stage is active
    stages: [
      { membraneModel: 'cpa3', elementsPerVessel: 6, vessels: 4 },
      { membraneModel: 'cpa3', elementsPerVessel: 6, vessels: 0 },
      { membraneModel: 'cpa3', elementsPerVessel: 6, vessels: 0 },
      { membraneModel: 'cpa3', elementsPerVessel: 6, vessels: 0 },
      { membraneModel: 'cpa3', elementsPerVessel: 6, vessels: 0 },
      { membraneModel: 'cpa3', elementsPerVessel: 6, vessels: 0 }
    ],

    // Flux display
    fluxUnit: 'gfd', // gfd | lmh

    // Hydranautics behavior: flux stays 0 until "Recalculate array"
    designCalculated: false,

    // Conditions
    membraneAge: 0,
    fluxDeclinePerYear: 5,
    foulingFactor: 1,
    spIncreasePerYear: 7,

    // Chemical (as per IMSDesign "Pass 1")
    chemical: 'None',
    chemicalConcentration: 100, // %
    chemicalDose: 0,
    doseUnit: 'mg/l', // mg/l | lb/hr | kg/hr

    // Economics
    energyCostPerKwh: 0.12
  }), []);

  // --- 1. STATE MANAGEMENT ---
  const [snapshots, setSnapshots] = useState([]); 
  const [membranes, setMembranes] = useState([
    { id: 'espa2ld', name: 'ESPA2-LD-4040', area: 80, areaM2: 7.43, aValue: 4.43, rejection: 99.6, monoRejection: 96.0, divalentRejection: 99.7, silicaRejection: 98.0, boronRejection: 90.0, alkalinityRejection: 99.5, co2Rejection: 0.0, kFb: 0.315, dpExponent: 1.75, type: 'Brackish' },
    { id: 'cpa3', name: 'CPA3', area: 400, areaM2: 37.16, aValue: 3.16, rejection: 99.7, monoRejection: 98.0, divalentRejection: 99.9, silicaRejection: 99.0, boronRejection: 92.0, alkalinityRejection: 99.8, co2Rejection: 0.0, kFb: 0.38, dpExponent: 1.75, type: 'Brackish' },
    { id: 'swc5ld', name: 'SWC5-LD', area: 400, areaM2: 37.16, aValue: 1.6, rejection: 99.3, monoRejection: 98.0, divalentRejection: 99.8, silicaRejection: 99.0, boronRejection: 92.0, alkalinityRejection: 99.7, co2Rejection: 0.0, kFb: 0.35, dpExponent: 1.75, type: 'Seawater' },
    { 
      id: 'lfc3ld4040',
      name: 'LFC3-LD-8040',
      area: 400,
      areaM2: 37.16,
      aValue: 3.16,
      rejection: 99.3,
      monoRejection: 92.0,
      divalentRejection: 99.95,
      silicaRejection: 99.95,
      boronRejection: 99.9,
      alkalinityRejection: 99.985,
      co2Rejection: 0.0,
      kFb: 0.315,
      dpExponent: 1.75,
      type: 'Low Fouling'
    }
  ]); 
  
  const [projectNotes, setProjectNotes] = useState(""); 
  const createProjectId = () => `proj_${Date.now()}`;
  const [waterData, setWaterData] = useState({
    projectId: createProjectId(),
    projectName: 'New_Project_V3',
    clientName: '',
    calculatedBy: '',
    pretreatment: 'Conventional',
    waterType: 'Well Water',
    calculatedTds: 0,
    temp: 25, ph: 7.5, ca: 60, mg: 20, na: 250, k: 15,
    hco3: 250, so4: 100, cl: 300, no3: 25, sio2: 20,
    nh4: 0, sr: 0, ba: 0, po4: 0, f: 0, b: 0, co2: 0, co3: 0
  });

  const [systemConfig, setSystemConfig] = useState(DEFAULT_SYSTEM_CONFIG);

  const [pretreatment, setPretreatment] = useState({ antiscalantDose: 3.5, sbsDose: 2.0 });
  const [postTreatment, setPostTreatment] = useState({ causticDose: 2.0 });
  
  const applyTdsProfile = (tdsValue) => {
  const tds = Number(tdsValue) || 0;
  if (tds <= 0) return;

  const EW_NA = 23;
  const EW_CL = 35.45;

  const totalMeq = tds / (EW_NA + EW_CL);

  const na = totalMeq * EW_NA;
  const cl = totalMeq * EW_CL;

  setWaterData(prev => ({
    ...prev,
    calculatedTds: tds,
    na: Number(na.toFixed(2)),
    cl: Number(cl.toFixed(2))
  }));
};

  const [projection, setProjection] = useState({ 
    fluxGFD: 0, pumpPressure: 0, monthlyEnergyCost: 0, permeateFlow: 0 
  });
  const [recentProjects, setRecentProjects] = useState([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  
  // Store base numeric values (without unit conversion) to preserve them when unit changes
  const baseValuesRef = useRef({ 
    permeate: null, 
    feed: null, 
    concentrate: null, 
    unit: null 
  });

  // --- 2. MASTER CALCULATION ENGINE ---
  useEffect(() => {
    const unit = FLOW_TO_M3H[systemConfig.flowUnit] ? systemConfig.flowUnit : 'gpm';
    const unitFactor = FLOW_TO_M3H[unit] ?? 1;
    const isGpm = ['gpm', 'gpd', 'mgd', 'migd'].includes(unit);

    const trains = Math.max(Number(systemConfig.numTrains) || 1, 1);
    
    // User gives Feed Flow and Recovery as primary inputs now
    const trainFeedInput = Number(systemConfig.feedFlow) || 0;
    const perTrainFeed_m3h = trainFeedInput * unitFactor;
    
    // Recovery input from user
    let recoveryPct = Math.min(Math.max(Number(systemConfig.recovery) || 0, 0), 99);
    
    // Calculate total elements and area across all active stages
    // Use stages array if available, otherwise fall back to legacy stage1Vessels/stage2Vessels
    let totalElements = 0;
    let totalArea_ft2 = 0;
    const pass1Stages = Math.min(Math.max(Number(systemConfig.pass1Stages) || 1, 1), 6);
    
    if (systemConfig.stages && systemConfig.stages.length > 0) {
      // Sum elements from all active stages (up to pass1Stages)
      for (let i = 0; i < pass1Stages; i++) {
        const stage = systemConfig.stages[i];
        if (stage) {
          const stageVessels = Number(stage.vessels) || 0;
          const stageElementsPerVessel = Number(stage.elementsPerVessel) || 0;
          totalElements += stageVessels * stageElementsPerVessel;
          const stageMembrane = membranes.find(m => m.id === stage.membraneModel) || membranes[0];
          const stageArea = stage.membraneModel === 'espa2ld' ? 80 : (Number(stageMembrane?.area) || 400);
          totalArea_ft2 += stageVessels * stageElementsPerVessel * stageArea;
        }
      }
    } else {
      // Legacy fallback: use stage1Vessels and stage2Vessels
      totalElements = (Number(systemConfig.stage1Vessels) + Number(systemConfig.stage2Vessels)) * Number(systemConfig.elementsPerVessel);
    }
    
    // Get membrane area - use first stage's membrane if stages array exists, otherwise use membraneModel
    let activeMem;
    if (systemConfig.stages && systemConfig.stages.length > 0 && systemConfig.stages[0]) {
      activeMem = membranes.find(m => m.id === systemConfig.stages[0].membraneModel) || membranes[0];
    } else {
      activeMem = membranes.find(m => m.id === systemConfig.membraneModel) || membranes[0];
    }
    
    // Ensure we have a valid membrane with area
    const activeMemId = systemConfig.stages?.[0]?.membraneModel || systemConfig.membraneModel;
    const membraneArea = activeMemId === 'espa2ld' ? 80 : (Number(activeMem?.area) || 400);
    if (totalArea_ft2 === 0) {
      totalArea_ft2 = totalElements * membraneArea;
    }
    const totalArea_m2 = totalArea_ft2 * 0.09290304;

    const currentGpmConst = 0.0556 * (membraneArea / 400);

    let perTrainProduct_m3h = 0;
    const feedPressureInput = Number(systemConfig.feedPressure);

    const activeStages = systemConfig.stages?.slice(0, pass1Stages) || [];
    const totalStageVessels = activeStages.reduce((sum, stage) => sum + (Number(stage?.vessels) || 0), 0);

    if (feedPressureInput > 0) {
        // SOLVE FOR RECOVERY based on Feed Pressure
        // Qp = Area * A * (P_feed - 0.5*dP - P_perm - Pi_avg)
        // Pi_avg depends on R. We iterate.
        const P_feed_bar = isGpm ? feedPressureInput / 14.5038 : feedPressureInput;
        // Calculate Pi_feed (Osmotic Pressure of feed)
        const ions = {
            ca: Number(waterData.ca) || 0,
            mg: Number(waterData.mg) || 0,
            na: Number(waterData.na) || 0,
            k: Number(waterData.k) || 0,
            sr: Number(waterData.sr) || 0,
            ba: Number(waterData.ba) || 0,
            hco3: Number(waterData.hco3) || 0,
            so4: Number(waterData.so4) || 0,
            cl: Number(waterData.cl) || 0,
            no3: Number(waterData.no3) || 0,
            sio2: Number(waterData.sio2) || 0,
            po4: Number(waterData.po4) || 0,
            f: Number(waterData.f) || 0,
            b: Number(waterData.b) || 0,
            co2: Number(waterData.co2) || 0,
            co3: Number(waterData.co3) || 0,
            nh4: Number(waterData.nh4) || 0
        };
        const feedTDS = Object.values(ions).reduce((sum, v) => sum + v, 0);
        const piFeed_bar = 0.00078 * feedTDS;
        
        // Flow-dependent dP (Standardized to match calculatorService)
        const nominalFlow = 12; 
        const perVesselFeed = perTrainFeed_m3h / (totalStageVessels || 1);
        const flowFactor = Math.pow(Math.max(perVesselFeed, 0.01) / nominalFlow, 1.5);
        const is4040 = membraneArea < 150; // ft2
        const vesselDeltaP_bar = (Number(systemConfig.elementsPerVessel) || 7) * (is4040 ? 1.33 : 0.23) * flowFactor;

        // Use the recovery from systemConfig as the starting point (defaults to 0.525 as requested)
        let currentR = (Number(systemConfig.recovery) || 52.5) / 100;
        for (let iter = 0; iter < 10; iter++) {
            const cfLogMean = currentR > 0.01 ? -Math.log(1 - Math.min(currentR, 0.99)) / currentR : 1;
            const piEff_bar = piFeed_bar * Math.pow(cfLogMean, 0.5);
            
            // Per user rule: Display P_feed = P_input + P_perm
            // Effective P_feed for calculation is just P_input
            // NDP = (P_input + P_perm) - 0.5*dP - P_perm - Pi_eff = P_input - 0.5*dP - Pi_eff
            const netDrivingPressure = Math.max(P_feed_bar - (0.5 * vesselDeltaP_bar) - piEff_bar, 0);
            
            const A_lmh_bar = Number(activeMem?.aValue) || 2.95;
            const Max_flux = (activeMem?.id === 'cpa3') ? 51.8 : 48.5;
            const Qp_lmh = Math.min(A_lmh_bar * netDrivingPressure, Max_flux);
            const Qp_m3h = (Qp_lmh * totalArea_m2) / 1000;
            perTrainProduct_m3h = Qp_m3h;
            currentR = perTrainFeed_m3h > 0 ? perTrainProduct_m3h / perTrainFeed_m3h : 0.5;
            currentR = Math.min(Math.max(currentR, 0.01), 0.95);
        }
        recoveryPct = currentR * 100;
    } else {
        // NORMAL MODE: Calculate Permeate Flow from Recovery and Feed Flow
        perTrainProduct_m3h = perTrainFeed_m3h * (recoveryPct / 100);
    }

    const recovery = recoveryPct / 100;
    const trainPermeateInput = perTrainProduct_m3h / unitFactor;
    const totalProduct_m3h = perTrainProduct_m3h * trains;

    const perTrainConc_m3h = perTrainFeed_m3h - perTrainProduct_m3h;

    const calcResults = calculateSystem({
      feedFlow: trainFeedInput,
      recovery: recoveryPct,
      vessels: totalStageVessels || Number(systemConfig.stage1Vessels) || 1,
      elementsPerVessel: Number(systemConfig.elementsPerVessel) || 0,
      feedPH: Number(systemConfig.feedPh) || Number(waterData.ph) || 7.0,
      tempF: (Number(waterData.temp) * 9 / 5) + 32,
      feedIons: {
        ca: Number(waterData.ca) || 0,
        mg: Number(waterData.mg) || 0,
        na: Number(waterData.na) || 0,
        k: Number(waterData.k) || 0,
        sr: Number(waterData.sr) || 0,
        ba: Number(waterData.ba) || 0,
        hco3: Number(waterData.hco3) || 0,
        so4: Number(waterData.so4) || 0,
        cl: Number(waterData.cl) || 0,
        no3: Number(waterData.no3) || 0,
        sio2: Number(waterData.sio2) || 0,
        po4: Number(waterData.po4) || 0,
        f: Number(waterData.f) || 0,
        b: Number(waterData.b) || 0,
        co2: Number(waterData.co2) || 0,
        co3: Number(waterData.co3) || 0,
        nh4: Number(waterData.nh4) || 0
      },
      stages: activeStages,
      membranes,
      flowUnit: unit,
      fluxUnit: systemConfig.fluxUnit,
      membraneAge: systemConfig.membraneAge,
      fluxDeclinePerYear: systemConfig.fluxDeclinePerYear,
      spIncreasePerYear: systemConfig.spIncreasePerYear,
      foulingFactor: systemConfig.foulingFactor,
      membraneModel: systemConfig.membraneModel,
      permeatePressure: systemConfig.permeatePressure,
      feedPressure: systemConfig.feedPressure,
      numTrains: systemConfig.numTrains
    });
    const stageResults = calcResults?.stageResults || [];
    
    // Calculate flux - always calculate, but only display if designCalculated is true
    // Flux (lmh) = Qp(m3/h) * 1000 / Am(m2)
    // Flux (gfd) = Flux (lmh) / 1.6976
    
    let rawFluxLMH = totalArea_m2 > 0 ? (perTrainProduct_m3h * 1000) / totalArea_m2 : 0;
    
    if (calcResults?.results) {
        rawFluxLMH = calcResults.results.avgFluxLMH;
    }
    
    // Debug logging to understand why flux is 0 (only log when calculated but still 0)
   if (systemConfig.designCalculated && rawFluxLMH === 0) {
      console.warn('Flux is 0 after calculation! Debug info:');
      console.log('  - designCalculated:', systemConfig.designCalculated);
      console.log('  - totalElements:', totalElements);
      console.log('  - membraneArea:', membraneArea);
      console.log('  - totalArea_ft2:', totalArea_ft2);
      console.log('  - totalArea_m2:', totalArea_m2);
      console.log('  - perTrainProduct_m3h:', perTrainProduct_m3h);
      console.log('  - rawFluxLMH:', rawFluxLMH);
      console.log('  - fluxUnit:', calcResults?.results?.fluxUnit);
      console.log('  - pass1Stages:', systemConfig.pass1Stages);
      console.log('  - stages:', systemConfig.stages?.map((s, i) => ({ 
        stage: i + 1, 
        vessels: s.vessels, 
        elements: s.elementsPerVessel,
        membrane: s.membraneModel 
      })));
    }

    // Check if only the unit changed (not the permeate flow value)
    // If so, use the stored base values and just reformat with new precision
    const permeateNumeric = Number(trainPermeateInput) || 0;
    const prevPermeate = baseValuesRef.current.permeate;
    const prevUnit = baseValuesRef.current.unit;
    const onlyUnitChanged = false; // Disable this logic as it causes stale value issues with manual inputs
    
    // Back-convert for display (train-level, same unit as UI)
    let perTrainProduct_display, perTrainFeed_display, perTrainConc_display;
    
    if (onlyUnitChanged && baseValuesRef.current.feed !== null) {
      // Only unit changed - use stored values, just reformat
      perTrainProduct_display = baseValuesRef.current.permeate;
      perTrainFeed_display = baseValuesRef.current.feed;
      perTrainConc_display = baseValuesRef.current.concentrate;
    } else {
      // Permeate flow changed or first calculation - calculate normally
      perTrainProduct_display = trainPermeateInput;
      perTrainFeed_display = perTrainFeed_m3h / unitFactor;
      perTrainConc_display = perTrainConc_m3h / unitFactor;
      
      // Store base values for next unit change
      baseValuesRef.current = {
        permeate: permeateNumeric,
        feed: perTrainFeed_display,
        concentrate: perTrainConc_display,
        unit: unit
      };
    }
    
    const totalPlantProduct_display = perTrainProduct_display * trains;

    // Format flows based on unit type (matching Hydranautics precision exactly)
    // gpm, m3/h: 2 decimals (e.g., 166.70, 66.70)
    // gpd, m3/d: 1 decimal (e.g., 166.7, 66.7)
    // mgd, migd, mld: 3 decimals (e.g., 166.700, 66.700)
    const getFlowDecimals = (flowUnit) => {
      if (['gpm', 'm3/h'].includes(flowUnit)) return 2;
      if (['gpd', 'm3/d'].includes(flowUnit)) return 1;
      if (['mgd', 'migd', 'mld'].includes(flowUnit)) return 3;
      return 2; // default
    };
    const flowDecimals = getFlowDecimals(unit);

    // Format function that matches Hydranautics display behavior
    // When unit changes, we want to keep the same numeric values, just change precision
    const formatFlow = (value, decimals) => {
      // Parse the value to get the raw number, then format with new precision
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      return Number(numValue).toFixed(decimals);
    };

    // Chemical usage (basis: train feed flow)
    const dose = Number(systemConfig.chemicalDose) || 0;
    const concPct = Math.min(Math.max(Number(systemConfig.chemicalConcentration) || 100, 1), 100);
    let chemicalActive_kg_hr = 0;
    if (systemConfig.doseUnit === 'mg/l') {
      // mg/L * m3/h -> kg/h
      chemicalActive_kg_hr = (dose * perTrainFeed_m3h) / 1000;
    } else if (systemConfig.doseUnit === 'lb/hr') {
      chemicalActive_kg_hr = dose * 0.45359237;
    } else if (systemConfig.doseUnit === 'kg/hr') {
      chemicalActive_kg_hr = dose;
    }
    const chemicalSolution_kg_hr = chemicalActive_kg_hr / (concPct / 100);

    // Keep the existing (simplified) pressure/energy model, but make it consistent with the new flow basis.
    const TCF = Math.exp(2640 * (1 / 298.15 - 1 / (Number(waterData.temp) + 273.15)));
    const CF = 1 / (1 - recovery);

    const getNumeric = (value) => Number(value) || 0;
    const ionFeed = {
      ca: getNumeric(waterData.ca),
      mg: getNumeric(waterData.mg),
      na: getNumeric(waterData.na),
      k: getNumeric(waterData.k),
      sr: getNumeric(waterData.sr),
      ba: getNumeric(waterData.ba),
      hco3: getNumeric(waterData.hco3),
      so4: getNumeric(waterData.so4),
      cl: getNumeric(waterData.cl),
      no3: getNumeric(waterData.no3),
      sio2: getNumeric(waterData.sio2),
      po4: getNumeric(waterData.po4),
      b: getNumeric(waterData.b),
      f: getNumeric(waterData.f),
      co2: getNumeric(waterData.co2),
      co3: getNumeric(waterData.co3)
    };

    const membraneRejection = Math.min(Math.max(Number(activeMem?.rejection) || 99.7, 80), 99.9);
    const defaultMono = Math.max(Math.min((Number(activeMem?.monoRejection) || (membraneRejection - 6)), 99.9), 80);
    const defaultDivalent = Math.max(Math.min((Number(activeMem?.divalentRejection) || membraneRejection), 99.9), 80);
    const silicaRejection = Math.max(Math.min((Number(activeMem?.silicaRejection) || (membraneRejection - 1)), 99.9), 80);
    const boronRejection = Math.max(Math.min((Number(activeMem?.boronRejection) || (membraneRejection - 8)), 99.9), 60);
    const alkalinityRejection = Math.max(Math.min((Number(activeMem?.alkalinityRejection) || (membraneRejection - 0.2)), 99.9), 80);
    const co2Rejection = Math.max(Math.min((Number(activeMem?.co2Rejection) || 0), 99.9), 0);

    const getSanitizedAValue = (m) => {
        let a = Number(m?.aValue);
        if (isNaN(a) || a <= 0) return 2.95;
        if (a < 1.0) return a * 24.62; // Convert gfd/psi to lmh/bar (1.6976 * 14.5038)
        return a;
    };

    const getIonRejection = (ionKey) => {
      const overrides = activeMem?.ionRejectionOverrides || {};
      if (overrides[ionKey] != null) return Number(overrides[ionKey]);
      if (['ca', 'mg', 'sr', 'ba', 'so4', 'po4'].includes(ionKey)) return defaultDivalent;
      if (['na', 'k', 'cl', 'no3', 'f'].includes(ionKey)) return defaultMono;
      if (['hco3', 'co3'].includes(ionKey)) return alkalinityRejection;
      if (ionKey === 'sio2') return silicaRejection;
      if (ionKey === 'b') return boronRejection;
      if (ionKey === 'co2') return co2Rejection;
      return membraneRejection;
    };

    const formatConc = (value) => Number(value).toFixed(3);
    const sumValues = (obj) => Object.values(obj).reduce((sum, val) => sum + (Number(val) || 0), 0);

    // Calculate average concentration factor
    const cfAvg = recovery > 0.01 ? -Math.log(1 - recovery) / recovery : 1;
    const testFluxLMH = 25; 

    const permeateConcentration = calcResults?.permeateConcentration || calcResults?.permeateIons || Object.fromEntries(
      Object.entries(ionFeed).map(([key, value]) => {
        const rejection = getIonRejection(key);
        const saltPassageTest = Math.max(1 - rejection / 100, 0);
        const ionB = testFluxLMH * saltPassageTest * spFactor;
        const ionSPActual = ionB / (Math.max(rawFluxLMH, 0.1) + ionB);
        const ionCavg = value * cfAvg;
        const permVal = ionCavg * ionSPActual;
        
        if (key === 'na' || key === 'cl') {
          return [key, Number(permVal).toFixed(2)];
        }
        return [key, formatConc(permVal)];
      })
    );
    const concentrateConcentration = calcResults?.concentrateConcentration || calcResults?.concentrateIons || Object.fromEntries(
      Object.entries(ionFeed).map(([key, value]) => [key, formatConc(value * CF)])
    );

    const permeateTds = calcResults?.permeateParameters?.tds != null
      ? Number(calcResults.permeateParameters.tds)
      : sumValues(permeateConcentration);
    const concentrateTds = calcResults?.concentrateParameters?.tds != null
      ? Number(calcResults.concentrateParameters.tds)
      : sumValues(concentrateConcentration);
    const osmoticP = calcResults?.concentrateParameters?.osmoticPressure != null
      ? Number(calcResults.concentrateParameters.osmoticPressure)
      : (isGpm ? (concentrateTds * 0.00076) * 14.5038 : (concentrateTds * 0.00076));

    // Ageing / fouling / SP increase: approximate Hydranautics behaviour
    const membraneAge = Math.max(Number(systemConfig.membraneAge) || 0, 0);
    const fluxDeclinePct = Math.min(Math.max(Number(systemConfig.fluxDeclinePerYear) || 0, 0), 99);
    const spIncreasePct = Math.min(Math.max(Number(systemConfig.spIncreasePerYear) || 0, 0), 200);
    const foulingFactorRaw = Number(systemConfig.foulingFactor);
    const foulingFactorValue = Number.isFinite(foulingFactorRaw)
      ? Math.min(Math.max(foulingFactorRaw, 0.35), 1)
      : 1;

    const aBase = getSanitizedAValue(activeMem);
    const aEffective = aBase * Math.pow(1 - fluxDeclinePct / 100, membraneAge);
    const spFactor = Math.pow(1 + spIncreasePct / 100, membraneAge);

    const permeateFlowGpm = perTrainProduct_m3h * 4.402867;
    const avgFluxVal = calcResults?.results?.avgFlux != null 
        ? Number(calcResults.results.avgFlux) 
        : (totalElements > 0 ? permeateFlowGpm / (totalElements * currentGpmConst) : 0);

    // Pump model expects a flux-like term; use rawFluxLMH to ensure consistency regardless of unit display
    const pressureTerm = (rawFluxLMH / (aEffective * TCF)) * foulingFactorValue;
    const pumpPressure = calcResults?.results?.feedPressure != null
      ? Number(calcResults.results.feedPressure)
      : (pressureTerm + osmoticP + 1.2) * spFactor;

    // Use total plant feed for power (m3/h)
    const totalFeed_m3h = perTrainFeed_m3h * trains;
    const powerKw = (pumpPressure * totalFeed_m3h) / (36.7 * 0.75);
    const monthlyEnergy = powerKw * 24 * 30 * Number(systemConfig.energyCostPerKwh);

    // Format flux: Return 1 decimal place as requested for Average Flux display
    const formatFlux = (value, isCalculated, flowUnit) => {
      return Number(value || 0).toFixed(1);
    };

    const feedPhForCalc = Number(systemConfig.feedPh) || Number(waterData.ph) || 7.0;
    const permeatePh = calcResults?.permeateParameters?.ph != null
      ? Number(calcResults.permeateParameters.ph)
      : Math.min(Math.max(feedPhForCalc - 1.69, 0), 14);
    const concentratePh = calcResults?.concentrateParameters?.ph != null
      ? Number(calcResults.concentrateParameters.ph)
      : Math.min(Math.max(feedPhForCalc + Math.log10(CF), 0), 14);
    // Langelier Saturation Index (simplified, consistent with PreTreatment)
    const pCa = 5.0 - Math.log10(Math.max(getNumeric(concentrateConcentration.ca) * 2.5, 0.0001));
    const pAlk = 5.0 - Math.log10(Math.max(getNumeric(concentrateConcentration.hco3) * 0.82, 0.0001));
    const C = (Math.log10(Math.max(concentrateTds, 1)) - 1) / 10 + (Number(waterData.temp) > 25 ? 2.0 : 2.3);
    const phs = C + pCa + pAlk;
    const lsi = concentratePh - phs;
    const ccpp = lsi > 0 ? lsi * 50 : 0;

    const caConc = getNumeric(concentrateConcentration.ca);
    const so4Conc = getNumeric(concentrateConcentration.so4);
    const baConc = getNumeric(concentrateConcentration.ba);
    const srConc = getNumeric(concentrateConcentration.sr);
    const sio2Conc = getNumeric(concentrateConcentration.sio2);
    const po4Conc = getNumeric(concentrateConcentration.po4);
    const fConc = getNumeric(concentrateConcentration.f);

    const concentrateSaturation = calcResults?.concentrateSaturation || {
      caSo4: Number((caConc * so4Conc) / 1000).toFixed(1),
      baSo4: Number((baConc * so4Conc) / 50).toFixed(1),
      srSo4: Number((srConc * so4Conc) / 2000).toFixed(1),
      sio2: Number((sio2Conc / 120) * 100).toFixed(1),
      ca3po42: Number((caConc * po4Conc) / 100).toFixed(2),
      caF2: Number((caConc * fConc) / 500).toFixed(1)
    };

    const concentrateParameters = calcResults?.concentrateParameters || {
      osmoticPressure: Number(osmoticP).toFixed(2),
      ccpp: Number(ccpp).toFixed(1),
      langelier: lsi.toFixed(2),
      ph: concentratePh.toFixed(1),
      tds: concentrateTds.toFixed(1)
    };
    const permeateParameters = calcResults?.permeateParameters || {
      ph: permeatePh.toFixed(1),
      tds: permeateTds.toFixed(1)
    };

    setProjection({
      // Train-level flows (match IMSDesign Train Information box with unit-based precision)
      permeateFlow: formatFlow(perTrainProduct_display, flowDecimals),
      feedFlow: formatFlow(perTrainFeed_display, flowDecimals),
      concentrateFlow: formatFlow(perTrainConc_display, flowDecimals),
      recovery: recoveryPct.toFixed(1),

      // System-level flows (used by other tabs/models)
      totalPlantProductFlowM3h: totalProduct_m3h.toFixed(3),
      totalPlantProductFlowDisplay: formatFlow(totalPlantProduct_display, flowDecimals),
      flowUnit: unit,
      feedFlowM3h: perTrainFeed_m3h.toFixed(3),
      totalFeedFlowM3h: totalFeed_m3h.toFixed(3),

      // Core KPIs - flux formatting matches Hydranautics (0 with unit-based decimals when not calculated)
      fluxGFD: formatFlux(avgFluxVal, systemConfig.designCalculated, unit),
      fluxLMH: formatFlux(avgFluxVal, systemConfig.designCalculated, unit),
      calcFluxDisplay: calcResults?.results?.calcFlux ?? '0.0',
      displayFluxUnit: calcResults?.results?.fluxUnit ?? (unit === 'gpm' ? 'gfd' : 'lmh'),
      highestBeta: calcResults?.results?.highestBeta ?? '0.000',
      pumpPressure: pumpPressure.toFixed(1),
      monthlyEnergyCost: monthlyEnergy.toFixed(2),

      chemicalActiveKgHr: chemicalActive_kg_hr.toFixed(3),
      chemicalSolutionKgHr: chemicalSolution_kg_hr.toFixed(3),

      tcf: TCF.toFixed(2),
      activeMembrane: activeMem,
      totalElements: totalElements,
      
      
      
      calcFeedPressurePsi: calcResults?.results ? Number(calcResults.results.feedPressure).toFixed(2) : '0.00',
      calcConcPressurePsi: calcResults?.results ? Number(calcResults.results.concPressure).toFixed(2) : '0.00',

      calcFeedFlowGpm: calcResults?.results?.feedFlowVessel ?? '0.00',
      calcConcFlowGpm: calcResults?.results?.concFlowVessel ?? '0.00',
      calcFluxGfd: calcResults?.results?.avgFluxGFD ?? '0.0',
      calcHighestFluxGfd: calcResults?.results?.highestFlux ?? '0.0',
      calcHighestBeta: calcResults?.results?.highestBeta ?? '0.00',
      customFluxWorkflow: calcResults?.customFluxWorkflow,
      stageResults,
      designWarnings: calcResults?.designWarnings || [],
      results: calcResults?.results,

      permeateConcentration,
      concentrateConcentration,
      concentrateSaturation,
      concentrateParameters,
      permeateParameters
    });
  }, [waterData, systemConfig, membranes, FLOW_TO_M3H]);

  // --- 3. PERSISTENCE ---
  const updateRecentProjects = useCallback((dataToSave) => {
    const entry = {
      id: dataToSave?.waterData?.projectId || createProjectId(),
      name: dataToSave?.waterData?.projectName || 'Untitled',
      clientName: dataToSave?.waterData?.clientName || '',
      waterType: dataToSave?.waterData?.waterType || '',
      updatedAt: new Date().toISOString(),
      data: dataToSave
    };
    const stored = localStorage.getItem('ro_pro_recent_projects');
    let existing = [];
    if (stored) {
      try {
        existing = JSON.parse(stored) || [];
      } catch (e) {
        existing = [];
      }
    }
    const filtered = existing.filter(item => item.id !== entry.id);
    const next = [entry, ...filtered].slice(0, 10);
    setRecentProjects(next);
    localStorage.setItem('ro_pro_recent_projects', JSON.stringify(next));
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('ro_pro_v3_master_final');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        const incomingWater = p.waterData || {};
        const hydratedWater = {
          ...incomingWater,
          projectId: incomingWater.projectId || createProjectId()
        };
        setWaterData(hydratedWater);
        const merged = { ...DEFAULT_SYSTEM_CONFIG, ...(p.systemConfig || {}) };
        // Back-compat: older saves had totalPlantProductFlow instead of permeateFlow
        if ((merged.permeateFlow === undefined || merged.permeateFlow === null) && merged.totalPlantProductFlow != null) {
          const trains = Math.max(Number(merged.numTrains) || 1, 1);
          merged.permeateFlow = Number(merged.totalPlantProductFlow) / trains;
        }
        setSystemConfig(merged);
        setMembranes(p.membranes || membranes);
        setProjectNotes(p.projectNotes || "");
        setSnapshots(p.snapshots || []);
        setPretreatment(p.pretreatment || pretreatment);
        setPostTreatment(p.postTreatment || postTreatment);
      } catch (e) { console.error("Restore failed", e); }
    }
    const recent = localStorage.getItem('ro_pro_recent_projects');
    if (recent) {
      try {
        const parsed = JSON.parse(recent);
        if (Array.isArray(parsed)) setRecentProjects(parsed);
      } catch (e) { console.error("Recent projects restore failed", e); }
    }
    setIsLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isLoaded) {
      const dataToSave = { waterData, systemConfig, membranes, snapshots, projectNotes, pretreatment, postTreatment };
      localStorage.setItem('ro_pro_v3_master_final', JSON.stringify(dataToSave));
      updateRecentProjects(dataToSave);
    }
  }, [waterData, systemConfig, membranes, snapshots, projectNotes, pretreatment, postTreatment, isLoaded, updateRecentProjects, DEFAULT_SYSTEM_CONFIG]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!isLoaded) return;
      const dataToSave = { waterData, systemConfig, membranes, snapshots, projectNotes, pretreatment, postTreatment };
      localStorage.setItem('ro_pro_v3_master_final', JSON.stringify(dataToSave));
      updateRecentProjects(dataToSave);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [waterData, systemConfig, membranes, snapshots, projectNotes, pretreatment, postTreatment, isLoaded, updateRecentProjects, DEFAULT_SYSTEM_CONFIG]);

  // --- 4. ACTION HANDLERS ---
  const takeSnapshot = () => {
    const name = prompt("Enter snapshot name (e.g. 'Case 1 - Winter'):");
    if (name) {
      const newSnapshot = {
        id: Date.now(),
        name,
        timestamp: new Date().toLocaleTimeString(),
        results: { ...projection },
        config: { ...systemConfig }
      };
      setSnapshots([...snapshots, newSnapshot]);
      alert("Snapshot added to Report tab.");
    }
  };

  const handleReset = () => {
    if (window.confirm("WARNING: This will delete all design data and reset the app. Continue?")) {
      localStorage.removeItem('ro_pro_v3_master_final');
      window.location.reload();
    }
  };

  const handleSaveToFile = () => {
    const data = { waterData, systemConfig, pretreatment, postTreatment, snapshots, projectNotes };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${waterData.projectName}_Design.json`;
    link.click();
  };

  const handlePrintDesignReport = () => {
    if (!projection) return;
    const unit = systemConfig.flowUnit || 'gpm';
    const feedPh = Number(systemConfig.feedPh) || Number(waterData.ph) || 7.0;
    const tempF = ((Number(waterData.temp) || 25) * 9) / 5 + 32;
    const reportDate = new Date().toLocaleDateString();
    const isGpm = ['gpm', 'gpd', 'mgd', 'migd'].includes(unit);
    const pUnit = isGpm ? 'psi' : 'bar';
    const fUnit = unit === 'm3/d' ? 'm3/d' : (isGpm ? 'gpm' : 'm3/h');
    const fluxUnit = isGpm ? 'gfd' : 'lmh';
    const EQ_WEIGHTS = {
      ca: 20.04,
      mg: 12.15,
      na: 23.0,
      k: 39.1,
      nh4: 18.04,
      ba: 68.67,
      sr: 43.81,
      co3: 30.0,
      hco3: 61.02,
      so4: 48.03,
      cl: 35.45,
      f: 19.0,
      no3: 62.0,
      po4: 31.67
    };
    const ionFeed = {
      na: Number(waterData.na) || 0,
      hco3: Number(waterData.hco3) || 0,
      cl: Number(waterData.cl) || 0,
      co2: Number(waterData.co2) || 0,
      nh4: Number(waterData.nh4) || 0
    };
    const permIons = projection.permeateConcentration || {};
    const concIons = projection.concentrateConcentration || {};
    const sumTds = (obj) => Object.values(obj).reduce((sum, val) => sum + (Number(val) || 0), 0);
    const rawTds = sumTds({
      ca: Number(waterData.ca) || 0,
      mg: Number(waterData.mg) || 0,
      na: Number(waterData.na) || 0,
      k: Number(waterData.k) || 0,
      sr: Number(waterData.sr) || 0,
      ba: Number(waterData.ba) || 0,
      hco3: Number(waterData.hco3) || 0,
      so4: Number(waterData.so4) || 0,
      cl: Number(waterData.cl) || 0,
      no3: Number(waterData.no3) || 0,
      sio2: Number(waterData.sio2) || 0,
      po4: Number(waterData.po4) || 0,
      f: Number(waterData.f) || 0,
      b: Number(waterData.b) || 0,
      co2: Number(waterData.co2) || 0,
      co3: Number(waterData.co3) || 0,
      nh4: Number(waterData.nh4) || 0
    });
    const permTds = Number(projection?.permeateParameters?.tds ?? 0);
    const concTds = Number(projection?.concentrateParameters?.tds ?? 0);
    const permPh = Number(projection?.permeateParameters?.ph ?? feedPh);
    const concPh = Number(projection?.concentrateParameters?.ph ?? feedPh);
    const econdFactor = 1.9095;
    const toEcond = (value) => Math.round((Number(value) || 0) * econdFactor);
    const toNumber = (value) => Number(value) || 0;
    const formatCaCO3 = (key, value) => {
      const eq = EQ_WEIGHTS[key];
      if (!eq) return '0.00';
      return (toNumber(value) * (50 / eq)).toFixed(2);
    };
    const cationKeys = ['ca', 'mg', 'na', 'k', 'nh4', 'ba', 'sr'];
    const anionKeys = ['co3', 'hco3', 'so4', 'cl', 'f', 'no3', 'po4'];
    const cationMeq = cationKeys.reduce((sum, key) => sum + (toNumber(waterData[key]) / (EQ_WEIGHTS[key] || 1)), 0);
    const anionMeq = anionKeys.reduce((sum, key) => sum + (toNumber(waterData[key]) / (EQ_WEIGHTS[key] || 1)), 0);
    const meqTotal = cationMeq + anionMeq;
    const balanceErrorPct = meqTotal > 0 ? ((cationMeq - anionMeq) / meqTotal) * 100 : 0;
    const analysisTdsKeys = [
      'ca', 'mg', 'na', 'k', 'nh4', 'ba', 'sr',
      'co3', 'hco3', 'so4', 'cl', 'f', 'no3', 'po4',
      'sio2', 'b', 'co2'
    ];
    const analysisTds = analysisTdsKeys.reduce((sum, key) => sum + toNumber(waterData[key]), 0);
    const analysisOsmoticPsi = analysisTds * 0.0115;
    const analysisCaConc = toNumber(waterData.ca);
    const analysisSo4Conc = toNumber(waterData.so4);
    const analysisBaConc = toNumber(waterData.ba);
    const analysisSrConc = toNumber(waterData.sr);
    const analysisSio2Conc = toNumber(waterData.sio2);
    const analysisPo4Conc = toNumber(waterData.po4);
    const analysisFConc = toNumber(waterData.f);
    const analysisPCa = 5.0 - Math.log10(Math.max(analysisCaConc * 2.5, 0.0001));
    const analysisPAlk = 5.0 - Math.log10(Math.max(toNumber(waterData.hco3) * 0.82, 0.0001));
    const analysisC = (Math.log10(Math.max(analysisTds, 1)) - 1) / 10 + (Number(waterData.temp) > 25 ? 2.0 : 2.3);
    const analysisPhs = analysisC + analysisPCa + analysisPAlk;
    const analysisLsi = (toNumber(waterData.ph) || 7) - analysisPhs;
    const analysisCcpp = analysisLsi > 0 ? analysisLsi * 50 : 0;
    const analysisSaturations = {
      caSo4: (analysisCaConc * analysisSo4Conc) / 1000,
      baSo4: (analysisBaConc * analysisSo4Conc) / 50,
      srSo4: (analysisSrConc * analysisSo4Conc) / 2000,
      sio2: (analysisSio2Conc / 120) * 100,
      ca3po42: (analysisCaConc * analysisPo4Conc) / 100,
      caF2: (analysisCaConc * analysisFConc) / 500
    };
    const stageRows = (projection.stageResults || []).map((row) => {
      return `
        <tr>
          <td>${row.index ? `1-${row.index}` : ''}</td>
          <td>${row.vessels ?? ''}</td>
          <td>${row.feedPressure ?? ''}</td>
          <td>${row.concPressure ?? ''}</td>
          <td>${row.feedFlow ?? ''}</td>
          <td>${row.concFlow ?? ''}</td>
          <td>${row.flux ?? ''}</td>
          <td>${row.highestFlux ?? ''}</td>
          <td>${row.highestBeta ?? ''}</td>
        </tr>
      `;
    }).join('');

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>Design Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #1d2b3a; }
            h1 { margin: 0; font-size: 20px; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1f6fb2; padding-bottom: 8px; margin-bottom: 12px; }
            .section { margin-bottom: 16px; }
            .section-title { font-weight: bold; color: #1f6fb2; margin-bottom: 6px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #c9d3de; padding: 6px; text-align: center; }
            th { background: #f0f3f7; }
            .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; font-size: 12px; }
            .meta div { padding: 4px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Basic Design</h1>
            <div>${reportDate}</div>
          </div>
          <div class="section meta">
            <div><strong>Project name:</strong> ${waterData.projectName || ''}</div>
            <div><strong>Client Name:</strong> ${waterData.clientName || ''}</div>
            <div><strong>Calculated by:</strong> ${waterData.calculatedBy || ''}</div>
            <div><strong>Permeate flow/train:</strong> ${projection.permeateFlow || '0.00'} ${unit}</div>
            <div><strong>Raw water flow/train:</strong> ${projection.feedFlow || '0.00'} ${unit}</div>
            <div><strong>Permeate recovery:</strong> ${Number(systemConfig.recovery || 0).toFixed(2)} %</div>
            <div><strong>Feed pressure:</strong> ${projection.calcFeedPressurePsi || '0.0'} psi</div>
            <div><strong>Feed temperature:</strong> ${tempF.toFixed(1)} °F</div>
            <div><strong>Feed Water pH:</strong> ${feedPh.toFixed(2)}</div>
            <div><strong>Chemical dose, mg/L:</strong> ${systemConfig.chemical || 'None'}</div>
            <div><strong>Membrane age:</strong> ${Number(systemConfig.membraneAge || 0).toFixed(1)} years</div>
            <div><strong>Flux decline, per year:</strong> ${Number(systemConfig.fluxDeclinePerYear || 0).toFixed(1)} %</div>
            <div><strong>Fouling factor:</strong> ${Number(systemConfig.foulingFactor || 1).toFixed(2)}</div>
            <div><strong>SP increase, per year:</strong> ${Number(systemConfig.spIncreasePerYear || 0).toFixed(1)} %</div>
            <div><strong>Feed type:</strong> ${waterData.waterType || ''}</div>
            <div><strong>Pretreatment:</strong> ${waterData.pretreatment || 'Conventional'}</div>
            <div><strong>Average flux:</strong> ${projection.calcFluxGfd || '0.0'} gfd</div>
          </div>

          <div class="section">
            <div class="section-title">Analysis - Feed Water Composition</div>
            <table>
              <thead>
                <tr>
                  <th>Ion</th>
                  <th>mg/L</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Ca</td><td>${toNumber(waterData.ca).toFixed(2)}</td></tr>
                <tr><td>Mg</td><td>${toNumber(waterData.mg).toFixed(2)}</td></tr>
                <tr><td>Na</td><td>${toNumber(waterData.na).toFixed(2)}</td></tr>
                <tr><td>K</td><td>${toNumber(waterData.k).toFixed(2)}</td></tr>
                <tr><td>NH4</td><td>${toNumber(waterData.nh4).toFixed(2)}</td></tr>
                <tr><td>Ba</td><td>${toNumber(waterData.ba).toFixed(2)}</td></tr>
                <tr><td>Sr</td><td>${toNumber(waterData.sr).toFixed(2)}</td></tr>
                <tr><td>CO3</td><td>${toNumber(waterData.co3).toFixed(2)}</td></tr>
                <tr><td>HCO3</td><td>${toNumber(waterData.hco3).toFixed(2)}</td></tr>
                <tr><td>SO4</td><td>${toNumber(waterData.so4).toFixed(2)}</td></tr>
                <tr><td>Cl</td><td>${toNumber(waterData.cl).toFixed(2)}</td></tr>
                <tr><td>F</td><td>${toNumber(waterData.f).toFixed(2)}</td></tr>
                <tr><td>NO3</td><td>${toNumber(waterData.no3).toFixed(2)}</td></tr>
                <tr><td>PO4</td><td>${toNumber(waterData.po4).toFixed(2)}</td></tr>
                <tr><td>SiO2</td><td>${toNumber(waterData.sio2).toFixed(2)}</td></tr>
                <tr><td>B</td><td>${toNumber(waterData.b).toFixed(2)}</td></tr>
                <tr><td>CO2</td><td>${toNumber(waterData.co2).toFixed(2)}</td></tr>
                <tr><td>Temperature (°C)</td><td>${toNumber(waterData.temp).toFixed(1)}</td></tr>
                <tr><td>pH</td><td>${toNumber(waterData.ph).toFixed(2)}</td></tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">Analysis - Ionic Balance</div>
            <table>
              <thead>
                <tr>
                  <th>Total Cations (meq/L)</th>
                  <th>Total Anions (meq/L)</th>
                  <th>Balance Error (%)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${cationMeq.toFixed(2)}</td>
                  <td>${anionMeq.toFixed(2)}</td>
                  <td>${balanceErrorPct.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">Analysis - Cations/Anions as CaCO3</div>
            <table>
              <thead>
                <tr>
                  <th>Cations</th>
                  <th>mg/L as CaCO3</th>
                  <th>Anions</th>
                  <th>mg/L as CaCO3</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Ca</td><td>${formatCaCO3('ca', waterData.ca)}</td><td>CO3</td><td>${formatCaCO3('co3', waterData.co3)}</td></tr>
                <tr><td>Mg</td><td>${formatCaCO3('mg', waterData.mg)}</td><td>HCO3</td><td>${formatCaCO3('hco3', waterData.hco3)}</td></tr>
                <tr><td>Na</td><td>${formatCaCO3('na', waterData.na)}</td><td>SO4</td><td>${formatCaCO3('so4', waterData.so4)}</td></tr>
                <tr><td>K</td><td>${formatCaCO3('k', waterData.k)}</td><td>Cl</td><td>${formatCaCO3('cl', waterData.cl)}</td></tr>
                <tr><td>NH4</td><td>${formatCaCO3('nh4', waterData.nh4)}</td><td>F</td><td>${formatCaCO3('f', waterData.f)}</td></tr>
                <tr><td>Ba</td><td>${formatCaCO3('ba', waterData.ba)}</td><td>NO3</td><td>${formatCaCO3('no3', waterData.no3)}</td></tr>
                <tr><td>Sr</td><td>${formatCaCO3('sr', waterData.sr)}</td><td>PO4</td><td>${formatCaCO3('po4', waterData.po4)}</td></tr>
                <tr><td><strong>Total, meq/L</strong></td><td><strong>${cationMeq.toFixed(2)}</strong></td><td><strong>Total, meq/L</strong></td><td><strong>${anionMeq.toFixed(2)}</strong></td></tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">Analysis - Saturations</div>
            <table>
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Calculated TDS (mg/L)</td><td>${analysisTds.toFixed(0)}</td></tr>
                <tr><td>Osmotic pressure (psi)</td><td>${analysisOsmoticPsi.toFixed(1)}</td></tr>
                <tr><td>CaSO4 (%)</td><td>${analysisSaturations.caSo4.toFixed(1)}</td></tr>
                <tr><td>BaSO4 (%)</td><td>${analysisSaturations.baSo4.toFixed(1)}</td></tr>
                <tr><td>SrSO4 (%)</td><td>${analysisSaturations.srSo4.toFixed(1)}</td></tr>
                <tr><td>CaF2 (%)</td><td>${analysisSaturations.caF2.toFixed(1)}</td></tr>
                <tr><td>SiO2 (%)</td><td>${analysisSaturations.sio2.toFixed(1)}</td></tr>
                <tr><td>Ca3(PO4)2 SI</td><td>${analysisSaturations.ca3po42.toFixed(2)}</td></tr>
                <tr><td>CCPP (mg/L CaCO3)</td><td>${analysisCcpp.toFixed(2)}</td></tr>
                <tr><td>LSI</td><td>${analysisLsi.toFixed(2)}</td></tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">Calculation Result</div>
            <table>
              <thead>
                <tr>
                  <th>Array</th>
                  <th>Vessels</th>
                  <th>Feed (${pUnit})</th>
                  <th>Conc (${pUnit})</th>
                  <th>Feed per vessel (${fUnit})</th>
                  <th>Conc per vessel (${fUnit})</th>
                  <th>Flux (${fluxUnit})</th>
                  <th>Highest flux (${fluxUnit})</th>
                  <th>Highest beta</th>
                </tr>
              </thead>
              <tbody>
                ${stageRows || '<tr><td colspan="9">No calculation results</td></tr>'}
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">Ion (mg/L)</div>
            <table>
              <thead>
                <tr>
                  <th>Ion</th>
                  <th>Raw Water</th>
                  <th>Feed Water</th>
                  <th>Permeate Water</th>
                  <th>Concentrate</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Na</td><td>${ionFeed.na.toFixed(2)}</td><td>${ionFeed.na.toFixed(2)}</td><td>${Number(permIons.na || 0).toFixed(3)}</td><td>${Number(concIons.na || 0).toFixed(1)}</td></tr>
                <tr><td>HCO3</td><td>${ionFeed.hco3.toFixed(2)}</td><td>${ionFeed.hco3.toFixed(2)}</td><td>${Number(permIons.hco3 || 0).toFixed(3)}</td><td>${Number(concIons.hco3 || 0).toFixed(1)}</td></tr>
                <tr><td>Cl</td><td>${ionFeed.cl.toFixed(2)}</td><td>${ionFeed.cl.toFixed(2)}</td><td>${Number(permIons.cl || 0).toFixed(3)}</td><td>${Number(concIons.cl || 0).toFixed(1)}</td></tr>
                <tr><td>CO2</td><td>${ionFeed.co2.toFixed(2)}</td><td>${ionFeed.co2.toFixed(2)}</td><td>${Number(permIons.co2 || 0).toFixed(3)}</td><td>${Number(concIons.co2 || 0).toFixed(2)}</td></tr>
                <tr><td>NH3</td><td>${ionFeed.nh4.toFixed(2)}</td><td>${ionFeed.nh4.toFixed(2)}</td><td>${Number(permIons.nh4 || 0).toFixed(3)}</td><td>${Number(concIons.nh4 || 0).toFixed(2)}</td></tr>
                <tr><td>TDS</td><td>${rawTds.toFixed(2)}</td><td>${rawTds.toFixed(2)}</td><td>${permTds.toFixed(2)}</td><td>${concTds.toFixed(2)}</td></tr>
                <tr><td>pH</td><td>${Number(waterData.ph || 7).toFixed(2)}</td><td>${feedPh.toFixed(2)}</td><td>${permPh.toFixed(2)}</td><td>${concPh.toFixed(2)}</td></tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">Saturations</div>
            <table>
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Raw Water</th>
                  <th>Feed Water</th>
                  <th>Permeate Water</th>
                  <th>Concentrate</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>CaSO4 / Ksp * 100, %</td><td>0</td><td>0</td><td>0</td><td>${projection.concentrateSaturation?.caSo4 ?? '0.0'}</td></tr>
                <tr><td>SrSO4 / Ksp * 100, %</td><td>0</td><td>0</td><td>0</td><td>${projection.concentrateSaturation?.srSo4 ?? '0.0'}</td></tr>
                <tr><td>BaSO4 / Ksp * 100, %</td><td>0</td><td>0</td><td>0</td><td>${projection.concentrateSaturation?.baSo4 ?? '0.0'}</td></tr>
                <tr><td>SiO2 Saturation, %</td><td>0</td><td>0</td><td>0</td><td>${projection.concentrateSaturation?.sio2 ?? '0.0'}</td></tr>
                <tr><td>CaF2 / Ksp * 100, %</td><td>0</td><td>0</td><td>0</td><td>${projection.concentrateSaturation?.caF2 ?? '0.0'}</td></tr>
                <tr><td>Ca3(PO4)2</td><td>0.0</td><td>0.0</td><td>0.0</td><td>${projection.concentrateSaturation?.ca3po42 ?? '0.00'}</td></tr>
                <tr><td>CCPP, mg/L</td><td>0.00</td><td>0.00</td><td>0.00</td><td>${projection.concentrateParameters?.ccpp ?? '0.0'}</td></tr>
                <tr><td>Langelier index</td><td>0.00</td><td>0.00</td><td>0.00</td><td>${projection.concentrateParameters?.langelier ?? '0.00'}</td></tr>
                <tr><td>Osmotic pressure, psi</td><td>${projection.concentrateParameters?.osmoticPressure ?? '0.0'}</td><td>${projection.concentrateParameters?.osmoticPressure ?? '0.0'}</td><td>0.5</td><td>${projection.concentrateParameters?.osmoticPressure ?? '0.0'}</td></tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">Flow Diagram</div>
            <div style="padding: 10px 0;">
              <svg viewBox="0 0 900 260" width="100%" height="260">
                <line x1="40" y1="130" x2="240" y2="130" stroke="#1e6bd6" strokeWidth="6" />
                <line x1="240" y1="130" x2="320" y2="130" stroke="#1e6bd6" strokeWidth="6" />
                <line x1="320" y1="130" x2="380" y2="130" stroke="#1e6bd6" strokeWidth="6" />
                <line x1="440" y1="130" x2="520" y2="130" stroke="#1e6bd6" strokeWidth="6" />
                <line x1="520" y1="130" x2="660" y2="130" stroke="#1e6bd6" strokeWidth="6" />
                <line x1="660" y1="130" x2="780" y2="130" stroke="#3cc7f4" strokeWidth="6" />
                <line x1="660" y1="130" x2="660" y2="210" stroke="#35c84b" strokeWidth="6" />
                <polygon points="90,110 120,110 135,130 120,150 90,150 75,130" fill="white" stroke="#222" strokeWidth="2" />
                <text x="105" y="136" textAnchor="middle" fontSize="14" fontFamily="Arial">1</text>
                <polygon points="210,110 240,110 255,130 240,150 210,150 195,130" fill="white" stroke="#222" strokeWidth="2" />
                <text x="225" y="136" textAnchor="middle" fontSize="14" fontFamily="Arial">2</text>
                <circle cx="380" cy="130" r="30" fill="white" stroke="#222" strokeWidth="3" />
                <polygon points="372,115 402,130 372,145" fill="white" stroke="#222" strokeWidth="2" />
                <polygon points="520,110 550,110 565,130 550,150 520,150 505,130" fill="white" stroke="#222" strokeWidth="2" />
                <text x="535" y="136" textAnchor="middle" fontSize="14" fontFamily="Arial">3</text>
                <rect x="660" y="95" width="140" height="70" fill="white" stroke="#222" strokeWidth="2" />
                <polygon points="650,205 670,205 680,220 670,235 650,235 640,220" fill="white" stroke="#222" strokeWidth="2" />
                <text x="660" y="226" textAnchor="middle" fontSize="14" fontFamily="Arial">4</text>
                <polygon points="800,110 830,110 845,130 830,150 800,150 785,130" fill="white" stroke="#222" strokeWidth="2" />
                <text x="815" y="136" textAnchor="middle" fontSize="14" fontFamily="Arial">5</text>
                ${systemConfig.chemical !== 'None' ? `
                  <text x="180" y="60" textAnchor="middle" fontSize="12" fontFamily="Arial" fill="#b83b2e">${systemConfig.chemical} Dosing</text>
                  <line x1="180" y1="70" x2="180" y2="110" stroke="#b83b2e" strokeWidth="2" />
                ` : ''}
              </svg>
            </div>
            <div class="section-title">Flow Diagram Streams</div>
            <table>
              <thead>
                <tr>
                  <th>Stream No.</th>
                  <th>Flow (${unit})</th>
                  <th>Pressure (psi)</th>
                  <th>TDS (mg/L)</th>
                  <th>pH</th>
                  <th>Econd (μS/cm)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1</td>
                  <td>${projection.feedFlow || '0.00'}</td>
                  <td>0</td>
                  <td>${rawTds.toFixed(0)}</td>
                  <td>${Number(waterData.ph || 7).toFixed(2)}</td>
                  <td>${toEcond(rawTds)}</td>
                </tr>
                <tr>
                  <td>2</td>
                  <td>${projection.feedFlow || '0.00'}</td>
                  <td>${projection.calcFeedPressurePsi || '0.0'}</td>
                  <td>${rawTds.toFixed(0)}</td>
                  <td>${feedPh.toFixed(2)}</td>
                  <td>${toEcond(rawTds)}</td>
                </tr>
                <tr>
                  <td>3</td>
                  <td>${projection.concentrateFlow || '0.00'}</td>
                  <td>${projection.calcConcPressurePsi || '0.0'}</td>
                  <td>${concTds.toFixed(0)}</td>
                  <td>${concPh.toFixed(2)}</td>
                  <td>${toEcond(concTds)}</td>
                </tr>
                <tr>
                  <td>4</td>
                  <td>${projection.permeateFlow || '0.00'}</td>
                  <td>0</td>
                  <td>${permTds.toFixed(1)}</td>
                  <td>${permPh.toFixed(2)}</td>
                  <td>${toEcond(permTds)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  };

  const handleLoadFromFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (data.waterData) setWaterData(data.waterData);
        if (data.systemConfig) setSystemConfig({ ...DEFAULT_SYSTEM_CONFIG, ...(data.systemConfig || {}) });
        if (data.snapshots) setSnapshots(data.snapshots);
        alert("Success: Design Loaded!");
      } catch (err) { alert("Error: Invalid File Format"); }
    };
    reader.readAsText(file);
  };

  const handleNewProject = () => {
    if (!window.confirm("Start a new project? Current data will be replaced.")) return;
    const newId = createProjectId();
    setWaterData({
      projectId: newId,
      projectName: 'New_Project_V3',
      clientName: '',
      calculatedBy: '',
      pretreatment: 'Conventional',
      waterType: 'Well Water',
      calculatedTds: 0,
      temp: 25,
      ph: 7.5,
      ca: 60,
      mg: 20,
      na: 250,
      k: 15,
      hco3: 250,
      so4: 100,
      cl: 300,
      no3: 25,
      sio2: 20,
      nh4: 0,
      sr: 0,
      ba: 0,
      po4: 0,
      f: 0,
      b: 0,
      co2: 0,
      co3: 0
    });
    setSystemConfig(DEFAULT_SYSTEM_CONFIG);
    setPretreatment({ antiscalantDose: 3.5, sbsDose: 2.0 });
    setPostTreatment({ causticDose: 2.0 });
    setSnapshots([]);
    setProjectNotes("");
    setActiveTab('analysis');
  };

  const handleOpenRecent = (entry) => {
    if (!entry?.data) return;
    const data = entry.data;
    const incomingWater = data.waterData || {};
    setWaterData({
      ...incomingWater,
      projectId: incomingWater.projectId || createProjectId()
    });
    setSystemConfig({ ...DEFAULT_SYSTEM_CONFIG, ...(data.systemConfig || {}) });
    setMembranes(data.membranes || membranes);
    setSnapshots(data.snapshots || []);
    setProjectNotes(data.projectNotes || "");
    setPretreatment(data.pretreatment || pretreatment);
    setPostTreatment(data.postTreatment || postTreatment);
    setActiveTab('analysis');
  };

  const handleDeleteProject = (projectId) => {
    if (!window.confirm("Delete this project? This cannot be undone.")) return;
    const stored = localStorage.getItem('ro_pro_recent_projects');
    let existing = [];
    if (stored) {
      try {
        existing = JSON.parse(stored) || [];
      } catch (e) {
        existing = [];
      }
    }
    const next = existing.filter(item => item.id !== projectId);
    setRecentProjects(next);
    localStorage.setItem('ro_pro_recent_projects', JSON.stringify(next));
    if (waterData.projectId === projectId) {
      handleNewProject();
    }
  };

  const handleToggleProjectSelect = (projectId) => {
    setSelectedProjectIds((current) => {
      if (current.includes(projectId)) {
        return current.filter(id => id !== projectId);
      }
      return [...current, projectId];
    });
  };

  const handleToggleSelectAllProjects = () => {
    if (selectedProjectIds.length === recentProjects.length) {
      setSelectedProjectIds([]);
    } else {
      setSelectedProjectIds(recentProjects.map(project => project.id));
    }
  };

  const handleDeleteSelectedProjects = () => {
    if (selectedProjectIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedProjectIds.length} project(s)? This cannot be undone.`)) return;
    const stored = localStorage.getItem('ro_pro_recent_projects');
    let existing = [];
    if (stored) {
      try {
        existing = JSON.parse(stored) || [];
      } catch (e) {
        existing = [];
      }
    }
    const next = existing.filter(item => !selectedProjectIds.includes(item.id));
    setRecentProjects(next);
    localStorage.setItem('ro_pro_recent_projects', JSON.stringify(next));
    if (selectedProjectIds.includes(waterData.projectId)) {
      handleNewProject();
    }
    setSelectedProjectIds([]);
  };
  
  useEffect(() => {
    if (activeTab === 'design') {
      setSystemConfig((current) => ({
        ...current,
        pass1Stages: 1,
        stages: (current.stages || DEFAULT_SYSTEM_CONFIG.stages).map((stage, index) =>
          index === 0 ? stage : { ...stage, vessels: 0 }
        ),
        stage2Vessels: 0,
        designCalculated: false
      }));
    }
  }, [activeTab, DEFAULT_SYSTEM_CONFIG.stages]);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f4f7f9', display: 'flex', flexDirection: 'column' }}>
      
      {/* GLOBAL HEADER */}
      <header style={{ backgroundColor: '#002f5d', color: '#fff', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.2)' }}>
        <h2 style={{ margin: 0, fontSize: '1.35rem', lineHeight: 1.2 }}>Morris-Jenkins IMS Design Pro 3.0</h2>
        
        <nav style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.08)', padding: '4px', borderRadius: '10px' }}>
          {['dashboard', 'analysis', 'pretreatment', 'design', 'post', 'report', 'database'].map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                padding: '8px 14px',
                background: activeTab === t ? '#f39c12' : 'transparent',
                color: activeTab === t ? '#1b1b1b' : 'white',
                border: activeTab === t ? '1px solid #f39c12' : '1px solid transparent',
                cursor: 'pointer',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                fontSize: '0.72rem',
                letterSpacing: '0.4px',
                borderRadius: '8px'
              }}
            >
              {t}
            </button>
          ))}
        </nav>

        {/* ACTION MENU GROUP */}
        <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
          <button onClick={takeSnapshot} style={{ background: '#8e44ad', border: '1px solid #7d3c98', color: 'white', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 'bold' }}>📸 Snapshot</button>
          <button onClick={handleSaveToFile} style={{ background: '#27ae60', border: '1px solid #229954', color: 'white', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 'bold' }}>💾 Save</button>
          <button onClick={() => fileInputRef.current.click()} style={{ background: '#3498db', border: '1px solid #2e86c1', color: 'white', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 'bold' }}>📁 Load</button>
          <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleLoadFromFile} />
          <button
            onClick={handleDeleteSelectedProjects}
            disabled={selectedProjectIds.length === 0}
            style={{
              background: selectedProjectIds.length === 0 ? '#7f8c8d' : '#c0392b',
              border: selectedProjectIds.length === 0 ? '1px solid #6c7a89' : '1px solid #a93226',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '8px',
              cursor: selectedProjectIds.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '0.78rem',
              fontWeight: 'bold'
            }}
          >
            🗑️ Delete
          </button>
          <button onClick={handlePrintDesignReport} style={{ background: '#f39c12', border: '1px solid #d68910', color: 'white', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 'bold' }}>🖨️ Print</button>
          <button onClick={handleReset} style={{ background: '#e74c3c', border: '1px solid #cb4335', color: 'white', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 'bold' }}>Reset</button>
        </div>
      </header>

      <ValidationBanner projection={projection} systemConfig={systemConfig} waterData={waterData} />

      <main style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
        {activeTab === 'dashboard' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
            <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #c2d1df', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: '#002f5d' }}>My Projects</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleDeleteSelectedProjects}
                disabled={selectedProjectIds.length === 0}
                style={{
                  background: selectedProjectIds.length === 0 ? '#bdc3c7' : '#e74c3c',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  cursor: selectedProjectIds.length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 'bold'
                }}
              >
                🗑️ Delete Selected
              </button>
              <button
                onClick={handleNewProject}
                style={{ background: '#3498db', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}
              >
                + New Project
              </button>
            </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#f4f7f9' }}>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e1e5ea', width: '32px' }}>
                  <input
                    type="checkbox"
                    checked={recentProjects.length > 0 && selectedProjectIds.length === recentProjects.length}
                    onChange={handleToggleSelectAllProjects}
                  />
                </th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e1e5ea' }}>Project</th>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e1e5ea' }}>Client</th>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e1e5ea' }}>Water Type</th>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e1e5ea' }}>Modified</th>
                    <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #e1e5ea' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentProjects.length === 0 && (
                    <tr>
                  <td colSpan={6} style={{ padding: '12px', color: '#666' }}>No recent projects yet.</td>
                    </tr>
                  )}
                  {recentProjects.map((project) => (
                    <tr key={project.id}>
                  <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>
                    <input
                      type="checkbox"
                      checked={selectedProjectIds.includes(project.id)}
                      onChange={() => handleToggleProjectSelect(project.id)}
                    />
                  </td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>{project.name}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>{project.clientName}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>{project.waterType}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>{new Date(project.updatedAt).toLocaleString()}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => handleOpenRecent(project)}
                            style={{ background: '#2ecc71', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Open
                          </button>
                          <button
                            onClick={() => handleDeleteProject(project.id)}
                            style={{ background: '#e74c3c', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #c2d1df', padding: '20px' }}>
              <h3 style={{ marginTop: 0, color: '#002f5d' }}>Recent Activity</h3>
              <div style={{ fontSize: '0.85rem', color: '#556' }}>
                {recentProjects.slice(0, 5).map((project) => (
                  <div key={project.id} style={{ marginBottom: '8px' }}>
                    <strong>{project.name}</strong> updated {new Date(project.updatedAt).toLocaleString()}
                  </div>
                ))}
                {recentProjects.length === 0 && <div>No recent activity.</div>}
              </div>
            </div>
          </div>
        )}
        {activeTab === 'analysis' && <WaterAnalysis waterData={waterData} setWaterData={setWaterData} />}
        {activeTab === 'pretreatment' && <PreTreatment waterData={waterData} pretreatment={pretreatment} setPretreatment={setPretreatment} systemConfig={systemConfig} />}
        {activeTab === 'design' && (
          <SystemDesign
            membranes={membranes}
            systemConfig={systemConfig}
            setWaterData={setWaterData} 
            setSystemConfig={setSystemConfig}
            projection={projection}
            applyTdsProfile={applyTdsProfile}
            waterData={waterData}
            onRun={() => setSystemConfig(c => ({ ...c, designCalculated: true }))}
          />
        )}
        {activeTab === 'post' && <PostTreatment projection={projection} postTreatment={postTreatment} setPostTreatment={setPostTreatment} systemConfig={systemConfig} />}
        {activeTab === 'report' && (
          <Report 
            waterData={waterData} 
            systemConfig={systemConfig} 
            applyTdsProfile={applyTdsProfile} 
            projection={projection} 
            pretreatment={pretreatment}
            postTreatment={postTreatment}
            projectNotes={projectNotes} 
            setProjectNotes={setProjectNotes} 
            snapshots={snapshots} 
            setSnapshots={setSnapshots}
          />
        )}
        {activeTab === 'database' && (
          <MembraneEditor
            membranes={membranes}
            setMembranes={setMembranes}
            systemConfig={systemConfig}
            setSystemConfig={setSystemConfig}
          />
        )}
      </main>

      <footer style={{ background: '#fff', borderTop: '1px solid #ddd', padding: '5px 20px', display: 'flex', gap: '20px', fontSize: '0.75rem', color: '#666' }}>
        <span>Project: <strong>{waterData.projectName}</strong></span>
        <span>Active Membrane: <strong>{projection.activeMembrane?.name}</strong></span>
        <span>Temp: <strong>{waterData.temp}°C</strong></span>
      </footer>

      <DesignGuidelines isOpen={isGuidelineOpen} onClose={() => setIsGuidelineOpen(false)} currentWaterType={waterData.waterType} />
    </div>
  );
};

export default App;