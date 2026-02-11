import React, { useMemo } from 'react';

// --- TECHNICAL CONSTANTS (Equivalent Weights) ---
const EQ_WEIGHTS = {
  ca: 20.04,
  mg: 12.15,
  na: 23.00,
  k: 39.10,
  nh4: 18.04,
  ba: 68.67,
  sr: 43.81,
  co3: 30.00,
  hco3: 61.02,
  so4: 48.03,
  cl: 35.45,
  f: 19.00,
  no3: 62.00,
  po4: 31.67
};

const WaterAnalysis = ({ waterData, setWaterData }) => {
  
  const applyTdsProfile = (tdsValue) => {
  const tds = Number(tdsValue) || 0;
  if (tds <= 0) return;

  // Equivalent weights
  const EW_NA = EQ_WEIGHTS.na;   // 23
  const EW_CL = EQ_WEIGHTS.cl;   // 35.45

  // Step 1: calculate total meq/L (Na–Cl water)
  const totalMeq = tds / (EW_NA + EW_CL);

  // Step 2: convert meq/L → mg/L
  const na = totalMeq * EW_NA;
  const cl = totalMeq * EW_CL;

  const updated = {
    ca: 0,
    mg: 0,
    k: 0,
    hco3: 0,
    so4: 0,
    no3: 0,
    sio2: 0,

    // calculated ions
    na: Number(na.toFixed(2)),
    cl: Number(cl.toFixed(2)),

    // preserve user-entered trace species
    nh4: waterData.nh4,
    sr: waterData.sr,
    ba: waterData.ba,
    po4: waterData.po4,
    f: waterData.f,
    b: waterData.b,
    co2: waterData.co2,
    co3: waterData.co3
  };

  setWaterData({
    ...waterData,
    calculatedTds: Math.round(tds),
    ...updated
  });
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

  const analysisTotals = useMemo(() => {
    const toNumber = (value) => Number(value) || 0;
    const cationKeys = ['ca', 'mg', 'na', 'k', 'nh4', 'ba', 'sr'];
    const anionKeys = ['co3', 'hco3', 'so4', 'cl', 'f', 'no3', 'po4'];

    const calcMeq = (key) => {
      const eq = EQ_WEIGHTS[key];
      if (!eq) return 0;
      return toNumber(waterData[key]) / eq;
    };

    const cationMeq = cationKeys.reduce((sum, key) => sum + calcMeq(key), 0);
    const anionMeq = anionKeys.reduce((sum, key) => sum + calcMeq(key), 0);

    const tdsKeys = [
      'ca', 'mg', 'na', 'k', 'nh4', 'ba', 'sr',
      'co3', 'hco3', 'so4', 'cl', 'f', 'no3', 'po4',
      'sio2', 'b', 'co2'
    ];
    const calculatedTds = tdsKeys.reduce((sum, key) => sum + toNumber(waterData[key]), 0);

    const osmoticPsi = calculatedTds * 0.0115;
    const caConc = toNumber(waterData.ca);
    const so4Conc = toNumber(waterData.so4);
    const baConc = toNumber(waterData.ba);
    const srConc = toNumber(waterData.sr);
    const sio2Conc = toNumber(waterData.sio2);
    const po4Conc = toNumber(waterData.po4);
    const fConc = toNumber(waterData.f);

    const pCa = 5.0 - Math.log10(Math.max(caConc * 2.5, 0.0001));
    const pAlk = 5.0 - Math.log10(Math.max(toNumber(waterData.hco3) * 0.82, 0.0001));
    const C = (Math.log10(Math.max(calculatedTds, 1)) - 1) / 10 + (Number(waterData.temp) > 25 ? 2.0 : 2.3);
    const phs = C + pCa + pAlk;
    const lsi = (toNumber(waterData.ph) || 7) - phs;
    const ccpp = lsi > 0 ? lsi * 50 : 0;

    return {
      calculatedTds,
      osmoticPsi,
      lsi,
      ccpp,
      cationMeq,
      anionMeq,
      caSo4: (caConc * so4Conc) / 1000,
      baSo4: (baConc * so4Conc) / 50,
      srSo4: (srConc * so4Conc) / 2000,
      sio2: (sio2Conc / 120) * 100,
      ca3po42: (caConc * po4Conc) / 100,
      caF2: (caConc * fConc) / 500
    };
  }, [waterData]);

  const formatCaCO3 = (key, value) => {
    const eq = EQ_WEIGHTS[key];
    if (!eq) return '0.00';
    return (Number(value || 0) * (50 / eq)).toFixed(2);
  };

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

  const handleReset = () => {
    setWaterData({
      ...waterData,
      waterType: 'Well Water',
      calculatedTds: 0,
      pretreatment: 'Conventional'
    });
  };

  const handleInputChange = (key, val) => {
    if (key === 'calculatedTds') {
      setWaterData({ ...waterData, calculatedTds: val });
      applyTdsProfile(val, waterData.waterType);
      return;
    }
    if (key === 'waterType') {
      setWaterData({ ...waterData, waterType: val });
      if (Number(waterData.calculatedTds) > 0) {
        applyTdsProfile(waterData.calculatedTds, val);
      }
      return;
    }
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
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={handleAutoBalance}
              style={{ background: '#3498db', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              ⚖️ Auto-Balance (Na/Cl)
            </button>
            <button 
              onClick={handleReset}
              style={{ background: '#e74c3c', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              🔄 Reset
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '15px' }}>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Project</label>
            <input
              type="text"
              value={waterData.projectName || ''}
              onChange={(e) => handleInputChange('projectName', e.target.value)}
            />
          </div>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Client Name</label>
            <input
              type="text"
              value={waterData.clientName || ''}
              onChange={(e) => handleInputChange('clientName', e.target.value)}
            />
          </div>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Calculated By</label>
            <input
              type="text"
              value={waterData.calculatedBy || ''}
              onChange={(e) => handleInputChange('calculatedBy', e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '15px' }}>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Water type</label>
            <select value={waterData.waterType || 'Well Water'} onChange={(e) => handleInputChange('waterType', e.target.value)}>
              <option value="Brackish Well Non-Fouling">Brackish Well Non-Fouling</option>
              <option value="Brackish Well High-Fouling">Brackish Well High-Fouling</option>
              <option value="Brackish Surface">Brackish Surface</option>
              <option value="Sea Well">Sea Well</option>
              <option value="Sea Surface">Sea Surface</option>
              <option value="Municipal Waste">Municipal Waste</option>
              <option value="Industrial Waste">Industrial Waste</option>
              <option value="RO Permeate">RO Permeate</option>
              <option value="Well Water">Well Water</option>
            </select>
          </div>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Pretreatment</label>
            <select value={waterData.pretreatment || 'Conventional'} onChange={(e) => handleInputChange('pretreatment', e.target.value)}>
              <option value="Conventional">Conventional</option>
              <option value="UF">UF</option>
              <option value="MF">MF</option>
              <option value="None">None</option>
            </select>
          </div>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Calculated TDS (mg/L)</label>
            <input
              type="number"
              value={waterData.calculatedTds ?? 0}
              onChange={(e) => handleInputChange('calculatedTds', e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px', marginBottom: '15px' }}>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Auto-fill from TDS</label>
            <button
              onClick={() => applyTdsProfile(waterData.calculatedTds, waterData.waterType)}
              style={{ background: '#2ecc71', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              Apply
            </button>
          </div>
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

        <div style={{ marginTop: '25px', background: '#f4f7fb', borderRadius: '6px', border: '1px solid #c2d1df' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', padding: '15px' }}>
            <div style={{ background: '#fff', border: '1px solid #c2d1df', borderRadius: '6px' }}>
              <div style={{ background: '#004a80', color: 'white', padding: '8px 12px', fontWeight: 'bold' }}>Cations</div>
              <div style={{ padding: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '6px' }}>
                  <div></div>
                  <div style={{ textAlign: 'right' }}>mg/L as CaCO3</div>
                </div>
                {[
                  ['ca', 'Ca'],
                  ['mg', 'Mg'],
                  ['na', 'Na'],
                  ['k', 'K'],
                  ['nh4', 'NH4'],
                  ['ba', 'Ba'],
                  ['sr', 'Sr']
                ].map(([key, label]) => (
                  <div key={key} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', fontSize: '0.8rem', marginBottom: '6px' }}>
                    <div>{label}</div>
                    <div style={{ textAlign: 'right', background: '#f8fbff', border: '1px solid #c2d1df', padding: '2px 6px' }}>{formatCaCO3(key, waterData[key])}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontWeight: 'bold' }}>
                  <span>Total, meq/L</span>
                  <span style={{ background: '#f8fbff', border: '1px solid #c2d1df', padding: '2px 6px' }}>{analysisTotals.cationMeq.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #c2d1df', borderRadius: '6px' }}>
              <div style={{ background: '#004a80', color: 'white', padding: '8px 12px', fontWeight: 'bold' }}>Anions</div>
              <div style={{ padding: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '6px' }}>
                  <div></div>
                  <div style={{ textAlign: 'right' }}>mg/L as CaCO3</div>
                </div>
                {[
                  ['co3', 'CO3'],
                  ['hco3', 'HCO3'],
                  ['so4', 'SO4'],
                  ['cl', 'Cl'],
                  ['f', 'F'],
                  ['no3', 'NO3'],
                  ['po4', 'PO4']
                ].map(([key, label]) => (
                  <div key={key} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', fontSize: '0.8rem', marginBottom: '6px' }}>
                    <div>{label}</div>
                    <div style={{ textAlign: 'right', background: '#f8fbff', border: '1px solid #c2d1df', padding: '2px 6px' }}>{formatCaCO3(key, waterData[key])}</div>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', fontSize: '0.8rem', marginBottom: '6px' }}>
                  <div>SiO2</div>
                  <div style={{ textAlign: 'right', background: '#f8fbff', border: '1px solid #c2d1df', padding: '2px 6px' }}>0.00</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', fontSize: '0.8rem', marginBottom: '6px' }}>
                  <div>B</div>
                  <div style={{ textAlign: 'right', background: '#f8fbff', border: '1px solid #c2d1df', padding: '2px 6px' }}>0.00</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontWeight: 'bold' }}>
                  <span>Total, meq/L</span>
                  <span style={{ background: '#f8fbff', border: '1px solid #c2d1df', padding: '2px 6px' }}>{analysisTotals.anionMeq.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ padding: '0 15px 15px' }}>
            <div style={{ background: '#fff', border: '1px solid #c2d1df', borderRadius: '6px' }}>
              <div style={{ background: '#004a80', color: 'white', padding: '8px 12px', fontWeight: 'bold' }}>Saturations</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px', padding: '10px', fontSize: '0.8rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>Calculated TDS</span>
                    <span style={{ background: '#f8fbff', border: '1px solid #c2d1df', padding: '2px 6px' }}>{analysisTotals.calculatedTds.toFixed(0)} mg/L</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>Osmotic pressure</span>
                    <span style={{ background: '#f8fbff', border: '1px solid #c2d1df', padding: '2px 6px' }}>{analysisTotals.osmoticPsi.toFixed(1)} psi</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>Ca3(PO4)2 SI</span>
                    <span style={{ background: '#f8fbff', border: '1px solid #c2d1df', padding: '2px 6px' }}>{analysisTotals.ca3po42.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>CCPP</span>
                    <span style={{ background: '#f8fbff', border: '1px solid #c2d1df', padding: '2px 6px' }}>{analysisTotals.ccpp.toFixed(2)} mg/L CaCO3</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>LSI</span>
                    <span style={{ background: '#f8fbff', border: '1px solid #c2d1df', padding: '2px 6px' }}>{analysisTotals.lsi.toFixed(2)}</span>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>CaSO4</span>
                    <span style={{ background: '#f8fbff', border: '1px solid #c2d1df', padding: '2px 6px' }}>{analysisTotals.caSo4.toFixed(1)} %</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>BaSO4</span>
                    <span style={{ background: '#f8fbff', border: '1px solid #c2d1df', padding: '2px 6px' }}>{analysisTotals.baSo4.toFixed(1)} %</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>SrSO4</span>
                    <span style={{ background: '#f8fbff', border: '1px solid #c2d1df', padding: '2px 6px' }}>{analysisTotals.srSo4.toFixed(1)} %</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>CaF2</span>
                    <span style={{ background: '#f8fbff', border: '1px solid #c2d1df', padding: '2px 6px' }}>{analysisTotals.caF2.toFixed(1)} %</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>SiO2</span>
                    <span style={{ background: '#f8fbff', border: '1px solid #c2d1df', padding: '2px 6px' }}>{analysisTotals.sio2.toFixed(1)} %</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
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