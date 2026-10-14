export const BASE_URL = 'https://smailpro.com';
export const API_SONJJ_URL = 'https://api.sonjj.com/v1';
export const SITE_KEY = '0x4AAAAAAABIS_gEec2IwOhI';

// Legacy Fgsi endpoint defaults (kept for fallback)
export const DEFAULT_FGSI_API_KEY =
  process.env.FGSI_API_KEY || 'takashi0927192';

// CapSolver is the default solver. Set SOLVER_PROVIDER to switch.
export const SOLVER_PROVIDER = (process.env.SOLVER_PROVIDER || 'capsolver').toLowerCase();
export const CAPSOLVER_KEY = process.env.CAPSOLVER_KEY || '';
export const TWOCAPTCHA_KEY = process.env.TWOCAPTCHA_KEY || '';

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const DOMAINS = {
  google: ['gmail.com', 'googlemail.com'],
  microsoft: [
    'outlook.com',
    'hotmail.com',
    'outlook.kr',
    'outlook.fr',
    'outlook.com.vn',
    'outlook.co.id',
    'outlook.co.th',
    'outlook.com.ar',
    'outlook.co.il'
  ],
  edu: ['singapore.edu.pl', 'paris.edu.pl', 'france.edu.pl'],
  other: [
    'devpoet.com',
    'hastana.com',
    'fenfax.com',
    'jewby.com',
    'bogchi.com',
    'devmant.com',
    'appbott.com',
    'animoby.com',
    'fordemy.com',
    'meltcoo.com',
    'brajraj.org',
    'comproa.org',
    'damphen.org',
    'momroad.org',
    'bussaco.com',
    'storegmail.net'
  ]
};
