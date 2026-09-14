import type { Locale } from '@/lib/i18n/locale-context'

/**
 * Copy for the public landing page, kept out of the components so it can be
 * edited or translated without touching layout. Not routed through
 * lib/i18n/dictionary.ts: that dictionary serves the signed-in product, and
 * folding a marketing page's prose into it would roughly double its size.
 */

export interface LandingCopy {
  sections: { id: string; num: string; label: string }[]
  hero: {
    title: string[]
    blurb: string
    cta: string
    credibility: { bold: string; rest: string }[]
    scrollHint: string
  }
  why: {
    eyebrow: string
    /** One chapter per scroll step. `lead` is plain, `emphasis` is the italic phrase. */
    chapters: { title: string; lead: string; emphasis: string; caption: string; mode: string }[]
    axisLabel: string
    /** Vertical label beside the scroll-hint arrow on the pinned run. */
    scrollLabel: string
    /** Caption on the hub card at the centre of the radial beat. */
    hubLabel: string
    /** Closing statement: each line is a plain half and an accented half. */
    payoff: { muted: string; accent: string }[]
    schools: string[]
    contextPills: string[]
    reusedSchools: string[]
    mathTitle: string
    math: { bold: string; rest: string }[]
    chart: {
      yLabel: string
      xLabel: string
      /** Sits on the dashed line the three curves are measured against. */
      refLabel: string
      lines: { key: string; label: string; note: string }[]
    }
  }
  how: {
    eyebrow: string
    titleLead: string
    titleEmphasis: string
    blurb: string
    previewLabel: string
    whatHappens: string
    preview: {
      fileTypes: string
      counselorAsk: string
      steps: string[]
      done: string
      live: string
      confirmTitle: string
      confirmBody: string
      cancel: string
      confirm: string
      confirmNote: string
      imported: string
      importedTitle: string
      matched: string
      stateReady: string
      stateDrafting: string
      stateQueued: string
      yourVoice: string
      extensionLabel: string
      formRows: string[]
      chanceLabel: string
    }
    stages: { num: string; name: string; summary: string; detail: string; preview: string; url: string }[]
  }
  stories: {
    eyebrow: string
    title: string
    blurb: string
    items: { initials: string; name: string; role: string; quote: string }[]
    marqueeTitle: string
  }
  rewards: {
    eyebrow: string
    title: string
    blurb: string
    cards: { label: string; title: string; body: string; note: string }[]
    inviteLabel: string
    inviteFields: { name: string; code: string; link: string }
    cta: string
    ctaNote: string
  }
  faq: { eyebrow: string; title: string; items: { q: string; a: string }[] }
  footer: {
    about: string
    companyLabel: string
    company: string[]
    legalLabel: string
    legal: string[]
    disclaimerTitle: string
    disclaimer: string
    copyright: string
  }
}

const SCHOOL_CARDS = ['UGA', 'Brown', 'Rice', 'UCLA', 'Duke']

/**
 * Institution marks, keyed by every name the page uses for a school - the
 * short card label and the full marquee name both resolve to the same file.
 * The marks belong to the institutions; they appear here to identify them.
 * Anything without an entry falls back to a monogram tile.
 */
