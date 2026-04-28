const config = {
  // TypeScript and TSX — lint + format
  '*.{ts,tsx}': ['eslint --fix --max-warnings 0 --no-warn-ignored', 'prettier --write'],

  // JSON, YAML, Markdown — format only
  '*.{json,yml,yaml,md}': ['prettier --write'],
};

export default config;
