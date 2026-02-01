import React, { useMemo } from 'react';

const WaterAnalysis = ({ waterData, setWaterData }) => {
  
  // --- TECHNICAL CONSTANTS (Equivalent Weights) ---
  const EQ_WEIGHTS = {
    ca: 20.04, mg: 12.15, na: 23.00, k: 39.10,
    hco3: 61.02, so4: 48.03, cl: 35.45, no3: 62.00
  };

  // --- LOGIC: IONIC BALANCE CALCULATION ---
  const balanceResults = useMemo(() => {
    const cations = 
      (Number(waterData.ca) / EQ_WEIGHTS.ca) + 
      (Number(waterData.mg) / EQ_WEIGHTS.mg) + 
      (Number(waterData.na) / EQ_WEIGHTS.na) + 
      (Number(waterData.k) / EQ_WEIGHTS.k);

    const anions = 
      (Number(waterData.hco3) / EQ_WEIGHTS.hco3) + 
      (Number(waterData.so4) / EQ_WEIGHTS.so4) + 
      (Number(waterData.cl) / EQ_WEIGHTS.cl) + 
      (Number(waterData.no3) / EQ_WEIGHTS.no3);

    const totalSum = cations + anions;
    const diff = cations - anions;
    const errorPct = totalSum > 0 ? (diff / totalSum) * 100 : 0;

    return { cations, anions, errorPct };
  }, [waterData]);

  // --- LOGIC: AUTO-BALANCE FEATURE ---
  const handleAutoBalance = () => {
    const diffMeq = balanceResults.cations - balanceResults.anions;
    
    if (diffMeq > 0) {
      // Too many cations (+), add Chloride (-) to balance
      const neededClMgL = Number(waterData.cl) + (diffMeq * EQ_WEIGHTS.cl);
      setWaterData({ ...waterData, cl: parseFloat(neededClMgL.toFixed(2)) });
    } else {
      // Too many anions (-), add Sodium (+) to balance
      const neededNaMgL = Number(waterData.na) + (Math.abs(diffMeq) * EQ_WEIGHTS.na);
      setWaterData({ ...waterData, na: parseFloat(neededNaMgL.toFixed(2)) });
    }
  };

  const handleInputChange = (key, val) => {
    setWaterData({ ...waterData, [key]: val });
  };

  // --- STYLING ---
  const cardStyle = { background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #c2d1df', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' };
  const inputGroupStyle = { display: 'flex', flexDirection: 'column', gap: '5px' };
  const labelStyle = { fontSize: '0.75rem', fontWeight: 'bold', color: '#555' };
  const errorColor = Math.abs(balanceResults.errorPct) > 5 ? '#e74c3c' : '#27ae60';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
      
      {/* LEFT COLUMN: ION INPUTS */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ margin: 0, color: '#002f5d' }}>Feed Water Composition</h3>
          <button 
            onClick={handleAutoBalance}
            style={{ background: '#3498db', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            ⚖️ Auto-Balance (Na/Cl)
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
          {/* CATIONS */}
          <div style={inputGroupStyle}><label style={labelStyle}>Calcium (Ca)</label><input type="number" value={waterData.ca} onChange={(e) => handleInputChange('ca', e.target.value)} /></div>
          <div style={inputGroupStyle}><label style={labelStyle}>Magnesium (Mg)</label><input type="number" value={waterData.mg} onChange={(e) => handleInputChange('mg', e.target.value)} /></div>
          <div style={inputGroupStyle}><label style={labelStyle}>Sodium (Na)</label><input type="number" value={waterData.na} onChange={(e) => handleInputChange('na', e.target.value)} /></div>
          <div style={inputGroupStyle}><label style={labelStyle}>Potassium (K)</label><input type="number" value={waterData.k} onChange={(e) => handleInputChange('k', e.target.value)} /></div>
          
          {/* ANIONS */}
          <div style={inputGroupStyle}><label style={labelStyle}>Bicarbonate (HCO3)</label><input type="number" value={waterData.hco3} onChange={(e) => handleInputChange('hco3', e.target.value)} /></div>
          <div style={inputGroupStyle}><label style={labelStyle}>Sulfate (SO4)</label><input type="number" value={waterData.so4} onChange={(e) => handleInputChange('so4', e.target.value)} /></div>
          <div style={inputGroupStyle}><label style={labelStyle}>Chloride (Cl)</label><input type="number" value={waterData.cl} onChange={(e) => handleInputChange('cl', e.target.value)} /></div>
          <div style={inputGroupStyle}><label style={labelStyle}>Nitrate (NO3)</label><input type="number" value={waterData.no3} onChange={(e) => handleInputChange('no3', e.target.value)} /></div>
          
          {/* NEUTRALS */}
          <div style={inputGroupStyle}><label style={labelStyle}>Silica (SiO2)</label><input type="number" value={waterData.sio2} onChange={(e) => handleInputChange('sio2', e.target.value)} /></div>
          <div style={inputGroupStyle}><label style={labelStyle}>Temperature (°C)</label><input type="number" value={waterData.temp} onChange={(e) => handleInputChange('temp', e.target.value)} /></div>
          <div style={inputGroupStyle}><label style={labelStyle}>pH</label><input type="number" step="0.1" value={waterData.ph} onChange={(e) => handleInputChange('ph', e.target.value)} /></div>
        </div>
      </div>

      {/* RIGHT COLUMN: VALIDATION PANEL */}
      <div style={{ ...cardStyle, background: '#f8fbff' }}>
        <h4 style={{ marginTop: 0, color: '#002f5d' }}>Ionic Balance</h4>
        
        <div style={{ marginBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span>Total Cations:</span>
            <span>{balanceResults.cations.toFixed(2)} meq/L</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
            <span>Total Anions:</span>
            <span>{balanceResults.anions.toFixed(2)} meq/L</span>
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '15px', borderRadius: '6px', background: 'white', border: `2px solid ${errorColor}` }}>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Balance Error</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: errorColor }}>
            {balanceResults.errorPct.toFixed(2)}%
          </div>
          <div style={{ fontSize: '0.7rem', marginTop: '5px' }}>
            {Math.abs(balanceResults.errorPct) <= 5 ? '✅ Analysis Valid' : '⚠️ Unbalanced Analysis'}
          </div>
        </div>

        <div style={{ marginTop: '20px', fontSize: '0.75rem', color: '#7f8c8d', lineHeight: '1.4' }}>
          <strong>Pro Tip:</strong> Professional designs require an error below 5%. Use the Auto-Balance tool to adjust Sodium or Chloride to reach 0%.
        </div>
      </div>
    </div>
  );
};

export default WaterAnalysis;