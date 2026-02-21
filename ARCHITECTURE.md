# **RO-Membrane Design Pro 3.0 - Architecture Design**

## **Current Issues**

❌ **App.js is 73.86 KB** - contains state + calculations + business logic  
❌ **SystemDesign.js is 60.11 KB** - UI + calculation logic mixed  
❌ **Membrane logic scattered** - across App.js, calculatorService, components  
❌ **No clear separation** - calculations happen in multiple places  

---

## **Proposed Clean Architecture**

### **Layer 1: Core Calculation Engine (Pure Functions)**

```
src/
├── engines/
│   ├── membraneEngine.js         ✨ NEW - Membrane-type logic
│   ├── calculationEngine.js      ✨ NEW - All calculations
│   ├── waterTypeEngine.js        ✨ NEW - Water-type logic
│   └── stageCalculationEngine.js ✨ NEW - Multi-stage logic
```

**Purpose:** Pure, testable, framework-agnostic calculation functions

---

### **Layer 2: State Management**

```
src/
├── hooks/
│   ├── useProjectState.js       ✨ NEW - Project data
│   ├── useSystemConfig.js       ✨ NEW - System configuration
│   ├── useCalculations.js       ✨ NEW - Computed calculations
│   └── useMembraneDatabase.js   ✨ NEW - Membrane library
```

**Purpose:** Encapsulate state logic, separate from UI

---

### **Layer 3: Service Layer (Business Logic)**

```
src/
├── services/
│   ├── projectService.js        ✨ NEW - Project CRUD
│   ├── calculationService.js    🔄 REFACTOR - Orchestrator
│   ├── membraneService.js       ✨ NEW - Membrane operations
│   ├── designValidationService.js ✨ NEW - Validation logic
│   └── reportService.js         ✨ NEW - Report generation
```

**Purpose:** Business logic, API calls, data transformations

---

### **Layer 4: Component Layer (UI Only)**

```
src/
├── pages/
│   ├── DashboardPage.js         ✨ NEW - Dashboard view
│   ├── WaterAnalysisPage.js     ✨ NEW - Water analysis view
│   ├── DesignPage.js            ✨ NEW - System design view
│   ├── TreatmentPage.js         ✨ NEW - Pre/Post treatment
│   └── ReportPage.js            ✨ NEW - Report view
│
├── sections/
│   ├── WaterAnalysisSection.js  ✨ NEW
│   ├── SystemDesignSection.js   ✨ NEW
│   ├── PreTreatmentSection.js   ✨ NEW
│   ├── PostTreatmentSection.js  ✨ NEW
│   └── ReportSection.js         ✨ NEW
│
├── components/
│   ├── MembraneSelector/
│   │   ├── MembraneSelector.js  ✨ NEW
│   │   ├── MembraneCard.js      ✨ NEW
│   │   └── MembraneModal.js     ✨ NEW
│   │
│   ├── Input/
│   │   ├── InputField.js        ✨ NEW
│   │   ├── Select.js            ✨ NEW
│   │   └── Table.js             ✨ NEW
│   │
│   ├── Results/
│   │   ├── ResultsGrid.js       ✨ NEW
│   │   ├── FluxDisplay.js       ✨ NEW
│   │   └── FlowDiagram.js       ✨ NEW
│   │
│   └── Common/
│       ├── Header.js            ✨ NEW
│       ├── Navigation.js        ✨ NEW
│       └── Footer.js            ✨ NEW
```

**Purpose:** Thin UI components, no business logic

---

### **Layer 5: Data Models**

```
src/
├── models/
│   ├── Membrane.js              ✨ NEW
│   ├── WaterData.js             ✨ NEW
│   ├── SystemConfig.js          ✨ NEW
│   ├── Project.js               ✨ NEW
│   └── CalculationResult.js     ✨ NEW
```

**Purpose:** Type definitions, validation schemas

---

### **Layer 6: Utilities**

```
src/
├── utils/
│   ├── constants/
│   │   ├── membraneConstants.js ✨ NEW
│   │   ├── waterConstants.js    ✨ NEW
│   │   └── unitConstants.js     ✨ NEW
│   │
│   ├── converters/
│   │   ├── unitConverter.js     ✨ NEW
│   │   ├── dataConverter.js     ✨ NEW
│   │   └── ionConverter.js      ✨ NEW
│   │
│   ├── validators/
│   │   ├── membraneValidator.js ✨ NEW
│   │   ├── waterValidator.js    ✨ NEW
│   │   └── systemValidator.js   ✨ NEW
│   │
│   └── formatters/
│       ├── numberFormatter.js   ✨ NEW
│       ├── fluxFormatter.js     ✨ NEW
│       └── pressureFormatter.js ✨ NEW
```

