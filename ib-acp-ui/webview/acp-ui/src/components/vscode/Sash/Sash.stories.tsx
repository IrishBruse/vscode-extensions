import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState, type CSSProperties, type ReactElement } from "react";
import { Sash } from "./Sash";

function SplitDemo(): ReactElement {
  const [leftWidth, setLeftWidth] = useState(320);
  return (
    <div
      style={
        {
          display: "flex",
          height: 420,
          border: "1px solid var(--vscode-widget-border)",
          "--demo-left-width": `${leftWidth}px`,
        } as CSSProperties
      }
    >
      <div style={{ width: leftWidth, padding: 16, minWidth: 0 }}>Main content</div>
      <Sash
        orientation="vertical"
        onDrag={(delta) => {
          setLeftWidth((width) => Math.min(560, Math.max(160, width + delta)));
        }}
      />
      <div style={{ flex: 1, padding: 16, minWidth: 0 }}>Side panel</div>
    </div>
  );
}

const meta = {
  title: "VS Code/Sash",
  component: SplitDemo,
} satisfies Meta<typeof SplitDemo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Vertical: Story = {};