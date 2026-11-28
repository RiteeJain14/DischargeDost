export interface DrugLookupResult {
  normalizedDrugs: string[];
  interactions: Array<{
    pair: string;
    severity: 'high' | 'moderate' | 'timing';
    clinicalMechanism: string;
    actionableGuidance: string;
  }>;
  timingNotes: Array<{
    drug: string;
    rule: string;
  }>;
}

export interface RedFlagEscalationResult {
  severity: 'stable' | 'caution' | 'red_flag';
  matchedTriggers: string[];
  escalationProtocol: string;
}

interface InteractionRule {
  drugA: string[];
  drugB: string[];
  pairLabel: string;
  severity: 'high' | 'moderate' | 'timing';
  mechanism: string;
  guidance: string;
}

const INTERACTION_RULES: InteractionRule[] = [
  {
    drugA: ['aspirin', 'ecosprin', 'acetylsalicylic'],
    drugB: ['ibuprofen', 'brufen', 'diclofenac', 'voveran', 'naproxen', 'aceclofenac', 'ketorolac', 'piroxicam'],
    pairLabel: 'Aspirin + NSAID Painkiller',
    severity: 'high',
    mechanism: 'Additive gastric mucosal injury and GI bleeding risk; ibuprofen can also competitively block aspirin antiplatelet cardioprotection.',
    guidance: 'Avoid combining OTC NSAIDs with low-dose aspirin. Confirm with your physician whether paracetamol is safer for pain.',
  },
  {
    drugA: ['clopidogrel', 'plavix', 'clopivas', 'deplatt'],
    drugB: ['omeprazole', 'omez', 'esomeprazole', 'nexpro'],
    pairLabel: 'Clopidogrel + Omeprazole/Esomeprazole',
    severity: 'high',
    mechanism: 'Strong CYP2C19 inhibition reduces conversion of clopidogrel to its active antiplatelet metabolite, raising stent thrombosis risk.',
    guidance: 'Ask your cardiologist immediately about switching to pantoprazole or famotidine if gastroprotection is needed.',
  },
  {
    drugA: ['clopidogrel', 'plavix', 'clopivas', 'deplatt'],
    drugB: ['pantoprazole', 'pan', 'pantocid', 'rabeprazole'],
    pairLabel: 'Clopidogrel + Pantoprazole (Monitor)',
    severity: 'moderate',
    mechanism: 'Pantoprazole is preferred over omeprazole with clopidogrel, though clinicians still periodically review dual-antiplatelet + PPI duration.',
    guidance: 'Take pantoprazole 30–45 minutes before breakfast; do not stop either medicine without your cardiologist approval.',
  },
  {
    drugA: ['aspirin', 'ecosprin', 'clopidogrel', 'prasugrel', 'ticagrelor'],
    drugB: ['warfarin', 'acitrom', 'rivaroxaban', 'apixaban', 'dabigatran'],
    pairLabel: 'Antiplatelet + Anticoagulant',
    severity: 'high',
    mechanism: 'Combined antiplatelet and anticoagulant therapy significantly increases major bleeding risk.',
    guidance: 'Watch closely for black tarry stools, nosebleeds, unusual bruising, or blood in urine and confirm exact duration with your doctor.',
  },
  {
    drugA: ['telmisartan', 'losartan', 'ramipril', 'enalapril', 'olmesartan'],
    drugB: ['spironolactone', 'aldactone', 'eplerenone', 'potassium'],
    pairLabel: 'ARB/ACEi + Potassium-Sparing Agent',
    severity: 'high',
    mechanism: 'Combined RAAS blockade and aldosterone antagonism can cause dangerous hyperkalemia and acute kidney injury.',
    guidance: 'Avoid potassium salt substitutes and ensure serum potassium and creatinine labs are checked on schedule.',
  },
  {
    drugA: ['telmisartan', 'losartan', 'ramipril', 'furosemide', 'lasix', 'torsemide'],
    drugB: ['ibuprofen', 'diclofenac', 'aceclofenac', 'naproxen', 'etoricoxib'],
    pairLabel: 'BP / Diuretic + NSAID',
    severity: 'high',
    mechanism: 'NSAIDs blunt antihypertensive/diuretic efficacy and increase risk of acute renal impairment ("triple whammy" when combined).',
    guidance: 'Do not take over-the-counter painkillers without checking with your treating physician.',
  },
  {
    drugA: ['metformin', 'glycomet', 'glucophage'],
    drugB: ['furosemide', 'lasix', 'torsemide'],
    pairLabel: 'Metformin + Loop Diuretic',
    severity: 'moderate',
    mechanism: 'Volume depletion or renal fluctuation from diuretics can raise metformin accumulation and lactic acidosis risk.',
    guidance: 'Stay adequately hydrated as permitted and report persistent vomiting, severe fatigue, or reduced urine output.',
  },
  {
    drugA: ['glimepiride', 'gliclazide', 'glipizide', 'insulin', 'mixtard', 'lantus', 'novorapid'],
    drugB: ['metformin', 'glycomet'],
    pairLabel: 'Dual Glucose-Lowering Therapy',
    severity: 'moderate',
    mechanism: 'Combined glucose-lowering therapy increases hypoglycemia risk if meals are delayed or reduced during recovery.',
    guidance: 'Never skip meals after taking glimepiride or insulin; keep glucose tablets or sugar handy for sweating/shakiness.',
  },
  {
    drugA: ['atorvastatin', 'rosuvastatin', 'simvastatin'],
    drugB: ['azithromycin', 'clarithromycin', 'erythromycin'],
    pairLabel: 'Statin + Macrolide Antibiotic',
    severity: 'moderate',
    mechanism: 'Macrolides can raise statin exposure and increase risk of muscle aches or myopathy.',
    guidance: 'Report unexplained muscle pain, tenderness, or dark tea-colored urine promptly.',
  },
  {
    drugA: ['levothyroxine', 'thyronorm', 'eltroxin'],
    drugB: ['calcium', 'shelcal', 'iron', 'ferrous', 'pantoprazole', 'omeprazole'],
    pairLabel: 'Levothyroxine + Calcium/Iron/PPI',
    severity: 'timing',
    mechanism: 'Polyvalent cations (calcium, iron) and raised gastric pH block levothyroxine absorption in the gut.',
    guidance: 'Take levothyroxine first thing on an empty stomach with plain water, and space calcium/iron supplements by at least 4 hours.',
  },
  {
    drugA: ['iron', 'ferrous', 'fericip', 'dexorange'],
    drugB: ['calcium', 'shelcal', 'milk', 'ciprofloxacin', 'levofloxacin'],
    pairLabel: 'Iron / Calcium / Fluoroquinolone Separation',
    severity: 'timing',
    mechanism: 'Calcium and dairy chelate iron and fluoroquinolone antibiotics, blocking absorption.',
    guidance: 'Separate iron, calcium, and fluoroquinolone doses by at least 2–4 hours.',
  },
];