**Purpose:** Reusable utility functions

---

## **Data Flow Architecture**

```
USER INPUT (Component)
    ↓
STATE MANAGEMENT (Hook)
    ↓
VALIDATION (Validator)
    ↓
CALCULATION ENGINE (Pure Functions)
    ├── Membrane Engine
    ├── Calculation Engine
    ├── Water Type Engine
    └── Stage Calculation Engine
    ↓
RESULTS
    ↓
FORMATTING (Formatter)
    ↓
DISPLAY (Component)
```

---

## **Membrane Type Logic - Clean Separation**

### **Current Problem:**
```javascript
// Scattered across multiple files
const Max_flux = (activeMem?.id === 'cpa3') ? 51.8 : 48.5;  // App.js hardcoded
const aValue = Number(m?.aValue);  // calculatorService.js
// More logic in SystemDesign, components, etc.
```

### **New Solution:**

**File:** `src/engines/membraneEngine.js`

```javascript
export const MEMBRANE_PROPERTIES = {
  cpa3: {
    id: 'cpa3',
    name: 'CPA3',
    area: 400,
    aValue: 3.1414,
    rejection: 99.7,
    maxFlux: 51.8,
    dpExponent: 1.18,
    membraneB: 0.136,
    // ... all properties in ONE place
  },
  swtds32k8040: {
    // ... seawater specific properties
  },
  // ... all membranes defined here
};

// Pure functions for membrane operations
export const getMembrane = (membraneId) => MEMBRANE_PROPERTIES[membraneId];

export const getMembraneSaltPassage = (membrane, flux) => {
  const baselineJ = 45.0;
  const ionB = (1 - membrane.rejection / 100) * baselineJ / flux;
  return ionB / (flux + ionB);
};

export const getMembraneFluxLimit = (membrane) => membrane.maxFlux;

export const getMembranesByType = (type) => {
  return Object.values(MEMBRANE_PROPERTIES).filter(m => m.type === type);
};

export const validateMembraneForWaterType = (membrane, waterType) => {
  // Business logic for membrane/water compatibility
};
```

---

## **Calculation Engine - Unified Logic**

### **Current Problem:**
Calculations in App.js, calculatorService.js, and SystemDesign.js

### **New Solution:**

**File:** `src/engines/calculationEngine.js`

```javascript
// ONE place for all calculations - pure functions
export const calculateFlux = (feedFlow, recovery, membraneArea, elements) => {
  // Single responsibility
};

export const calculatePressure = (flux, aValue, osmoticPressure, deltaP) => {
  // Single responsibility
};

export const calculatePermeateQuality = (feedIons, recovery, membrane) => {
  // Single responsibility
};

export const calculateSystemDesign = (inputs) => {
  // Orchestrates sub-calculations
  const { feedFlow, recovery, membrane, stages, waterData } = inputs;
  
  return {
    flux: calculateFlux(...),
    pressure: calculatePressure(...),
    permeate: calculatePermeateQuality(...),
    stages: calculateStageResults(...),
    // ... all results
  };
};
```

---

## **State Management - Hooks**

### **Current Problem:**
All state in App.js (73.86 KB)

### **New Solution:**

**File:** `src/hooks/useSystemConfig.js`

```javascript
export function useSystemConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  
  const updateFeedFlow = useCallback((flow) => {
    setConfig(c => ({ ...c, feedFlow: flow }));
  }, []);
  
  const updateMembrane = useCallback((membraneId) => {
    setConfig(c => ({ ...c, membraneModel: membraneId }));
  }, []);
  
  const updateRecovery = useCallback((recovery) => {
    setConfig(c => ({ ...c, recovery }));
  }, []);
  
  return {
    config,
    updateFeedFlow,
    updateMembrane,
    updateRecovery,
    // ... all updates
  };
}
```

**File:** `src/hooks/useCalculations.js`

```javascript
export function useCalculations(config, waterData, membranes) {
  return useMemo(() => {
    return calculateSystemDesign({
      ...config,
      waterData,
      membranes
    });
  }, [config, waterData, membranes]);
}
```

---

## **Component Structure - Thin Components**

### **Current Problem:**
SystemDesign.js is 60.11 KB - too much logic

### **New Solution:**

**File:** `src/pages/DesignPage.js`

