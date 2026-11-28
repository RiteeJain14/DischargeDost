import type { LanguageCode } from '../types';

/**
 * Generates a realistic hospital discharge summary document as a crisp PNG image
 * on an offscreen HTML5 Canvas so users and reviewers can immediately test the
 * full multimodal Gemini Vision + Function Calling pipeline without needing a local file.
 */
export function renderSampleDischargeImage(): { dataUrl: string; base64: string; mimeType: string } {
  const canvas = document.createElement('canvas');
  canvas.width = 1100;
  canvas.height = 1420;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable.');
  }

  // Slight off-white scanned paper background
  ctx.fillStyle = '#fcfcfa';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle paper border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, canvas.width - 72, canvas.height - 72);

  // Header band
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 30px Georgia, serif';
  ctx.fillText('APOLLO SPECIALTY CARE HOSPITAL — BENGALURU', 68, 96);

  ctx.fillStyle = '#334155';
  ctx.font = '18px monospace';
  ctx.fillText('DISCHARGE SUMMARY  |  DEPT. OF CARDIOLOGY & INTERNAL MEDICINE', 68, 130);

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(68, 150);
  ctx.lineTo(1032, 150);
  ctx.stroke();

  const lines: Array<{ y: number; text: string; bold?: boolean; size?: number; color?: string }> = [
    { y: 190, text: 'Patient: Mr. Ramesh Verma (62 yrs / M)    DOA: 21-Nov-2026    DOD: 25-Nov-2026', bold: true, size: 19 },
    { y: 222, text: 'IP No: BLR-88412-C    Consultant: Dr. A. Nair (MD, DM Cardiology)', size: 18 },
    { y: 270, text: 'FINAL DIAGNOSIS:', bold: true, size: 20, color: '#0f172a' },
    { y: 300, text: '1. Non-ST Elevation Myocardial Infarction (NSTEMI) - S/P PTCA + DES to LAD (22-Nov-2026)', size: 18 },
    { y: 328, text: '2. Type 2 Diabetes Mellitus & Essential Hypertension (Stable at discharge)', size: 18 },
    { y: 376, text: 'HOSPITAL COURSE SUMMARY:', bold: true, size: 20, color: '#0f172a' },
    { y: 406, text: 'Admitted with exertional chest discomfort. Coronary angiogram showed 90% proximal LAD lesion;', size: 17 },
    { y: 432, text: 'successful drug-eluting stent placed. Post-procedure vitals stable (BP 126/78 mmHg, HR 72/min).', size: 17 },
    { y: 458, text: 'Right radial puncture site clean and dry. Discharged home on dual antiplatelet therapy.', size: 17 },
    { y: 508, text: 'DISCHARGE MEDICATIONS (TAKE REGULARLY):', bold: true, size: 20, color: '#0f172a' },
    { y: 544, text: '1. Tab. Aspirin (Ecosprin) 75 mg       — 1 tab OD after breakfast (Continue lifelong)', size: 18, bold: true },
    { y: 578, text: '2. Tab. Clopidogrel (Clopivas) 75 mg   — 1 tab OD after breakfast (Minimum 12 months)', size: 18, bold: true },
    { y: 612, text: '3. Tab. Pantoprazole 40 mg             — 1 tab OD 30 mins BEFORE breakfast (Empty stomach)', size: 18 },
    { y: 646, text: '4. Tab. Atorvastatin 40 mg             — 1 tab HS at bedtime', size: 18 },
    { y: 680, text: '5. Tab. Metformin 500 mg SR            — 1 tab BD (Morning & Night AFTER meals)', size: 18 },
    { y: 714, text: '6. Tab. Ibuprofen 400 mg               — 1 tab SOS for severe body/joint pain (added at clinic)', size: 18 },
    { y: 768, text: 'DIET & LIFESTYLE ADVICE:', bold: true, size: 20, color: '#0f172a' },
    { y: 798, text: '• Low-salt (<4g/day), low-oil heart-healthy home diet; avoid fried food, pickles, papad, sweets.', size: 17 },
    { y: 826, text: '• Adequate plain water (1.5 - 2 L/day). No smoking or alcohol.', size: 17 },
    { y: 854, text: '• Avoid lifting >3 kg with right arm for 7 days. Short 10-min indoor walks after Day 3.', size: 17 },
    { y: 904, text: 'WHEN TO RETURN TO EMERGENCY IMMEDIATELY (RED FLAGS):', bold: true, size: 20, color: '#991b1b' },
    { y: 936, text: '• Any chest pain, tightness, jaw/arm discomfort, or shortness of breath.', size: 18, color: '#7f1d1d' },
    { y: 966, text: '• Black tarry stools, blood in vomit/urine, or bleeding from gums/radial site.', size: 18, color: '#7f1d1d' },
    { y: 996, text: '• Sudden dizziness, fainting, cold sweats, or fever > 101°F.', size: 18, color: '#7f1d1d' },
    { y: 1050, text: 'FOLLOW-UP APPOINTMENTS:', bold: true, size: 20, color: '#0f172a' },
    { y: 1082, text: '• Cardiology OPD Review with Dr. A. Nair on 03-Dec-2026 at 10:30 AM (Bring ECG & Fasting Lipid/HbA1c).', size: 17 },
    { y: 1110, text: '• Right wrist dressing check at Day 5.', size: 17 },
  ];

  for (const line of lines) {
    ctx.fillStyle = line.color ?? '#1e293b';
    ctx.font = `${line.bold ? 'bold ' : ''}${line.size ?? 18}px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText(line.text, 68, line.y);
  }

  // Stamp signature area at bottom
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(720, 1210, 290, 110);
  ctx.fillStyle = '#0f766e';
  ctx.font = 'bold 16px monospace';
  ctx.fillText('SIGNED ELECTRONICALLY', 745, 1248);
  ctx.fillStyle = '#334155';
  ctx.font = '15px Arial, sans-serif';
  ctx.fillText('Dr. A. Nair, MD DM', 745, 1278);
  ctx.fillText('Reg No: KMC-49201', 745, 1302);

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1] ?? '';
  return { dataUrl, base64, mimeType: 'image/png' };
}

export const SAMPLE_CHECKIN_PRESETS_BY_LANG: Record<
  LanguageCode,
  Array<{ label: string; text: string }>
> = {
  en: [
    {
      label: 'Doing well, mild tiredness',
      text: 'Took my morning Aspirin, Clopidogrel, and Pantoprazole on time. Feeling slightly tired after walking, no chest pain or breathing trouble.',
    },
    {
      label: 'Caution: Mild dizziness & skipped dose',
      text: 'Feeling a little dizzy when standing up and I skipped my morning Metformin tablet because I ate very little breakfast.',
    },
    {
      label: 'Red Flag: Chest tightness & black stool',
      text: 'Having mild chest tightness since 1 hour and noticed black tarry stool this morning after taking painkiller.',
    },
  ],
  hi: [
    {
      label: 'ठीक महसूस कर रहे हैं, हल्की थकान',
      text: 'सुबह Aspirin, Clopidogrel और Pantoprazole समय पर ली। चलने के बाद हल्की थकान है, सीने में दर्द या सांस की तकलीफ नहीं है।',
    },
    {
      label: 'सावधानी: हल्का चक्कर और छूटी खुराक',
      text: 'खड़े होने पर हल्का चक्कर आ रहा है और कम नाश्ता करने के कारण सुबह की Metformin गोली छूट गई।',
    },
    {
      label: 'खतरे का संकेत: सीने में जकड़न और काला मल',
      text: '1 घंटे से सीने में हल्का दबाव महसूस हो रहा है और दर्द की दवा के बाद आज सुबह काला चिपचिपा मल दिखा।',
    },
  ],
  ta: [
    {
      label: 'நலமாக உள்ளேன், லேசான சோர்வு',
      text: 'காலை Aspirin, Clopidogrel, Pantoprazole சரியான நேரத்தில் எடுத்தேன். நடந்த பிறகு லேசான சோர்வு உள்ளது; நெஞ்சு வலி அல்லது மூச்சுத் திணறல் இல்லை.',
    },
    {
      label: 'கவனம்: லேசான தலைசுற்றல் & தவறிய மருந்து',
      text: 'எழுந்து நிற்கும்போது லேசாக தலை சுற்றுகிறது; காலை உணவு குறைவாக சாப்பிட்டதால் Metformin மாத்திரை எடுக்கவில்லை.',
    },
    {
      label: 'அபாயம்: நெஞ்சு இறுக்கம் & கருப்பு மலம்',
      text: '1 மணி நேரமாக நெஞ்சில் லேசான இறுக்கம் உள்ளது; வலி மாத்திரை எடுத்த பிறகு இன்று காலை கருப்பு நிற மலம் வந்தது.',
    },
  ],
  bn: [
    {
      label: 'ভালো আছি, হালকা ক্লান্তি',
      text: 'সকালে Aspirin, Clopidogrel এবং Pantoprazole সময়মতো খেয়েছি। হাঁটার পর হালকা ক্লান্তি লাগছে, বুকে ব্যথা বা শ্বাসকষ্ট নেই।',
    },
    {
      label: 'সতর্কতা: হালকা মাথা ঘোরা ও ডোজ বাদ পড়া',
      text: 'দাঁড়ালে একটু মাথা ঘুরছে এবং সকালে খুব কম নাস্তা করায় Metformin ট্যাবলেটটা খাওয়া হয়নি।',
    },
    {
      label: 'বিপদ সংকেত: বুকে চাপ ও কালো পায়খানা',
      text: 'গত ১ ঘণ্টা ধরে বুকে হালকা চাপ লাগছে এবং ব্যথার ওষুধ খাওয়ার পর আজ সকালে কালো রঙের পায়খানা হয়েছে।',
    },
  ],
};

export const SAMPLE_CHECKIN_PRESETS = SAMPLE_CHECKIN_PRESETS_BY_LANG.en;