export const SCHOOL_LOGOS: Record<string, string> = {
  'Harvard University': '/logos/harvard.png',
  'Yale University': '/logos/yale.png',
  'Princeton University': '/logos/princeton.png',
  'Columbia University': '/logos/columbia.png',
  'University of Pennsylvania': '/logos/upenn.png',
  'Cornell University': '/logos/cornell.png',
  'Brown University': '/logos/brown.png',
  Brown: '/logos/brown.png',
  'Dartmouth College': '/logos/dartmouth.png',
  'Stanford University': '/logos/stanford.png',
  Stanford: '/logos/stanford.png',
  MIT: '/logos/mit.png',
  'University of Chicago': '/logos/uchicago.png',
  Caltech: '/logos/caltech.png',
  'Duke University': '/logos/duke.png',
  Duke: '/logos/duke.png',
  'Johns Hopkins': '/logos/jhu.png',
  Northwestern: '/logos/northwestern.png',
  'Rice University': '/logos/rice.png',
  Rice: '/logos/rice.png',
  Vanderbilt: '/logos/vanderbilt.png',
  'Carnegie Mellon': '/logos/cmu.png',
  'Notre Dame': '/logos/notredame.png',
  'UC Berkeley': '/logos/berkeley.png',
  UCLA: '/logos/ucla.png',
  'UC San Diego': '/logos/ucsd.png',
  'UC Santa Barbara': '/logos/ucsb.png',
  'UC Irvine': '/logos/uci.png',
  'UC Davis': '/logos/ucdavis.png',
  'UC Santa Cruz': '/logos/ucsc.png',
  'Williams College': '/logos/williams.png',
  'Amherst College': '/logos/amherst.png',
  'University of Georgia': '/logos/uga.png',
  UGA: '/logos/uga.png',
}

const UNIVERSITIES = [
  'Harvard University', 'Yale University', 'Princeton University', 'Columbia University',
  'University of Pennsylvania', 'Cornell University', 'Brown University', 'Dartmouth College',
  'Stanford University', 'MIT', 'University of Chicago', 'Caltech', 'Duke University',
  'Johns Hopkins', 'Northwestern', 'Rice University', 'Vanderbilt', 'Carnegie Mellon',
  'Notre Dame', 'UC Berkeley', 'UCLA', 'UC San Diego', 'UC Santa Barbara', 'UC Irvine',
  'UC Davis', 'UC Santa Cruz', 'Williams College', 'Amherst College', 'University of Georgia',
]

