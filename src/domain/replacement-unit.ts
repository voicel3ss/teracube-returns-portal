export function isDifferentReplacementUnit(returnedSerial: string | null | undefined, candidateSerial: string) {
  if (!returnedSerial) return true;
  return returnedSerial.trim().toUpperCase() !== candidateSerial.trim().toUpperCase();
}
