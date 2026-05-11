import React from 'react';

const GUIDELINE_DATA = {
  waterTypes: [
    "Brackish Well Non-Fouling", "Brackish Well High-Fouling", "Brackish Surface Conv.", 
    "Brackish Surface MF/UF", "Sea Well Conv.", "Sea Surface Conv.", 
    "Sea Surface MF/UF", "Muni Teritary Waste Conv.", "Muni Teritary Waste MF/UF", "RO Perm."
  ],
  parameters: [
    { name: "System Average flux (lmh)", values: [27, 22, 20, 27, 17, 14, 17, 17, 20, 36] },
    { name: "Max Element flux (lmh)", values: [46, 32, 31, 36, 42, 34, 42, 26, 27, 56] },
    { name: "Flux decline % (per year)", values: [5, 7, 7, 7, 5, 7, 5, 15, 12, 3] },
    { name: "Salt Passage Increase % (per year)", values: [7, 7, 10, 7, 7, 10, 7, 12, 10, 5] },
    { name: "Beta Standard element", values: [1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.5] },
    { name: "Beta Full fit element", values: [1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.3, 1.3, 2.2] }
  ],
  feedMax: [
    { size: "2.5\"", value: 1.4 },
    { size: "4.0\"", value: 3.6 },
    { size: "8.0\"", value: 17.0 },
    { size: "8.0\" LD only", value: 19.3 },
    { size: "16.0\"", value: 68.1 }
  ],
  rejectMin: [
    { size: "2.5\"", values: [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.2] },
    { size: "4.0\"", values: [0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.8, 0.7, 0.5] },
    { size: "8.0\"", values: [2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 3.2, 2.7, 1.4] },
    { size: "16.0\"", values: [10.9, 10.9, 10.9, 10.9, 10.9, 10.9, 11.0, 12.8, 10.9, 7.3] },
    { size: "4.0\" full fit", values: [1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 1.8, 2.1, 1.8, 1.4] },
    { size: "8.0\" full fit", values: [6.8, 6.8, 6.8, 6.8, 6.8, 6.8, 6.8, 7.9, 6.8, 4.5] }
  ],
  saturationLimits: [
    { param: "LSI (< 10000 ppm TDS)", limit: 2.5 },
    { param: "CaSO4 (%)", limit: 400 },
    { param: "SrSO4 (%)", limit: 1200 },
    { param: "BaSO4 (%)", limit: 10000 },
    { param: "Ca3(PO4)2 SI", limit: 2.4 },
    { param: "SiO2 (%)", limit: 140 },
    { param: "CaF2 (%)", limit: 50000 }
  ],
  pressureDrop: {
    vessel6m: { typical: 1.72, max: 3.45 },
    element: { typical: 1.03, max: 1.03 }
  }
};

