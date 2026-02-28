import React, { useState } from 'react';

const MembraneEditor = ({ membranes, setMembranes, systemConfig, setSystemConfig }) => {
  const [newMembrane, setNewMembrane] = useState({ 
    id: '', 
    name: '', 
    area: 400, 
    type: 'Brackish',
    aValue: 0.12,
    rejection: 99.7,
    maxFlux: 48.5,
    membraneB: 0.14,
    dpExponent: 1.22,
    nominalFlowDP: 15.5
  });

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newMembrane.id || !newMembrane.name) {
      alert("Please provide both an ID and a Model Name.");
      return;
    }
    
    // Check for duplicates
    if (membranes.find(m => m.id === newMembrane.id)) {
      alert("A membrane with this ID already exists.");
      return;
    }

    const membraneToAdd = {
      ...newMembrane,
      areaM2: newMembrane.area * 0.092903,
      transport: {
        aValueRef: newMembrane.aValue,
        membraneBRef: newMembrane.membraneB,
        kMtRef: 160,
        soluteBFactors: {
          monovalent: 1.0,
          divalent: 0.6,
          silica: 0.8,
          boron: 1.4,
          co2: 999
        }
      },
      pressureDropModel: {
        coefficient: newMembrane.nominalFlowDP / 1000, // Approximate
        exponent: newMembrane.dpExponent
      },
      osmoticModel: {
        type: 'industrial-linear',
        coefficient: 0.00074
      }
    };

    setMembranes([...membranes, membraneToAdd]);
    setNewMembrane({ id: '', name: '', area: 400, type: 'Brackish', aValue: 0.12, rejection: 99.7, maxFlux: 48.5, membraneB: 0.14, dpExponent: 1.22, nominalFlowDP: 15.5 });
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to remove this membrane from your database?")) {
      setMembranes(membranes.filter(m => m.id !== id));
    }
  };

  const cardStyle = { background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: '20px' };
  const inputStyle = { padding: '10px', border: '1px solid #ccc', borderRadius: '4px', flex: 1 };
  const thStyle = { textAlign: 'left', padding: '12px', borderBottom: '2px solid #eee', color: '#666' };
  const tdStyle = { padding: '12px', borderBottom: '1px solid #eee' };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ color: '#2c3e50' }}>Membrane Database Editor</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Add new membrane specifications here. These will immediately appear in your <strong>System Design</strong> dropdown.
      </p>

      {/* ADD NEW MEMBRANE FORM */}
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, color: '#004a80' }}>Add New Membrane Model</h3>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input 
            placeholder="ID (e.g., swc5)" 
            value={newMembrane.id} 
            onChange={e => setNewMembrane({...newMembrane, id: e.target.value.toLowerCase().replace(/\s/g, '')})} 
            style={inputStyle} 
          />
          <input 
            placeholder="Full Name (e.g., SWC5-LD)" 
            value={newMembrane.name} 
            onChange={e => setNewMembrane({...newMembrane, name: e.target.value})} 
            style={inputStyle} 
          />
          <input 
            type="number" 
            placeholder="Area (ft²)" 
            value={newMembrane.area} 
            onChange={e => setNewMembrane({...newMembrane, area: parseFloat(e.target.value) || 0})} 
            style={{ ...inputStyle, maxWidth: '100px' }} 
          />
          <input 
            type="number" 
            step="0.01"
            placeholder="A-value" 
            value={newMembrane.aValue} 
            onChange={e => setNewMembrane({...newMembrane, aValue: parseFloat(e.target.value) || 0})} 
            style={{ ...inputStyle, maxWidth: '90px' }} 
          />
          <input 
            type="number" 
            step="0.1"
            placeholder="Rej (%)" 
            value={newMembrane.rejection} 
            onChange={e => setNewMembrane({...newMembrane, rejection: parseFloat(e.target.value) || 0})} 
            style={{ ...inputStyle, maxWidth: '90px' }} 
          />
          <input 
            type="number" 
            step="0.1"
            placeholder="Max Flux (LMH)" 
            value={newMembrane.maxFlux} 
            onChange={e => setNewMembrane({...newMembrane, maxFlux: parseFloat(e.target.value) || 48.5})} 
            style={{ ...inputStyle, maxWidth: '120px' }} 
          />
          <input 
            type="number" 
            step="0.01"
            placeholder="Membrane B" 
            value={newMembrane.membraneB} 
            onChange={e => setNewMembrane({...newMembrane, membraneB: parseFloat(e.target.value) || 0.14})} 
            style={{ ...inputStyle, maxWidth: '100px' }} 
          />
          <input 
            type="number" 
            step="0.01"
            placeholder="DP Exponent" 
            value={newMembrane.dpExponent} 
            onChange={e => setNewMembrane({...newMembrane, dpExponent: parseFloat(e.target.value) || 1.22})} 
            style={{ ...inputStyle, maxWidth: '110px' }} 
          />
          <input 
            type="number" 
            step="0.1"
            placeholder="Nominal Flow DP" 
            value={newMembrane.nominalFlowDP} 
            onChange={e => setNewMembrane({...newMembrane, nominalFlowDP: parseFloat(e.target.value) || 15.5})} 
            style={{ ...inputStyle, maxWidth: '130px' }} 
          />
          <select 
            value={newMembrane.type} 
            onChange={e => setNewMembrane({...newMembrane, type: e.target.value})} 
            style={inputStyle}
          >
            <option value="Brackish">Brackish</option>
            <option value="Seawater">Seawater</option>
          </select>
          <button type="submit" style={{ padding: '10px 20px', background: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            Add Element
          </button>
        </form>
      </div>

      {/* DATABASE TABLE */}
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0, color: '#004a80' }}>Current Library</h3>
        <div style={{ overflowX: 'auto', width: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>Model</th>
              <th style={thStyle}>Area (ft²)</th>
              <th style={thStyle}>A-value</th>
              <th style={thStyle}>Rej (%)</th>
              <th style={thStyle}>Max Flux (LMH)</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Action</th>
            </tr>
          </thead>
          <tbody>
            {membranes.map(m => (
              <tr
                key={m.id}
                onClick={() => setSystemConfig?.({ ...systemConfig, membraneModel: m.id })}
                style={{
                  cursor: 'pointer',
                  background: systemConfig?.membraneModel === m.id ? '#ebf5ff' : 'transparent'
                }}
                title="Click to use this membrane in Design"
              >
                <td style={tdStyle}><code>{m.id}</code></td>
                <td style={tdStyle}>{m.name}</td>
                <td style={tdStyle}>{m.area}</td>
                <td style={tdStyle}>{m.aValue ?? ''}</td>
                <td style={tdStyle}>{m.rejection ?? ''}</td>
                <td style={tdStyle}>{m.maxFlux ?? '48.5'}</td>
                <td style={tdStyle}>
                   <span style={{ 
                     padding: '2px 8px', 
                     borderRadius: '12px', 
                     fontSize: '0.75rem', 
                     background: m.type === 'Seawater' ? '#ebf5ff' : '#f0fff4',
                     color: m.type === 'Seawater' ? '#004a80' : '#27ae60'
                   }}>
                     {m.type}
                   </span>
                </td>
                <td style={tdStyle}>
                  <button 
                    onClick={() => handleDelete(m.id)} 
                    style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div style={{ marginTop: '10px', fontSize: '0.75rem', color: '#666' }}>
          Tip: click a row to set it as the active membrane for the Design tab.
        </div>
      </div>
    </div>
  );
};

export default MembraneEditor;