import type { Meta, StoryObj } from "@storybook/react-vite";
import { ImageViewer } from "./ImageViewer";

const previewImage =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <rect width="640" height="360" fill="#1f6feb"/>
      <text x="32" y="190" fill="#ffffff" font-family="sans-serif" font-size="32">Pasted image</text>
    </svg>`,
  );

const meta = {
  title: "ACP/Dialogs/ImageViewer",
  component: ImageViewer,
  parameters: { fullWidth: true },
} satisfies Meta<typeof ImageViewer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    src: previewImage,
    onClose: () => undefined,
  },
};
