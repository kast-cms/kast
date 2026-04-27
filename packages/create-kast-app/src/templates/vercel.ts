export const VERCEL_TEMPLATE = `{
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "outputDirectory": "apps/admin/.next",
  "ignoreCommand": "git diff HEAD^ HEAD --quiet .",
  "env": {
    "NEXT_PUBLIC_API_URL": "https://{{projectName}}-api.railway.app/api/v1"
  }
}
`;
