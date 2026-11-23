/**
 * Starts the latest prompt as soon as cancel is sent.
 * It does not wait for the previous prompt call to finish.
 * That previous call sees `isCurrent` false and must not report completion.
 */
export class LatestPromptTurn {
    private epoch = 0;

    run(
        cancelInFlight: () => Promise<void>,
        turn: (isCurrent: () => boolean) => Promise<void>,
    ): Promise<void> {
        const epoch = ++this.epoch;
        const isCurrent = (): boolean => this.epoch === epoch;
        return (async () => {
            if (epoch > 1) {
                await cancelInFlight().catch(() => undefined);
            }
            if (!isCurrent()) {
                return;
            }
            await turn(isCurrent);
        })();
    }
}
