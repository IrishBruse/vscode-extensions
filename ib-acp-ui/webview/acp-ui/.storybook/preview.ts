import type { Decorator, Preview } from "@storybook/react";
import React from "react";
import { applyPlaygroundVsCodeTheme } from "../src/storybook/applyVsCodeTheme";
import "../src/global.css";

const withAgentRoot: Decorator = (Story, context) => {
  const fullWidth = context.parameters.fullWidth === true;
  return React.createElement(
    "div",
    {
      className: "agent-root",
      style: fullWidth
        ? { height: "100vh" }
        : { maxWidth: 760, margin: "0 auto", padding: "16px 0" },
    },
    React.createElement(Story),
  );
};

const preview: Preview = {
  loaders: [
    async () => {
      await applyPlaygroundVsCodeTheme();
      return {};
    },
  ],
  decorators: [withAgentRoot],
  parameters: {
    layout: "fullscreen",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
