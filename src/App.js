import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import WaterAnalysis from './components/WaterAnalysis';
import PreTreatment from './components/PreTreatment';
import SystemDesign from './components/SystemDesign';
import PostTreatment from './components/PostTreatment';
import Report from './components/Report';
import MembraneEditor from './components/MembraneEditor';
import DesignGuidelines from './components/DesignGuidelines';
import ValidationBanner from './components/ValidationBanner';
import { calculateSystem, calculateEC, applyTdsProfile } from './utils/calculatorService';
import { getAllMembranes } from './engines/membraneEngine';
import { EQ_WEIGHTS } from './components/WaterAnalysis';


const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isGuidelineOpen, setIsGuidelineOpen] = useState(false);
  const fileInputRef = useRef(null);

  const DEFAULT_MEMBRANES = useMemo(() => {
    return getAllMembranes().map(m => ({
      id: m.id,
      name: m.name,
      areaM2: m.areaM2,
      type: m.type
    }));
  }, []);

  const DEFAULT_SYSTEM_CONFIG = useMemo(() => ({
    // Inputs (follow IMSDesign layout: System-level total + trains; Train values are calculated)
    feedPh: 7.0,
    recovery: 40,
    flowUnit: 'm3/h', // gpm/gpd/mgd/migd/m3/h/m3/d/mld
    feedFlow: 35,
    averageFlux: 15.7,
    permeateFlow: 14, // train permeate flow in selected unit
    numTrains: 1,

    // Array specification
    stage1Vessels: 4,
    stage2Vessels: 0,
    elementsPerVessel: 6,
    membraneModel: 'swtds32k8080',
    pass1Stages: 1, // Initially only 1 stage is active
    stages: [
      { membraneModel: 'swtds32k8080', elementsPerVessel: 6, vessels: 4 },
      { membraneModel: 'swtds32k8080', elementsPerVessel: 6, vessels: 0 },
      { membraneModel: 'swtds32k8080', elementsPerVessel: 6, vessels: 0 },
      { membraneModel: 'swtds32k8080', elementsPerVessel: 6, vessels: 0 },
      { membraneModel: 'swtds32k8080', elementsPerVessel: 6, vessels: 0 },
      { membraneModel: 'swtds32k8080', elementsPerVessel: 6, vessels: 0 }
    ],

    // Flux display
    fluxUnit: 'lmh', // gfd | lmh

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
  const [membranes, setMembranes] = useState(DEFAULT_MEMBRANES); 
  
  const [projectNotes, setProjectNotes] = useState(""); 
  const createProjectId = () => `proj_${Date.now()}`;
  
  const mergeMembranes = (savedMembranes) => {
    if (!savedMembranes || !Array.isArray(savedMembranes)) return DEFAULT_MEMBRANES;
    const savedMap = new Map(savedMembranes.map(m => [m.id, m]));
    const merged = DEFAULT_MEMBRANES.map(defaultMem => savedMap.get(defaultMem.id) || defaultMem);
    const customMembranes = savedMembranes.filter(m => !DEFAULT_MEMBRANES.some(d => d.id === m.id));
    return [...merged, ...customMembranes];
  };
  const [waterData, setWaterData] = useState({
    projectId: createProjectId(),
    projectName: 'Seawater_RO_Design',
    clientName: '',
    calculatedBy: '',
    pretreatment: 'Conventional',
    waterType: 'Sea Well',
    calculatedTds: 20000,
    temp: 25, ph: 7.0, ca: 0, mg: 0, na: 7869.96, k: 0,
    hco3: 0.5, so4: 0, cl: 12129.94, no3: 0, sio2: 0,
    nh4: 0, sr: 0, ba: 0, po4: 0, f: 0, b: 0, co2: 0.056, co3: 0.001
  });

  const [systemConfig, setSystemConfig] = useState(DEFAULT_SYSTEM_CONFIG);

  const [pretreatment, setPretreatment] = useState({ antiscalantDose: 3.5, sbsDose: 2.0 });
  const [postTreatment, setPostTreatment] = useState({ causticDose: 2.0 });

  
  
  const handleApplyTdsProfile = (tdsValue) => {
    const updated = applyTdsProfile(tdsValue, waterData);
    setWaterData(updated);
  };
  const [projection, setProjection] = useState({ 
    fluxGFD: 0, pumpPressure: 0, monthlyEnergyCost: 0, permeateFlow: 0 
  });
  const [recentProjects, setRecentProjects] = useState([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  
  // --- 2. MASTER CALCULATION ENGINE ---
  useEffect(() => {
    const activePass1Stages = Math.min(Math.max(Number(systemConfig.pass1Stages) || 1, 1), 6);
    const activeStages = systemConfig.stages?.slice(0, activePass1Stages) || [];

    const calculationInputs = {
      ...systemConfig,
      stages: activeStages,
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
        nh4: Number(waterData.nh4) || 0,
      },
      temp: Number(waterData.temp) || 25,
      feedPh: Number(systemConfig.feedPh) || Number(waterData.ph) || 7.0,
      waterType: waterData.waterType,
      tds: Number(waterData.calculatedTds) || 0,
    };

    try {
      const results = calculateSystem(calculationInputs);
      
      const isImperial = ['gpm', 'gpd', 'mgd', 'migd'].includes((systemConfig.flowUnit || '').toLowerCase().trim().replace('/', ''));
      const fluxUnitLabel = isImperial ? 'gfd' : 'lmh';
      
      setProjection({
        ...results.results,
        stageResults: results.stageResults,
        flowDiagramPoints: results.flowDiagramPoints,
        permeateIons: results.permeateParameters.ions || {},
        concentrateIons: results.concentrateParameters.ions || {},
        permeateTds: results.permeateParameters.tds,
        concentrateTds: results.concentrateParameters.tds,
        osmoticP: results.concentrateParameters.osmoticPressure,
        concentrateSaturation: results.concentrateParameters.saturation?.saturations || {},
        concentrateParameters: results.concentrateParameters,
        permeateParameters: results.permeateParameters,
        feedParameters: results.feedParameters,
        permeateFlow: results.flowDiagramPoints[3].flow,
        feedFlow: results.flowDiagramPoints[0].flow,
        concentrateFlow: results.flowDiagramPoints[2].flow,
        totalPlantProductFlowDisplay: results.flowDiagramPoints[3].flow,
        pumpPressure: results.results.feedPressure,
        fluxUnit: fluxUnitLabel
      });
    } catch (error) {
      console.warn('Calculation failed:', error.message);
    }
  }, [systemConfig, waterData, membranes]);
    

  // --- 3. PERSISTENCE ---






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
        setMembranes(mergeMembranes(p.membranes));
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

    // Force update standard membranes to new calibrations (Persistence Migration)
    setMembranes(prev => prev.map(m => {
      if (m.id === 'cpa3' && (m.aValue !== 3.1414 || m.dpExponent !== 1.3078)) {
        return { ...m, aValue: 3.1414, areaM2: 37.17, dpExponent: 1.3078 };
      }
      if (m.id === 'swtds32k8080') {
        return { 
          ...m, 
          aValue: 1.005, 
          membraneB: 0.0547,
          transport: {
            aValueRef: 1.005,
            membraneBRef: 0.0547,
            soluteBFactors: {
              monovalent: 1.0,
              divalent: 0.6,
              silica: 0.8,
              boron: 1.4,
              co2: 999
            }
          }
        };
      }
      return m;
    }));

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
    
    const isImperial = ['gpm', 'gpd', 'mgd', 'migd'].includes((unit || '').toLowerCase().trim().replace('/', ''));
    const pUnit = isImperial ? 'psi' : 'bar';
    const fluxUnit = isImperial ? 'gfd' : 'lmh';
    const fUnit = isImperial ? 'gpm' : 'm3/h';

    const permTds = Number(projection?.permeateParameters?.tds ?? 0);
    const concTds = Number(projection?.concentrateParameters?.tds ?? 0);
    const permPh = Number(projection?.permeateParameters?.ph ?? feedPh);
    const concPh = Number(projection?.concentrateParameters?.ph ?? feedPh);
    
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

    const rawTds = Number(waterData.calculatedTds) || 0;
    const toEcondString = (tds, ph) => calculateEC(tds, ph).toFixed(2);

    const ionFeed = waterData;
    const permIons = projection.permeateParameters?.ions || {};
    const concIons = projection.concentrateParameters?.ions || {};
    
    const stageRows = (projection.stageResults || []).map((row) => {
      return `
        <tr>
          <td>${row.stage}</td>
          <td>${row.vessels ?? ''}</td>
          <td>${row.feedPressure ?? ''}</td>
          <td>${row.concPressure ?? ''}</td>
          <td>${row.feedFlowVessel ?? ''}</td>
          <td>${row.concFlowVessel ?? ''}</td>
          <td>${row.flux ?? ''}</td>
          <td>${row.highestFlux ?? ''}</td>
          <td>${row.highestBeta ?? ''}</td>
          <td>${row.rejection ?? ''}</td>
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
            <div><strong>Calculated TDS:</strong> ${waterData.calculatedTds || ''}</div>
            <div><strong>Permeate flow/train:</strong> ${projection.permeateFlow || '0.00'} ${unit}</div>
            <div><strong>Raw water flow/train:</strong> ${projection.feedFlow || '0.00'} ${unit}</div>
            <div><strong>Permeate recovery:</strong> ${Number(systemConfig.recovery || 0).toFixed(2)} %</div>
            <div><strong>Feed pressure:</strong> ${projection.calcFeedPressurePsi || '0.0'} psi</div>
            <div><strong>Feed temperature:</strong> ${tempF.toFixed(2)} °F</div>
            <div><strong>Feed Water pH:</strong> ${feedPh.toFixed(2)}</div>
            <div><strong>Chemical dose, mg/L:</strong> ${systemConfig.chemical || 'None'}</div>
            <div><strong>Membrane age:</strong> ${Number(systemConfig.membraneAge || 0).toFixed(2)} years</div>
            <div><strong>Flux decline, per year:</strong> ${Number(systemConfig.fluxDeclinePerYear || 0).toFixed(2)} %</div>
            <div><strong>Fouling factor:</strong> ${Number(systemConfig.foulingFactor || 1).toFixed(2)}</div>
            <div><strong>SP increase, per year:</strong> ${Number(systemConfig.spIncreasePerYear || 0).toFixed(2)} %</div>
            <div><strong>Feed type:</strong> ${waterData.waterType || ''}</div>
            <div><strong>Pretreatment:</strong> ${waterData.pretreatment || 'Conventional'}</div>
            <div><strong>Average flux:</strong> ${Number(projection.avgFlux).toFixed(2)} ${fluxUnit}</div>
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
                <tr><td>Temperature (°C)</td><td>${toNumber(waterData.temp).toFixed(2)}</td></tr>
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
            <div class="section-title">Analysis - Saturations (Feed)</div>
            <table>
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Calculated TDS (mg/L)</td><td>${rawTds.toFixed(2)}</td></tr>
                <tr><td>Osmotic pressure (${pUnit})</td><td>${(projection.feedParameters?.saturation?.osmoticPressureBar * (isImperial ? 14.5038 : 1)).toFixed(2)}</td></tr>
                <tr><td>CaSO4 (%)</td><td>${projection.feedParameters?.saturation?.saturations?.caSo4 ?? '0.00'}</td></tr>
                <tr><td>BaSO4 (%)</td><td>${projection.feedParameters?.saturation?.saturations?.baSo4 ?? '0.00'}</td></tr>
                <tr><td>SrSO4 (%)</td><td>${projection.feedParameters?.saturation?.saturations?.srSo4 ?? '0.00'}</td></tr>
                <tr><td>CaF2 (%)</td><td>${projection.feedParameters?.saturation?.saturations?.caF2 ?? '0.00'}</td></tr>
                <tr><td>SiO2 (%)</td><td>${projection.feedParameters?.saturation?.saturations?.sio2 ?? '0.00'}</td></tr>
                <tr><td>Ca3(PO4)2 SI</td><td>${projection.feedParameters?.saturation?.saturations?.ca3po42 ?? '0.00'}</td></tr>
                <tr><td>CCPP (mg/L CaCO3)</td><td>${projection.feedParameters?.saturation?.ccpp ?? '0.00'}</td></tr>
                <tr><td>LSI</td><td>${projection.feedParameters?.saturation?.lsi ?? '0.00'}</td></tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">Train Information</div>
            <div class="meta">
              <div><strong>Feed pH:</strong> ${feedPh.toFixed(2)}</div>
              <div><strong>Chemical:</strong> ${systemConfig.chemical || 'None'}</div>
              <div><strong>Permeate recovery%:</strong> ${Number(systemConfig.recovery || 0).toFixed(2)}</div>
              <div><strong>Chemical concentration:</strong> ${systemConfig.chemicalConcentration || 100}</div>
              <div><strong>Permeate flow ${unit}:</strong> ${projection.permeateFlow || '0.00'}</div>
              <div><strong>Chemical dose ${systemConfig.doseUnit || 'mg/l'}:</strong> ${systemConfig.chemicalDose || 0}</div>
              <div><strong>Average flux ${fluxUnit}:</strong> ${Number(projection.avgFlux).toFixed(2)}</div>
              <div><strong>Membrane age years:</strong> ${Number(systemConfig.membraneAge || 0).toFixed(1)}</div>
              <div><strong>Feed flow ${unit}:</strong> ${projection.feedFlow || '0.00'}</div>
              <div><strong>Flux decline%, per year:</strong> ${Number(systemConfig.fluxDeclinePerYear || 0).toFixed(2)}</div>
              <div><strong>Concentrate flow ${unit}:</strong> ${projection.concentrateFlow || '0.00'}</div>
              <div><strong>Fouling factor:</strong> ${Number(systemConfig.foulingFactor || 1).toFixed(2)}</div>
              <div><strong>SSP increase% per year:</strong> ${Number(systemConfig.spIncreasePerYear || 0).toFixed(1)}</div>
              <div><strong>Total plant product flow ${unit}:</strong> ${(Number(projection.permeateFlow) * Number(systemConfig.numTrains || 1)).toFixed(1)}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Calculation Results(All flows are per vessel)</div>
            <table>
              <thead>
                <tr>
                  <th>Array</th>
                  <th>Vessels</th>
                  <th>Feed (${pUnit})</th>
                  <th>Conc (${pUnit})</th>
                  <th>Feed (${fUnit})</th>
                  <th>Conc (${fUnit})</th>
                  <th>Flux (${fluxUnit})</th>
                  <th>Highest flux (${fluxUnit})</th>
                  <th>Highest beta</th>
                  <th>Final rejection (%)</th>
                </tr>
              </thead>
              <tbody>
                ${(projection.stageResults || []).map((row) => `
                  <tr>
                    <td>${row.array}</td>
                    <td>${row.vessels}</td>
                    <td>${row.feedPressure}</td>
                    <td>${row.concPressure}</td>
                    <td>${row.feedFlowVessel}</td>
                    <td>${row.concFlowVessel}</td>
                    <td>${row.flux}</td>
                    <td>${row.highestFlux}</td>
                    <td>${row.highestBeta}</td>
                    <td>${row.rejection}</td>
                  </tr>
                `).join('') || '<tr><td colspan="10">No calculation results</td></tr>'}
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">Permeate Concentration</div>
            <table>
              <thead>
                <tr>
                  <th>Ion</th>
                  <th>Value (mg/l)</th>
                </tr>
              </thead>
              <tbody>
                ${['ca', 'k', 'sr', 'cl', 'po4', 'co2', 'mg', 'nh4', 'hco3', 'no3', 'sio2', 'co3', 'na', 'ba', 'so4', 'f', 'b'].map(key => {
                  const ionName = key === 'nh4' ? 'NH4' : 
                                key === 'hco3' ? 'HCO3' :
                                key === 'so4' ? 'SO4' :
                                key === 'po4' ? 'PO4' :
                                key === 'no3' ? 'NO3' :
                                key === 'co3' ? 'CO3' :
                                key === 'sio2' ? 'SiO2' :
                                key === 'co2' ? 'CO2' :
                                key.charAt(0).toUpperCase() + key.slice(1);
                  return `
                    <tr>
                      <td>${ionName}</td>
                      <td>${Number(permIons[key] || 0).toFixed(3)}</td>
                    </tr>
                  `;
                }).join('')}
                <tr><td><strong>TDS</strong></td><td><strong>${permTds.toFixed(2)}</strong></td></tr>
                <tr><td><strong>pH</strong></td><td><strong>${permPh.toFixed(1)}</strong></td></tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">Concentrate Saturations and Parameters</div>
            <table>
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Value</th>
                  <th>Unit</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>CaSO4, %</td><td>${projection.concentrateParameters?.saturation?.saturations?.caSo4 ?? '0'}</td><td>%</td></tr>
                <tr><td>SrSO4, %</td><td>${projection.concentrateParameters?.saturation?.saturations?.srSo4 ?? '0'}</td><td>%</td></tr>
                <tr><td>Osmotic pressure</td><td>${projection.concentrateParameters?.osmoticPressure?.toFixed(1) ?? '0.0'}</td><td>bar</td></tr>
                <tr><td>pH</td><td>${projection.concentrateParameters?.ph ?? '0.0'}</td><td></td></tr>
                <tr><td>BaSO4, %</td><td>${projection.concentrateParameters?.saturation?.saturations?.baSo4 ?? '0'}</td><td>%</td></tr>
                <tr><td>SiO2, %</td><td>${projection.concentrateParameters?.saturation?.saturations?.sio2 ?? '0'}</td><td>%</td></tr>
                <tr><td>CCPP</td><td>${projection.concentrateParameters?.saturation?.ccpp ?? '0'}</td><td>mg/l CaCO3</td></tr>
                <tr><td>TDS</td><td>${projection.concentrateParameters?.tds?.toFixed(1) ?? '0.0'}</td><td>mg/l</td></tr>
                <tr><td>Ca3(PO4)2 SI</td><td>${projection.concentrateParameters?.saturation?.saturations?.ca3po42 ?? '0.00'}</td><td></td></tr>
                <tr><td>CaF2, %</td><td>${projection.concentrateParameters?.saturation?.saturations?.caF2 ?? '0'}</td><td>%</td></tr>
                <tr><td>Langelier</td><td>${projection.concentrateParameters?.saturation?.lsi ?? '0.00'}</td><td></td></tr>
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
                  <td>0.00</td>
                  <td>${rawTds.toFixed(2)}</td>
                  <td>${Number(waterData.ph || 7).toFixed(2)}</td>
                  <td>${toEcondString(rawTds, waterData.ph || 7)}</td>
                </tr>
                <tr>
                  <td>2</td>
                  <td>${projection.feedFlow || '0.00'}</td>
                  <td>0.00</td>
                  <td>${rawTds.toFixed(2)}</td>
                  <td>${feedPh.toFixed(2)}</td>
                  <td>${toEcondString(rawTds, feedPh)}</td>
                </tr>
                <tr>
                  <td>3</td>
                  <td>${projection.feedFlow || '0.00'}</td>
                  <td>${projection.calcFeedPressurePsi || '0.00'}</td>
                  <td>${rawTds.toFixed(2)}</td>
                  <td>${feedPh.toFixed(2)}</td>
                  <td>${toEcondString(rawTds, feedPh)}</td>
                </tr>
                <tr>
                  <td>4</td>
                  <td>${projection.concentrateFlow || '0.00'}</td>
                  <td>${projection.calcConcPressurePsi || '0.00'}</td>
                  <td>${concTds.toFixed(2)}</td>
                  <td>${concPh.toFixed(2)}</td>
                  <td>${toEcondString(concTds, concPh)}</td>
                </tr>
                <tr>
                  <td>5</td>
                  <td>${projection.permeateFlow || '0.00'}</td>
                  <td>0.00</td>
                  <td>${permTds.toFixed(2)}</td>
                  <td>${permPh.toFixed(2)}</td>
                  <td>${toEcondString(permTds, permPh)}</td>
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
    setMembranes(mergeMembranes(data.membranes));
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
        {activeTab === 'analysis' && <WaterAnalysis waterData={waterData} setWaterData={setWaterData} handleApplyTdsProfile={handleApplyTdsProfile} />}
        {activeTab === 'pretreatment' && <PreTreatment waterData={waterData} pretreatment={pretreatment} setPretreatment={setPretreatment} systemConfig={systemConfig} />}
        {activeTab === 'design' && (
          <SystemDesign
            membranes={membranes}
            systemConfig={systemConfig}
            setWaterData={setWaterData} 
            setSystemConfig={setSystemConfig}
            projection={projection}
            applyTdsProfile={handleApplyTdsProfile}
            waterData={waterData}
            onRun={() => setSystemConfig(c => ({ ...c, designCalculated: true }))}
          />
        )}
        {activeTab === 'post' && <PostTreatment projection={projection} postTreatment={postTreatment} setPostTreatment={setPostTreatment} systemConfig={systemConfig} />}
        {activeTab === 'report' && (
          <Report 
            waterData={waterData} 
            systemConfig={systemConfig} 
            applyTdsProfile={handleApplyTdsProfile} 
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