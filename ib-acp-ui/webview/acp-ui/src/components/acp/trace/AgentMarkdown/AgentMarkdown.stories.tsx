import type { Meta, StoryObj } from "@storybook/react-vite";
import { AgentMarkdown } from "./AgentMarkdown";

const sampleMarkdown = `A short paragraph of assistant markdown.

- First item
- Second item

\`\`\`typescript
const greet = (name: string) => \`Hello, \${name}\`;
\`\`\`
`;

const meta = {
  title: "ACP/Trace/AgentMarkdown",
  component: AgentMarkdown,
} satisfies Meta<typeof AgentMarkdown>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    text: sampleMarkdown,
  },
};

export const TableAndQuote: Story = {
  args: {
    text: `> Quote the setting before you change it.

| Setting | Default |
| --- | --- |
| content width | 100 |
| sessions directory | extension storage |

A [link](https://agentclientprotocol.com) stays in the paragraph.`,
  },
};
