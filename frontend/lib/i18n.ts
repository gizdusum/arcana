export type Lang = 'en' | 'tr'

export const translations = {
  en: {
    nav: {
      about: 'About',
      strategies: 'Strategies',
      howItWorks: 'How It Works',
      launchApp: 'Launch App',
    },
    hero: {
      badge: 'Arc Testnet · Live',
      title: 'The Hidden Intelligence of Arc',
      subtitle:
        'ARCANA is an autonomous AI trading agent that manages perpetual futures on your behalf — continuously, transparently, on-chain.',
      cta: 'Launch App',
      ctaSub: 'Get test USDC',
    },
    stats: {
      strategies: 'Strategies',
      network: 'Network',
      poweredBy: 'Powered by',
      vault: 'Vault Type',
    },
    features: {
      title: 'Three Strategies. One Vault.',
      subtitle: 'Choose your risk profile. ARCANA handles the rest.',
      apollo: {
        label: 'Conservative',
        desc: 'Long-only positions with tight risk controls. APOLLO protects before it hunts.',
      },
      atlas: {
        label: 'Balanced',
        desc: 'Long + short exposure across BTC and ETH. ATLAS holds the weight of every market.',
      },
      ares: {
        label: 'Aggressive',
        desc: 'Maximum leverage, both directions. ARES does not wait. ARES does not hesitate.',
      },
    },
    howItWorks: {
      title: 'How It Works',
      subtitle: 'From deposit to autonomous trading in four steps.',
      step1: { title: 'Connect Wallet', desc: 'Connect your wallet and get test USDC from the Circle faucet.' },
      step2: { title: 'Choose Strategy', desc: 'Select Apollo for safety, Atlas for balance, or Ares for maximum aggression.' },
      step3: { title: 'ARCANA Trades', desc: 'The AI agent executes perpetual futures positions 24/7 based on your strategy.' },
      step4: { title: 'Monitor & Withdraw', desc: 'Track real-time P&L, open positions, and withdraw your USDC anytime.' },
    },
    vision: {
      title: 'A New Paradigm in DeFi',
      body: 'ARCANA represents a convergence of artificial intelligence and decentralized finance — where autonomous agents execute with mathematical precision, operating without emotion or fatigue, on transparent infrastructure anyone can verify.',
      quoteAuthor: 'ARCANA · Manifesto',
    },
    footer: {
      tagline: 'Autonomous DeFi Trading Agent',
      network: 'Arc Testnet · 5042002',
      links: { app: 'App', vault: 'Vault', trade: 'Trade', strategy: 'Strategy', leaderboard: 'Leaderboard', log: 'Log' },
      faucet: 'Get test USDC',
      rights: '© 2025 ARCANA. Testnet only.',
    },
    terminal: {
      selectStrategy: 'Select a strategy to begin',
      hint1: 'try: "long ETH 100 USDC"',
      hint2: '"what\'s my balance?"',
      hint3: '"switch to ARES"',
      placeholder: 'Ask ARCANA anything...',
      placeholderInactive: 'Select a strategy above to begin',
      send: 'send ↵',
    },
  },
  tr: {
    nav: {
      about: 'Hakkında',
      strategies: 'Stratejiler',
      howItWorks: 'Nasıl Çalışır',
      launchApp: 'Uygulamayı Aç',
    },
    hero: {
      badge: 'Arc Testnet · Canlı',
      title: 'Arc\'ın Gizli Zekası',
      subtitle:
        'ARCANA, vadeli işlemleri sizin adınıza sürekli, şeffaf ve zincir üzerinde yöneten özerk bir yapay zeka ticaret ajanıdır.',
      cta: 'Uygulamayı Aç',
      ctaSub: 'Test USDC al',
    },
    stats: {
      strategies: 'Strateji',
      network: 'Ağ',
      poweredBy: 'Güç Kaynağı',
      vault: 'Vault Türü',
    },
    features: {
      title: 'Üç Strateji. Tek Vault.',
      subtitle: 'Risk profilinizi seçin. Gerisini ARCANA halleder.',
      apollo: {
        label: 'Muhafazakar',
        desc: 'Sıkı risk kontrolleriyle yalnızca long pozisyonlar. APOLLO avlanmadan önce korur.',
      },
      atlas: {
        label: 'Dengeli',
        desc: 'BTC ve ETH\'da long + short maruziyeti. ATLAS her piyasanın ağırlığını taşır.',
      },
      ares: {
        label: 'Agresif',
        desc: 'Maksimum kaldıraç, her iki yön. ARES beklemez. ARES tereddüt etmez.',
      },
    },
    howItWorks: {
      title: 'Nasıl Çalışır',
      subtitle: 'Yatırımdan özerk ticarete dört adımda.',
      step1: { title: 'Cüzdanı Bağla', desc: 'Cüzdanınızı bağlayın ve Circle faucet\'inden test USDC alın.' },
      step2: { title: 'Strateji Seç', desc: 'Güvenlik için Apollo, denge için Atlas veya maksimum agresiflik için Ares\'i seçin.' },
      step3: { title: 'ARCANA Ticareti Yapar', desc: 'Yapay zeka ajanı, stratejinize göre 24/7 vadeli işlem pozisyonları açar.' },
      step4: { title: 'Takip Et ve Çek', desc: 'Gerçek zamanlı K/Z\'yi, açık pozisyonları takip edin ve USDC\'nizi istediğiniz zaman çekin.' },
    },
    vision: {
      title: 'DeFi\'de Yeni Bir Paradigma',
      body: 'ARCANA, yapay zeka ile merkeziyetsiz finansın kesişim noktasını temsil eder — özerk ajanların matematiksel hassasiyetle, duygu ve yorgunluk olmaksızın, herkesin doğrulayabileceği şeffaf altyapı üzerinde çalıştığı bir dünya.',
      quoteAuthor: 'ARCANA · Manifesto',
    },
    footer: {
      tagline: 'Özerk DeFi Ticaret Ajanı',
      network: 'Arc Testnet · 5042002',
      links: { app: 'Uygulama', vault: 'Vault', trade: 'Ticaret', strategy: 'Strateji', leaderboard: 'Sıralama', log: 'Kayıt' },
      faucet: 'Test USDC al',
      rights: '© 2025 ARCANA. Yalnızca testnet.',
    },
    terminal: {
      selectStrategy: 'Başlamak için strateji seç',
      hint1: '"100 USDC ETH long aç"',
      hint2: '"bakiyem ne kadar?"',
      hint3: '"ARES\'e geç"',
      placeholder: 'ARCANA\'ya bir şey sor...',
      placeholderInactive: 'Başlamak için yukarıdan strateji seçin',
      send: 'gönder ↵',
    },
  },
} as const

export type T = typeof translations.en