const TIMING_RULES: Array<{ keywords: string[]; rule: string }> = [
  {
    keywords: ['pantoprazole', 'omeprazole', 'rabeprazole', 'esomeprazole', 'pan-d', 'pan '],
    rule: 'Take 30–45 minutes before breakfast on an empty stomach for optimal acid suppression.',
  },
  {
    keywords: ['levothyroxine', 'thyronorm', 'eltroxin'],
    rule: 'Take early morning on an empty stomach with plain water; wait 45–60 minutes before tea, coffee, or breakfast.',
  },
  {
    keywords: ['metformin', 'glycomet', 'glucophage'],
    rule: 'Take with or immediately after meals to minimize stomach upset, nausea, or loose stools.',
  },
  {
    keywords: ['glimepiride', 'gliclazide', 'amaryl'],
    rule: 'Take 15–30 minutes before a main meal and never skip eating afterward to avoid low blood sugar.',
  },
  {
    keywords: ['atorvastatin', 'rosuvastatin', 'simvastatin'],
    rule: 'Best taken consistently in the evening or at bedtime unless instructed otherwise.',
  },
  {
    keywords: ['furosemide', 'lasix', 'torsemide', 'dytor'],
    rule: 'Take in the morning or early afternoon to prevent nighttime urination disrupting sleep.',
  },
];

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').trim();
}

function matchesAny(medName: string, keywords: string[]): boolean {
  const norm = normalizeName(medName);
  return keywords.some((kw) => norm.includes(kw));
}

export function lookupDrugInteractions(medicineNames: string[]): DrugLookupResult {
  const cleaned = medicineNames
    .map((m) => String(m || '').trim())
    .filter((m) => m.length > 0)
    .slice(0, 25);

  const interactions: DrugLookupResult['interactions'] = [];
  const seenPairs = new Set<string>();

  for (let i = 0; i < cleaned.length; i++) {
    for (let j = i + 1; j < cleaned.length; j++) {
      const med1 = cleaned[i];
      const med2 = cleaned[j];

      for (const rule of INTERACTION_RULES) {
        const matchForward = matchesAny(med1, rule.drugA) && matchesAny(med2, rule.drugB);
        const matchReverse = matchesAny(med2, rule.drugA) && matchesAny(med1, rule.drugB);
        if (matchForward || matchReverse) {
          const key = `${rule.pairLabel}:${[med1, med2].sort().join('|')}`;
          if (!seenPairs.has(key)) {
            seenPairs.add(key);
            interactions.push({
              pair: `${med1} + ${med2}`,
              severity: rule.severity,
              clinicalMechanism: rule.mechanism,
              actionableGuidance: rule.guidance,
            });
          }
        }
      }
    }
  }

  // Detect duplicate therapeutic classes (e.g., two NSAIDs or two PPIs)
  const nsaids = cleaned.filter((m) =>
    matchesAny(m, ['ibuprofen', 'diclofenac', 'aceclofenac', 'naproxen', 'ketorolac', 'etoricoxib'])
  );
  if (nsaids.length > 1) {
    interactions.push({
      pair: nsaids.join(' + '),
      severity: 'high',
      clinicalMechanism: 'Duplicate NSAID analgesics compound GI ulceration and kidney injury risk without extra benefit.',
      actionableGuidance: 'Verify with your physician so only one anti-inflammatory agent is used if needed.',
    });
  }

  const timingNotes: DrugLookupResult['timingNotes'] = [];
  for (const med of cleaned) {
    for (const tRule of TIMING_RULES) {
      if (matchesAny(med, tRule.keywords)) {
        timingNotes.push({ drug: med, rule: tRule.rule });
        break;
      }
    }
  }

  return {
    normalizedDrugs: cleaned,
    interactions,
    timingNotes,
  };
}

