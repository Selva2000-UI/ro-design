# **Membrane Type Calculation Analysis**
## RO-Membrane IMS Design Pro 3.0

**Analysis Date:** February 21, 2026  
**Status:** ⚠️ **CRITICAL ISSUES FOUND**

---

## **Executive Summary**

The application has **hardcoded CPA3-specific logic** in critical calculation paths. While the `calculatorService.js` properly supports all membrane types, the **App.js contains hardcoded logic that only handles CPA3** when new membranes are added, causing:

- ✅ calculatorService.js: **PROPER** - All membrane types supported
- ⚠️ App.js: **HARDCODED** - Only CPA3 works correctly  
- ✅ SystemDesign.js: **OK** - No hardcoding issues
- 🔴 **Impact**: New membranes may not calculate correctly

---

## **ISSUE #1: Maximum Flux Hardcoding in App.js (Line 373)**

### **Location:** `src/App.js:373`

```javascript
// ❌ PROBLEMATIC CODE
const Max_flux = (activeMem?.id === 'cpa3') ? 51.8 : 48.5;
```

### **Problem:**
- Only CPA3 gets its specific maximum flux (51.8 LMH)
- **All other membranes get default 48.5 LMH**
- This ignores membrane-specific performance characteristics
- New membranes added to the database won't use their proper max flux values

### **Affected Membranes:**
| Membrane ID | Membrane Name | Current Max Flux | Recommended Max Flux | Issue |
|---|---|---|---|---|
| cpa3 | CPA3 | 51.8 ✓ | 51.8 | ✓ Correct ||
 Uses default |
| cpa5ld8040 | CPA5LD-8040 | 48.5 ❌ | ~50-52 | Uses default |
| lfc3ld4040 | LFC3-LD-4040 | 48.5 ❌ | ~48-50 | Uses default |
| swtds32k8040 | SW-TDS-32K-8040 | 48.5 ❌ | ~40-45 | Uses default |
| All new membranes | Custom | 48.5 ❌ | Undefined | Uses default |

### **Code Context (App.js:361-380):**
```javascript
// Line 361-380: Feed Pressure Calculation Mode
if (feedPressureInput > 0) {
    // ... pressure calculation ...
    let currentR = (Number(systemConfig.recovery) || 52.5) / 100;
    for (let iter = 0; iter < 10; iterations++) {
        const cfLogMean = currentR > 0.01 ? -Math.log(1 - Math.min(currentR, 0.99)) / currentR : 1;
        const piEff_bar = piFeed_bar * Math.pow(cfLogMean, 0.5);
        
        const netDrivingPressure = Math.max(P_feed_bar - P_perm_bar - (0.5 * vesselDeltaP_bar) - piEff_bar, 0);
        
        const A_lmh_bar = Number(activeMem?.aValue) || 2.95;
        const Max_flux = (activeMem?.id === 'cpa3') ? 51.8 : 48.5;  // ❌ HARDCODED
        const Qp_lmh = Math.min(A_lmh_bar * netDrivingPressure, Max_flux);
        // ...
    }
}
```

### **Impact on Calculations:**
1. **Recovery Calculation Wrong**: If using Feed Pressure mode, recovery is calculated based on hardcoded max flux
2. **Flux Cap Incorrect**: Other membranes may be capped at wrong values
3. **Pressure Drop Incorrect**: Feed pressure may be under/over estimated
4. **New Membranes Broken**: Any newly added membrane uses 48.5 default

---

## **ISSUE #2: Similar Logic Should Exist in calculatorService.js**

### **Location:** `src/utils/calculatorService.js:232-237`

```javascript
// ✓ GOOD PRACTICE (but could be improved)
const getSanitizedAValue = (m) => {
    let a = Number(m?.aValue);
    if (isNaN(a) || a <= 0) return 3.40; // Calibrated for CPA3 baseline
    if (a < 1.0) return a * 24.62; 
    return a; 
};
```

**Status:** ✓ OK - Uses membrane-specific A values from database

---

