import React, { useState, useMemo } from 'react';

const ROCalculator = () => {
  const [inputs, setInputs] = useState({
    permeateFlow: 100, // gpm
    recovery: 50, // %
    feedPressure: 200, // psi
    feedTDS: 1000, // mg/L
    temperature: 25, // °C
    membraneArea: 400, // ft²
    numElements: 6
  });

  const calculateROPerformance = useMemo(() => {
    const { permeateFlow, recovery, feedPressure, feedTDS, temperature, membraneArea, numElements } = inputs;
    
    // Basic mass balance
    const feedFlow = permeateFlow / (recovery / 100);
    const concentrateFlow = feedFlow - permeateFlow;
    
    // Osmotic pressure calculation (simplified)
    const osmoticPressure = feedTDS * 0.0115; // psi
    
    // Flux calculation
    const totalMembraneArea = membraneArea * numElements;
    const fluxGFD = permeateFlow / (totalMembraneArea * 0.0556);
    
    // Concentrate pressure (assume pressure drop)
    const pressureDrop = 15; // psi (typical for RO systems)
    const concentratePressure = feedPressure - pressureDrop;
    
    // Permeate pressure (assume atmospheric)
    const permeatePressure = 0;
    
    // Highest flux (assume 10% higher than average)
    const highestFlux = fluxGFD * 1.1;
    
    return {
      feedFlow: feedFlow.toFixed(2),
      concentrateFlow: concentrateFlow.toFixed(2),
      fluxGFD: fluxGFD.toFixed(2),
      highestFlux: highestFlux.toFixed(2),
      feedPressure: feedPressure.toFixed(1),
      concentratePressure: concentratePressure.toFixed(1),
      permeatePressure: permeatePressure.toFixed(1),
      osmoticPressure: osmoticPressure.toFixed(1),
      recovery: recovery.toFixed(1),
      feedTDS: feedTDS.toFixed(0),
      temperature: temperature.toFixed(1)
    };
  }, [inputs]);

  const handleInputChange = (field, value) => {
    setInputs(prev => ({
      ...prev,
      [field]: parseFloat(value) || 0
    }));
  };

  const results = calculateROPerformance;

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ color: '#002f5d', marginBottom: '20px' }}>Reverse Osmosis Performance Calculator</h2>
      
      {/* Input Section */}
      <div style={{ 
        background: '#f8f9fa', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        border: '1px solid #dee2e6'
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#495057' }}>Input Parameters</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Permeate Flow (gpm)
            </label>
            <input
              type="number"
              value={inputs.permeateFlow}
              onChange={(e) => handleInputChange('permeateFlow', e.target.value)}
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
        </div>
      </div>

      {/* Results Table */}
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
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>Concentrate Pressure</td>
                <td style={{ padding: '12px', textAlign: 'right', border: '1px solid #dee2e6' }}>{results.concentratePressure}</td>
                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>psi</td>
              </tr>
              <tr>
                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>Permeate Pressure</td>
                <td style={{ padding: '12px', textAlign: 'right', border: '1px solid #dee2e6' }}>{results.permeatePressure}</td>
                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>psi</td>
              </tr>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>Osmotic Pressure</td>
                <td style={{ padding: '12px', textAlign: 'right', border: '1px solid #dee2e6' }}>{results.osmoticPressure}</td>
                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>psi</td>
              </tr>
              
              <tr>
                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>Feed Flow</td>
                <td style={{ padding: '12px', textAlign: 'right', border: '1px solid #dee2e6' }}>{results.feedFlow}</td>
                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>gpm</td>
              </tr>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>Concentrate Flow</td>
                <td style={{ padding: '12px', textAlign: 'right', border: '1px solid #dee2e6' }}>{results.concentrateFlow}</td>
                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>gpm</td>
              </tr>
              <tr>
                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>Flux</td>
                <td style={{ padding: '12px', textAlign: 'right', border: '1px solid #dee2e6' }}>{results.fluxGFD}</td>
                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>gfd</td>
              </tr>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>Highest Flux</td>
                <td style={{ padding: '12px', textAlign: 'right', border: '1px solid #dee2e6' }}>{results.highestFlux}</td>
                <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>gfd</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Additional Information */}
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '6px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#0066cc' }}>Additional Parameters</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', fontSize: '14px' }}>
            <div><strong>Recovery:</strong> {results.recovery}%</div>
            <div><strong>Feed TDS:</strong> {results.feedTDS} mg/L</div>
            <div><strong>Temperature:</strong> {results.temperature}°C</div>
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
        <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>Calculation Notes</h4>
        <ul style={{ margin: '0', paddingLeft: '20px', color: '#856404' }}>
          <li>Feed Flow = Permeate Flow ÷ (Recovery ÷ 100)</li>
          <li>Concentrate Flow = Feed Flow - Permeate Flow</li>
          <li>Osmotic Pressure = Feed TDS × 0.0115 psi</li>
          <li>Flux = Permeate Flow ÷ (Total Membrane Area × 0.0556)</li>
          <li>Concentrate Pressure = Feed Pressure - Pressure Drop (15 psi assumed)</li>
          <li>Permeate Pressure = 0 psi (atmospheric)</li>
          <li>Highest Flux = Average Flux × 1.1 (10% higher)</li>
        </ul>
      </div>
    </div>
  );
};

export default ROCalculator;