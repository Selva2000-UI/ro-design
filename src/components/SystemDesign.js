import React, { useState, useEffect, useRef } from 'react';
import { FLOW_TO_M3H } from '../utils/calculatorService';

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
  const [showFeedPressure, setShowFeedPressure] = useState(false);
  const [showPermeatePressure, setShowPermeatePressure] = useState(false);


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

  const handleInputChange = (key, value) => {
    const resetsDesign = [
      'feedFlow',
      'averageFlux',
      'permeateFlow',
      'recovery',
      'numTrains',
      'elementsPerVessel',
      'stage1Vessels',
      'stage2Vessels',
      'membraneModel',
      'feedPressure'
    ].includes(key);

    const updates = { ...systemConfig, [key]: value, ...(resetsDesign ? { designCalculated: false } : {}) };

    // If user manually edits recovery, clear feedPressure to switch back to normal mode
    if (key === 'recovery' && value !== systemConfig.recovery && Number(value) > 0) {
      updates.feedPressure = '';
    }

    // If user enters Feed Pressure, set recovery default to 52.5 as per request
    if (key === 'feedPressure' && value !== '' && Number(value) > 0) {
      updates.recovery = 52.5;
    }

    setSystemConfig(updates);
  };

  const handleStageChange = (stageIndex, field, value) => {
    const currentStages = systemConfig.stages || stages;
    const newStages = [...currentStages];
    newStages[stageIndex] = { ...newStages[stageIndex], [field]: value };

    // Preserve designCalculated state - if it was already calculated, keep it calculated
    // so flux updates in real-time when vessels/stages change
    const keepCalculated = systemConfig.designCalculated;

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

        setSystemConfig({
          ...systemConfig,
          stages: newStages,
          stage1Vessels: newStages[0].vessels,
          stage2Vessels: newStages[1]?.vessels || 0,
          elementsPerVessel: newStages[0].elementsPerVessel,
          membraneModel: newStages[0].membraneModel,
          pass1Stages: newPass1Stages, // Auto-update pass1Stages
          designCalculated: keepCalculated // Preserve calculated state
        });
        return;
      }
    }

    setSystemConfig({
      ...systemConfig,
      stages: newStages,
      stage1Vessels: newStages[0].vessels,
      stage2Vessels: newStages[1]?.vessels || 0,
      elementsPerVessel: newStages[0].elementsPerVessel,
      membraneModel: newStages[0].membraneModel,
      // Keep pass1Stages unchanged
      designCalculated: keepCalculated // Preserve calculated state so flux updates in real-time
    });
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
    setSystemConfig(prev => ({
      ...prev,
      stages: newStages,
      stage1Vessels: newStages[0].vessels,
      stage2Vessels: newStages[1]?.vessels || 0,
      pass1Stages: numStages, // Store in config as source of truth - this CONTROLS active stages
      designCalculated: keepCalculated // Preserve calculated state so flux updates in real-time
    }));
  };

  const handleMembraneSelect = (membraneId) => {
    const currentStages = systemConfig.stages || stages;
    const newStages = [...currentStages];
    newStages[selectedStageForMembrane - 1] = {
      ...newStages[selectedStageForMembrane - 1],
      membraneModel: membraneId
    };
    setSystemConfig({
      ...systemConfig,
      stages: newStages,
      membraneModel: newStages[0].membraneModel,
      designCalculated: false
    });
    setShowMembraneModal(false);
  };

  const openMembraneModal = (stageNum) => {
    setSelectedStageForMembrane(stageNum);
    setShowMembraneModal(true);
  };

  const handleFlowUnitChange = (nextUnit) => {
    const prevUnit = systemConfig.flowUnit || 'gpm';
    const prevFactor = FLOW_TO_M3H[prevUnit] || 1;
    const nextFactor = FLOW_TO_M3H[nextUnit] || 1;

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

    setSystemConfig({
      ...systemConfig,
      flowUnit: nextUnit,
      feedFlow: convertValue(systemConfig.feedFlow),
      permeateFlow: convertValue(systemConfig.permeateFlow),
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

  const getFeedTds = () => {
    const ions = {
      ca: Number(waterData?.ca) || 0,
      mg: Number(waterData?.mg) || 0,
      na: Number(waterData?.na) || 0,
      k: Number(waterData?.k) || 0,
      sr: Number(waterData?.sr) || 0,
      ba: Number(waterData?.ba) || 0,
      hco3: Number(waterData?.hco3) || 0,
      so4: Number(waterData?.so4) || 0,
      cl: Number(waterData?.cl) || 0,
      no3: Number(waterData?.no3) || 0,
      sio2: Number(waterData?.sio2) || 0,
      po4: Number(waterData?.po4) || 0,
      f: Number(waterData?.f) || 0,
      b: Number(waterData?.b) || 0,
      co2: Number(waterData?.co2) || 0,
      co3: Number(waterData?.co3) || 0,
      nh4: Number(waterData?.nh4) || 0
    };
    return Object.values(ions).reduce((sum, value) => sum + value, 0);
  };

  const formatNumber = (value, decimals = 1) => {
    const num = Number(value);
    return Number.isFinite(num) ? num.toFixed(decimals) : (0).toFixed(decimals);
  };

  const flowUnitLabel = systemConfig.flowUnit || 'gpm';
  const isGpm = ['gpm', 'gpd', 'mgd', 'migd'].includes(flowUnitLabel);
  const pUnit = isGpm ? 'psi' : 'bar';
  // Use m3/h for metric result tables even if input is m3/d, as per industry standard/IMSDesign
  const fUnit = isGpm ? 'gpm' : 'm³/h';
  const fluxUnit = isGpm ? 'gfd' : 'lmh';
//   const BAR_TO_PSI = 14.5038;

  const feedTds = getFeedTds();
  const rawFeedPh = Number(waterData?.ph) || 7.0;
  const treatedFeedPh = Number(systemConfig.feedPh) || rawFeedPh;
  const permTds = projection?.permeateParameters?.tds ?? 0;
  const concTds = projection?.concentrateParameters?.tds ?? 0;
  const permPh = projection?.permeateParameters?.ph ?? treatedFeedPh;
  const concPh = projection?.concentrateParameters?.ph ?? treatedFeedPh;
  const feedPressurePsi = projection?.results?.feedPressure ?? '0.0';
  const concPressurePsi = projection?.results?.concPressure ?? '0.0';
  const flowDiagramReady = systemConfig.designCalculated && projection;
  const tdsToEcond = (value, factor = 1.97) => Math.round((Number(value) || 0) * factor);
  const handlePrintFlowDiagram = () => {
    if (!flowDiagramRef.current) return;

    const stageRows = (projection.stageResults || []).map((row) => `
      <tr>
        <td style="border: 1px solid #ccc; padding: 6px;">1 - ${row.index}</td>
        <td style="border: 1px solid #ccc; padding: 6px;">${row.vessels}</td>
        <td style="border: 1px solid #ccc; padding: 6px;">${row.feedPressure}</td>
        <td style="border: 1px solid #ccc; padding: 6px;">${row.concPressure}</td>
        <td style="border: 1px solid #ccc; padding: 6px;">${row.feedFlow}</td>
        <td style="border: 1px solid #ccc; padding: 6px;">${row.concFlow}</td>
        <td style="border: 1px solid #ccc; padding: 6px;">${row.flux}</td>
        <td style="border: 1px solid #ccc; padding: 6px;">${row.highestFlux}</td>
        <td style="border: 1px solid #ccc; padding: 6px;">${row.highestBeta}</td>
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
                ${flowDiagramRef.current.innerHTML}
                
                <div class="header">Calculation Result</div>
                <table>
                  <thead>
                    <tr style="background: #eee;">
                      <th style="border: 1px solid #ccc; padding: 6px;">Array</th>
                      <th style="border: 1px solid #ccc; padding: 6px;">Vessels</th>
                      <th style="border: 1px solid #ccc; padding: 6px;">Feed (${pUnit})</th>
                      <th style="border: 1px solid #ccc; padding: 6px;">Conc (${pUnit})</th>
                      <th style="border: 1px solid #ccc; padding: 6px;">Feed (${fUnit})</th>
                      <th style="border: 1px solid #ccc; padding: 6px;">Conc (${fUnit})</th>
                      <th style="border: 1px solid #ccc; padding: 6px;">Flux (${fluxUnit})</th>
                      <th style="border: 1px solid #ccc; padding: 6px;">Highest flux (${fluxUnit})</th>
                      <th style="border: 1px solid #ccc; padding: 6px;">Highest beta</th>
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
            <span title={`Flux Calculation Logic (Standard: 400 ft² element):\n\n🔹 CASE 1: PERMEATE FLOW IN GPM → FLUX IN GFD\nFormula: Average Flux (GFD) = Permeate Flow (gpm) / (No. of Vessels × Nm × 0.2778)\n\n🔹 CASE 2: PERMEATE FLOW IN m³/h → FLUX IN LMH\nFormula: Average Flux (LMH) = Permeate Flow (m³/h) / (No. of Vessels × Nm × 0.0372)\n\n🔹 CASE 3: PERMEATE FLOW IN m³/d → FLUX IN LMH\nFormula: Average Flux (LMH) = Permeate Flow (m³/d) / (No. of Vessels × Nm × 0.893)\n\n⚠️ Note: Constants are valid for 400 ft² membranes. If membrane area changes, the constant is automatically recalculated.`}>Average flux</span>
            <div style={{display:'flex', gap:'4px', alignItems:'center'}}>
              <div style={{...inputStyle, background: '#eee'}}>{projection?.results?.avgFlux ?? systemConfig.averageFlux ?? '0.0'}</div>
              <span style={{ fontSize: '0.7rem', color: '#333' }}>{projection?.results?.fluxUnit || (isGpm ? 'GFD' : 'LMH')}</span>
            </div>
          </div>

          <div style={rowStyle}>
            <span title="Permeate flow = Flux * Area">Permeate flow</span>
            <div style={{display:'flex', gap:'4px', alignItems:'center'}}>
              <div style={{...inputStyle, background: '#eee'}}>{projection?.permeateFlow ?? '0.00'}</div>
              <span style={{ fontSize: '0.7rem', color: '#333' }}>{systemConfig.flowUnit || 'gpm'}</span>
            </div>
          </div>
          <div style={rowStyle}>
            <span>Concentrate flow</span>
            <div style={{display:'flex', gap:'4px', alignItems:'center'}}>
              <div style={{...inputStyle, background: '#eee'}}>{projection?.concentrateFlow ?? '0.00'}</div>
              <span style={{ fontSize: '0.7rem', color: '#333' }}>{systemConfig.flowUnit || 'gpm'}</span>
            </div>
          </div>
        </div>

        <div style={panelStyle}>
          <div style={headerStyle}>Conditions</div>
          <div style={{ ...rowStyle, fontWeight: 'bold', marginTop: '2px' }}><span>Pass 1</span></div>
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
          <div style={rowStyle}><span>Fouling factor</span> <input style={inputStyle} value={systemConfig.foulingFactor} onChange={e => handleInputChange('foulingFactor', e.target.value)} /></div>
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
                    const selectedMembrane = membranes.find(m => m.id === stage?.membraneModel) || membranes[0];
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
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
              {membranes.map(membrane => (
                <button
                  key={membrane.id}
                  onClick={() => handleMembraneSelect(membrane.id)}
                  style={{
                    padding: '10px',
                    border: '2px solid #004a80',
                    borderRadius: '4px',
                    background: 'white',
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontSize: '0.85rem',
                    transition: 'all 0.2s'
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
                <div>Temperature: {((Number(waterData?.temp || 25) * 9) / 5 + 32).toFixed(1)} °F</div>
                <div>Date: {new Date().toLocaleDateString()}</div>
                <div>Membrane age, P1: {Number(systemConfig.membraneAge || 0).toFixed(1)} years</div>
              </div>
              <div style={{ padding: '20px' }}>
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
                  {systemConfig.chemical !== 'None' && (
                    <>
                      <text x="180" y="60" textAnchor="middle" fontSize="12" fontFamily="Arial" fill="#b83b2e">
                        {systemConfig.chemical} Dosing
                      </text>
                      <line x1="180" y1="70" x2="180" y2="110" stroke="#b83b2e" strokeWidth="2" />
                    </>
                  )}
                </svg>

                <div style={{ border: '1px solid #c9d3de', borderRadius: '4px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'center' }}>
                    <thead style={{ background: '#f0f3f7' }}>
                      <tr>
                        <th style={{ border: '1px solid #c9d3de', padding: '6px', width: '140px' }}></th>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <th key={n} style={{ border: '1px solid #c9d3de', padding: '6px' }}>{n}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px', fontWeight: 'bold' }}>Flow ({flowUnitLabel})</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>{projection?.feedFlow ?? '0.00'}</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>{projection?.feedFlow ?? '0.00'}</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>{projection?.feedFlow ?? '0.00'}</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>{projection?.concentrateFlow ?? '0.00'}</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>{projection?.permeateFlow ?? '0.00'}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px', fontWeight: 'bold' }}>Pressure (psi)</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>0</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>0</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>{feedPressurePsi}</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>{concPressurePsi}</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>0</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px', fontWeight: 'bold' }}>TDS (mg/L)</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>{formatNumber(feedTds, 1)}</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>{formatNumber(feedTds, 1)}</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>{formatNumber(feedTds, 1)}</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>{formatNumber(concTds, 1)}</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>{formatNumber(permTds, 1)}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px', fontWeight: 'bold' }}>pH</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>{formatNumber(rawFeedPh, 2)}</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>{formatNumber(treatedFeedPh, 1)}</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>{formatNumber(treatedFeedPh, 1)}</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>{formatNumber(concPh, 1)}</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>{formatNumber(permPh, 2)}</td>
                      </tr>
                      <tr>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px', fontWeight: 'bold' }}>Econd (µS/cm)</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>{tdsToEcond(feedTds, 1.97)}</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>{tdsToEcond(feedTds, 1.97)}</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>{tdsToEcond(feedTds, 1.97)}</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>{tdsToEcond(concTds, 1.78)}</td>
                        <td style={{ border: '1px solid #c9d3de', padding: '6px' }}>{tdsToEcond(permTds, 2.29)}</td>
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
            <div style={headerStyle}>Calculation Result</div>
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
                  <th style={{ border: '1px solid #ccc' }}>
                    Highest beta <br/>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(projection.stageResults && projection.stageResults.length > 0 ? projection.stageResults : []).map((row) => (
                  <tr key={`stage-${row.index}`}>
                    <td style={{ border: '1px solid #ccc' }}>1 - {row.index}</td>
                    <td style={{ border: '1px solid #ccc' }}>{row.vessels}</td>
                    <td style={{ border: '1px solid #ccc', background: Number(row.feedPressure) < 0 ? '#f8d7da' : 'transparent' }}>
                      {row.feedPressure}
                    </td>
                   <td style={{ border: '1px solid #ccc', background: Number(row.concPressure) < 0 ? '#f8d7da' : 'transparent' }}>
                      {row.concPressure}
                    </td>
                    <td style={{ border: '1px solid #ccc' }}>
                      {row.feedFlow}
                    </td>
                    <td style={{ border: '1px solid #ccc' }}>{row.concFlow}</td>
                    <td style={{ border: '1px solid #ccc' }}>{row.flux}</td>
                    <td style={{ border: '1px solid #ccc', background: Number(row.highestFlux) > (isGpm ? 20 : 34) ? '#f8d7da' : 'transparent' }}>
                      {row.highestFlux}
                    </td>
                    <td style={{ border: '1px solid #ccc' }}>{row.highestBeta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: '10px', padding: '8px', background: 'white', borderTop: '1px solid #ccc', fontSize: '0.8rem', fontWeight: 'bold', color: '#004a80', display: 'flex', gap: '20px' }}>
              <div>Feed Pressure is {projection.results?.feedPressure ?? '0.0'} {pUnit}</div>
              <div>Permeate Pressure is {systemConfig.permeatePressure || '0.0'} {pUnit}</div>
              <div>Osmotic {projection.results?.osmoticPressure ?? '0.0'} {pUnit}</div>
              <div>Average flux / Flux {projection.results?.avgFlux ?? '0.0'} {fluxUnit}</div>
            </div>
          </div>

          <div style={{ marginTop: '12px', background: 'white', padding: '8px', border: '1px solid #c2d1df' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '0.75rem' }}>Permeate Concentration (mg/L)</div>
            <div style={{ fontSize: '0.65rem', color: '#666', marginBottom: '8px' }}>Formula: Cp = Cf × (1 - Rejection)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', fontSize: '0.7rem' }}>
              <div>Ca: {projection.permeateConcentration?.ca ?? '0.000'}</div>
              <div>Mg: {projection.permeateConcentration?.mg ?? '0.000'}</div>
              <div>Na: {projection.permeateConcentration?.na ?? '0.000'}</div>
              <div>K: {projection.permeateConcentration?.k ?? '0.000'}</div>
              <div>Sr: {projection.permeateConcentration?.sr ?? '0.000'}</div>
              <div>Ba: {projection.permeateConcentration?.ba ?? '0.000'}</div>
              <div>HCO3: {projection.permeateConcentration?.hco3 ?? '0.000'}</div>
              <div>SO4: {projection.permeateConcentration?.so4 ?? '0.000'}</div>
              <div>Cl: {projection.permeateConcentration?.cl ?? '0.000'}</div>
              <div>NO3: {projection.permeateConcentration?.no3 ?? '0.000'}</div>
              <div>SiO2: {projection.permeateConcentration?.sio2 ?? '0.000'}</div>
              <div>PO4: {projection.permeateConcentration?.po4 ?? '0.000'}</div>
              <div>F: {projection.permeateConcentration?.f ?? '0.000'}</div>
              <div>B: {projection.permeateConcentration?.b ?? '0.000'}</div>
              <div>CO2: {projection.permeateConcentration?.co2 ?? '0.000'}</div>
              <div>CO3: {projection.permeateConcentration?.co3 ?? '0.000'}</div>
              <div>pH: {projection.permeateParameters?.ph ?? '0.0'}</div>
              <div>TDS: {projection.permeateParameters?.tds ?? '0.0'} mg/L</div>
            </div>
          </div>

          <div style={{ marginTop: '10px', background: 'white', padding: '8px', border: '1px solid #c2d1df' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '6px', fontSize: '0.75rem' }}>Concentrate Saturations and Parameters</div>
            <div style={{ fontSize: '0.65rem', color: '#666', marginBottom: '8px' }}>
              Osmotic Pressure: {projection.concentrateParameters?.osmoticPressure ?? '0.0'} {pUnit}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', fontSize: '0.7rem' }}>
              <div>CaSO4: {projection.concentrateSaturation?.caSo4 ?? '0.0'}%</div>
              <div>BaSO4: {projection.concentrateSaturation?.baSo4 ?? '0.0'}%</div>
              <div>SrSO4: {projection.concentrateSaturation?.srSo4 ?? '0.0'}%</div>
              <div>SiO2: {projection.concentrateSaturation?.sio2 ?? '0.0'}%</div>
              <div>Ca3(PO4)2: {projection.concentrateSaturation?.ca3po42 ?? '0.00'}%</div>
              <div>CaF2: {projection.concentrateSaturation?.caF2 ?? '0.0'}%</div>
              <div>CCPP: {projection.concentrateParameters?.ccpp ?? '0.0'} mg/L</div>
              <div>Langelier: {projection.concentrateParameters?.langelier ?? '0.00'}</div>
              <div>pH: {projection.concentrateParameters?.ph ?? '0.0'}</div>
              <div>TDS: {projection.concentrateParameters?.tds ?? '0.0'} mg/L</div>
              <div>Osmotic: {projection.concentrateParameters?.osmoticPressure ?? '0.0'} {pUnit}</div>
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