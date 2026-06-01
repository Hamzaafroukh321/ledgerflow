export enum RoundingMode {
  HALF_UP = "HALF_UP",
  HALF_EVEN = "HALF_EVEN",
  DOWN = "DOWN",
  UP = "UP"
}

export function roundMinor(value: number, mode: RoundingMode = RoundingMode.HALF_UP): number {
  if (!Number.isFinite(value)) {
    throw new Error("Cannot round a non-finite value");
  }

  switch (mode) {
    case RoundingMode.DOWN:
      return value < 0 ? Math.ceil(value) : Math.floor(value);
    case RoundingMode.UP:
      return value < 0 ? Math.floor(value) : Math.ceil(value);
    case RoundingMode.HALF_UP:
      return halfUp(value);
    case RoundingMode.HALF_EVEN:
      return halfEven(value);
  }
}

function halfUp(value: number): number {
  const sign = Math.sign(value) || 1;
  return sign * Math.floor(Math.abs(value) + 0.5);
}

function halfEven(value: number): number {
  const sign = Math.sign(value) || 1;
  const absolute = Math.abs(value);
  const floor = Math.floor(absolute);
  const fraction = absolute - floor;

  if (fraction < 0.5) {
    return sign * floor;
  }

  if (fraction > 0.5) {
    return sign * (floor + 1);
  }

  return sign * (floor % 2 === 0 ? floor : floor + 1);
}
