import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  stories: ["../src/components/**/*.stories.tsx"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  staticDirs: [],
  async viteFinal(viteConfig) {
    return mergeConfig(viteConfig, {
      plugins: [react()],
      resolve: {
        alias: {
          ...viteConfig.resolve?.alias,
        },
      },
      root: path.join(configDir, ".."),
    });
  },
};

export default config;
