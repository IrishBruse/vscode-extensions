import type { Meta, StoryObj } from "@storybook/react-vite";
import { ImageViewer } from "./ImageViewer";

/** 1×1 PNG for offline Storybook preview */
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const meta = {
  title: "ACP UI/ImageViewer",
  component: ImageViewer,
} satisfies Meta<typeof ImageViewer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    src: TINY_PNG,
    onClose: () => undefined,
  },
};