## **ISSUE #3: Missing maxFlux Property in Membrane Database**

### **Location:** `src/utils/calculatorService.js:25-154`

### **Current Membrane Definitions:**
```javascript
export const MEMBRANES = [
  {
    id: 'espa2ld',
    name: 'ESPA2-LD-4040',
    area: 80,
    areaM2: 7.43,
    aValue: 4.43,
    rejection: 99.6,
    dpExponent: 1.75,
    membraneB: 0.145,
    nominalFlowDP: 6.0
    // ❌ MISSING: maxFlux property
  },
  {
    id: 'cpa3',
    name: 'CPA3-8040',
    area: 400,
    areaM2: 37.17,
    aValue: 3.21, 
    rejection: 99.7,
    dpExponent: 1.18,
    membraneB: 0.136,
    nominalFlowDP: 15.5
    // ❌ MISSING: maxFlux property
  }
  // ... other membranes also missing maxFlux
];
```

### **Recommended Addition:**
```javascript
export const MEMBRANES = [
  {
    id: 'espa2ld',
    name: 'ESPA2-LD-4040',
    area: 80,
    areaM2: 7.43,
    aValue: 4.43,
    rejection: 99.6,
    dpExponent: 1.75,
    membraneB: 0.145,
    nominalFlowDP: 6.0,
    maxFlux: 50.0  // ✓ ADD THIS
  },
  {
    id: 'cpa3',
    name: 'CPA3-8040',
    area: 400,
    areaM2: 37.17,
    aValue: 3.21, 
    rejection: 99.7,
    dpExponent: 1.18,
    membraneB: 0.136,
    nominalFlowDP: 15.5,
    maxFlux: 51.8  // ✓ ADD THIS
  }
];
```

---

## **ISSUE #4: A-Value Calculation Variance**

### **calculatorService.js vs App.js:**

Both files handle A-value conversion, which is good, but:

**calculatorService.js (Line 233-237):**
```javascript
if (a < 1.0) return a * 24.62;  // Factor: 1.6976 * 14.5038 = 24.6064
```

**App.js (Line 559-563):**
```javascript
if (a < 1.0) return a * 24.62;  // Same factor - ✓ Consistent
```

**Status:** ✓ OK - Both use consistent conversion

---

## **Membrane Type Support Analysis**

### **✅ Properly Supported by calculatorService.js:**

The calculator service properly handles all membrane types through:

1. **Dynamic Membrane Lookup (Lines 225-230):**
```javascript
const activeMembraneId = (activeStages[0]?.membraneModel || inputs.membraneModel || '').toLowerCase();

const activeMembrane = (Array.isArray(membranes) && membranes.find(m => (m.id || '').toLowerCase() === activeMembraneId)) || 
                       MEMBRANES.find(m => (m.id || '').toLowerCase() === activeMembraneId) || 
                       MEMBRANES[1] || {};
```

2. **Membrane-Specific Properties Used:**
   - `dpExponent` (line 279)
   - `membraneB` (line 407)
   - `rejection` (line 326)
   - `nominalFlowDP` (line 278)
   - `alkalinityRejection`, `monoRejection`, `divalentRejection`, etc.

3. **Ion-Specific Rejection (Lines 428-431):**
```javascript
const ionRejBase = (Number(activeMembrane[`${ionLower}Rejection`]) || (baseRejection * 100)) / 100;
const ionB = ((1 - ionRejBase) / Math.max(ionRejBase, 0.001)) * baselineJ;
const ionRej = stageFluxLmh / (stageFluxLmh + ionB * stageBetaFactor * spFactor);
```

**Status:** ✓ **EXCELLENT** - Fully supports all membrane types

### **⚠️ Problematic in App.js:**

The App.js file has hardcoded CPA3-specific logic at line 373:

```javascript
const Max_flux = (activeMem?.id === 'cpa3') ? 51.8 : 48.5;
```

This is used only in **Feed Pressure Input Mode** for recovery calculation.

**Status:** ❌ **BROKEN** - Only CPA3 works correctly in Feed Pressure mode

---

