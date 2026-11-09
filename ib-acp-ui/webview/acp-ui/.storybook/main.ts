import type { StorybookConfig } from "@storybook/react-vite";
import type { Plugin } from "vite";
import { resolvePlaygroundThemeCssVariables } from "../../../src/platform/node/resolvePlaygroundThemeCssVariables";

function playgroundThemePlugin(): Plugin {
  return {
    name: "acp-ui-playground-theme",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split("?")[0];
        if (path !== "/api/playground-theme") {
          next();
          return;
        }
        try {
          const theme = resolvePlaygroundThemeCssVariables();
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(theme));
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}

const config: StorybookConfig = {
  stories: ["../src/components/**/*.stories.tsx"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  staticDirs: [],
  async viteFinal(viteConfig) {
    const { mergeConfig } = await import("vite");
    return mergeConfig(viteConfig, {
      plugins: [playgroundThemePlugin()],
    });
  },
};

export default config;
