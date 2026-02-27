import React from 'react';

const Report = ({ 
  waterData = {}, 
  systemConfig = {}, 
  projection = {}, 
  postTreatment = {}, 
  pretreatment = {}, 
  projectNotes = "", 
  setProjectNotes, 
  snapshots = [] 
}) => {
  const reportDate = new Date().toLocaleDateString();
  const safeSnapshots = Array.isArray(snapshots) ? snapshots : [];

  // --- SAFETY FALLBACKS ---
  // We use the OR operator || to ensure we don't multiply by 'undefined'
  // Use total plant feed (m3/h) from the main projection engine
  const feedFlow = Number(projection?.totalFeedFlowM3h || 0);
  const asDose = Number(pretreatment?.antiscalantDose || 0);
  const causticDose = Number(postTreatment?.causticDose || 0);

  // Monthly Calculations
  const monthlyAS = ((feedFlow * asDose * 24 * 30) / 1000).toFixed(2);
  const monthlyCaustic = ((feedFlow * causticDose * 24 * 30) / 1000).toFixed(2);

  const sectionStyle = { marginBottom: '25px', border: '1px solid #004a80', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#fff' };
  const headerStyle = { backgroundColor: '#004a80', color: '#fff', padding: '12px 15px', fontWeight: 'bold' };

  const flowUnitLabel = systemConfig.flowUnit || 'gpm';
  const isGpm = ['gpm', 'gpd', 'mgd', 'migd'].includes(flowUnitLabel.toLowerCase().trim().replace('/', ''));
  const pUnit = isGpm ? 'psi' : 'bar';
  const fluxUnit = isGpm ? 'gfd' : 'lmh';

  return (
    <div id="printable-report" style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px', fontFamily: 'Arial' }}>
      <style>{`@page { size: landscape; margin: 15mm; } @media print { .no-print { display: none !important; } }`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '4px solid #004a80', paddingBottom: '10px', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>TECHNICAL SUBMITTAL</h1>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: '2px 0' }}><strong>Project:</strong> {waterData?.projectName || 'New Project'}</p>
          <p style={{ margin: '2px 0' }}><strong>Date:</strong> {reportDate}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '25px' }}>
        <div>
          {/* OPEX SUMMARY */}
          <div style={sectionStyle}>
            <div style={headerStyle}>Monthly Operational Cost Estimator</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px' }}>⚡ Electricity ({systemConfig?.energyCostPerKwh || 0}/kWh)</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>${projection?.monthlyEnergyCost || 0}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '12px' }}>🧪 Antiscalant ({monthlyAS} kg)</td>
                  <td style={{ textAlign: 'right' }}>Calculated by Dose</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px' }}>🧪 Caustic Soda ({monthlyCaustic} kg)</td>
                  <td style={{ textAlign: 'right' }}>Calculated by Dose</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* SNAPSHOT COMPARISON */}
          {safeSnapshots.length > 0 && (
            <div style={sectionStyle}>
              <div style={headerStyle}>Design Alternatives Comparison</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#f4f4f4' }}>
                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Metric</th>
                    {safeSnapshots.map((s, i) => <th key={i} style={{ borderBottom: '1px solid #ddd' }}>{s.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '8px', borderBottom: '1px solid #eee' }}>Flux (${fluxUnit.toUpperCase()})</td>
                    {safeSnapshots.map((s, i) => (
                      <td key={i} style={{ textAlign: 'center', borderBottom: '1px solid #eee' }}>
                        {Number(s.results?.avgFlux || 0).toFixed(2)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <div style={sectionStyle}>
            <div style={headerStyle}>System Performance</div>
            <div style={{ padding: '15px' }}>
              <p>Feed Pressure: <strong>{projection?.pumpPressure || 0} {pUnit}</strong></p>
              <p>Final pH: <strong>{projection?.finalPh || 'N/A'}</strong></p>
              <p>LSI Post-Treatment: <strong>{projection?.postTreatmentLsi || 'N/A'}</strong></p>
            </div>
          </div>    
          <textarea 
            className="no-print" 
            value={projectNotes} 
            onChange={(e) => setProjectNotes(e.target.value)}
            style={{ width: '100%', height: '100px', marginBottom: '10px', padding: '10px', boxSizing: 'border-box' }}
            placeholder="Add notes..."
          />
          
          <button 
            onClick={() => window.print()} 
            className="no-print" 
            style={{ width: '100%', padding: '15px', background: '#004a80', color: '#fff', cursor: 'pointer', fontWeight: 'bold', border: 'none', borderRadius: '4px' }}
          >
            PRINT REPORT
          </button>
        </div>
      </div>
    </div>
  );
};

export default Report;