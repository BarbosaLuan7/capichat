/**
 * Design Tokens - W3C DTCG Format
 *
 * These tokens follow the W3C Design Token Community Group specification.
 * @see https://design-tokens.github.io/community-group/format/
 *
 * Token Structure:
 * - colors.json: Color primitives, semantic colors, and domain-specific colors
 * - spacing.json: Spacing scale and border radius
 * - typography.json: Font families, sizes, weights, line heights
 * - effects.json: Shadows, gradients, and animations
 *
 * Usage:
 * These tokens serve as the source of truth for the design system.
 * The CSS custom properties in index.css are derived from these tokens.
 *
 * To generate CSS from these tokens, you can use tools like:
 * - Style Dictionary (https://amzn.github.io/style-dictionary/)
 * - Tokens Studio (https://tokens.studio/)
 */

import colors from './colors.json';
import spacing from './spacing.json';
import typography from './typography.json';
import effects from './effects.json';

export { colors, spacing, typography, effects };

export type ColorToken = typeof colors;
export type SpacingToken = typeof spacing;
export type TypographyToken = typeof typography;
export type EffectsToken = typeof effects;

export interface DesignTokens {
  colors: ColorToken;
  spacing: SpacingToken;
  typography: TypographyToken;
  effects: EffectsToken;
}

const tokens: DesignTokens = {
  colors,
  spacing,
  typography,
  effects,
};

export default tokens;
