export function buildReport(intent, plan, validation, toolMap, execution, verification) {
    const failed = verification.find((v) => v.status === "fail");
    const summary = failed
        ? `Autonomy run partially failed at step ${failed.stepId}: ${failed.notes.join("; ")}`
        : "Autonomy run completed successfully.";
    return {
        intent,
        plan,
        validation,
        toolMap,
        execution,
        verification,
        summary,
    };
}
