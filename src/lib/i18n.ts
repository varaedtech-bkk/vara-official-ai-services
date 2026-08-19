export type Lang = 'en' | 'th';

export const LANGS: Lang[] = ['en', 'th'];

export type Copy = {
  htmlLang: string;
  eyebrow: string;
  headline: string;
  headlineAccent: string;
  subhead: string;

  ctaStart: string;
  ctaConnecting: string;
  ctaEnd: string;
  ctaRetry: string;

  statusIdle: string;
  statusConnecting: string;
  statusListening: string;
  statusSpeaking: string;
  statusThinking: string;
  statusEnded: string;

  micHint: string;
  micDenied: string;
  statusMicBlocked: string;
  micDeniedHelp: string;
  notConfigured: string;
  notConfiguredHelp: string;
  connectionError: string;
  connectionErrorHelp: string;

  transcriptTitle: string;
  transcriptEmpty: string;
  you: string;
  assistant: string;

  tapToSpeak: string;

  muteOn: string;
  muteOff: string;
  captionsOn: string;
  captionsOff: string;

  typeInstead: string;
  typeInsteadHint: string;
  typePlaceholder: string;
  send: string;
  chatIntro: string;
  backToVoice: string;
  backToVoiceHint: string;
  chatTyping: string;

  leadTitle: string;
  leadSubtitle: string;
  leadName: string;
  leadOrg: string;
  leadEmail: string;
  leadPhone: string;
  leadInterest: string;
  leadMessage: string;
  leadSubmit: string;
  leadSending: string;
  leadSuccess: string;
  leadError: string;
  leadRequired: string;

  leadCapturedToast: string;

  capabilitiesTitle: string;
  capabilities: { title: string; body: string }[];

  contactTitle: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  addressLines: string[];

  footerTagline: string;
  footerRights: string;
  footerVisit: string;
  footerVisitShort: string;
  privacyNote: string;

  langLabel: string;
  switchNote: string;
};

const en: Copy = {
  htmlLang: 'en',
  eyebrow: 'VARA EdTech · Live AI Assistant',
  headline: 'Talk to',
  headlineAccent: 'Sunny',
  subhead:
    "Our AI assistant knows everything about VARA EdTech — our AI services, our VR and AR work, and how we partner with universities. Ask anything, out loud, right now.",

  ctaStart: 'Start talking',
  ctaConnecting: 'Connecting…',
  ctaEnd: 'End conversation',
  ctaRetry: 'Try again',

  statusIdle: 'Ready when you are',
  statusConnecting: 'Connecting',
  statusListening: 'Listening',
  statusSpeaking: 'Sunny is speaking',
  statusThinking: 'Thinking',
  statusEnded: 'Conversation ended',

  micHint: 'Your browser will ask for microphone access.',
  micDenied: 'Microphone blocked',
  statusMicBlocked: 'Microphone blocked',
  micDeniedHelp:
    'Allow microphone access for this site in your browser settings, then reload the page.',
  notConfigured: 'Voice assistant not configured',
  notConfiguredHelp:
    'The assistant keys are missing on the server, so the voice session cannot start.',
  connectionError: "Couldn't connect",
  connectionErrorHelp:
    'Check your internet connection and try again. If you are on conference wifi, a phone hotspot usually fixes it.',

  transcriptTitle: 'Live transcript',
  transcriptEmpty: 'The conversation will appear here as you speak.',
  you: 'You',
  assistant: 'Sunny',

  tapToSpeak: 'Tap the sphere to speak',

  muteOn: 'Mute microphone',
  muteOff: 'Unmute microphone',
  captionsOn: 'Hide transcript',
  captionsOff: 'Show transcript',

  typeInstead: 'Type a message',
  typeInsteadHint: 'Chat with Sunny if you’d rather not use the mic',
  typePlaceholder: 'Message Sunny…',
  send: 'Send',
  chatIntro:
    "Hi, I'm Sunny. Ask me anything about VARA EdTech — services, projects, university partnerships or pricing.",
  backToVoice: 'Talk with Sunny',
  backToVoiceHint: 'Switch back to voice',
  chatTyping: 'Sunny is typing…',

  leadTitle: 'Ask us to get in touch',
  leadSubtitle:
    'Leave your details and the team will contact you within 24 hours. Sunny can also take these for you during the conversation.',
  leadName: 'Your name',
  leadOrg: 'University / organisation',
  leadEmail: 'Email',
  leadPhone: 'Phone or WhatsApp',
  leadInterest: 'What are you interested in?',
  leadMessage: 'Anything else we should know?',
  leadSubmit: 'Send request',
  leadSending: 'Sending…',
  leadSuccess: "Thank you — we've received your request and will be in touch within 24 hours.",
  leadError: 'Something went wrong. Please email info@varaedtech.com or call +66 94 887 7955.',
  leadRequired: 'Please add your name and either an email or a phone number.',

  leadCapturedToast: 'Sunny saved your details for the team',

  capabilitiesTitle: 'What Sunny can talk about',
  capabilities: [
    {
      title: 'Our AI services',
      body: 'Answer Engine Optimization, voice assistants, chatbots, automation, analytics and custom private AI models — eleven services, most live within one to two weeks.',
    },
    {
      title: 'What we have already built',
      body: 'Four flagship platforms running today: a real-time AI engine, Estimaro, RedLine, and private AI models trained on your own content.',
    },
    {
      title: 'University partnerships',
      body: 'Nine campus ideas, AI workshops and faculty training, plus a pilot-first path that starts with one thing and proves it works.',
    },
    {
      title: 'Working with us',
      body: 'Timelines, indicative pricing, how a pilot runs, data privacy and PDPA, and how to get a free evaluation.',
    },
  ],

  contactTitle: 'Or reach us directly',
  contactEmail: 'info@varaedtech.com',
  contactPhone: '+66 94 887 7955',
  contactAddress: 'Head office',
  addressLines: [
    '5th Floor, Forum Tower',
    '184 Ratchadaphisek Rd, Huai Khwang',
    'Bangkok 10310, Thailand',
  ],

  footerTagline: 'Revolutionizing learning',
  footerRights: 'VARA EdTech Co., Ltd. All rights reserved.',
  footerVisit: 'Visit varaedtech.com',
  footerVisitShort: 'Visit site',
  privacyNote:
    'Conversations may be recorded so the team can follow up accurately. Please do not share passwords or payment details.',

  langLabel: 'Language',
  switchNote: 'Switching language will end the current conversation.',
};

