export default {
  extends: ['stylelint-config-standard'],
  rules: {
    // css-tree bug: <cursor-predefined> syntax not recognized for values like `help`
    'declaration-property-value-no-unknown': null,
    'selector-pseudo-class-no-unknown': [
      true,
      { ignorePseudoClasses: ['deep', 'global', 'slotted'] },
    ],
  },
  overrides: [
    {
      files: ['**/*.vue'],
      customSyntax: 'postcss-html',
    },
  ],
}