const EN: LandingCopy = {
  sections: [
    { id: 'hero', num: '01', label: 'Get Started' },
    { id: 'why', num: '02', label: 'Why Us' },
    { id: 'how', num: '03', label: 'How It Works' },
    { id: 'stories', num: '04', label: 'Success Stories' },
    { id: 'rewards', num: '05', label: 'Rewards' },
    { id: 'faq', num: '06', label: 'FAQ' },
  ],
  hero: {
    title: ['U.S. College Applications,', 'Organized Start to Finish'],
    blurb:
      'Plan school lists, improve essays, track deadlines, forecast admissions chances, and prepare U.S. college application forms in one place.',
    cta: 'Get Started Free',
    credibility: [
      { bold: 'UGA AI Research Lab', rest: '6 researchers' },
      { bold: '6 senior advisors', rest: 'former admissions readers' },
      { bold: '120+ student testers', rest: 'Harvard, Princeton, Georgia Tech, etc.' },
    ],
    scrollHint: 'Scroll down',
  },
  why: {
    eyebrow: '02 — Why Us',
    chapters: [
      {
        title: 'Manual workflow',
        lead: 'One school',
        emphasis: 'starts from zero.',
        caption: 'Start over for every school',
        mode: 'single',
      },
      {
        title: 'Manual workflow',
        lead: 'Every new school',
        emphasis: 'starts over.',
        caption: 'Start over for every school',
        mode: 'manual',
      },
      {
        title: 'Other AI admissions products',
        lead: 'Faster tasks.',
        emphasis: 'Same restarts.',
        caption: 'A new AI session for every school',
        mode: 'otherAi',
      },
      {
        title: 'Application overload',
        lead: 'One application background',
        emphasis: 'connects everything.',
        caption: 'One reusable system',
        mode: 'hub',
      },
      {
        title: 'Aipply',
        lead: 'Your application background',
        emphasis: 'keeps being reused.',
        caption: 'Reach every school from the same context',
        mode: 'routes',
      },
      {
        title: 'Workload compared',
        lead: 'Same workload.',
        emphasis: 'More schools reached.',
        caption: 'Same work, more schools',
        mode: 'chart',
      },
      {
        title: 'Aipply',
        lead: 'Less repeated work.',
        emphasis: 'More chances.',
        caption: 'More schools. More chances.',
        mode: 'payoff',
      },
    ],
    axisLabel: 'Visualising the workload',
    scrollLabel: 'Keep scrolling',
    hubLabel: 'AIPPLY · Application context',
    payoff: [
      { muted: 'Less', accent: 'repeated work.' },
      { muted: 'More', accent: 'schools.' },
      { muted: 'More', accent: 'chances.' },
    ],
    schools: SCHOOL_CARDS,
    contextPills: ['Background', 'Activities', 'Writing', 'School Forms'],
    reusedSchools: ['UGA', 'Brown', 'Carnegie Mellon', 'UCLA', 'Duke', 'Stanford'],
    mathTitle: '10 applications actually mean:',
    math: [
      { bold: '11 application forms', rest: 'across 10 schools' },
      { bold: '15 essays', rest: 'plus 76 long-answer prompts' },
      { bold: '12+ hours minimum', rest: 'on form-filling alone — before drafting the essays' },
    ],
    chart: {
      yLabel: 'Total workload ↑',
      xLabel: 'Schools applied to →',
      refLabel: 'The same workload',
      lines: [
        { key: 'manual', label: 'Manual', note: 'Work keeps adding' },
        { key: 'otherAi', label: 'Other AI products', note: 'Still starts over' },
        { key: 'aipply', label: 'Aipply', note: 'Same workload' },
      ],
    },
  },
  how: {
    eyebrow: '03 — How It Works',
    titleLead: 'Five stages,',
    titleEmphasis: 'one application.',
    blurb:
      'Everything in the U.S. college application process — profile, guidance, school list, essays, forecasts, deadlines, and forms — stays connected in one place.',
    previewLabel: 'Live preview',
    whatHappens: "What's happening here",
    preview: {
      fileTypes: 'PDF · DOCX · TXT · MD · PNG · JPG — validated as they arrive.',
      counselorAsk: 'Add Cornell as a reach school and use it when you refresh my forecast.',
      steps: ['Check school catalog', 'Read current school list', 'Prepare confirm card'],
      done: 'done',
      live: 'live',
      confirmTitle: 'Add to your list',
      confirmBody: 'Add Cornell University as a reach school',
      cancel: 'Cancel',
      confirm: 'Confirm',
      confirmNote: 'Write actions stay visible and confirm-gated.',
      imported: 'Imported · 648 words',
      importedTitle: 'Common App Personal Statement',
      matched: '2 sources → 14 school prompts matched',
      stateReady: 'Ready',
      stateDrafting: 'Drafting',
      stateQueued: 'Queued',
      yourVoice: 'Your voice',
      extensionLabel: 'Chrome extension · live on Common App',
      formRows: ['Personal Information', 'Education', 'Activities', 'Honors'],
      chanceLabel: 'Chance of ≥1 offer',
    },
    stages: [
      {
        num: '01',
        name: 'Profile',
        summary: 'Drop in transcripts, scores, and any of your materials.',
        detail:
          'Drop in transcripts, scores, and any of your materials. Aipply extracts the student record, flags what needs review, and keeps the profile editable before anything downstream uses it.',
        preview: 'documents',
        url: 'aipply / build-profile',
      },
      {
        num: '02',
        name: 'AI Counselor',
        summary: 'Ask your AI counselor team to prepare real changes.',
        detail:
          'Your AI counselor team can use built-in skills to update the product surface: add a college, change profile details, save an essay draft, or start a form. It prepares a confirm card first, then writes only after you approve.',
        preview: 'counselor',
        url: 'aipply / counselor',
      },
      {
        num: '03',
        name: 'Schools & Applications',
        summary: 'Build a balanced list and start each application.',
        detail:
          'Build a Reach / Target / Safety portfolio, draft school-specific answers from your saved context, and keep forms synced with the dashboard instead of reconciling each school by hand.',
        preview: 'forms',
        url: 'aipply / submit',
      },
      {
        num: '04',
        name: 'Writing',
        summary: "Turn a few drafts into every school's essays.",
        detail:
          'Import what you already wrote, or pull it from counselor work. Writing Reuse expands those sources across your school list — each draft in your voice, not a template.',
        preview: 'writing',
        url: 'aipply / writing',
      },
      {
        num: '05',
        name: 'Forecast & Submit',
        summary: 'Review your admission chances at each school before you submit.',
        detail:
          'Forecasts respond when profile, school list, essays, or materials change. Review the signal shifts, finish the missing pieces, then move to submission with fewer blind spots.',
        preview: 'forecast',
        url: 'aipply / admission-forecast',
      },
    ],
  },
  stories: {
    eyebrow: '04 — Success Stories',
    title: 'What Families and Students Say',
    blurb:
      'Perspectives from students, parents, and counselors using Aipply to make applications clearer and more manageable.',
    items: [
      {
        initials: 'HP',
        name: 'Parent of Harvard and Princeton Children',
        role: 'Senior College Counselor',
        quote:
          'We tried the app after a friend recommended it to us. Our oldest child attended Harvard University, and our middle child attended Princeton University. When I entered their academic profiles into the app, it correctly identified both schools as strong matches. The estimated admission probabilities also seemed quite realistic — about 85% for our oldest child and 60% for our middle child. Based on this experience, I believe we will use the app for our youngest child when she reaches 12th grade in two years.',
      },
      {
        initials: 'JL',
        name: 'Jasmine L.',
        role: 'Harvard University',
        quote:
          'The personalized AI counselor was amazing for brainstorming new ideas on how to expand the clubs I have created and for improving my application essays.',
      },
      {
        initials: 'MP',
        name: 'An MIT Parent',
        role: 'MIT Parent',
        quote:
          'This app features an excellent college data repository. A few years ago, my daughter spent a great deal of time preparing her application materials for MIT. Had she had access to this app, it would have saved her a tremendous amount of time and effort. Highly recommended!',
      },
      {
        initials: 'RX',
        name: 'Ryan Xiao',
        role: 'Georgia Tech',
        quote:
          'Aipply is the perfect tool to streamline anyone’s college application experience. As a student who has applied to many colleges, I know college application season is one of the most stressful parts of a high schooler’s career. However, Aipply is able to turn this stressful process into something much more manageable and efficient. My favorite tool is their autofill feature, which allows me to add information about myself and have it autogenerate into the ocean of differing profile questions. Additionally, the AI counselors provide lots of crucial help with college application decisions and essay writing.',
      },
    ],
    marqueeTitle: 'Trusted by students admitted to 1,000+ top universities',
  },
  rewards: {
    eyebrow: '05 — Rewards',
    title: 'Try free, then get rewarded for staying.',
    blurb:
      'A free trial that is actually free, plus benefits that compound the longer you and your friends keep building applications here.',
    cards: [
      {
        label: 'Free start',
        title: '7 days, every tool, free.',
        body:
          'Try everything — AI counselor, school matching, essay workshop, document manager. No credit card. Cancel any time before day 8.',
        note: 'Most students reach a first essay draft in their first session.',
      },
      {
        label: 'Refer a friend',
        title: 'Bring a friend, both win.',
        body:
          'When a friend signs up with your code, you both get an extra month free. No cap — refer five, get five.',
        note: 'Stackable with the free trial. Compounds the longer you stay.',
      },
      {
        label: 'Ambassador',
        title: 'Bring your whole school.',
        body:
          'Run a study group, club, or counseling program? Earn revenue share plus premium access for your members.',
        note: 'Two-week setup with a real human partner. Open to any school.',
      },
      {
        label: 'Share kit',
        title: 'Easily shareable.',
        body:
          'A printable invite card with your code, link, and personal QR — built to land well in group chats, on dorm corkboards, and on parents’ fridges.',
        note: 'One-tap copy for code or link from any device.',
      },
    ],
    inviteLabel: 'Aipply · Invite',
    inviteFields: { name: 'Name', code: 'Code', link: 'Link' },
    cta: 'Get Started — 7 Days Free',
    ctaNote: 'No credit card required.',
  },
  faq: {
    eyebrow: '06 — FAQ',
    title: 'Frequently Asked Questions',
    items: [
      {
        q: 'What is Aipply?',
        a: 'Aipply is an AI-powered admissions workspace that keeps your profile, school list, essays, forecasts, and application forms connected, so work you do once carries across every school you apply to.',
      },
      {
        q: 'Is Aipply only an AI counselor?',
        a: 'No. The AI counselor team is one part of it. Aipply also builds your school list, expands your existing essays across school prompts, forecasts admission chances, and prepares application forms.',
      },
      {
        q: 'Can Aipply help with college essays?',
        a: 'It helps you reuse and adapt what you have already written, and coaches you on structure and specificity. It will not write an application essay from nothing for you — your essays have to stay yours.',
      },
      {
        q: 'Does Aipply help with Common App and college forms?',
        a: 'Yes. Aipply prepares answers from your saved profile, and a Chrome extension fills supported portals from that data. You review and submit every form yourself.',
      },
      {
        q: 'Who is Aipply for right now?',
        a: 'High-school students applying to U.S. universities, and the parents and counselors supporting them.',
      },
    ],
  },
  footer: {
    about:
      'Your personal AI-powered admissions counselor to manage every aspect of your college application.',
    companyLabel: 'Company',
    company: ['About us', 'Expert Network', 'Ambassador Program'],
    legalLabel: 'Legal',
    legal: ['User Agreement', 'Privacy policy', 'Copyright / DMCA Policy', 'Cookie notice', 'AI ethics policies'],
    disclaimerTitle: 'Disclaimers & Attributions',
    disclaimer:
      'Aipply, including its websites, browser extensions, applications, and other affiliated or associated services and properties, is an independent product and is not affiliated with, endorsed by, or sponsored by any college, university, application platform, testing organization, or other institution or third party referenced on, accessible through, or interacted with by the service. All names, seals, logos, and trademarks of any institution, application platform, testing organization, or other third party are the property of their respective owners and are used solely to identify the entity to which factual information or other content refers; their use does not imply any endorsement or relationship.',
    copyright: '© 2026 Aipply. All rights reserved.',
  },
}

