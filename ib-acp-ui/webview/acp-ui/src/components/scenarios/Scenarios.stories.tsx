import type { Meta, StoryObj } from "@storybook/react-vite";
import cursorSeed from "../../../../../fixtures/cursor-model-seed.json?raw";
import markdownChat from "../../../../../fixtures/chats/markdown.ndjson?raw";
import planChat from "../../../../../fixtures/chats/plan.ndjson?raw";
import showcaseChat from "../../../../../fixtures/chats/showcase.ndjson?raw";
import toolsChat from "../../../../../fixtures/chats/tools.ndjson?raw";
import opusSeed from "../../../../../fixtures/opus-model-seed.json?raw";
import { ScenarioChat } from "./ScenarioChat";

const meta = {
  title: "Scenarios",
  component: ScenarioChat,
  parameters: { fullWidth: true },
} satisfies Meta<typeof ScenarioChat>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Showcase: Story = {
  args: { ndjson: showcaseChat, seedText: cursorSeed },
};

export const Markdown: Story = {
  args: { ndjson: markdownChat, seedText: cursorSeed },
};

export const Tools: Story = {
  args: { ndjson: toolsChat, seedText: cursorSeed },
};

export const Plan: Story = {
  args: { ndjson: planChat, seedText: cursorSeed },
};

export const CursorModel: Story = {
  args: { ndjson: "", seedText: cursorSeed },
};

export const OpusModel: Story = {
  args: { ndjson: "", seedText: opusSeed },
};
