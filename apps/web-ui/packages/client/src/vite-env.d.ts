/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MODE: string;
  readonly VITE_EXPOSE_TEST_HOOKS?: string;
  readonly VITE_API_URL?: string;
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
