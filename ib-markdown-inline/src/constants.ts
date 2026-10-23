export const Commands = {
    OpenMarkdownInline: `ib-markdown-inline.openMarkdownInline`,

    OpenMarkdownSource: `ib-markdown-inline.openMarkdownSource`,

    OpenMermaidMarkdownPreview: `ib-utilities.openMermaidMarkdownPreview`,
} as const;

export type Commands = (typeof Commands)[keyof typeof Commands];
