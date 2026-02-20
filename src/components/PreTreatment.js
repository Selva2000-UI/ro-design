import React, { useMemo } from 'react';

const PreTreatment = ({ waterData, pretreatment, setPretreatment, systemConfig }) => {
  
  const scalingAnalysis = useMemo(() => {
    const recovery = Number(systemConfig.recovery || 0) / 100;
    if (recovery >= 1) return { lsi: 0, silicaSat: 0, cf: 1 };

    // 1. Concentration Factor (CF)
    // Formula: 1 / (1 - Recovery)
    const CF = 1 / (1 - recovery);

    // 2. LSI (Langelier Saturation Index) Estimation
    // This is a simplified version of the IMSDesign Stiff & Davis Index
    const temp = Number(waterData.temp || 25);
    const ph = Number(waterData.ph || 7.5);
    const ca = Number(waterData.ca || 0) * CF; // Concentrated Calcium
    const alkalinity = Number(waterData.hco3 || 0) * CF; // Concentrated Bicarbonate
    const ions = ['ca', 'mg', 'na', 'k', 'sr', 'ba', 'hco3', 'so4', 'cl', 'no3', 'sio2', 'f', 'b', 'po4', 'nh4'];
    const totalTds = ions.reduce((sum, ion) => sum + Number(waterData[ion] || 0), 0);
    const tds = totalTds * CF;

    // pCa = -log10(Ca as CaCO3), pAlk = -log10(Alk), C = Temp/TDS constant
    const pCa = 5.0 - Math.log10(ca * 2.5); 
    const pAlk = 5.0 - Math.log10(alkalinity * 0.82);
    const C = (Math.log10(tds) - 1) / 10 + (temp > 25 ? 2.0 : 2.3);
    
    const phs = C + pCa + pAlk;
    const LSI = ph - phs;

    // 3. Silica Scaling
    // Silica solubility is approx 120 mg/L at 25°C
    const silicaInConc = Number(waterData.sio2 || 0) * CF;
    const silicaSat = (silicaInConc / 120) * 100;

    return {
      lsi: LSI.toFixed(2),
      silicaSat: silicaSat.toFixed(1),
      cf: CF.toFixed(2),
      isLsiDanger: LSI > 0.2,
      isSilicaDanger: silicaSat > 100
    };
  }, [waterData, systemConfig]);

  const handleInputChange = (key, val) => {
    setPretreatment({ ...pretreatment, [key]: val });
  };

  const cardStyle = { background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #c2d1df', marginBottom: '20px' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
      
      {/* CHEMICAL INPUTS */}
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, color: '#002f5d' }}>Pre-Treatment Dosing</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Antiscalant (mg/L)</label>
            <input 
              style={{ width: '100%', padding: '8px' }} 
              type="number" 
              value={pretreatment.antiscalantDose} 
              onChange={(e) => handleInputChange('antiscalantDose', e.target.value)} 
            />
            <p style={{ fontSize: '0.7rem', color: '#666' }}>Typical: 2.0 - 5.0 mg/L</p>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Sodium Bisulfite (mg/L)</label>
            <input 
              style={{ width: '100%', padding: '8px' }} 
              type="number" 
              value={pretreatment.sbsDose} 
              onChange={(e) => handleInputChange('sbsDose', e.target.value)} 
            />
          </div>
        </div>
      </div>

      {/* SCALING MONITOR */}
      <div style={{ ...cardStyle, background: '#fff9e6', border: '2px solid #f39c12' }}>
        <h4 style={{ marginTop: 0, color: '#856404' }}>Concentrate Scaling Risk</h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Concentration Factor:</span>
            <span style={{ fontWeight: 'bold' }}>{scalingAnalysis.cf}x</span>
          </div>

          <div style={{ padding: '10px', background: scalingAnalysis.isLsiDanger ? '#f8d7da' : '#d4edda', borderRadius: '4px', border: `1px solid ${scalingAnalysis.isLsiDanger ? '#f5c6cb' : '#c3e6cb'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>LSI (CaCO3):</span>
              <span>{scalingAnalysis.lsi}</span>
            </div>
            <div style={{ fontSize: '0.75rem' }}>
              {scalingAnalysis.isLsiDanger ? '⚠️ Scaling Likely. Increase Antiscalant or Acid.' : '✅ Safe (with Antiscalant)'}
            </div>
          </div>

          <div style={{ padding: '10px', background: scalingAnalysis.isSilicaDanger ? '#f8d7da' : '#d4edda', borderRadius: '4px', border: `1px solid ${scalingAnalysis.isSilicaDanger ? '#f5c6cb' : '#c3e6cb'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>Silica Saturation:</span>
              <span>{scalingAnalysis.silicaSat}%</span>
            </div>
            <div style={{ fontSize: '0.75rem' }}>
              {scalingAnalysis.isSilicaDanger ? '⚠️ High Risk! Limit Recovery or increase Temp.' : '✅ Under Solubility Limit'}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default PreTreatment;