import React, { useState, useMemo, useEffect } from 'react';
import { 
  calculateA, 
  estimateMembraneB, 
  getAllMembranes, 
  getAValue, 
  getMembraneB,
  getArea
} from '../engines/membraneEngine';
import { 
  calculateOsmoticPressure, 
  convertPressure, 
  convertFlux,
  calculateTCF,
  FLOW_CONVERSION
} from '../engines/calculationEngine';

const ROCalculator = () => {
  const allMembranes = useMemo(() => getAllMembranes(), []);
  
  const [inputs, setInputs] = useState({
    feedFlow: 200, // gpm
    recovery: 50, // %
    feedPressure: 200, // psi
    feedTDS: 1000, // mg/L
    rejection: 99.5, // %
    temperature: 25, // °C
    membraneArea: 400, // ft²
    numElements: 6,
    isSeawater: false,
    selectedMembraneId: 'custom',
    mode: 'normalization' // 'normalization' or 'prediction'
  });

  // Update inputs when membrane is selected
  const handleMembraneChange = (id) => {
    if (id === 'custom') {
      setInputs(prev => ({ ...prev, selectedMembraneId: id }));
      return;
    }
    
    const membrane = allMembranes.find(m => m.id === id);
    if (membrane) {
      setInputs(prev => ({
        ...prev,
        selectedMembraneId: id,
        membraneArea: getArea(membrane) / 0.092903, // m2 to ft2
        isSeawater: membrane.type === 'Seawater',
        rejection: (membrane.testConditions?.rejection * 100) || prev.rejection
      }));
    }
  };

  const results = useMemo(() => {
    const { 
      feedFlow, 
      recovery, 
      feedPressure, 
      feedTDS, 
      rejection,
      temperature, 
      membraneArea, 
      numElements,
      isSeawater,
      selectedMembraneId,
      mode
    } = inputs;
    
    // 1. Basic mass balance
    const recoveryFraction = recovery / 100;
    const permeateFlow = feedFlow * recoveryFraction;
    const concentrateFlow = feedFlow - permeateFlow;
    
    // 2. Pressure conversions (for engine)
    const feedPressureBar = convertPressure(feedPressure, 'psi');
    
    // 3. Osmotic pressure using engine (in psi)
    const osmoticCoeff = isSeawater ? 0.00085 : 0.0007925;
    const osmoticPressurePsi = calculateOsmoticPressure(feedTDS, 'psi', isSeawater, osmoticCoeff);
    const osmoticPressureBar = calculateOsmoticPressure(feedTDS, 'bar', isSeawater, osmoticCoeff);
    
    // 4. Flux calculation
    // Total area in m2
    const totalAreaM2 = numElements * (membraneArea * 0.092903);
    // Flow in m3/h
    const permeateFlowM3h = permeateFlow * FLOW_CONVERSION.gpm;
    // Flux in LMH
    const fluxLMH = totalAreaM2 > 0 ? (permeateFlowM3h * 1000) / totalAreaM2 : 0;
    // Flux in GFD
    const fluxGFD = convertFlux(fluxLMH, 'lmh');
    
    // 5. Normalization or Prediction
    let aValue, bValue;
    const membrane = allMembranes.find(m => m.id === selectedMembraneId);
    
    // Temperature Correction Factors
    const tcfA = calculateTCF(temperature, 'A');
    const tcfB = calculateTCF(temperature, 'B');

    if (mode === 'normalization' || !membrane) {
      // Calculate actual A and B from observed data
      const aActual = calculateA(fluxLMH, feedPressureBar, osmoticPressureBar, osmoticCoeff);
      const bActual = estimateMembraneB(fluxLMH, feedTDS, rejection / 100, recoveryFraction, isSeawater);
      
      // Normalize to 25C for standardized reporting
      aValue = aActual / tcfA;
      bValue = bActual / tcfB;
    } else {
      // Use factory reference values (at 25C)
      aValue = getAValue(membrane);
      bValue = getMembraneB(membrane);
    }
    
    // 6. Predicted Permeate TDS using B-Value model
    // Concentration factor
    const cf = 1 / Math.max(0.01, 1 - recoveryFraction);
    // Log mean concentration factor
    const cf_avg = recoveryFraction > 0.01 ? (cf - 1) / Math.log(cf) : (1 + cf) / 2;
    // Mass transfer coefficient (approximate for typical vessels)
    const k_mt = (membrane?.transport?.kMtRef) || (isSeawater ? 720 : 450);
    // Concentration polarization factor
    const beta = Math.exp(fluxLMH / k_mt);
    
    // Physical B corrected for temperature and salinity
    const bFactorTds = isSeawater ? 1.0 : 1.0 + 0.10 * (feedTDS / 1000);
    const B_operating = bValue * tcfB * bFactorTds;
    
    // Avg concentration at membrane surface
    const c_avg = feedTDS * cf_avg * beta;
    
    // Salt transport equation: Js = B * (Cm - Cp)
    // Permeate TDS (Cp) = (B * Cm) / (Flux + B)
    const predictedPermeateTDS = (B_operating * c_avg) / (fluxLMH + B_operating);
    
    // 7. Feed Pressure Verification (Prediction Mode)
    // In prediction mode, the "required" pressure might differ from input
    const aOperating = aValue * tcfA;
    const requiredNDP = aOperating > 0 ? fluxLMH / aOperating : 0;
    const predictedFeedPressureBar = requiredNDP + osmoticPressureBar + 0.5; // +0.5 bar for dP
    const predictedFeedPressurePsi = predictedFeedPressureBar * 14.5038;
    
    // 7. Concentrate pressure (assume 15 psi drop as before)
    const pressureDrop = 15;
    const concentratePressure = feedPressure - pressureDrop;
    const permeatePressure = 0;
    
    // 8. Highest flux estimate
    const highestFlux = fluxGFD * 1.18;
    
    return {
      permeateFlow: permeateFlow.toFixed(2),
      concentrateFlow: concentrateFlow.toFixed(2),
      fluxGFD: fluxGFD.toFixed(2),
      fluxLMH: fluxLMH.toFixed(2),
      highestFlux: highestFlux.toFixed(2),
      feedPressure: feedPressure.toFixed(1),
      concentratePressure: concentratePressure.toFixed(1),
      permeatePressure: permeatePressure.toFixed(1),
      osmoticPressure: osmoticPressurePsi.toFixed(1),
      recovery: recovery.toFixed(1),
      feedTDS: feedTDS.toFixed(0),
      rejection: rejection.toFixed(2),
      temperature: temperature.toFixed(1),
      aValue: aValue.toFixed(3),
      bValue: bValue.toFixed(3),
      permeateTDS: predictedPermeateTDS.toFixed(2),
      totalAreaM2: totalAreaM2.toFixed(1)
    };
  }, [inputs, allMembranes]);

  const handleInputChange = (field, value) => {
    setInputs(prev => ({
      ...prev,
      [field]: field === 'isSeawater' || field === 'selectedMembraneId' || field === 'mode' ? value : (parseFloat(value) || 0)
    }));
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ color: '#002f5d', marginBottom: '20px' }}>Reverse Osmosis Performance Calculator</h2>
      
      {/* Mode Selector */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button 
          onClick={() => handleInputChange('mode', 'normalization')}
          style={{
            padding: '10px 20px',
            background: inputs.mode === 'normalization' ? '#002f5d' : '#e9ecef',
            color: inputs.mode === 'normalization' ? '#fff' : '#000',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Normalization Mode
        </button>
        <button 
          onClick={() => handleInputChange('mode', 'prediction')}
          style={{
            padding: '10px 20px',
            background: inputs.mode === 'prediction' ? '#002f5d' : '#e9ecef',
            color: inputs.mode === 'prediction' ? '#fff' : '#000',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Prediction Mode
        </button>
      </div>

      {/* Input Section */}
      <div style={{ 
        background: '#f8f9fa', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        border: '1px solid #dee2e6'
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#495057' }}>Input Parameters</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Membrane Preset
            </label>
            <select
              value={inputs.selectedMembraneId}
              onChange={(e) => handleMembraneChange(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              <option value="custom">-- Custom / User Input --</option>
              {allMembranes.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Feed Flow (gpm)
            </label>
            <input
              type="number"
              value={inputs.feedFlow}
              onChange={(e) => handleInputChange('feedFlow', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Recovery (%)
            </label>
            <input
              type="number"
              value={inputs.recovery}
              onChange={(e) => handleInputChange('recovery', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Feed Pressure (psi)
            </label>
            <input
              type="number"
              value={inputs.feedPressure}
              onChange={(e) => handleInputChange('feedPressure', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Feed TDS (mg/L)
            </label>
            <input
              type="number"
              value={inputs.feedTDS}
              onChange={(e) => handleInputChange('feedTDS', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
          {inputs.mode === 'normalization' && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Observed Rejection (%)
              </label>
              <input
                type="number"
                value={inputs.rejection}
                onChange={(e) => handleInputChange('rejection', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>
          )}
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Temperature (°C)
            </label>
            <input
              type="number"
              value={inputs.temperature}
              onChange={(e) => handleInputChange('temperature', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Membrane Area (ft²)
            </label>
            <input
              type="number"
              value={inputs.membraneArea}
              onChange={(e) => handleInputChange('membraneArea', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Number of Elements
            </label>
            <input
              type="number"
              value={inputs.numElements}
              onChange={(e) => handleInputChange('numElements', e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Water Type
            </label>
            <select
              value={inputs.isSeawater}
              onChange={(e) => handleInputChange('isSeawater', e.target.value === 'true')}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: 'white'
              }}
            >
              <option value="false">Brackish</option>
              <option value="true">Seawater</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div style={{ 
          background: '#fff', 
          padding: '20px', 
          borderRadius: '8px',
          border: '1px solid #dee2e6',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#002f5d' }}>RO Performance Results</h3>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px',
              border: '1px solid #dee2e6'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#e9ecef' }}>
                  <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6' }}>Parameter</th>
                  <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #dee2e6' }}>Value</th>
                  <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6' }}>Unit</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>Feed Pressure</td>
                  <td style={{ padding: '12px', textAlign: 'right', border: '1px solid #dee2e6' }}>{results.feedPressure}</td>
                  <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>psi</td>
                </tr>
                {inputs.mode === 'prediction' && (
                  <tr style={{ backgroundColor: '#fff5f5' }}>
                    <td style={{ padding: '12px', border: '1px solid #dee2e6', color: '#c53030' }}>Required Pressure (Est.)</td>
                    <td style={{ padding: '12px', textAlign: 'right', border: '1px solid #dee2e6', color: '#c53030', fontWeight: 'bold' }}>{results.predictedFeedPressure}</td>
                    <td style={{ padding: '12px', border: '1px solid #dee2e6', color: '#c53030' }}>psi</td>
                  </tr>
                )}
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>Osmotic Pressure</td>
                  <td style={{ padding: '12px', textAlign: 'right', border: '1px solid #dee2e6' }}>{results.osmoticPressure}</td>
                  <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>psi</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>Flux</td>
                  <td style={{ padding: '12px', textAlign: 'right', border: '1px solid #dee2e6' }}>{results.fluxGFD}</td>
                  <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>gfd</td>
                </tr>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>Flux (Metric)</td>
                  <td style={{ padding: '12px', textAlign: 'right', border: '1px solid #dee2e6' }}>{results.fluxLMH}</td>
                  <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>lmh</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>Permeate Flow</td>
                  <td style={{ padding: '12px', textAlign: 'right', border: '1px solid #dee2e6' }}>{results.permeateFlow}</td>
                  <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>gpm</td>
                </tr>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>Concentrate Flow</td>
                  <td style={{ padding: '12px', textAlign: 'right', border: '1px solid #dee2e6' }}>{results.concentrateFlow}</td>
                  <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>gpm</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', border: '1px solid #dee2e6', color: '#0056b3', fontWeight: 'bold' }}>Permeate TDS</td>
                  <td style={{ padding: '12px', textAlign: 'right', border: '1px solid #dee2e6', color: '#0056b3', fontWeight: 'bold' }}>{results.permeateTDS}</td>
                  <td style={{ padding: '12px', border: '1px solid #dee2e6', color: '#0056b3', fontWeight: 'bold' }}>mg/L</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ 
          background: '#e7f3ff', 
          padding: '20px', 
          borderRadius: '8px',
          border: '1px solid #b3d7ff',
        }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#0056b3' }}>Transport Parameters</h3>
          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '12px', color: '#666' }}>A-Value (Water Permeability)</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#002f5d' }}>{results.aValue}</div>
            <div style={{ fontSize: '11px', color: '#666' }}>LMH/bar</div>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '12px', color: '#666' }}>B-Value (Salt Permeability)</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#002f5d' }}>{results.bValue}</div>
            <div style={{ fontSize: '11px', color: '#666' }}>LMH</div>
          </div>
          <div style={{ fontSize: '13px', color: '#444', lineHeight: '1.4' }}>
            These parameters represent the normalized performance of the membrane system based on your current operating conditions.
          </div>
        </div>
      </div>

      {/* Calculation Notes */}
      <div style={{ 
        marginTop: '20px', 
        padding: '15px', 
        backgroundColor: '#fff3cd', 
        borderRadius: '6px',
        border: '1px solid #ffeaa7'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>Dynamic Engine Notes</h4>
        <ul style={{ margin: '0', paddingLeft: '20px', color: '#856404', fontSize: '13px' }}>
          <li>Calculations powered by centralized <strong>membraneEngine.js</strong> and <strong>calculationEngine.js</strong>.</li>
          <li><strong>Osmotic Pressure:</strong> Calculated using industrial-grade van't Hoff model ({inputs.isSeawater ? 'Seawater' : 'Brackish'} coefficient).</li>
          <li><strong>A-Value:</strong> Normalized water transport coefficient (J / NDP).</li>
          <li><strong>B-Value:</strong> Salt transport coefficient adjusted for concentration polarization and recovery.</li>
        </ul>
      </div>
    </div>
  );
};

export default ROCalculator;