```javascript
export function DesignPage() {
  const config = useSystemConfig();
  const calculations = useCalculations(config.config, waterData, membranes);
  
  return (
    <div className="design-page">
      <SystemDesignSection 
        config={config}
        calculations={calculations}
      />
    </div>
  );
}
```

**File:** `src/sections/SystemDesignSection.js`

```javascript
export function SystemDesignSection({ config, calculations }) {
  return (
    <div className="system-design-section">
      <MembraneSelector 
        selected={config.config.membraneModel}
        onChange={config.updateMembrane}
      />
      <StageConfiguration
        config={config.config}
        onChange={config.updateStages}
      />
      <ResultsGrid
        calculations={calculations}
      />
    </div>
  );
}
```

---

## **Benefits of This Architecture**

| Aspect | Before | After |
|--------|--------|-------|
| **File Sizes** | App.js: 73KB, SystemDesign: 60KB | Each < 15KB |
| **Testability** | Hard - mixed concerns | Easy - pure functions |
| **Reusability** | Low - tightly coupled | High - modular |
| **Maintainability** | Hard - scattered logic | Easy - single responsibility |
| **Membrane Logic** | Scattered, hardcoded | Centralized, data-driven |
| **Calculations** | Multiple places | One engine |
| **State Management** | Monolithic | Organized by concern |

---

## **Migration Path**

### **Phase 1: Create Engines (Week 1)**
- [ ] Create `membraneEngine.js` with all membrane definitions
- [ ] Extract pure calculation functions to `calculationEngine.js`
- [ ] Create `waterTypeEngine.js` for water-type logic
- [ ] Create `stageCalculationEngine.js` for multi-stage logic

### **Phase 2: Create Hooks (Week 2)**
- [ ] Create `useSystemConfig.js`
- [ ] Create `useProjectState.js`
- [ ] Create `useCalculations.js`
- [ ] Create `useMembraneDatabase.js`

### **Phase 3: Create Service Layer (Week 2)**
- [ ] Refactor `calculationService.js` as orchestrator
- [ ] Create `membraneService.js`
- [ ] Create `designValidationService.js`
- [ ] Create `reportService.js`

### **Phase 4: Refactor Components (Week 3)**
- [ ] Create page components
- [ ] Create section components
- [ ] Create reusable components
- [ ] Update App.js to use hooks

### **Phase 5: Testing & Optimization (Week 4)**
- [ ] Add unit tests for engines
- [ ] Add integration tests
- [ ] Performance optimization
- [ ] Documentation

---

## **Key Principles**

1. **Separation of Concerns** - Each file has one job
2. **DRY (Don't Repeat Yourself)** - Logic in ONE place
3. **Pure Functions** - Testable, predictable calculations
4. **Single Responsibility** - Components handle UI only
5. **Data Flow** - One direction: Input → Calculate → Display
6. **Type Safety** - Models define data structure
7. **Membrane-Agnostic** - Add membranes without code changes

---

## **Example: Adding a New Membrane Type**

### **Old Way (Current):**
```javascript
// 1. Edit calculatorService.js - add to array
// 2. Edit App.js - update hardcoded logic
// 3. Edit SystemDesign.js - maybe add special handling
// 4. Edit components - might need changes
// 5. Test everything - fragile, easy to break
```

### **New Way (Proposed):**
```javascript
// 1. Edit membraneEngine.js - add one entry to MEMBRANE_PROPERTIES
// 2. Done! No other changes needed
// 3. All calculations, validation, UI use this data automatically
```

---

## **Technical Stack**

- **State:** React Hooks (useState, useCallback, useMemo)
- **Calculation:** Pure JavaScript functions
- **Validation:** Joi or Zod (optional)
- **Testing:** Jest + React Testing Library
- **Types:** JSDoc comments (no TypeScript needed)

---

## **File Organization Summary**

```
src/
├── engines/              # Pure calculation functions
├── hooks/               # Custom React hooks for state
├── services/            # Business logic & orchestration
├── models/              # Data structure definitions
├── pages/               # Full page components
├── sections/            # Feature sections
├── components/          # Reusable UI components
├── utils/               # Helper functions
├── constants/           # Constants (move from scattered)
└── App.js               # Root component (thin)
```

**Total:** ~45 files, each < 200 lines, clear responsibilities

---

## **Next Steps**

1. ✅ Approve this architecture
2. Create engines/ folder
3. Create membraneEngine.js with all membrane definitions
4. Create calculationEngine.js with pure functions
5. Create hooks/ folder with state management
6. Refactor components to use hooks
7. Test everything works
8. Document new patterns