const DesignGuidelines = ({ isOpen, onClose, currentWaterType, parameter }) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    const content = document.getElementById('guidelines-text-content').innerHTML;

    printWindow.document.write(`
      <html>
        <head>
          <title>Design Guidelines - Text Reference</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #333; }
            h1, h2, h3 { color: #004a80; border-bottom: 2px solid #004a80; padding-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 11px; }
            th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
            th { background-color: #f2f2f2; }
            .highlight { background-color: #fff3cd; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>RO Design Guidelines (Metric Units)</h1>
          ${content}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownload = () => {
    let text = "RO DESIGN GUIDELINES (METRIC UNITS)\n\n";
    
    text += "1. DESIGN PARAMETERS BY WATER TYPE\n";
    text += "Parameters: " + GUIDELINE_DATA.waterTypes.join(" | ") + "\n";
    GUIDELINE_DATA.parameters.forEach(p => {
      text += `${p.name}: ${p.values.join(", ")}\n`;
    });
    
    text += "\n2. MAXIMUM FEED FLOW PER VESSEL (m3/h)\n";
    GUIDELINE_DATA.feedMax.forEach(f => {
      text += `${f.size}: ${f.value}\n`;
    });
    
    text += "\n3. MINIMUM REJECT FLOW PER VESSEL (m3/h)\n";
    GUIDELINE_DATA.rejectMin.forEach(r => {
      text += `${r.size}: ${r.values.join(", ")}\n`;
    });
    
    text += "\n4. SATURATION LIMITS (WITH ANTISCALANT)\n";
    GUIDELINE_DATA.saturationLimits.forEach(s => {
      text += `${s.param}: ${s.limit}\n`;
    });
    
    text += "\n5. PRESSURE DROP (BAR)\n";
    text += `6-M Vessel: Typical ${GUIDELINE_DATA.pressureDrop.vessel6m.typical}, Max ${GUIDELINE_DATA.pressureDrop.vessel6m.max}\n`;
    text += `Element: Typical ${GUIDELINE_DATA.pressureDrop.element.typical}, Max ${GUIDELINE_DATA.pressureDrop.element.max}\n`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'RO_Design_Guidelines.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tableHeaderStyle = { background: '#f8f9fa', border: '1px solid #dee2e6', padding: '10px', fontSize: '0.75rem', textAlign: 'left' };
  const tableCellStyle = { border: '1px solid #dee2e6', padding: '10px', fontSize: '0.75rem' };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}>
      <div style={{ background: 'white', width: '95%', maxWidth: '1300px', height: '90vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
        <div style={{ background: '#004a80', color: 'white', padding: '15px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Full Design Guidelines (Text Reference)</h2>
          <button onClick={onClose} style={{ color: 'white', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.5rem' }}>✕</button>
        </div>
        
        <div id="guidelines-text-content" style={{ flex: 1, padding: '25px', overflowY: 'auto', backgroundColor: '#fff' }}>
          <h3 style={{ color: '#004a80', borderBottom: '2px solid #004a80', paddingBottom: '8px' }}>1. Parameters by Water Type</h3>
          <div style={{ overflowX: 'auto', marginBottom: '30px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Parameter</th>
                  {GUIDELINE_DATA.waterTypes.map(type => (
                    <th key={type} style={{ ...tableHeaderStyle, minWidth: '80px', background: type === currentWaterType ? '#fff3cd' : '#f8f9fa' }}>{type}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GUIDELINE_DATA.parameters.map(param => (
                  <tr key={param.name}>
                    <td style={{ ...tableCellStyle, fontWeight: 'bold', background: '#fcfcfc' }}>{param.name}</td>
                    {param.values.map((val, idx) => (
                      <td key={idx} style={{ ...tableCellStyle, background: GUIDELINE_DATA.waterTypes[idx] === currentWaterType ? '#fffdf5' : 'white' }}>{val}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginBottom: '30px' }}>
            <div>
              <h3 style={{ color: '#004a80', borderBottom: '2px solid #004a80', paddingBottom: '8px' }}>2. Feed Max Flow (m³/h)</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={tableHeaderStyle}>Element Size</th>
                    <th style={tableHeaderStyle}>Max Flow (m³/h)</th>
                  </tr>
                </thead>
                <tbody>
                  {GUIDELINE_DATA.feedMax.map(f => (
                    <tr key={f.size}>
                      <td style={tableCellStyle}>{f.size}</td>
                      <td style={tableCellStyle}>{f.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3 style={{ color: '#004a80', borderBottom: '2px solid #004a80', paddingBottom: '8px' }}>3. Saturation Limits</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={tableHeaderStyle}>Parameter</th>
                    <th style={tableHeaderStyle}>Limit (Typical)</th>
                  </tr>
                </thead>
                <tbody>
                  {GUIDELINE_DATA.saturationLimits.map(s => (
                    <tr key={s.param}>
                      <td style={tableCellStyle}>{s.param}</td>
                      <td style={tableCellStyle}>{s.limit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <h3 style={{ color: '#004a80', borderBottom: '2px solid #004a80', paddingBottom: '8px' }}>4. Reject Min Flow (m³/h)</h3>
          <div style={{ overflowX: 'auto', marginBottom: '30px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={tableHeaderStyle}>Size</th>
                  {GUIDELINE_DATA.waterTypes.map(type => (
                    <th key={type} style={{ ...tableHeaderStyle, minWidth: '80px', background: type === currentWaterType ? '#fff3cd' : '#f8f9fa' }}>{type}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GUIDELINE_DATA.rejectMin.map(r => (
                  <tr key={r.size}>
                    <td style={{ ...tableCellStyle, fontWeight: 'bold', background: '#fcfcfc' }}>{r.size}</td>
                    {r.values.map((val, idx) => (
                      <td key={idx} style={{ ...tableCellStyle, background: GUIDELINE_DATA.waterTypes[idx] === currentWaterType ? '#fffdf5' : 'white' }}>{val}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 style={{ color: '#004a80', borderBottom: '2px solid #004a80', paddingBottom: '8px' }}>5. Pressure Drop (bar)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: '500px' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Location</th>
                <th style={tableHeaderStyle}>Typical</th>
                <th style={tableHeaderStyle}>Maximum</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tableCellStyle}>6-M Vessel</td>
                <td style={tableCellStyle}>{GUIDELINE_DATA.pressureDrop.vessel6m.typical}</td>
                <td style={tableCellStyle}>{GUIDELINE_DATA.pressureDrop.vessel6m.max}</td>
              </tr>
              <tr>
                <td style={tableCellStyle}>Single Element</td>
                <td style={tableCellStyle}>{GUIDELINE_DATA.pressureDrop.element.typical}</td>
                <td style={tableCellStyle}>{GUIDELINE_DATA.pressureDrop.element.max}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ padding: '20px 30px', background: '#f8fbff', borderTop: '1px solid #e1e8ed', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
          <button onClick={handleDownload} style={{ padding: '10px 20px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📥 Download Text
          </button>
          <button onClick={handlePrint} style={{ padding: '10px 20px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🖨 Print Guidelines
          </button>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#34495e', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DesignGuidelines;
