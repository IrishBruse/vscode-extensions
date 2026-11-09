import type { Decorator, Preview } from "@storybook/react";
import React from "react";
import "../src/global.css";
import "./previewTheme.css";

const withAgentRoot: Decorator = (Story) =>
  React.createElement(
    "div",
    {
      className: "agent-root",
      style: { maxWidth: 760, margin: "0 auto", padding: "16px 0" },
    },
    React.createElement(Story),
  );

const preview: Preview = {
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
