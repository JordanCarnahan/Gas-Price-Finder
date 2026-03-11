/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';
const appBackground = '#1f2937';
const cardBackground = '#111827';
const whiteText = '#ffffff';

export const Colors = {
  light: {
    text: whiteText,
    background: appBackground,
    tint: tintColorLight,
    icon: '#cbd5e1',
    tabIconDefault: '#94a3b8',
    tabIconSelected: tintColorLight,
    card: cardBackground,
    border: '#374151',
    notification: '#ef4444',
  },
  dark: {
    text: whiteText,
    background: appBackground,
    tint: tintColorDark,
    icon: '#cbd5e1',
    tabIconDefault: '#94a3b8',
    tabIconSelected: tintColorDark,
    card: cardBackground,
    border: '#374151',
    notification: '#ef4444',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
