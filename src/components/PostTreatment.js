import React, { useMemo } from 'react';

const PostTreatment = ({ projection, postTreatment, setPretreatment, setPostTreatment, systemConfig }) => {

  const postAnalysis = useMemo(() => {
    // Use total plant product flow (m3/h) from the main projection engine
    const permeateFlow = Number(projection?.totalPlantProductFlowM3h || 0);
    const causticDose = Number(postTreatment.causticDose || 0);
    
    // 1. Post-RO pH Estimation
    // RO Permeate pH is usually 1.0 - 1.5 units lower than feed due to CO2
    const basePermeatePh = 6.2; 
    
    // 2. pH Shift calculation (Simplified curve for NaOH dosing)
    // Every 1 mg/L of NaOH typically raises pH by ~0.3-0.5 units in low-alkalinity water
    const finalPh = basePermeatePh + (causticDose * 0.45);

    // 3. Post-Treatment LSI
    // Product water should target LSI between -0.5 and 0.0 to be "balanced"
    const isCorrosive = finalPh < 7.5;

    // 4. Monthly Cost
    const monthlyUsageKg = (permeateFlow * causticDose * 24 * 30) / 1000;

    return {
      finalPh: finalPh.toFixed(2),
      isCorrosive,
      monthlyUsageKg: monthlyUsageKg.toFixed(2),
      permeateFlow: permeateFlow.toFixed(2)
    };
  }, [postTreatment, projection]);

  const handleInputChange = (key, val) => {
    setPostTreatment({ ...postTreatment, [key]: val });
  };

  const cardStyle = { background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #c2d1df', marginBottom: '20px' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      
      {/* DOSING INPUTS */}
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, color: '#002f5d' }}>Post-Treatment Dosing</h3>
        <p style={{ fontSize: '0.85rem', color: '#666' }}>Adjust dosing to stabilize product water pH and prevent pipe corrosion.</p>
        
        <div style={{ marginTop: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold' }}>Caustic Soda (NaOH 100%) Dose (mg/L)</label>
          <input 
            style={{ width: '100%', padding: '10px', marginTop: '5px', fontSize: '1.1rem' }} 
            type="number" 
            step="0.1"
            value={postTreatment.causticDose} 
            onChange={(e) => handleInputChange('causticDose', e.target.value)} 
          />
        </div>

        <div style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span>Monthly NaOH Usage:</span>
            <strong>{postAnalysis.monthlyUsageKg} kg/month</strong>
          </div>
        </div>
      </div>

      {/* PRODUCT WATER QUALITY MONITOR */}
      <div style={{ ...cardStyle, background: postAnalysis.isCorrosive ? '#fff5f5' : '#f0fff4', border: `2px solid ${postAnalysis.isCorrosive ? '#fc8181' : '#68d391'}` }}>
        <h4 style={{ marginTop: 0, color: postAnalysis.isCorrosive ? '#c53030' : '#2f855a' }}>Product Water Stability</h4>
        
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Projected Product pH</div>
          <div style={{ fontSize: '3rem', fontWeight: 'bold', color: postAnalysis.isCorrosive ? '#e53e3e' : '#38a169' }}>
            {postAnalysis.finalPh}
          </div>
        </div>

        <div style={{ padding: '10px', borderRadius: '4px', textAlign: 'center', background: 'white', fontWeight: 'bold' }}>
          {postAnalysis.isCorrosive ? '⚠️ CORROSIVE WATER' : '✅ STABILIZED WATER'}
        </div>

        <p style={{ fontSize: '0.75rem', marginTop: '15px', lineHeight: '1.4', color: '#4a5568' }}>
          <strong>Note:</strong> RO permeate usually contains high levels of dissolved $CO_2$. If pH remains low despite high NaOH dosing, consider adding a <strong>Degasifier</strong> before chemical injection.
        </p>
      </div>

    </div>
  );
};

export default PostTreatment;