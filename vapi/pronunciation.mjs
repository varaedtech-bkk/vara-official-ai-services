/**
 * Thai Azure TTS reads Latin brand names as garbage (voritech, sanjiya).
 * Keep this list in sync with src/lib/voice-pronunciation.ts
 */

export const TH_SPOKEN_COMPANY = 'วา รา เอด เทค';
export const TH_SPOKEN_FOUNDER = 'ซัน เจ กู มาร์';
export const TH_SPOKEN_SUNNY = 'ซัน นี่';

export const TH_FIRST_MESSAGE = `สวัสดีครับ ผม ${TH_SPOKEN_SUNNY} จาก ${TH_SPOKEN_COMPANY} ครับ ให้ผมช่วยอะไรได้บ้างครับ`;

function exact(key, value) {
  return { type: 'exact', key, value, replaceAllEnabled: true };
}

export const TH_TTS_REPLACEMENTS = [
  exact('VARA EdTech Co., Ltd.', TH_SPOKEN_COMPANY),
  exact('VARA EdTech Co. Ltd.', TH_SPOKEN_COMPANY),
  exact('VARA EdTech Co Ltd', TH_SPOKEN_COMPANY),
  exact('VARA EdTech', TH_SPOKEN_COMPANY),
  exact('Vara EdTech', TH_SPOKEN_COMPANY),
  exact('Vara Ed Tech', TH_SPOKEN_COMPANY),
  exact('VARAEdTech', TH_SPOKEN_COMPANY),
  exact('voritech', TH_SPOKEN_COMPANY),
  exact('Voritech', TH_SPOKEN_COMPANY),
  exact('VoriTech', TH_SPOKEN_COMPANY),
  exact('vorite', TH_SPOKEN_COMPANY),
  exact('วาไรเต็ด', TH_SPOKEN_COMPANY),
  exact('วาไรเท่ห์', TH_SPOKEN_COMPANY),
  exact('วราเอทเทค', TH_SPOKEN_COMPANY),
  exact('วาราเอดเทค', TH_SPOKEN_COMPANY),
  exact('วารา เอดเทค', TH_SPOKEN_COMPANY),
  exact('วารา เอด เทค', TH_SPOKEN_COMPANY),
  exact('Sunjay Kumar', TH_SPOKEN_FOUNDER),
  exact('Sanjay Kumar', TH_SPOKEN_FOUNDER),
  exact('ซันเชียร์คง', TH_SPOKEN_FOUNDER),
  exact('เซนเจียคุม', TH_SPOKEN_FOUNDER),
  exact('ซันเชียร์', TH_SPOKEN_FOUNDER),
  exact('เซนเจีย', TH_SPOKEN_FOUNDER),
  exact('สันจิยา', TH_SPOKEN_FOUNDER),
  exact('ซันเจย์ กุมาร์', TH_SPOKEN_FOUNDER),
  exact('ซันเจย์', TH_SPOKEN_FOUNDER),
  exact('Sunjay', TH_SPOKEN_FOUNDER),
  exact('Sanjay', TH_SPOKEN_FOUNDER),
  exact('Sanjiya', TH_SPOKEN_FOUNDER),
  exact('EdTech', 'เอด เทค'),
  exact('Ed Tech', 'เอด เทค'),
  exact('Co., Ltd.', 'จำกัด'),
  exact('Co. Ltd.', 'จำกัด'),
  exact('Co Ltd', 'จำกัด'),
  exact('Sunny', TH_SPOKEN_SUNNY),
  exact('ซันนี่', TH_SPOKEN_SUNNY),
];

export const TH_VOICE_CHUNK_PLAN = {
  enabled: true,
  minCharacters: 20,
  formatPlan: {
    enabled: true,
    replacements: TH_TTS_REPLACEMENTS,
  },
};

export const TH_PRONUNCIATION_LOCK = [
  'คุณกำลังพูดผ่านระบบอ่านภาษาไทย คำอังกฤษจะถูกอ่านผิดทั้งหมด',
  `ชื่อบริษัทพูดได้แค่คำนี้: ${TH_SPOKEN_COMPANY}`,
  'ห้ามพูด voritech วาไรเต็ด วาฬ วอรา เอธิ หรือสะกด Co Ltd',
  `ผู้ก่อตั้งพูดได้แค่คำนี้: คุณ ${TH_SPOKEN_FOUNDER}`,
  'ห้ามพูด เซ็น ซันเชียร์ เซนเจีย สันจิยา ซันเย — ที่ถูกคือ ซัน เจ ตามด้วย กู มาร์',
  `ชื่อตัวเองพูดว่า ${TH_SPOKEN_SUNNY}`,
  `ถ้าถามชื่อบริษัท ให้ตอบว่า: ชื่อบริษัทคือ ${TH_SPOKEN_COMPANY} ครับ ไม่ใช่วาฬ`,
  `ถ้าถามชื่อเจ้าของ ให้ตอบว่า: ผู้ก่อตั้งและซีอีโอคือ คุณ ${TH_SPOKEN_FOUNDER} ครับ`,
  'ห้ามแต่งคำอ่านใหม่เมื่อผู้ฟังแก้ชื่อ ให้พูดประโยคเดิมช้าๆ อีกครั้ง',
].join('\n');