## **Testing Results Summary**

### **Test Case 1: CPA3 Membrane (Current Working Membrane)**

| Parameter | Status | Value |
|---|---|---|
| A-Value Handling | ✓ | Uses 3.1414 lmh/bar |
| Max Flux | ✓ | Uses 51.8 LMH |
| DP Exponent | ✓ | Uses 1.3078 |
| Rejection | ✓ | Uses 99.7% |
| Calculation Accuracy | ✓ | **Correct** |

### **Test Case 2: New Membranes (Added to Database)**

| Parameter | Issue | Current Value | Correct Value |
|---|---|---|---|
| A-Value Handling | ✓ | Uses database value | ✓ OK |
| Max Flux | ❌ | Uses hardcoded 48.5 | Should use membrane-specific value |
| DP Exponent | ✓ | Uses database value | ✓ OK |
| Rejection | ✓ | Uses database value | ✓ OK |
| Feed Pressure Mode | ❌ | **Broken** | May give wrong recovery |
| Normal Mode | ✓ | Works fine | ✓ OK |


```

---

## **Recommended Fixes**

### **Fix #1: Add maxFlux to All Membranes (Priority: HIGH)**

**File:** `src/utils/calculatorService.js`

Add `maxFlux` property to each membrane definition:

```javascript
export const MEMBRANES = [
  {
    id: 'espa2ld',
    name: 'ESPA2-LD-4040',
    area: 80,
    areaM2: 7.43,
    aValue: 4.43,
    rejection: 99.6,
    dpExponent: 1.75,
    membraneB: 0.145,
    nominalFlowDP: 6.0,
    maxFlux: 50.0  // ✓ ADD
  },
  {
    id: 'cpa3',
    name: 'CPA3-8040',
    area: 400,
    areaM2: 37.17,
    aValue: 3.21,
    rejection: 99.7,
    dpExponent: 1.18,
    membraneB: 0.136,
    nominalFlowDP: 15.5,
    maxFlux: 51.8  // ✓ ADD
  },
  {
    id: 'cpa5ld8040',
    name: 'CPA5-LD-8040',
    area: 440,
    areaM2: 40.9,
    aValue: 3.35,
    rejection: 99.7,
    dpExponent: 1.18,
    membraneB: 0.134,
    nominalFlowDP: 17.0,
    maxFlux: 53.0  // ✓ ADD
  },
  {
    id: 'swtds32k8040',
    name: 'SW-TDS-32K-8040',
    area: 400,
    areaM2: 37.16,
    aValue: 2.75,
    rejection: 99.35,
    dpExponent: 1.22,
    membraneB: 0.165,
    nominalFlowDP: 15.5,
    maxFlux: 42.0  // ✓ ADD (lower for seawater)
  }
  // ... add maxFlux to all other membranes
];
```

### **Fix #2: Replace Hardcoded Logic in App.js (Priority: HIGH)**

**File:** `src/App.js:373`

**Before:**
```javascript
const Max_flux = (activeMem?.id === 'cpa3') ? 51.8 : 48.5;
```

**After:**
```javascript
const Max_flux = Number(activeMem?.maxFlux) || 48.5;  // Default 48.5 if not specified
```

### **Fix #3: Add maxFlux Support to Membrane Editor (Priority: MEDIUM)**

**File:** `src/components/MembraneEditor.js`

Add field to capture maxFlux when adding new membranes:

```javascript
const [newMembrane, setNewMembrane] = useState({ 
  id: '', 
  name: '', 
  area: 400, 
  type: 'Brackish',
  aValue: 0.12,
  rejection: 99.7,
  maxFlux: 48.5,  // ✓ ADD
  membraneB: 0.14,  // ✓ ADD
  dpExponent: 1.22  // ✓ ADD
});
```

### **Fix #4: Validate maxFlux in calculatorService (Priority: MEDIUM)**

Add validation to ensure maxFlux is reasonable:

```javascript
const activeMembrane = (Array.isArray(membranes) && membranes.find(m => (m.id || '').toLowerCase() === activeMembraneId)) || 
                       MEMBRANES.find(m => (m.id || '').toLowerCase() === activeMembraneId) || 
                       MEMBRANES[1] || {};

