declare module "vscode" {
    export interface CustomEditorDiffDocuments<T> {
        readonly original: T;
        readonly modified: T;
    }

    export interface CustomEditorSideBySideDiffWebviewPanels {
        readonly original: WebviewPanel;
        readonly modified: WebviewPanel;
    }

    export interface CustomTextEditorProvider {
        resolveCustomTextEditorInlineDiff?(
            documents: CustomEditorDiffDocuments<TextDocument>,
            webviewPanel: WebviewPanel,
            token: CancellationToken,
        ): Thenable<void> | void;

        resolveCustomTextEditorSideBySideDiff?(
            documents: CustomEditorDiffDocuments<TextDocument>,
            webviewPanels: CustomEditorSideBySideDiffWebviewPanels,
            token: CancellationToken,
        ): Thenable<void> | void;
    }
}
