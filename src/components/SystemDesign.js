import React, { useState, useEffect, useRef } from 'react';
import { 
  FLOW_CONVERSION_MAP 
} from '../utils/calculatorService';
import { 
  calculateFeedFlow, 
  calculatePermeateFlow, 
  calculateConcentrateFlow, 
  calculateRecovery 
} from '../engines/calculationEngine';

const SystemDesign = ({
  membranes,
  systemConfig,
  setSystemConfig,
  projection,
  waterData,
  applyTdsProfile,
  setWaterData,
  onRun
}) => {

  const [showMembraneModal, setShowMembraneModal] = useState(false);
  const [showFlowDiagram, setShowFlowDiagram] = useState(false);
  const flowDiagramRef = useRef(null);
  const [selectedStageForMembrane, setSelectedStageForMembrane] = useState(1);
  const [localPass1Stages, setLocalPass1Stages] = useState(null); // Local state for input while typing
  const [localAverageFlux, setLocalAverageFlux] = useState(null); // Local state for flux input
  const [showFeedPressure, setShowFeedPressure] = useState(false);
  const [showPermeatePressure, setShowPermeatePressure] = useState(false);
  const [showFluxLoss, setShowFluxLoss] = useState(false);

  // Sync localAverageFlux when systemConfig.averageFlux changes externally
  useEffect(() => {
    if (localAverageFlux !== null && systemConfig.averageFlux !== localAverageFlux) {
      setLocalAverageFlux(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemConfig.averageFlux]);


  // Get stages from systemConfig, always ensure 6 stages exist
  const getStages = () => {
    if (systemConfig.stages && systemConfig.stages.length === 6) {
      return systemConfig.stages;
    }
    // Initialize with only Stage 1 active (vessels > 0), others have 0
    const stage1Vessels = systemConfig.stage1Vessels || 3;
    return [
      { membraneModel: systemConfig.membraneModel || 'espa2ld', elementsPerVessel: systemConfig.elementsPerVessel || 7, vessels: stage1Vessels },
      { membraneModel: systemConfig.membraneModel || 'espa2ld', elementsPerVessel: systemConfig.elementsPerVessel || 7, vessels: 0 },
      { membraneModel: systemConfig.membraneModel || 'espa2ld', elementsPerVessel: systemConfig.elementsPerVessel || 7, vessels: 0 },
      { membraneModel: systemConfig.membraneModel || 'espa2ld', elementsPerVessel: systemConfig.elementsPerVessel || 7, vessels: 0 },
      { membraneModel: systemConfig.membraneModel || 'espa2ld', elementsPerVessel: systemConfig.elementsPerVessel || 7, vessels: 0 },
      { membraneModel: systemConfig.membraneModel || 'espa2ld', elementsPerVessel: systemConfig.elementsPerVessel || 7, vessels: 0 }
    ];
  };

  const stages = getStages();

  // Use pass1Stages from systemConfig as source of truth, default to 1
  // This is the CONTROLLING value - it determines how many stages are active
  const pass1Stages = (systemConfig.pass1Stages !== undefined && systemConfig.pass1Stages >= 1 && systemConfig.pass1Stages <= 6)
    ? systemConfig.pass1Stages
    : 1; // Default to 1 stage initially

  // Initialize stages in systemConfig if not present
  useEffect(() => {
    if (!systemConfig.stages || systemConfig.stages.length !== 6) {
      const initialStages = getStages();
      setSystemConfig(prev => ({
        ...prev,
        stages: initialStages,
        pass1Stages: prev.pass1Stages !== undefined ? prev.pass1Stages : 1
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync localPass1Stages when systemConfig.pass1Stages changes externally
  useEffect(() => {
    if (localPass1Stages !== null && systemConfig.pass1Stages !== localPass1Stages) {
      setLocalPass1Stages(null); // Clear local state to show the actual value
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemConfig.pass1Stages]);

  const getFlowDecimals = (flowUnit) => {
    if (['gpm', 'm3/h'].includes(flowUnit)) return 2;
    if (['gpd', 'm3/d'].includes(flowUnit)) return 1;
    if (['mgd', 'migd', 'mld'].includes(flowUnit)) return 3;
    return 2; // default
  };

  const calculateTotalPassArea = (cfg) => {
    const currentStages = cfg.stages || getStages();
    let area = 0;
    const activePass1Stages = Math.min(Math.max(Number(cfg.pass1Stages) || 1, 1), 6);
    for (let i = 0; i < activePass1Stages; i++) {
        const s = currentStages[i];
        const vessels = Number(s?.vessels) || 0;
        const elements = Number(s?.elementsPerVessel) || 0;
        // Robust matching: check ID, then check Name (normalized)
        const modelId = (s?.membraneModel || '').toLowerCase().replace(/-/g, '');
        const membrane = membranes.find(m => 
          m.id.toLowerCase().replace(/-/g, '') === modelId || 
          m.name.toLowerCase().replace(/-/g, '') === modelId
        ) || membranes[0];
        area += vessels * elements * (Number(membrane?.areaM2) || 37.16);
    }
    return area;
  };

  const getFluxConstant = () => {
    const currentStages = systemConfig.stages || getStages();
    const s = currentStages[0];
    const modelId = (s?.membraneModel || '').toLowerCase().replace(/-/g, '');
    const membrane = membranes.find(m => 
      m.id.toLowerCase().replace(/-/g, '') === modelId || 
      m.name.toLowerCase().replace(/-/g, '') === modelId
    ) || membranes[0];
    const area = Number(membrane?.areaM2) || 37.16;
    return (area / 1000).toFixed(5);
  };

  const fluxConst = getFluxConstant();

  const handleInputChange = (key, value) => {
    const resetsDesign = [
      'feedFlow',
      'averageFlux',
      'permeateFlow',
      'recovery',
      'concentrateFlow',
      'numTrains',
      'elementsPerVessel',
      'stage1Vessels',
      'stage2Vessels',
      'membraneModel',
      'feedPressure'
    ].includes(key);

    let updates = { ...systemConfig, [key]: value, ...(resetsDesign ? { designCalculated: false } : {}) };

    if (key === 'flowUnit') {
      const oldUnit = systemConfig.flowUnit || 'gpm';
      const newUnit = value || 'gpm';
      const oldFactor = FLOW_CONVERSION_MAP[oldUnit] || 1;
      const newFactor = FLOW_CONVERSION_MAP[newUnit] || 1;
      const ratio = oldFactor / newFactor;

      updates.feedFlow = (Number(systemConfig.feedFlow) * ratio).toFixed(getFlowDecimals(newUnit));
      updates.permeateFlow = (Number(systemConfig.permeateFlow) * ratio).toFixed(getFlowDecimals(newUnit));
      updates.concentrateFlow = (Number(systemConfig.concentrateFlow) * ratio).toFixed(getFlowDecimals(newUnit));

      const unit = newUnit.toLowerCase().trim().replace('/', '');
      const isImperialFlow = ['gpm', 'gpd', 'mgd', 'migd'].includes(unit);
      updates.pressureUnit = isImperialFlow ? 'psi' : 'bar';
      updates.fluxUnit = isImperialFlow ? 'gfd' : 'lmh';
      
      // Flux also needs to be converted if switching between Imperial/Metric flux units
      const oldIsImperial = ['gpm', 'gpd', 'mgd', 'migd'].includes(oldUnit.toLowerCase().trim().replace('/', ''));
      if (oldIsImperial !== isImperialFlow) {
        const oldFlux = Number(systemConfig.averageFlux) || 0;
        updates.averageFlux = (isImperialFlow ? (oldFlux / 1.6976) : (oldFlux * 1.6976)).toFixed(2);
      }
    }

    // --- Apply RO Membrane Formulas ---
    const numValue = Number(value) || 0;
    const trains = Math.max(Number(updates.numTrains) || 1, 1);
    const flowUnit = updates.flowUnit || 'gpm';
    const factor = FLOW_CONVERSION_MAP[flowUnit] || 1;
    const isImperial = ['gpm', 'gpd', 'mgd', 'migd'].includes(flowUnit.toLowerCase().trim().replace('/', ''));
    const decimals = getFlowDecimals(flowUnit);
    const totalArea = calculateTotalPassArea(updates);

    if (key === 'feedFlow' && numValue > 0) {
      const rec = (Number(updates.recovery) || 0) / 100;
      const trainQf = numValue / trains;
      updates.permeateFlow = calculatePermeateFlow(trainQf, rec).toFixed(decimals);
      updates.concentrateFlow = calculateConcentrateFlow(trainQf, rec, true).toFixed(decimals);
      
      if (totalArea > 0) {
        const qpM3h = Number(updates.permeateFlow) * factor;
        const fluxLmh = (qpM3h * 1000) / totalArea;
        updates.averageFlux = (isImperial ? (fluxLmh / 1.6976) : fluxLmh).toFixed(2);
      }
    } 
    else if (key === 'recovery' && numValue > 0) {
      const rec = numValue / 100;
      const trainQf = (Number(updates.feedFlow) || 0) / trains;
      updates.permeateFlow = calculatePermeateFlow(trainQf, rec).toFixed(decimals);
      updates.concentrateFlow = calculateConcentrateFlow(trainQf, rec, true).toFixed(decimals);
      
      if (totalArea > 0) {
        const qpM3h = Number(updates.permeateFlow) * factor;
        const fluxLmh = (qpM3h * 1000) / totalArea;
        updates.averageFlux = (isImperial ? (fluxLmh / 1.6976) : fluxLmh).toFixed(2);
      }

      if (value !== systemConfig.recovery) {
        updates.feedPressure = '';
      }
    }
    else if (key === 'numTrains' && numValue > 0) {
      const qf = Number(updates.feedFlow) || 0;
      const rec = (Number(updates.recovery) || 0) / 100;
      const trainQf = qf / numValue;
      updates.permeateFlow = calculatePermeateFlow(trainQf, rec).toFixed(decimals);
      updates.concentrateFlow = calculateConcentrateFlow(trainQf, rec, true).toFixed(decimals);
      
      if (totalArea > 0) {
        const qpM3h = Number(updates.permeateFlow) * factor;
        const fluxLmh = (qpM3h * 1000) / totalArea;
        updates.averageFlux = (isImperial ? (fluxLmh / 1.6976) : fluxLmh).toFixed(2);
      }
    }
    else if (key === 'membraneAge' || key === 'fluxDeclinePerYear') {
      const age = Number(updates.membraneAge) || 0;
      const decline = Number(updates.fluxDeclinePerYear) || 5;
      updates.foulingFactor = Math.pow(1 - decline / 100, age).toFixed(3);
    }

    // If user enters Feed Pressure, we don't force recovery to 52.5 anymore
    // This allows testing specific cases like the user benchmarks (40% recovery)
    if (key === 'feedPressure' && value !== '' && Number(value) > 0) {
      // updates.recovery = 52.5; // REMOVED: Don't force recovery
      const qf = Number(updates.feedFlow) || 0;
      const rec = (Number(updates.recovery) || 40) / 100;
      const trainQf = qf / trains;
      updates.permeateFlow = calculatePermeateFlow(trainQf, rec).toFixed(decimals);
      updates.concentrateFlow = calculateConcentrateFlow(trainQf, rec, true).toFixed(decimals);
    }

    setSystemConfig(updates);
  };

  const handleStageChange = (stageIndex, field, value) => {
    const currentStages = systemConfig.stages || stages;
    const newStages = [...currentStages];
    newStages[stageIndex] = { ...newStages[stageIndex], [field]: value };

    // Cascade membrane model and elements per vessel if Stage 1 is changed
    if (stageIndex === 0) {
      for (let i = 1; i < newStages.length; i++) {
        if (field === 'membraneModel' || field === 'elementsPerVessel') {
          newStages[i] = { ...newStages[i], [field]: value };
        }
      }
    }

    // Preserve designCalculated state - if it was already calculated, keep it calculated
    // so flux updates in real-time when vessels/stages change
    const keepCalculated = systemConfig.designCalculated;

    let updates = {
      ...systemConfig,
      stages: newStages,
      stage1Vessels: newStages[0].vessels,
      stage2Vessels: newStages[1]?.vessels || 0,
      elementsPerVessel: newStages[0].elementsPerVessel,
      membraneModel: newStages[0].membraneModel,
      designCalculated: keepCalculated // Preserve calculated state
    };

    // If vessels changed for a stage beyond pass1Stages, auto-increase pass1Stages
    if (field === 'vessels') {
      const vesselValue = parseInt(value) || 0;
      if (vesselValue > 0 && stageIndex >= pass1Stages) {
        // User is setting vessels for a stage beyond current pass1Stages
        // Auto-increase pass1Stages to include this stage
        const newPass1Stages = stageIndex + 1;
        // Copy Stage 1 values to any new stages that were added
        const stage1Values = { ...currentStages[0] };
        for (let i = pass1Stages; i < newPass1Stages; i++) {
          if (i !== stageIndex) { // Don't overwrite the stage being edited
            newStages[i] = { ...stage1Values, vessels: 0 };
          }
        }
        updates.pass1Stages = newPass1Stages;
      }
    }

    // Recalculate Flux and related flows based on NEW area
    const totalArea = calculateTotalPassArea(updates);
    if (totalArea > 0) {
        const flowUnit = updates.flowUnit || 'gpm';
        const factor = FLOW_CONVERSION_MAP[flowUnit] || 1;
        const isImperial = ['gpm', 'gpd', 'mgd', 'migd'].includes(flowUnit.toLowerCase().trim().replace('/', ''));
        const decimals = getFlowDecimals(flowUnit);
        
        // Use either fixed recovery OR fixed flux to update
        // In this case, we'll keep recovery fixed and update permeate/flux
        const rec = (Number(updates.recovery) || 0) / 100;
        const trains = Math.max(Number(updates.numTrains) || 1, 1);
        const trainQf = (Number(updates.feedFlow) || 0) / trains;
        
        updates.permeateFlow = calculatePermeateFlow(trainQf, rec).toFixed(decimals);
        updates.concentrateFlow = calculateConcentrateFlow(trainQf, rec, true).toFixed(decimals);
        
        const qpM3h = Number(updates.permeateFlow) * factor;
        const fluxLmh = (qpM3h * 1000) / totalArea;
        updates.averageFlux = (isImperial ? (fluxLmh / 1.6976) : fluxLmh).toFixed(2);
    }

    setSystemConfig(updates);
  };

  const handlePass1StagesChange = (value) => {
    // value can be a number or string
    const numStages = Math.min(Math.max(parseInt(value) || 1, 1), 6);
    const currentPass1Stages = systemConfig.pass1Stages !== undefined ? systemConfig.pass1Stages : pass1Stages;

    if (numStages === currentPass1Stages) {
      return; // No change needed
    }

    // Get current stages from systemConfig
    const currentStages = systemConfig.stages || stages;
    const newStages = [...currentStages];
    const stage1Values = { ...currentStages[0] };

    if (numStages > currentPass1Stages) {
      // Increasing: Add new stages by copying Stage 1 values
      // New stages get Stage 1 membrane and elements, but vessels start at 0
      for (let i = currentPass1Stages; i < numStages; i++) {
        newStages[i] = {
          ...stage1Values,
          vessels: 0  // New stages start with 0 vessels
        };
      }
    } else {
      // Decreasing: FORCE clear vessels for stages beyond numStages
      // This ensures Pass 1 stages CONTROLS the number of active stages
      for (let i = numStages; i < 6; i++) {
        newStages[i] = {
          ...stage1Values,
          vessels: 0  // Force to 0 for stages beyond numStages
        };
      }
    }

    // Preserve designCalculated state - if it was already calculated, keep it calculated
    // so flux updates in real-time when stages change
    const keepCalculated = systemConfig.designCalculated;

    // Update systemConfig with new pass1Stages value
    let updates = {
      ...systemConfig,
      stages: newStages,
      stage1Vessels: newStages[0].vessels,
      stage2Vessels: newStages[1]?.vessels || 0,
      pass1Stages: numStages, // Store in config as source of truth - this CONTROLS active stages
      designCalculated: keepCalculated // Preserve calculated state so flux updates in real-time
    };

    // Recalculate Flux based on new stage count
    const totalArea = calculateTotalPassArea(updates);
    if (totalArea > 0) {
        const flowUnit = updates.flowUnit || 'gpm';
        const factor = FLOW_CONVERSION_MAP[flowUnit] || 1;
        const isImperial = ['gpm', 'gpd', 'mgd', 'migd'].includes(flowUnit.toLowerCase().trim().replace('/', ''));
        const decimals = getFlowDecimals(flowUnit);
        const rec = (Number(updates.recovery) || 0) / 100;
        const trains = Math.max(Number(updates.numTrains) || 1, 1);
        const trainQf = (Number(updates.feedFlow) || 0) / trains;
        
        updates.permeateFlow = calculatePermeateFlow(trainQf, rec).toFixed(decimals);
        updates.concentrateFlow = calculateConcentrateFlow(trainQf, rec, true).toFixed(decimals);
        
        const qpM3h = Number(updates.permeateFlow) * factor;
        const fluxLmh = (qpM3h * 1000) / totalArea;
        updates.averageFlux = (isImperial ? (fluxLmh / 1.6976) : fluxLmh).toFixed(2);
    }

    setSystemConfig(updates);
  };

  const handleMembraneSelect = (membraneId) => {
    const currentStages = systemConfig.stages || stages;
    const newStages = [...currentStages];
    
    // Cascading update: Change selected stage and all SUBSEQUENT stages
    for (let i = selectedStageForMembrane - 1; i < newStages.length; i++) {
      newStages[i] = {
        ...newStages[i],
        membraneModel: membraneId
      };
    }

    let updates = {
      ...systemConfig,
      stages: newStages,
      membraneModel: newStages[0].membraneModel,
      designCalculated: false
    };

    // Recalculate Flux based on new membrane area
    const totalArea = calculateTotalPassArea(updates);
    if (totalArea > 0) {
        const flowUnit = updates.flowUnit || 'gpm';
        const factor = FLOW_CONVERSION_MAP[flowUnit] || 1;
        const isImperial = ['gpm', 'gpd', 'mgd', 'migd'].includes(flowUnit.toLowerCase().trim().replace('/', ''));
        const decimals = getFlowDecimals(flowUnit);
        const rec = (Number(updates.recovery) || 0) / 100;
        const trains = Math.max(Number(updates.numTrains) || 1, 1);
        const trainQf = (Number(updates.feedFlow) || 0) / trains;
        
        updates.permeateFlow = calculatePermeateFlow(trainQf, rec).toFixed(decimals);
        updates.concentrateFlow = calculateConcentrateFlow(trainQf, rec, true).toFixed(decimals);
        
        const qpM3h = Number(updates.permeateFlow) * factor;
        const fluxLmh = (qpM3h * 1000) / totalArea;
        updates.averageFlux = (isImperial ? (fluxLmh / 1.6976) : fluxLmh).toFixed(2);
    }

    setSystemConfig(updates);
    setShowMembraneModal(false);
  };

  const openMembraneModal = (stageNum) => {
    setSelectedStageForMembrane(stageNum);
    setShowMembraneModal(true);
  };

  const handleFlowUnitChange = (nextUnit) => {
    const prevUnit = systemConfig.flowUnit || 'gpm';
    const prevFactor = FLOW_CONVERSION_MAP[prevUnit] || 1;
    const nextFactor = FLOW_CONVERSION_MAP[nextUnit] || 1;

    // Get decimal precision for the new unit (matching Hydranautics)
    const getFlowDecimals = (flowUnit) => {
      if (['gpm', 'm3/h'].includes(flowUnit)) return 2;
      if (['gpd', 'm3/d'].includes(flowUnit)) return 1;
      if (['mgd', 'migd', 'mld'].includes(flowUnit)) return 3;
      return 2; // default
    };

    const convertValue = (val) => {
      const num = Number(val) || 0;
      if (num === 0) return '0.00';
      return (num * (prevFactor / nextFactor)).toFixed(getFlowDecimals(nextUnit));
    };

    const isImperial = ['gpm', 'gpd', 'mgd', 'migd'].includes(nextUnit);
    const prevIsImperial = ['gpm', 'gpd', 'mgd', 'migd'].includes(prevUnit);
    
    // Also convert averageFlux numerical value if unit category changed
    let nextAverageFlux = systemConfig.averageFlux;
    if (isImperial !== prevIsImperial) {
      const currentFlux = Number(systemConfig.averageFlux) || 0;
      if (currentFlux > 0) {
        // 1.6976 is the conversion factor between LMH and GFD
        nextAverageFlux = (isImperial ? (currentFlux / 1.6976) : (currentFlux * 1.6976)).toFixed(2);
      }
    }

    setSystemConfig({
      ...systemConfig,
      flowUnit: nextUnit,
      fluxUnit: isImperial ? 'gfd' : 'lmh',
      feedFlow: convertValue(systemConfig.feedFlow),
      permeateFlow: convertValue(systemConfig.permeateFlow),
      concentrateFlow: convertValue(systemConfig.concentrateFlow),
      averageFlux: nextAverageFlux,
      designCalculated: false
    });
  };

  // Get decimal precision for flow unit (matching Hydranautics)
    // const getFlowDecimals = (flowUnit) => {
    //   if (['gpm', 'm3/h'].includes(flowUnit)) return 2;
    //   if (['gpd', 'm3/d'].includes(flowUnit)) return 1;
    //   if (['mgd', 'migd', 'mld'].includes(flowUnit)) return 3;
    //   return 2; // default
    // };

  // Format flux to match flow unit decimal precision when value is 0

  const panelStyle = { background: '#c2d1df', border: '1px solid #8ba4bb', padding: '10px', borderRadius: '2px' };
  const headerStyle = { background: '#004a80', color: 'white', padding: '4px 8px', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '10px' };
  const rowStyle = { display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.75rem' };
  const inputStyle = { width: '70px', textAlign: 'right', border: '1px solid #999' };

  const flowUnitLabel = systemConfig.flowUnit || 'gpm';
  const fUnit = flowUnitLabel; // Use exact user selected unit
  const unitForCategory = (flowUnitLabel || '').toLowerCase().trim().replace('/', '');
  const isImperialCategory = ['gpm', 'gpd', 'mgd', 'migd'].includes(unitForCategory);
  
  const pUnit = isImperialCategory ? 'psi' : 'bar';
  const fluxUnit = isImperialCategory ? 'gfd' : 'lmh';
  
  const flowDiagramReady = systemConfig.designCalculated && projection;
  const handlePrintFlowDiagram = () => {
    if (!flowDiagramRef.current) return;

    const flowPoints = (projection?.flowDiagramPoints || []).slice().sort((a, b) => a.id - b.id);
    const flowIdHeader = flowPoints.map(p => `<th style="border: 1px solid #c9d3de; padding: 6px;">${p.id}</th>`).join('');
    
    const flowRows = [
      { label: 'Stream', key: 'name' },
      { label: `Flow (${fUnit})`, key: 'flow' },
      { label: `Pressure (${pUnit})`, key: 'pressure' },
      { label: 'TDS (mg/l)', key: 'tds' },
      { label: 'pH', key: 'ph' },
      { label: 'Econd (µS/cm)', key: 'ec' }
    ].map((row, rIdx) => `
      <tr>
        <td style="border: 1px solid #c9d3de; padding: 6px; font-weight: bold; background: #f9f9f9;">${row.label}</td>
        ${flowPoints.map(p => `<td style="border: 1px solid #c9d3de; padding: 6px; ${row.key === 'name' ? 'font-size: 0.7rem; background: #f9f9f9;' : ''}">${p[row.key] || ''}</td>`).join('')}
      </tr>
    `).join('');

    const stageRows = (projection.stageResults || []).map((row) => `
      <tr>
        <td style="border: 1px solid #ccc; padding: 6px;">${row.array}</td>
        <td style="border: 1px solid #ccc; padding: 6px;">${row.vessels}</td>
        <td style="border: 1px solid #ccc; padding: 6px;">${row.feedPressure}</td>
        <td style="border: 1px solid #ccc; padding: 6px;">${row.concPressure}</td>
        <td style="border: 1px solid #ccc; padding: 6px;">${row.feedFlowVessel}</td>
        <td style="border: 1px solid #ccc; padding: 6px;">${row.concFlowVessel}</td>
        <td style="border: 1px solid #ccc; padding: 6px;">${row.flux}</td>
        <td style="border: 1px solid #ccc; padding: 6px;">${row.highestFlux}</td>
        <td style="border: 1px solid #ccc; padding: 6px;">${row.highestBeta}</td>
        <td style="border: 1px solid #ccc; padding: 6px;">${row.rejection}</td>
      </tr>
    `).join('');

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(`
          <html>
            <head>
              <title>Flow Diagram</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                .print-container { width: 100%; }
                table { width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: center; margin-bottom: 20px; }
                th, td { border: 1px solid #c9d3de; padding: 6px; }
                thead { background: #f0f3f7; }
                .header { background: #1f6fb2; color: white; padding: 12px 16px; font-weight: bold; font-size: 1rem; margin-top: 20px; margin-bottom: 10px; }
                .meta { padding: 12px 16px; border-bottom: 1px solid #d6e1ed; display: flex; gap: 20px; font-size: 0.85rem; }
                .content { padding: 20px 0; }
                svg { width: 100%; height: 260px; }
              </style>
            </head>
            <body>
              <div class="print-container">
                <div class="header">Flow Diagram</div>
                <div class="meta">
                  <div>Project name: ${waterData?.projectName || 'Project'}</div>
                  <div>Temperature: ${((Number(waterData?.temp || 25) * 9) / 5 + 32).toFixed(2)} °F</div>
                  <div>Membrane age: ${systemConfig.membraneAge || 0} years</div>
                  <div>Fouling factor: ${Number(systemConfig.foulingFactor || 1).toFixed(3)}</div>
                  <div>Flux Loss: ${((1 - (Number(systemConfig.foulingFactor) || 1)) * 100).toFixed(1)}%</div>
                  <div>Flux decline: ${systemConfig.fluxDeclinePerYear || 5} %/yr</div>
                  <div>Date: ${new Date().toLocaleDateString()}</div>
                </div>
                <div class="content">
                  ${flowDiagramRef.current.querySelector('svg').outerHTML}
                </div>
                
                <table>
                  <thead>
                    <tr style="background: #f0f3f7;">
                      <th style="border: 1px solid #c9d3de; padding: 6px; width: 140px;">#</th>
                      ${flowIdHeader}
                    </tr>
                  </thead>
                  <tbody>
                    ${flowRows}
                  </tbody>
                </table>
                
                <div class="header">Calculation Result</div>
                <table>
                  <thead>
                    <tr style="background: #eee;">
                      <th style="border: 1px solid #ccc; padding: 6px;">Array</th>
                      <th style="border: 1px solid #ccc; padding: 6px;">Vessels</th>
                      <th style="border: 1px solid #ccc; padding: 6px;">Feed (${pUnit})</th>
                      <th style="border: 1px solid #ccc; padding: 6px;">Conc (${pUnit})</th>
                      <th style="border: 1px solid #ccc; padding: 6px;">Feed per vessel (${fUnit})</th>
                      <th style="border: 1px solid #ccc; padding: 6px;">Conc per vessel (${fUnit})</th>
                      <th style="border: 1px solid #ccc; padding: 6px;">Flux (${fluxUnit})</th>
                      <th style="border: 1px solid #ccc; padding: 6px;">Highest flux (${fluxUnit})</th>
                      <th style="border: 1px solid #ccc; padding: 6px;">Highest beta</th>
                      <th style="border: 1px solid #ccc; padding: 6px;">Final rejection (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${stageRows}
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
  const changeTds = (value) => {
    const tds = value === '' ? 0 : Number(value);

    setWaterData({
      ...waterData,
      calculatedTds: tds
    });

    // 🔥 AUTO CALCULATE ON INPUT
    if (tds > 0) {
      applyTdsProfile(tds);
    }
  };



  const labelStyle = { fontSize: '0.75rem', fontWeight: 'bold', color: '#555' };
  const miniActionBtn = {
    background: 'linear-gradient(#f4f7f9, #dfe6ed)',
    border: '1px solid #8ba4bb',
    borderRadius: '6px',
    padding: '4px 8px',
    fontSize: '0.7rem',
    fontWeight: 'bold',
    color: '#003b6f',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', fontFamily: 'Arial' }}>

      <label style={labelStyle}>Calculated TDS (mg/L)</label>

      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <input
          type="number"
          value={waterData.calculatedTds ?? ''}
          onChange={(e) => changeTds(e.target.value)}
          style={{ width: '15%' }}
        />
          
        <button
          onClick={() => {
            const nextShow = !showFeedPressure;
            setShowFeedPressure(nextShow);
            if (nextShow) {
              setSystemConfig(prev => ({ ...prev, recovery: 52.5 }));
            }
          }}
          style={{
            ...miniActionBtn,
            background: showFeedPressure
              ? 'linear-gradient(#b3d4f2, #8fbce6)'
              : miniActionBtn.background
          }}
        >
          ⏱️ Feed Pressure
        </button>

        <button
          onClick={() => setShowPermeatePressure(p => !p)}
          style={{
            ...miniActionBtn,
            background: showPermeatePressure
              ? 'linear-gradient(#b3d4f2, #8fbce6)'
              : miniActionBtn.background
          }}
        >
          ⏱️ Permeate Pressure
        </button>
      </div>

      {/* TOP SECTION: INPUT PANELS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.8fr', gap: '10px' }}>
        <div style={panelStyle}>
          <div style={headerStyle}>Train Information</div>
          <div style={rowStyle}><span>Feed pH</span> <input style={inputStyle} value={systemConfig.feedPh} onChange={e => handleInputChange('feedPh', e.target.value)} /></div>
          <div style={rowStyle}>
            <span>Feed flow</span>
            <div style={{display:'flex', gap:'2px'}}>
              <select style={{fontSize:'0.7rem'}} value={systemConfig.flowUnit} onChange={e => handleFlowUnitChange(e.target.value)}>
                <option value="gpm">gpm</option>
                 <option value="m3/h">m³/h</option>
                 <option value="m3/d">m³/d</option>
              </select>
              <input style={inputStyle} value={systemConfig.feedFlow} onChange={e => handleInputChange('feedFlow', e.target.value)} />
            </div>
          </div>

          

          <div style={rowStyle}>
            <span>Permeate recovery %</span>
            <input 
              style={inputStyle} 
              value={systemConfig.recovery ?? ''} 
              onChange={e => handleInputChange('recovery', e.target.value)}
            />
          </div>

          <div style={rowStyle}>
            <span title={`Flux Calculation Logic (Selected Membrane Area: ${(Number(fluxConst) * 1000).toFixed(2)} m²):\n\n🔹 CASE 1: PERMEATE FLOW IN GPM → FLUX IN GFD\nFormula: Average Flux (GFD) = Permeate Flow (gpm) / (No. of Vessels × Nm × ${(Number(fluxConst) * 1.6976 * 4.403).toFixed(4)})\n\n🔹 CASE 2: PERMEATE FLOW IN m³/h → FLUX IN LMH\nFormula: Average Flux (LMH) = Permeate Flow (m³/h) / (No. of Vessels × Nm × ${fluxConst})\n\n🔹 CASE 3: PERMEATE FLOW IN m³/d → FLUX IN LMH\nFormula: Average Flux (LMH) = Permeate Flow (m³/d) / (No. of Vessels × Nm × ${(Number(fluxConst) / 24).toFixed(5)})\n\n⚠️ Note: Constants are automatically updated based on selected membrane area.`}>Average flux</span>
            <div style={{display:'flex', gap:'4px', alignItems:'center'}}>
              <input 
                style={{...inputStyle, background: '#eee'}} 
                value={localAverageFlux !== null ? localAverageFlux : (systemConfig.averageFlux ?? '')} 
                readOnly
              />
              <span style={{ fontSize: '0.7rem', color: '#333' }}>{projection?.fluxUnit || fluxUnit}</span>
            </div>
          </div>

          <div style={rowStyle}>
            <span title="Permeate flow = Flux * Area">Permeate flow</span>
            <div style={{display:'flex', gap:'4px', alignItems:'center'}}>
              <input 
                style={{...inputStyle, background: '#eee'}} 
                value={systemConfig.permeateFlow ?? ''} 
                readOnly
              />
              <span style={{ fontSize: '0.7rem', color: '#333' }}>{systemConfig.flowUnit || 'gpm'}</span>
            </div>
          </div>
          <div style={rowStyle}>
            <span>Concentrate flow</span>
            <div style={{display:'flex', gap:'4px', alignItems:'center'}}>
              <input 
                style={{...inputStyle, background: '#eee'}} 
                value={systemConfig.concentrateFlow ?? ''} 
                readOnly
              />
              <span style={{ fontSize: '0.7rem', color: '#333' }}>{systemConfig.flowUnit || 'gpm'}</span>
            </div>
          </div>
        </div>

        <div style={panelStyle}>
          <div style={headerStyle}>Conditions</div>
          <div style={{ ...rowStyle, fontWeight: 'bold', marginTop: '2px' }}></div>  
          <div style={rowStyle}>
            <span>Chemical</span>
            <select style={{ ...inputStyle, width: '110px', textAlign: 'left' }} value={systemConfig.chemical} onChange={e => handleInputChange('chemical', e.target.value)}>
              <option value="None">None</option>
              <option value="Antiscalant">Antiscalant</option>
              <option value="SBS">SBS</option>
              <option value="Acid">Acid</option>
              <option value="Caustic">Caustic</option>
            </select>
          </div>
          <div style={rowStyle}>
            <span>Chemical concentration</span>
            <div style={{display:'flex', gap:'4px', alignItems:'center'}}>
              <input style={inputStyle} value={systemConfig.chemicalConcentration} onChange={e => handleInputChange('chemicalConcentration', e.target.value)} />
              <span style={{ fontSize: '0.7rem', color: '#333' }}>%</span>
            </div>
          </div>
          <div style={rowStyle}>
            <span>Chemical dose</span>
            <div style={{display:'flex', gap:'4px', alignItems:'center'}}>
              <input style={inputStyle} value={systemConfig.chemicalDose} onChange={e => handleInputChange('chemicalDose', e.target.value)} />
              <select style={{fontSize:'0.7rem'}} value={systemConfig.doseUnit} onChange={e => handleInputChange('doseUnit', e.target.value)}>
                <option value="mg/l">mg/l</option>
                <option value="lb/hr">lb/hr</option>
                <option value="kg/hr">kg/hr</option>
              </select>
            </div>
          </div>
          <div style={rowStyle}><span>Membrane age (years)</span> <input style={inputStyle} value={systemConfig.membraneAge} onChange={e => handleInputChange('membraneAge', e.target.value)} /></div>
          <div style={rowStyle}><span>Flux decline %/yr</span> <input style={inputStyle} value={systemConfig.fluxDeclinePerYear} onChange={e => handleInputChange('fluxDeclinePerYear', e.target.value)} /></div>
          <div style={rowStyle}>
            <span>Fouling factor</span>
            <input
              readOnly
              onClick={() => setShowFluxLoss(prev => !prev)}
              value={showFluxLoss 
                ? `${((1 - (Number(systemConfig.foulingFactor) || 1)) * 100).toFixed(1)}%` 
                : Number(systemConfig.foulingFactor || 1).toFixed(3)
              }
              style={{
                ...inputStyle,
                background: showFluxLoss ? '#fffacd' : '#eee',
                cursor: 'pointer',
                color: showFluxLoss ? '#d32f2f' : '#333',
                fontWeight: 'bold',
                textAlign: 'center'
              }}
              title={showFluxLoss ? "Click to see Fouling Factor" : "Click to see Flux Loss %"}
            />
          </div>
          <div style={rowStyle}><span>SP increase % per year</span> <input style={inputStyle} value={systemConfig.spIncreasePerYear} onChange={e => handleInputChange('spIncreasePerYear', e.target.value)} /></div>
        </div>

        <div style={panelStyle}>
          <div style={headerStyle}>System</div>
          <div style={rowStyle}>
            <span>Total plant product flow</span>
            <div style={{display:'flex', gap:'4px', alignItems:'center'}}>
              <input style={{...inputStyle, background:'#eee'}} value={projection?.totalPlantProductFlowDisplay ?? '0.00'} readOnly />
              <span style={{ fontSize: '0.7rem', color: '#333' }}>{systemConfig.flowUnit || 'gpm'}</span>
            </div>
          </div>
          <div style={rowStyle}><span>Number of trains</span> <input style={inputStyle} value={systemConfig.numTrains} onChange={e => handleInputChange('numTrains', e.target.value)} /></div>
          
          {showFeedPressure && (
            <div style={rowStyle}>
              <span>Feed Pressure</span>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input
                  style={inputStyle}
                  value={systemConfig.feedPressure ?? ''}
                  onChange={e => handleInputChange('feedPressure', e.target.value)}
                />
                <span style={{ fontSize: '0.7rem' }}>{pUnit}</span>
              </div>
            </div>
          )}

          {showPermeatePressure && (
            <div style={rowStyle}>
              <span>Permeate Pressure</span>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input
                  style={inputStyle}
                  value={systemConfig.permeatePressure ?? ''}
                  onChange={e => handleInputChange('permeatePressure', e.target.value)}
                />
                <span style={{ fontSize: '0.7rem' }}>{pUnit}</span>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* MIDDLE SECTION: SPECIFICATIONS & RUN BUTTON */}
      <div style={panelStyle}>
        <div style={headerStyle}>System Specifications</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
          <div style={{ flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', background: 'white' }}>
              <thead>
                <tr style={{ background: '#f0f0f0' }}>
                  <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left', width: '120px' }}></th>
                  {Array.from({ length: pass1Stages }, (_, i) => i + 1).map(stageNum => (
                    <th key={stageNum} style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                      Stage {stageNum}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #ccc', padding: '8px', fontWeight: 'bold' }}>Membrane type</td>
                  {Array.from({ length: pass1Stages }, (_, i) => i + 1).map(stageNum => {
                    const currentStages = systemConfig.stages || stages;
                    const stage = currentStages[stageNum - 1];
                    const getModelId = (model) => (model || '').toLowerCase().replace(/-/g, '').trim();
                    const targetId = getModelId(stage?.membraneModel);
                    const selectedMembrane = membranes.find(m => 
                      getModelId(m.id) === targetId || 
                      getModelId(m.name) === targetId
                    ) || membranes[0];
                    return (
                      <td key={stageNum} style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                        <input
                          type="text"
                          value={selectedMembrane?.name || ''}
                          onClick={() => openMembraneModal(stageNum)}
                          readOnly
                          style={{
                            width: '100%',
                            padding: '4px',
                            textAlign: 'center',
                            border: '1px solid #999',
                            background: '#fffacd',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td style={{ border: '1px solid #ccc', padding: '8px', fontWeight: 'bold' }}>Membranes/vessel</td>
                  {Array.from({ length: pass1Stages }, (_, i) => i + 1).map(stageNum => {
                    const currentStages = systemConfig.stages || stages;
                    const stage = currentStages[stageNum - 1];
                    return (
                      <td key={stageNum} style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                        <input
                          type="number"
                          value={stage?.elementsPerVessel || ''}
                          onChange={(e) => handleStageChange(stageNum - 1, 'elementsPerVessel', parseInt(e.target.value) || 0)}
                          style={{
                            width: '100%',
                            padding: '4px',
                            textAlign: 'center',
                            border: '1px solid #999',
                            fontSize: '0.75rem'
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td style={{ border: '1px solid #ccc', padding: '8px', fontWeight: 'bold' }}>No. of vessels</td>
                  {Array.from({ length: pass1Stages }, (_, i) => i + 1).map(stageNum => {
                    const currentStages = systemConfig.stages || stages;
                    const stage = currentStages[stageNum - 1];
                    const hasError = (stage?.vessels || 0) === 0;
                    return (
                      <td key={stageNum} style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                        <input
                          type="number"
                          value={stage?.vessels || ''}
                          onChange={(e) => handleStageChange(stageNum - 1, 'vessels', parseInt(e.target.value) || 0)}
                          style={{
                            width: '100%',
                            padding: '4px',
                            textAlign: 'center',
                            border: hasError ? '2px solid red' : '1px solid #999',
                            fontSize: '0.75rem'
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
                {showPermeatePressure && (
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '8px', fontWeight: 'bold' }}>
                      Permeate Pressure
                    </td>
                    {Array.from({ length: pass1Stages }).map((_, i) => (
                      <td
                        key={i}
                        style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}
                      >
                        <input
                          type="number"
                          style={{ width: '100%', textAlign: 'center' }}
                          value={systemConfig.permeatePressure ?? ''}
                          onChange={e =>
                            handleInputChange('permeatePressure', e.target.value)
                          }
                        />
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.75rem' }}>
              <span>Pass 1 stages:</span>
              <input
                type="number"
                min="1"
                max="6"
                step="1"
                value={localPass1Stages !== null ? localPass1Stages : pass1Stages}
                onChange={(e) => {
                  const val = e.target.value;
                  // Allow typing any value temporarily
                  if (val === '') {
                    setLocalPass1Stages('');
                    return;
                  }
                  const numVal = parseInt(val);
                  if (!isNaN(numVal)) {
                    setLocalPass1Stages(numVal);
                    // Update immediately if valid
                    if (numVal >= 1 && numVal <= 6) {
                      handlePass1StagesChange(numVal);
                    }
                  }
                }}
                onBlur={(e) => {
                  // Validate and apply on blur
                  const val = parseInt(e.target.value);
                  if (isNaN(val) || val < 1 || val > 6) {
                    // Invalid, restore to current pass1Stages
                    setLocalPass1Stages(null);
                  } else {
                    const clamped = Math.min(Math.max(val, 1), 6);
                    setLocalPass1Stages(null);
                    if (clamped !== pass1Stages) {
                      handlePass1StagesChange(clamped);
                    }
                  }
                }}
                onKeyDown={(e) => {
                  // Handle arrow keys
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const newVal = Math.min(pass1Stages + 1, 6);
                    setLocalPass1Stages(null);
                    handlePass1StagesChange(newVal);
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const newVal = Math.max(pass1Stages - 1, 1);
                    setLocalPass1Stages(null);
                    handlePass1StagesChange(newVal);
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur(); // Trigger onBlur validation
                  }
                }}
                style={{ width: '60px', padding: '4px', textAlign: 'center', border: '1px solid #999' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button onClick={() => {
              setSystemConfig({
                ...systemConfig,
                pass1Stages: 1,
                stages: (systemConfig.stages || stages).map((stage, index) =>
                  index === 0 ? stage : { ...stage, vessels: 0 }
                ),
                stage1Vessels: 3,
                stage2Vessels: 0,
                elementsPerVessel: 7,
                membraneModel: 'espa2ld',
                designCalculated: false
              });
            }} style={{
              background: 'linear-gradient(#bdc3c7, #95a5a6)', color: 'white', padding: '10px 30px',
              borderRadius: '20px', border: '1px solid #7f8c8d', cursor: 'pointer', fontWeight: 'bold',
              alignSelf: 'flex-start'
            }}>
              Recalculate array
            </button>
            <button onClick={onRun} style={{
              background: 'linear-gradient(#3498db, #2980b9)', color: 'white', padding: '10px 30px',
              borderRadius: '20px', border: '1px solid #004a80', cursor: 'pointer', fontWeight: 'bold',
              alignSelf: 'flex-start'
            }}>
              Run
            </button>
            <button
              onClick={() => {
                if (!flowDiagramReady) return;
                setShowFlowDiagram(true);
              }}
              style={{
                background: flowDiagramReady ? 'linear-gradient(#2ecc71, #27ae60)' : 'linear-gradient(#bdc3c7, #95a5a6)',
                color: 'white',
                padding: '10px 30px',
                borderRadius: '20px',
                border: '1px solid #1e8449',
                cursor: flowDiagramReady ? 'pointer' : 'not-allowed',
                fontWeight: 'bold',
                alignSelf: 'flex-start'
              }}
            >
              Flow Diagram
            </button>
          </div>
        </div>
      </div>

      {/* MEMBRANE SELECTION MODAL */}
      {showMembraneModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }} onClick={() => setShowMembraneModal(false)}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '90vw',
            maxWidth: '950px',
            height: '85vh',
            minWidth: '650px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexShrink: 0 }}>
              <h3 style={{ margin: 0 }}>Select Membrane Type for Stage {selectedStageForMembrane}</h3>
              <button onClick={() => setShowMembraneModal(false)} style={{
                background: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '5px 15px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', width: '100%', overflowY: 'auto', overflowX: 'hidden', flex: 1, minHeight: '450px', alignContent: 'start', paddingRight: '5px' }}>
              {membranes.map(membrane => (
                <button
                  key={membrane.id}
                  onClick={() => handleMembraneSelect(membrane.id)}
                  style={{
                    padding: '12px 8px',
                    border: '2px solid #004a80',
                    borderRadius: '4px',
                    background: 'white',
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontSize: '0.8rem',
                    transition: 'all 0.2s',
                    minHeight: '70px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#e3f2fd'}
                  onMouseOut={(e) => e.target.style.background = 'white'}
                >
                  <div style={{ fontWeight: 'bold' }}>{membrane.name}</div>
                  <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '4px' }}>{membrane.type}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showFlowDiagram && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }} onClick={() => setShowFlowDiagram(false)}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '1200px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <div ref={flowDiagramRef}>
              <div style={{ background: '#1f6fb2', color: 'white', padding: '12px 16px', fontWeight: 'bold', fontSize: '1rem' }}>
                Flow Diagram
              </div>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #d6e1ed', display: 'flex', gap: '20px', fontSize: '0.85rem' }}>
                <div>Project name: {waterData?.projectName || 'Project'}</div>
                <div>Temperature: {((Number(waterData?.temp || 25) * 9) / 5 + 32).toFixed(2)} °F</div>
                <div>Date: {new Date().toLocaleDateString()}</div>
                <div>Membrane age, P1: {Number(systemConfig.membraneAge || 0).toFixed(2)} years</div>
              </div>
              <div style={{ padding: '20px', background: '#fff', overflowX: 'auto' }}>
                <svg viewBox={`0 0 ${Math.max(900, 250 + (pass1Stages * 150) + 100)} ${Math.max(260, 100 + (pass1Stages * 80))}`} width="100%" height={Math.max(260, 100 + (pass1Stages * 80))}>
                  {/* --- DYNAMIC SVG GENERATION --- */}
                  {(() => {
                    const numStages = pass1Stages;
                    const startX = 50;
                    const startY = 80;
                    const stageWidth = 100;
                    const horizontalGap = 150;
                    const verticalGap = 80;
                    const elements = [];

                    // 1. Feed line and Pump
                    elements.push(<line key="f-line-1" x1={startX} y1={startY} x2={startX + 100} y2={startY} stroke="#1e6bd6" strokeWidth="6" />);
                    elements.push(<polygon key="p1-hex" points={`${startX + 30},${startY - 15} ${startX + 60},${startY - 15} ${startX + 75},${startY} ${startX + 60},${startY + 15} ${startX + 30},${startY + 15} ${startX + 15},${startY}`} fill="white" stroke="#222" strokeWidth="2" />);
                    elements.push(<text key="p1-txt" x={startX + 45} y={startY + 5} textAnchor="middle" fontSize="12" fontWeight="bold">1</text>);

                    const pumpX = startX + 130;
                    elements.push(<circle key="pump-c" cx={pumpX} cy={startY} r="25" fill="white" stroke="#222" strokeWidth="3" />);
                    elements.push(<polygon key="pump-t" points={`${pumpX - 5},${startY - 12} ${pumpX + 15},${startY} ${pumpX - 5},${startY + 12}`} fill="none" stroke="#222" strokeWidth="2" />);

                    elements.push(<line key="f-line-2" x1={pumpX + 25} y1={startY} x2={250} y2={startY} stroke="#1e6bd6" strokeWidth="6" />);
                    elements.push(<polygon key="p2-hex" points={`${pumpX + 50},${startY - 15} ${pumpX + 80},${startY - 15} ${pumpX + 95},${startY} ${pumpX + 80},${startY + 15} ${pumpX + 50},${startY + 15} ${pumpX + 35},${startY}`} fill="white" stroke="#222" strokeWidth="2" />);
                    elements.push(<text key="p2-txt" x={pumpX + 65} y={startY + 5} textAnchor="middle" fontSize="12" fontWeight="bold">2</text>);

                    // Common Permeate Line at Top
                    const permY = 25;
                    const finalX = 250 + (numStages * horizontalGap);
                    elements.push(<line key="perm-main" x1={250 + stageWidth} y1={permY} x2={finalX + 50} y2={permY} stroke="#3cc7f4" strokeWidth="6" />);

                    for (let i = 0; i < numStages; i++) {
                      const sX = 250 + (i * horizontalGap);
                      const sY = startY + (i * verticalGap);

                      // Membrane Block
                      elements.push(<rect key={`m-r-${i}`} x={sX} y={sY - 25} width={stageWidth} height={50} fill="white" stroke="#222" strokeWidth="2" />);
                      elements.push(<line key={`m-l-${i}`} x1={sX} y1={sY + 25} x2={sX + stageWidth} y2={sY - 25} stroke="#222" strokeWidth="1" />);

                      // Permeate branch
                      elements.push(<line key={`p-b-${i}`} x1={sX + stageWidth} y1={sY - 15} x2={sX + stageWidth} y2={permY} stroke="#3cc7f4" strokeWidth="4" />);
                      if (numStages > 1) {
                        const pLabelId = numStages + i + 3;
                        const pY = i === 0 ? permY : (sY + permY) / 2 - 10;
                        const pX = i === 0 ? sX + stageWidth + 40 : sX + stageWidth;
                        
                        elements.push(<polygon key={`pp-${i}`} points={`${pX - 15},${pY - 12} ${pX + 15},${pY - 12} ${pX + 25},${pY} ${pX + 15},${pY + 12} ${pX - 15},${pY + 12} ${pX - 25},${pY}`} fill="white" stroke="#222" strokeWidth="1.5" />);
                        elements.push(<text key={`pt-${i}`} x={pX} y={pY + 4} textAnchor="middle" fontSize="11" fontWeight="bold">{pLabelId}</text>);
                      }

                      // Reject / Next Feed
                      if (i < numStages - 1) {
                        const nY = startY + (i + 1) * verticalGap;
                        elements.push(<line key={`r-v-${i}`} x1={sX + stageWidth / 2} y1={sY + 25} x2={sX + stageWidth / 2} y2={nY} stroke="#35c84b" strokeWidth="6" />);
                        elements.push(<line key={`r-h-${i}`} x1={sX + stageWidth / 2} y1={nY} x2={sX + horizontalGap} y2={nY} stroke="#35c84b" strokeWidth="6" />);
                        const rLabelId = i + 3;
                        const rY = (sY + 25 + nY) / 2;
                        elements.push(<polygon key={`rp-${i}`} points={`${sX + stageWidth / 2 - 15},${rY - 12} ${sX + stageWidth / 2 + 15},${rY - 12} ${sX + stageWidth / 2 + 25},${rY} ${sX + stageWidth / 2 + 15},${rY + 12} ${sX + stageWidth / 2 - 15},${rY + 12} ${sX + stageWidth / 2 - 25},${rY}`} fill="white" stroke="#222" strokeWidth="1.5" />);
                        elements.push(<text key={`rt-${i}`} x={sX + stageWidth / 2} y={rY + 4} textAnchor="middle" fontSize="11" fontWeight="bold">{rLabelId}</text>);
                      } else {
                        // Final Concentrate
                        elements.push(<line key="conc-f" x1={sX + stageWidth / 2} y1={sY + 25} x2={sX + stageWidth / 2} y2={sY + 70} stroke="#35c84b" strokeWidth="6" />);
                        const cLabelId = numStages + 2;
                        elements.push(<polygon key="cp" points={`${sX + stageWidth / 2 - 15},${sY + 50 - 12} ${sX + stageWidth / 2 + 15},${sY + 50 - 12} ${sX + stageWidth / 2 + 25},${sY + 50} ${sX + stageWidth / 2 + 15},${sY + 50 + 12} ${sX + stageWidth / 2 - 15},${sY + 50 + 12} ${sX + stageWidth / 2 - 25},${sY + 50}`} fill="white" stroke="#222" strokeWidth="1.5" />);
                        elements.push(<text key="ct" x={sX + stageWidth / 2} y={sY + 50 + 4} textAnchor="middle" fontSize="11" fontWeight="bold">{cLabelId}</text>);
                      }
                    }

                    // Final Permeate Label
                    const finalPLab = 3 + (numStages > 1 ? 2 * numStages : numStages);
                    elements.push(<polygon key="fpl" points={`${finalX + 45 - 15},${permY - 12} ${finalX + 45 + 15},${permY - 12} ${finalX + 45 + 25},${permY} ${finalX + 45 + 15},${permY + 12} ${finalX + 45 - 15},${permY + 12} ${finalX + 45 - 25},${permY}`} fill="white" stroke="#222" strokeWidth="1.5" />);
                    elements.push(<text key="fpt" x={finalX + 45} y={permY + 4} textAnchor="middle" fontSize="11" fontWeight="bold">{finalPLab}</text>);

                    return elements;
                  })()}

                  {systemConfig.chemical !== 'None' && (
                    <>
                      <text x="180" y="45" textAnchor="middle" fontSize="11" fontFamily="Arial" fill="#b83b2e" fontWeight="bold">
                        {systemConfig.chemical}
                      </text>
                      <line x1="180" y1="50" x2="180" y2="80" stroke="#b83b2e" strokeWidth="2" strokeDasharray="4" />
                    </>
                  )}
                </svg>

                <div style={{ border: '1px solid #c9d3de', borderRadius: '4px', overflow: 'hidden', marginTop: '15px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'center' }}>
                    <thead style={{ background: '#f0f3f7' }}>
                      <tr>
                        <th style={{ border: '1px solid #c9d3de', padding: '6px', width: '140px' }}>#</th>
                        {(projection?.flowDiagramPoints || []).slice().sort((a, b) => a.id - b.id).map((p) => (
                          <th key={p.id} style={{ border: '1px solid #c9d3de', padding: '6px' }}>{p.id}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px', fontWeight: 'bold', background: '#f9f9f9' }}>Stream</td>
                        {(projection?.flowDiagramPoints || []).slice().sort((a, b) => a.id - b.id).map((p) => (
                          <td key={`name-${p.id}`} style={{ border: '1px solid #c9d3de', padding: '6px', fontSize: '0.7rem', background: '#f9f9f9' }}>{p.name || ''}</td>
                        ))}
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px', fontWeight: 'bold', background: '#f9f9f9' }}>Flow ({fUnit})</td>
                        {(projection?.flowDiagramPoints || []).slice().sort((a, b) => a.id - b.id).map((p) => (
                          <td key={p.id} style={{ border: '1px solid #c9d3de', padding: '6px' }}>{p.flow}</td>
                        ))}
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px', fontWeight: 'bold', background: '#f9f9f9' }}>Pressure ({pUnit})</td>
                        {(projection?.flowDiagramPoints || []).slice().sort((a, b) => a.id - b.id).map((p) => (
                          <td key={p.id} style={{ border: '1px solid #c9d3de', padding: '6px' }}>{p.pressure}</td>
                        ))}
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px', fontWeight: 'bold', background: '#f9f9f9' }}>TDS (mg/l)</td>
                        {(projection?.flowDiagramPoints || []).slice().sort((a, b) => a.id - b.id).map((p) => (
                          <td key={p.id} style={{ border: '1px solid #c9d3de', padding: '6px' }}>{p.tds}</td>
                        ))}
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px', fontWeight: 'bold', background: '#f9f9f9' }}>pH</td>
                        {(projection?.flowDiagramPoints || []).slice().sort((a, b) => a.id - b.id).map((p) => (
                          <td key={p.id} style={{ border: '1px solid #c9d3de', padding: '6px' }}>{p.ph}</td>
                        ))}
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px', fontWeight: 'bold', background: '#f9f9f9' }}>Econd (µS/cm)</td>
                        {(projection?.flowDiagramPoints || []).slice().sort((a, b) => a.id - b.id).map((p) => (
                          <td key={p.id} style={{ border: '1px solid #c9d3de', padding: '6px' }}>{p.ec}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handlePrintFlowDiagram} style={{
                  background: '#2ecc71',
                  color: 'white',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '8px 24px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}>
                  Print
                </button>
                <button onClick={() => setShowFlowDiagram(false)} style={{
                  background: '#1f6fb2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '8px 24px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM SECTION: CALCULATION RESULTS (VISIBLE ONLY AFTER RUN) */}
      {systemConfig.designCalculated && projection && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ ...panelStyle, background: '#d9e4f0' }}>
            <div style={headerStyle}>Calculation Results(All flows are per vessel)</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'center', background: 'white' }}>
              <thead style={{ background: '#eee' }}>
                <tr>
                  <th style={{ border: '1px solid #ccc' }}>Array</th>
                  <th style={{ border: '1px solid #ccc' }}>Vessels</th>
                  <th style={{ border: '1px solid #ccc' }}>Feed ({pUnit})</th>
                  <th style={{ border: '1px solid #ccc' }}>Conc ({pUnit})</th>
                  <th style={{ border: '1px solid #ccc' }}>Feed ({fUnit})</th>
                  <th style={{ border: '1px solid #ccc' }}>Conc ({fUnit})</th>
                  <th style={{ border: '1px solid #ccc' }}>Flux ({fluxUnit})</th>
                  <th style={{ border: '1px solid #ccc' }}>Highest flux ({fluxUnit})</th>
                  <th style={{ border: '1px solid #ccc' }}>Highest beta</th>
                </tr>
              </thead>
              <tbody>
                {(projection.stageResults && projection.stageResults.length > 0 ? projection.stageResults : []).map((row, idx) => {
                  const isBetaHigh = Number(row.highestBeta) > 1.20;
                  const flowVesselGpm = fUnit === 'gpm' ? Number(row.concFlowVessel) : (Number(row.concFlowVessel) * (1 / FLOW_CONVERSION_MAP[fUnit]) / 0.227); // approx
                  const isFlowLow = fUnit === 'gpm' && Number(row.concFlowVessel) < 11.0; // Corrected from 12.0 to match industrial benchmarks (e.g. 11.14 gpm)
                  
                  return (
                    <tr key={`stage-${row.stage}`}>
                      <td style={{ border: '1px solid #ccc' }}>{row.array}</td>
                      <td style={{ border: '1px solid #ccc' }}>{row.vessels}</td>
                      <td style={{ border: '1px solid #ccc', background: Number(row.feedPressure) < 0 ? 'red' : 'transparent', color: Number(row.feedPressure) < 0 ? 'white' : 'inherit' }}>
                        {row.feedPressure}
                      </td>
                      <td style={{ border: '1px solid #ccc', background: Number(row.concPressure) < 0 ? 'red' : 'transparent', color: Number(row.concPressure) < 0 ? 'white' : 'inherit' }}>
                        {row.concPressure}
                      </td>
                      <td style={{ border: '1px solid #ccc' }}>
                        {row.feedFlowVessel}
                      </td>
                      <td style={{ 
                        border: '1px solid #ccc', 
                        background: isFlowLow ? 'red' : 'transparent', 
                        color: isFlowLow ? 'white' : 'inherit',
                        fontWeight: isFlowLow ? 'bold' : 'normal'
                      }}>
                        {row.concFlowVessel}
                      </td>
                      <td style={{ border: '1px solid #ccc' }}>{row.flux}</td>
                      <td style={{ border: '1px solid #ccc', background: Number(row.highestFlux) > (fluxUnit === 'gfd' ? 20 : 34) ? 'red' : 'transparent', color: Number(row.highestFlux) > (fluxUnit === 'gfd' ? 20 : 34) ? 'white' : 'inherit' }}>
                        {row.highestFlux}
                      </td>
                      <td style={{ 
                        border: '1px solid #ccc', 
                        background: isBetaHigh ? 'red' : 'transparent', 
                        color: isBetaHigh ? 'white' : 'inherit',
                        fontWeight: isBetaHigh ? 'bold' : 'normal'
                      }}>
                        {row.highestBeta}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
          </div>

          <div style={{ marginTop: '12px', background: 'white', padding: '8px', border: '1px solid #c2d1df' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '0.75rem' }}>Permeate Concentration (mg/L)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', fontSize: '0.7rem' }}>
              <div>Ca: {(projection.permeateParameters?.ions?.ca ?? 0).toFixed(3)}</div>
              <div>Mg: {(projection.permeateParameters?.ions?.mg ?? 0).toFixed(3)}</div>
              <div>Na: {(projection.permeateParameters?.ions?.na ?? 0).toFixed(3)}</div>
              <div>K: {(projection.permeateParameters?.ions?.k ?? 0).toFixed(3)}</div>
              <div>Sr: {(projection.permeateParameters?.ions?.sr ?? 0).toFixed(3)}</div>
              <div>Ba: {(projection.permeateParameters?.ions?.ba ?? 0).toFixed(3)}</div>
              <div>HCO3: {(projection.permeateParameters?.ions?.hco3 ?? 0).toFixed(3)}</div>
              <div>SO4: {(projection.permeateParameters?.ions?.so4 ?? 0).toFixed(3)}</div>
              <div>Cl: {(projection.permeateParameters?.ions?.cl ?? 0).toFixed(3)}</div>
              <div>NO3: {(projection.permeateParameters?.ions?.no3 ?? 0).toFixed(3)}</div>
              <div>SiO2: {(projection.permeateParameters?.ions?.sio2 ?? 0).toFixed(3)}</div>
              <div>PO4: {(projection.permeateParameters?.ions?.po4 ?? 0).toFixed(3)}</div>
              <div>F: {(projection.permeateParameters?.ions?.f ?? 0).toFixed(3)}</div>
              <div>B: {(projection.permeateParameters?.ions?.b ?? 0).toFixed(3)}</div>
              <div>CO2: {(projection.permeateParameters?.ions?.co2 ?? 0).toFixed(3)}</div>
              <div>CO3: {(projection.permeateParameters?.ions?.co3 ?? 0).toFixed(3)}</div>
              <div>pH: {Number(projection.permeateParameters?.ph || 7).toFixed(1)}</div>
              <div>TDS: {Number(projection.permeateParameters?.tds || 0).toFixed(2)} mg/l</div>
            </div>
          </div>

          <div style={{ marginTop: '10px', background: 'white', padding: '8px', border: '1px solid #c2d1df' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '0.75rem' }}>Concentrate Saturations and Parameters</div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', fontSize: '0.7rem' }}>
              <div>CaSO4: {projection.concentrateSaturation?.caSo4 ?? '0.00'}%</div>
              <div>BaSO4: {projection.concentrateSaturation?.baSo4 ?? '0.00'}%</div>
              <div>SrSO4: {projection.concentrateSaturation?.srSo4 ?? '0.00'}%</div>
              <div>SiO2: {projection.concentrateSaturation?.sio2 ?? '0.00'}%</div>
              <div>Ca3(PO4)2: {projection.concentrateSaturation?.ca3po42 ?? '0.00'}%</div>
              <div>CaF2: {projection.concentrateSaturation?.caF2 ?? '0.00'}%</div>
              {(() => {
                const lastStage = projection.stageResults?.[projection.stageResults.length - 1];
                const concP = Number(lastStage?.concPressure) || 0;
                const osmP = Number(projection.concentrateParameters?.osmoticPressure || 0);
                const isNdpLow = (concP - osmP) < 5.0;
                return (
                  <div style={{ background: isNdpLow ? 'red' : 'transparent', color: isNdpLow ? 'white' : 'inherit', padding: '2px' }}>
                    Osmotic pressure: {osmP.toFixed(1)} {pUnit}
                  </div>
                );
              })()}
              <div>CCPP: {projection.concentrateParameters?.saturation?.ccpp ?? '0.00'} mg/L</div>
              <div>Langelier: {projection.concentrateParameters?.saturation?.lsi ?? '0.00'}</div>
              <div>pH: {projection.concentrateParameters?.ph ?? '0.00'}</div>
              <div>TDS: {Number(projection.concentrateParameters?.tds || 0).toFixed(1)} mg/L</div>
            </div>
          </div>

          {projection.designWarnings?.length > 0 && (
            <div style={{ marginTop: '15px', padding: '10px', background: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '4px', color: '#721c24', fontSize: '0.8rem', fontWeight: 'bold' }}>
              <p style={{ margin: 0 }}>⚠️ Design Warnings:</p>
              <ul style={{ margin: '5px 0 0 20px', padding: 0 }}>
                {projection.designWarnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SystemDesign;