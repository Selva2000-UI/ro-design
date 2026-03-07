import React from 'react';

const ValidationBanner = ({ projection, systemConfig, waterData }) => {
  const flux = Number(projection.fluxGFD || 0);
  const recovery = Number(systemConfig.recovery || 0);
  const s1Vessels = Number(systemConfig.stage1Vessels || 1);
  
  // Engineering Rule: Max feed flow per 8" vessel is ~17 m3/h
  const feedFlowM3h = Number(projection.feedFlowM3h || 0); // train-level feed in m3/h
  const flowPerVessel = feedFlowM3h / s1Vessels;

  const checks = [
    {
      id: 'flux',
      label: 'Design Flux',
      value: `${flux} GFD`,
      status: flux > 16 ? 'error' : flux > 14 ? 'warning' : 'success',
      msg: flux > 16 ? 'High fouling risk' : flux > 14 ? 'Pushing limits' : 'Safe range'
    },
    {
      id: 'loading',
      label: 'Vessel Loading',
      value: `${flowPerVessel.toFixed(1)} m³/h`,
      status: flowPerVessel > 17 ? 'error' : flowPerVessel > 15 ? 'warning' : 'success',
      msg: flowPerVessel > 17 ? 'Exceeds 8" limit' : 'High velocity'
    },
    {
      id: 'recovery',
      label: 'System Recovery',
      value: `${recovery}%`,
      status: recovery > 85 ? 'error' : recovery > 75 ? 'warning' : 'success',
      msg: recovery > 80 ? 'Scaling likely' : 'Standard'
    }
  ];

  const bannerStyle = {
    display: 'flex',
    gap: '15px',
    padding: '12px 20px',
    background: '#fff',
    borderBottom: '1px solid #d1d9e0',
    overflowX: 'auto',
    alignItems: 'center'
  };

  const badgeStyle = (status) => ({
    display: 'flex',
    flexDirection: 'column',
    padding: '4px 12px',
    borderRadius: '6px',
    minWidth: '140px',
    borderLeft: `4px solid ${status === 'error' ? '#e74c3c' : status === 'warning' ? '#f39c12' : '#27ae60'}`,
    background: '#f8f9fa'
  });

  const alerts = projection.designValidation?.issues || [];

  return (
    <div style={{ background: '#fff' }}>
      <div style={bannerStyle}>
        <span style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#002f5d', marginRight: '10px' }}>
          DESIGN STATUS:
        </span>
        {checks.map(check => (
          <div key={check.id} style={badgeStyle(check.status)}>
            <div style={{ fontSize: '0.7rem', color: '#666', fontWeight: 'bold' }}>{check.label.toUpperCase()}</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#333' }}>{check.value}</div>
            <div style={{ fontSize: '0.65rem', color: check.status === 'success' ? '#27ae60' : '#d35400' }}>
              {check.status === 'success' ? '✓ ' : '⚠ '}{check.msg}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ValidationBanner;