const RED_FLAG_KEYWORDS: Array<{ label: string; patterns: string[] }> = [
  {
    label: 'Chest pain, pressure, or radiating arm/jaw discomfort',
    patterns: ['chest pain', 'chest tightness', 'angina', 'सीने में दर्द', 'छाती में दर्द', 'மார்பு வலி', 'বুকে ব্যথা'],
  },
  {
    label: 'Shortness of breath or difficulty breathing at rest',
    patterns: ['shortness of breath', 'breathless', 'difficulty breathing', 'dyspnea', 'सांस फूलना', 'साँस', 'மூச்சுத் திணறல்', 'শ্বাসকষ্ট'],
  },
  {
    label: 'Signs of internal bleeding (black stools, blood in vomit/urine)',
    patterns: ['black stool', 'melena', 'blood in vomit', 'vomiting blood', 'bleeding', 'coughing blood', 'काला मल', 'खून', 'রক্ত', 'ரத்தம்'],
  },
  {
    label: 'Sudden neurological deficit (slurred speech, weakness, confusion, fainting)',
    patterns: ['faint', 'passed out', 'unconscious', 'slurred speech', 'one side weak', 'confusion', 'चक्कर', 'बेहोश', 'மயக்கம்', 'অজ্ঞান'],
  },
  {
    label: 'High fever, chills, or spreading wound redness/pus',
    patterns: ['high fever', '102', '103', 'pus', 'wound oozing', 'chills', 'तेज बुखार', 'मवाद', 'அதிக காய்ச்சல்', 'তীব্র জ্বর'],
  },
  {
    label: 'Severe hypoglycemia signs (cold sweat, confusion, blood sugar < 70)',
    patterns: ['hypoglycemia', 'low sugar', 'sugar 50', 'sugar 60', 'cold sweat', 'shivering'],
  },
];

const CAUTION_KEYWORDS = [
  'mild dizziness',
  'dizzy',
  'nausea',
  'vomiting',
  'swelling',
  'ankle swelling',
  'missed dose',
  'skipped',
  'headache',
  'loose motion',
  'acidity',
  'stomach upset',
  'fatigue',
  'weakness',
  'चक्कर',
  'उल्टी',
  'सूजन',
  'தலைச்சுற்றல்',
  'வாந்தி',
  'মাথা ঘোরা',
  'বমি',
];

export function evaluateSymptomRedFlags(
  symptomText: string,
  dischargeRedFlags: string[],
): RedFlagEscalationResult {
  const lower = symptomText.toLowerCase();
  const matchedTriggers: string[] = [];

  for (const rf of RED_FLAG_KEYWORDS) {
    if (rf.patterns.some((p) => lower.includes(p.toLowerCase()))) {
      matchedTriggers.push(rf.label);
    }
  }

  // Also check overlap against patient-specific discharge red flags
  for (const customRf of dischargeRedFlags) {
    const words = customRf
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 5);
    const hits = words.filter((w) => lower.includes(w));
    if (hits.length >= 2 && !matchedTriggers.includes(customRf)) {
      matchedTriggers.push(customRf);
    }
  }

  if (matchedTriggers.length > 0) {
    return {
      severity: 'red_flag',
      matchedTriggers,
      escalationProtocol:
        'URGENT ESCALATION: Potential post-discharge red-flag symptoms detected. Contact the treating hospital emergency desk or call emergency medical services immediately. Do not wait for the next scheduled follow-up.',
    };
  }

  const hasCaution = CAUTION_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
  if (hasCaution) {
    return {
      severity: 'caution',
      matchedTriggers: ['Non-emergent symptom or missed dose reported'],
      escalationProtocol:
        'CLINICAL CAUTION: Monitor symptoms closely over the next 4–6 hours, check vital signs (BP/blood glucose if available), and call the hospital outpatient helpline today if symptoms persist or worsen.',
    };
  }

  return {
    severity: 'stable',
    matchedTriggers: [],
    escalationProtocol:
      'STABLE CHECK-IN: No acute red flags triggered. Continue prescribed medicines, hydration, and rest schedule as planned.',
  };
}
