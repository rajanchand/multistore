import type { Config } from 'tailwindcss';
import preset from '../../packages/config/tailwind-preset.js';

const config: Config = {
  presets: [preset],
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
};

export default config;
