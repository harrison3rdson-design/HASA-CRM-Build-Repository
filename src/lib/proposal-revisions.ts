export function proposalRevisionLabel(
  internalRevisionNumber: number | string,
  options: { compact?: boolean } = {},
): string {
  const revisionNumber = Number(internalRevisionNumber);
  if (!Number.isInteger(revisionNumber) || revisionNumber < 1) {
    throw new Error("Proposal version must be a positive whole number.");
  }

  if (revisionNumber === 1) {
    return options.compact ? "Original" : "Original Proposal";
  }

  const customerRevisionNumber = revisionNumber - 1;
  return options.compact
    ? `R${customerRevisionNumber}`
    : `Revision ${customerRevisionNumber}`;
}