const th: Copy = {
  htmlLang: 'th',
  eyebrow: 'VARA EdTech · ผู้ช่วย AI สนทนาสด',
  headline: 'คุยกับ',
  headlineAccent: 'Sunny',
  subhead:
    'ผู้ช่วย AI ของเรารู้ทุกเรื่องเกี่ยวกับ VARA EdTech ทั้งบริการด้าน AI งาน VR และ AR รวมถึงความร่วมมือกับมหาวิทยาลัย ถามได้เลยด้วยเสียง ตอนนี้',

  ctaStart: 'เริ่มสนทนา',
  ctaConnecting: 'กำลังเชื่อมต่อ…',
  ctaEnd: 'จบการสนทนา',
  ctaRetry: 'ลองอีกครั้ง',

  statusIdle: 'พร้อมแล้วครับ',
  statusConnecting: 'กำลังเชื่อมต่อ',
  statusListening: 'กำลังฟัง',
  statusSpeaking: 'Sunny กำลังพูด',
  statusThinking: 'กำลังคิด',
  statusEnded: 'จบการสนทนาแล้ว',

  micHint: 'เบราว์เซอร์จะขออนุญาตใช้ไมโครโฟน',
  micDenied: 'ไมโครโฟนถูกบล็อก',
  statusMicBlocked: 'ไมโครโฟนถูกบล็อก',
  micDeniedHelp:
    'กรุณาอนุญาตให้เว็บไซต์นี้ใช้ไมโครโฟนในการตั้งค่าเบราว์เซอร์ แล้วโหลดหน้าใหม่อีกครั้งครับ',
  notConfigured: 'ยังไม่ได้ตั้งค่าผู้ช่วยเสียง',
  notConfiguredHelp: 'ยังไม่ได้ใส่คีย์ผู้ช่วยบนเซิร์ฟเวอร์ จึงยังเริ่มสนทนาด้วยเสียงไม่ได้ครับ',
  connectionError: 'เชื่อมต่อไม่สำเร็จ',
  connectionErrorHelp:
    'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่อีกครั้ง หากใช้ wifi ของงานประชุม การเปลี่ยนไปใช้ฮอตสปอตจากมือถือมักช่วยได้ครับ',

  transcriptTitle: 'บทสนทนาสด',
  transcriptEmpty: 'บทสนทนาจะปรากฏที่นี่เมื่อเริ่มพูด',
  you: 'คุณ',
  assistant: 'Sunny',

  tapToSpeak: 'แตะทรงกลมเพื่อเริ่มพูด',

  muteOn: 'ปิดไมโครโฟน',
  muteOff: 'เปิดไมโครโฟน',
  captionsOn: 'ซ่อนบทสนทนา',
  captionsOff: 'แสดงบทสนทนา',

  typeInstead: 'พิมพ์ข้อความ',
  typeInsteadHint: 'คุยกับ Sunny ผ่านแชท ถ้าไม่สะดวกใช้ไมโครโฟน',
  typePlaceholder: 'พิมพ์ถึง Sunny…',
  send: 'ส่ง',
  chatIntro:
    'สวัสดีครับ ผม Sunny ถามได้ทุกเรื่องเกี่ยวกับ VARA EdTech ทั้งบริการ ผลงาน ความร่วมมือกับมหาวิทยาลัย หรือราคานะครับ',
  backToVoice: 'คุยด้วยเสียง',
  backToVoiceHint: 'กลับไปสนทนาด้วยเสียง',
  chatTyping: 'Sunny กำลังพิมพ์…',

  leadTitle: 'ให้เราติดต่อกลับ',
  leadSubtitle:
    'ฝากข้อมูลไว้ ทีมงานจะติดต่อกลับภายใน 24 ชั่วโมงครับ หรือจะให้ Sunny รับข้อมูลระหว่างสนทนาก็ได้',
  leadName: 'ชื่อของท่าน',
  leadOrg: 'มหาวิทยาลัย / องค์กร',
  leadEmail: 'อีเมล',
  leadPhone: 'เบอร์โทร หรือ WhatsApp',
  leadInterest: 'สนใจเรื่องใดครับ',
  leadMessage: 'มีรายละเอียดอื่นที่อยากแจ้งไหมครับ',
  leadSubmit: 'ส่งคำขอ',
  leadSending: 'กำลังส่ง…',
  leadSuccess: 'ขอบคุณครับ เราได้รับข้อมูลแล้ว ทีมงานจะติดต่อกลับภายใน 24 ชั่วโมงครับ',
  leadError: 'เกิดข้อผิดพลาด กรุณาอีเมลมาที่ info@varaedtech.com หรือโทร +66 94 887 7955 ครับ',
  leadRequired: 'กรุณากรอกชื่อ และอีเมลหรือเบอร์โทรอย่างน้อยหนึ่งอย่างครับ',

  leadCapturedToast: 'Sunny บันทึกข้อมูลของท่านให้ทีมงานแล้ว',

  capabilitiesTitle: 'Sunny คุยเรื่องอะไรได้บ้าง',
  capabilities: [
    {
      title: 'บริการด้าน AI',
      body: 'AEO ผู้ช่วยเสียง แชทบอท ระบบอัตโนมัติ การวิเคราะห์ธุรกิจ และโมเดล AI เฉพาะขององค์กร รวม 11 บริการ ส่วนใหญ่ใช้งานได้ภายใน 1-2 สัปดาห์',
    },
    {
      title: 'ผลงานที่สร้างไปแล้ว',
      body: 'แพลตฟอร์มหลัก 4 ตัวที่ใช้งานอยู่จริง ทั้ง Real-Time AI Engine, Estimaro, RedLine และโมเดล AI ส่วนตัวที่เทรนด้วยข้อมูลของท่านเอง',
    },
    {
      title: 'ความร่วมมือกับมหาวิทยาลัย',
      body: '9 ไอเดียสำหรับมหาวิทยาลัย เวิร์กช็อป AI และการอบรมอาจารย์ พร้อมแนวทางเริ่มจากโครงการนำร่องที่พิสูจน์ผลได้จริง',
    },
    {
      title: 'การทำงานร่วมกัน',
      body: 'ระยะเวลา กรอบราคา ขั้นตอนโครงการนำร่อง ความเป็นส่วนตัวและ PDPA รวมถึงการขอประเมินฟรี',
    },
  ],

  contactTitle: 'หรือติดต่อเราโดยตรง',
  contactEmail: 'info@varaedtech.com',
  contactPhone: '+66 94 887 7955',
  contactAddress: 'สำนักงานใหญ่',
  addressLines: [
    'ชั้น 5 อาคาร Forum Tower',
    'เลขที่ 184 ถนนรัชดาภิเษก แขวงห้วยขวาง',
    'เขตห้วยขวาง กรุงเทพมหานคร 10310',
  ],

  footerTagline: 'Revolutionizing learning',
  footerRights: 'บริษัท วรา เอดเทค จำกัด สงวนลิขสิทธิ์',
  footerVisit: 'เยี่ยมชม varaedtech.com',
  footerVisitShort: 'เว็บไซต์',
  privacyNote:
    'บทสนทนาอาจถูกบันทึกไว้เพื่อให้ทีมงานติดต่อกลับได้อย่างถูกต้อง กรุณาอย่าแจ้งรหัสผ่านหรือข้อมูลการชำระเงิน',

  langLabel: 'ภาษา',
  switchNote: 'การเปลี่ยนภาษาจะจบการสนทนาปัจจุบัน',
};

export const COPY: Record<Lang, Copy> = { en, th };

export const getCopy = (lang: Lang): Copy => COPY[lang] ?? COPY.en;
