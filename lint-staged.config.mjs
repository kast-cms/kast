const config = {
  // TypeScript and TSX — lint + format
  // Exclude template/ from ESLint: those files have no node_modules/generated types
  '*.{ts,tsx}': (files) => {
    const lintFiles = files.filter((f) => !f.includes('/create-kast-app/template/'));
    const cmds = [`prettier --write ${files.join(' ')}`];
    if (lintFiles.length > 0) {
      cmds.unshift(`eslint --fix --max-warnings 0 --no-warn-ignored ${lintFiles.join(' ')}`);
    }
    return cmds;
  },

  // JSON, YAML, Markdown — format only
  '*.{json,yml,yaml,md}': ['prettier --write'],
};

export default config;