const ZH: LandingCopy = {
  sections: [
    { id: 'hero', num: '01', label: '开始使用' },
    { id: 'why', num: '02', label: '为什么选择我们' },
    { id: 'how', num: '03', label: '如何运作' },
    { id: 'stories', num: '04', label: '成功案例' },
    { id: 'rewards', num: '05', label: '奖励' },
    { id: 'faq', num: '06', label: '常见问题' },
  ],
  hero: {
    title: ['美本申请，', '从规划到提交一站式管理'],
    blurb: '美本选校列表、文书修改、截止日期、录取预测和申请表格，都在同一个地方完成和管理。',
    cta: '免费开始使用',
    credibility: [
      { bold: 'UGA AI Research Lab', rest: '6 位研究人员' },
      { bold: '6 位资深顾问', rest: '前招生材料审阅人' },
      { bold: '120+ 名学生测试者', rest: 'Harvard、Princeton、Georgia Tech 等' },
    ],
    scrollHint: '继续向下滚动',
  },
  why: {
    eyebrow: '02 — 为什么选择我们',
    chapters: [
      { title: '手动申请流程', lead: '一所学校', emphasis: '从零开始。', caption: '每所学校都从头再来', mode: 'single' },
      { title: '手动申请流程', lead: '每增加一所学校', emphasis: '都要重新开始。', caption: '每所学校都从头再来', mode: 'manual' },
      { title: '其他 AI 申请产品', lead: '单项任务更快。', emphasis: '冷启动没有减少。', caption: '每所学校都要开启新的 AI 会话', mode: 'otherAi' },
      { title: '申请管理过载', lead: '一套申请背景', emphasis: '把一切连接起来。', caption: '一套可复用的系统', mode: 'hub' },
      { title: 'Aipply', lead: '你的申请背景', emphasis: '持续复用。', caption: '用同一套背景覆盖每一所学校', mode: 'routes' },
      { title: '工作量对比', lead: '同样的工作量。', emphasis: '覆盖更多学校。', caption: '同样的工作量，更多学校', mode: 'chart' },
      { title: 'Aipply', lead: '更少重复工作。', emphasis: '更多机会。', caption: '更多学校。更多机会。', mode: 'payoff' },
    ],
    axisLabel: '可视化工作量',
    scrollLabel: '继续向下滚动',
    hubLabel: 'AIPPLY · 申请背景',
    payoff: [
      { muted: '更少', accent: '重复工作。' },
      { muted: '更多', accent: '学校。' },
      { muted: '更多', accent: '机会。' },
    ],
    schools: SCHOOL_CARDS,
    contextPills: ['个人背景', '活动经历', '文书', '申请表格'],
    reusedSchools: ['UGA', 'Brown', 'Carnegie Mellon', 'UCLA', 'Duke', 'Stanford'],
    mathTitle: '申请 10 所学校实际意味着：',
    math: [
      { bold: '11 份申请表', rest: '覆盖 10 所学校' },
      { bold: '15 篇文书', rest: '另有 76 道需要动笔写的长回答题' },
      { bold: '至少 12 小时', rest: '仅用于重复填表；还未计算构思和写作文书的时间' },
    ],
    chart: {
      yLabel: '总工作量 ↑',
      xLabel: '已申请学校数 →',
      refLabel: '同样的工作量',
      lines: [
        { key: 'manual', label: '手动流程', note: '工作不断累积' },
        { key: 'otherAi', label: '其他 AI 产品', note: '仍要重新开始' },
        { key: 'aipply', label: 'Aipply', note: '同样的工作量' },
      ],
    },
  },
  how: {
    eyebrow: '03 — 如何运作',
    titleLead: '五个阶段，',
    titleEmphasis: '完成一份申请。',
    blurb:
      '从档案、申请指导、选校列表、文书、预测、截止日期到表格，整个美本申请流程都连接在同一个地方。',
    previewLabel: '实时预览',
    whatHappens: '这里会发生什么',
    preview: {
      fileTypes: 'PDF · DOCX · TXT · MD · PNG · JPG —— 上传时即时校验。',
      counselorAsk: '把 Cornell 添加为冲刺学校，并在刷新我的预测时使用它。',
      steps: ['检查学校目录', '读取当前学校列表', '准备确认卡片'],
      done: '完成',
      live: '进行中',
      confirmTitle: '添加到你的列表',
      confirmBody: '将 Cornell University 添加为冲刺学校',
      cancel: '取消',
      confirm: '确认',
      confirmNote: '写入动作始终可见，并需要确认。',
      imported: '导入 · 648 词',
      importedTitle: 'Common App 个人陈述',
      matched: '2 篇原文 → 匹配到 14 道学校题目',
      stateReady: '已生成',
      stateDrafting: '生成中',
      stateQueued: '排队中',
      yourVoice: '你的声音',
      extensionLabel: 'Chrome 扩展 · 在 Common App 实时运行',
      formRows: ['个人信息', '教育经历', '活动', '荣誉'],
      chanceLabel: '获得至少 1 份录取通知的机会',
    },
    stages: [
      {
        num: '01',
        name: '档案',
        summary: '上传成绩单、分数和所有申请材料。',
        detail:
          '上传成绩单、分数和所有申请材料。Aipply 会提取学生记录，标记需要复核的内容，并在后续功能使用前让档案保持可编辑。',
        preview: 'documents',
        url: 'aipply / build-profile',
      },
      {
        num: '02',
        name: 'AI 顾问',
        summary: '让你的 AI 顾问团队准备真实可执行的修改。',
        detail:
          '你的 AI 顾问团队可以使用内置技能更新产品中的内容：添加大学、修改档案信息、保存文书草稿或启动表单。它会先生成确认卡片，只有你批准后才会写入。',
        preview: 'counselor',
        url: 'aipply / counselor',
      },
      {
        num: '03',
        name: '学校与申请',
        summary: '建立均衡选校列表，并启动每一份申请。',
        detail:
          '建立冲刺 / 匹配 / 保底组合，根据你保存的背景起草各校专属回答，并让表单与仪表盘保持同步，不必逐校手动核对。',
        preview: 'forms',
        url: 'aipply / submit',
      },
      {
        num: '04',
        name: '写作',
        summary: '用少量已有文书，扩成每所学校的文章。',
        detail:
          '导入你已经写好的内容，或从顾问对话里带出来。文书复用会把这些原文扩成选校列表上的其余题目——每篇都是你自己的声音，不是模板。',
        preview: 'writing',
        url: 'aipply / writing',
      },
      {
        num: '05',
        name: '预测与提交',
        summary: '提交前先查看每所学校的录取机会。',
        detail:
          '当档案、选校列表、文书或材料发生变化时，录取预测会随之更新。先查看信号变化，补齐缺失内容，再减少盲点地进入提交阶段。',
        preview: 'forecast',
        url: 'aipply / admission-forecast',
      },
    ],
  },
  stories: {
    eyebrow: '04 — 成功案例',
    title: '家庭和学生怎么评价',
    blurb: '来自学生、家长和顾问的真实视角：他们正在用 Aipply 让申请更清晰、更可控。',
    items: [
      {
        initials: 'HP',
        name: 'Harvard 和 Princeton 学生的家长',
        role: '资深大学申请顾问',
        quote:
          '朋友推荐后，我们试用了这个应用。我的大女儿就读于 Harvard University，二女儿就读于 Princeton University。当我把她们的学术背景输入应用后，它正确地把两所学校都识别为强匹配。估算的录取概率也相当真实：大女儿约 85%，二女儿约 60%。基于这次体验，我相信等小女儿两年后进入 12 年级时，我们也会使用这个应用。',
      },
      {
        initials: 'JL',
        name: 'Jasmine L.',
        role: 'Harvard University',
        quote: '个性化 AI 顾问在帮我构思如何拓展自己创办的社团，以及改进申请文书方面非常有帮助。',
      },
      {
        initials: 'MP',
        name: '一位 MIT 家长',
        role: 'MIT 家长',
        quote:
          '这个应用拥有非常出色的大学数据资料库。几年前，我女儿为了申请 MIT 花了大量时间准备材料。如果当时能用上这个应用，会节省她大量时间和精力。强烈推荐！',
      },
      {
        initials: 'RX',
        name: 'Ryan Xiao',
        role: 'Georgia Tech',
        quote:
          'Aipply 是简化大学申请体验的理想工具。作为申请过很多大学的学生，我知道大学申请季是高中生涯中压力最大的阶段之一。但 Aipply 能把这个充满压力的过程变得更可管理、更高效。我最喜欢的是自动填写功能，它让我添加自己的信息，并自动生成到各种不同的档案问题里，从而高效完成大学申请。AI 顾问也在选校决策和文书写作方面提供了很多关键帮助。',
      },
    ],
    marqueeTitle: '受到已被 1,000+ 所顶尖大学录取学生的信任',
  },
  rewards: {
    eyebrow: '05 — 奖励',
    title: '先免费试用，再因持续使用获得奖励。',
    blurb: '真正免费的试用，加上会随着你和朋友持续完成申请而叠加的权益。',
    cards: [
      {
        label: '免费开始',
        title: '7 天，所有工具，免费使用。',
        body:
          '试用全部功能：AI 顾问、选校匹配、文书工作坊、文件管理器。无需信用卡。第 8 天前可随时取消。',
        note: '大多数学生在第一次使用中就能完成第一版文书草稿。',
      },
      {
        label: '推荐朋友',
        title: '邀请朋友，双方都受益。',
        body: '当朋友使用你的邀请码注册时，你们双方都可额外获得 1 个月免费使用。不设上限：推荐 5 人，就获得 5 个月。',
        note: '可与免费试用叠加。使用越久，权益越多。',
      },
      {
        label: '校园大使',
        title: '把它带给你的整个学校。',
        body: '负责学习小组、社团或升学辅导项目？你可以获得收入分成，并为成员解锁高级权限。',
        note: '两周内完成启动，并有真人合作伙伴支持。面向所有学校开放。',
      },
      {
        label: '分享工具包',
        title: '轻松分享。',
        body:
          '一张可打印的邀请码卡片，包含你的代码、链接和个人二维码，适合发到群聊、贴在宿舍公告板，或放在家长的冰箱上。',
        note: '一键复制，可在任何设备上复制代码或链接。',
      },
    ],
    inviteLabel: 'Aipply · 邀请',
    inviteFields: { name: '姓名', code: '代码', link: '链接' },
    cta: '开始使用 — 免费 7 天',
    ctaNote: '无需信用卡。',
  },
  faq: {
    eyebrow: '06 — 常见问题',
    title: '常见问题',
    items: [
      {
        q: 'Aipply 是什么？',
        a: 'Aipply 是一个由 AI 驱动的申请工作台，把你的档案、选校列表、文书、录取预测和申请表格连接在一起，让你做过一次的工作能延续到每一所学校。',
      },
      {
        q: 'Aipply 只是 AI 顾问吗？',
        a: '不是。AI 顾问团队只是其中一部分。Aipply 还会帮你建立选校列表、把已有文书扩展到各校题目、预测录取概率，并准备申请表格。',
      },
      {
        q: 'Aipply 能帮助文书吗？',
        a: '它帮你复用和改写已经写好的内容，并在结构与细节上给出指导。它不会凭空替你写出一篇申请文书 —— 文书必须是你自己的。',
      },
      {
        q: 'Aipply 能帮助 Common App 和申请表格吗？',
        a: '可以。Aipply 会根据你保存的档案准备答案，Chrome 扩展会用这些数据填写支持的申请平台。每一份表格都由你本人复核并提交。',
      },
      {
        q: 'Aipply 目前适合谁使用？',
        a: '申请美国大学的高中生，以及支持他们的家长和升学顾问。',
      },
    ],
  },
  footer: {
    about: '您的专属 AI 招生顾问，轻松管理大学申请的每一个环节。',
    companyLabel: '公司',
    company: ['关于我们', '专家网络', '大使计划'],
    legalLabel: '法律',
    legal: ['用户协议', '隐私政策', '版权 / DMCA 政策', 'Cookie 提示', 'AI 伦理政策'],
    disclaimerTitle: '免责声明与归属说明',
    disclaimer:
      'Aipply，包括其网站、浏览器扩展、应用程序以及其他附属或相关服务和资产，是独立产品，与服务中提及、可访问或可交互的任何学院、大学、申请平台、考试机构、其他机构或第三方均不存在隶属、认可、背书或赞助关系。任何机构、申请平台、考试机构或其他第三方的所有名称、印章、标识和商标均归各自权利人所有，仅用于标识事实信息或其他内容所指向的实体；其使用不代表任何背书或合作关系。',
    copyright: '© 2026 Aipply. 保留所有权利。',
  },
}

export const LANDING_UNIVERSITIES = UNIVERSITIES

export function getLandingCopy(locale: Locale): LandingCopy {
  return locale === 'zh' ? ZH : EN
}