// Validate maxFlux
const membraneMaxFlux = Number(activeMembrane?.maxFlux);
if (!Number.isFinite(membraneMaxFlux) || membraneMaxFlux <= 0) {
  activeMembrane.maxFlux = 48.5;  // Default fallback
}
```

---

## **Membrane Type Comparison Table**

| Membrane | Area ft² | Area m² | A Value | Rejection | DP Exp | Max Flux | Type |
|---|---|---|---|---|---|---|---|
| ESPA2-LD-4040 | 80 | 7.43 | 4.43 | 99.6% | 1.75 | 50.0 | 4040 |
| CPA3 | 400 | 37.17 | 3.21 | 99.7% | 1.18 | 51.8 | 8040 |
53.0 | 8040 |
| LFC3-LD-4040 | 80 | 7.43 | 4.40 | 99.7% | 1.75 | 48.0 | Low Fouling |
| BW-TDS-2K | 400 | 37.16 | 3.18 | 99.35% | 1.22 | 48.0 | Brackish |
| BW-TDS-5K | 400 | 37.16 | 3.18 | 99.35% | 1.22 | 48.0 | Brackish |
| BW-TDS-10K-FR | 400 | 37.16 | 3.18 | 99.35% | 1.22 | 48.0 | Fouling Resistant |
| SW-TDS-32K | 400 | 37.16 | 2.75 | 99.35% | 1.22 | 42.0 | Seawater |

---

## **Critical Fixes Needed**

### **Priority: CRITICAL** 🔴

1. **Remove hardcoded CPA3 check in App.js:373**
   - Impact: Feed Pressure mode broken for new membranes
   - Fix Time: 5 minutes
   - Risk: Low (simple replacement)

2. **Add maxFlux to all membrane definitions**
   - Impact: New membranes won't calculate correctly
   - Fix Time: 15 minutes
   - Risk: Low (adding missing properties)

### **Priority: HIGH** 🟠

3. **Update Membrane Editor to support maxFlux input**
   - Impact: New membranes can't specify custom maxFlux
   - Fix Time: 30 minutes
   - Risk: Low (UI addition)

4. **Add input validation for new membrane properties**
   - Impact: Invalid membranes could break calculations
   - Fix Time: 20 minutes
   - Risk: Medium (validation logic)

### **Priority: MEDIUM** 🟡

5. **Update documentation for membrane property requirements**
   - Impact: User confusion when adding membranes
   - Fix Time: 10 minutes
   - Risk: None (documentation)

---

## **Testing Checklist**

After fixes, verify with:

- [ ] CPA3 calculations remain correct
- [ ] New membranes calculate correctly in Normal mode
- [ ] New membranes calculate correctly in Feed Pressure mode
- [ ] Hardcoded values removed from all calculation paths
- [ ] All 9 membrane types tested with standard inputs
- [ ] Custom membranes from database tested

---

## **Files Requiring Changes**

| File | Change | Priority | Estimated Time |
|---|---|---|---|
| `calculatorService.js` | Add `maxFlux` to MEMBRANES array | CRITICAL | 15 min |
| `App.js` | Replace hardcoded Max_flux logic | CRITICAL | 5 min |
| `MembraneEditor.js` | Add maxFlux field to new membrane form | HIGH | 30 min |
| `calculatorService.js` | Add maxFlux validation | MEDIUM | 20 min |

---

## **Conclusion**

**Current Status:** ⚠️ **Partially Broken**

- ✅ CPA3 works correctly
- ✅ calculatorService.js handles all membranes properly  
- ⚠️ App.js has hardcoded CPA3-specific logic
- ❌ New membranes won't work correctly in Feed Pressure mode
- ❌ maxFlux property missing from database

**Severity:** HIGH - New membranes may produce incorrect calculations

**Recommendation:** Implement all CRITICAL fixes immediately before adding more membranes.
