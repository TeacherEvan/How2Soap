/**
 * Frame-rate independent exponential decay & critically-damped analytical spring.
 * Unconditionally stable across 60Hz, 120Hz, and background-tab resume spikes.
 */

export function expDecay(current: number, target: number, decay = 18, dt = 1 / 60): number {
  const safeDt = Math.max(dt, 0);
  if (Math.abs(current - target) <= 1e-4) return target;
  return target + (current - target) * Math.exp(-decay * safeDt);
}

export class AnalyticalSpring {
  public pos: number;
  public vel = 0;
  public target: number;
  private readonly omega: number;

  constructor(initial = 0, stiffness = 320) {
    this.pos = initial;
    this.target = initial;
    this.omega = Math.sqrt(stiffness);
  }

  public setTarget(target: number): void {
    this.target = target;
  }

  public isAtRest(posTol = 0.001, velTol = 0.005): boolean {
    return Math.abs(this.pos - this.target) <= posTol && Math.abs(this.vel) <= velTol;
  }

  public update(dt: number): number {
    const safeDt = Math.max(dt, 0);
    const x0 = this.pos - this.target;
    const v0 = this.vel;
    const decay = Math.exp(-this.omega * safeDt);
    const c1 = x0;
    const c2 = v0 + this.omega * x0;
    const nextX = (c1 + c2 * safeDt) * decay;
    this.vel = (c2 - this.omega * (c1 + c2 * safeDt)) * decay;
    this.pos = this.target + nextX;
    if (this.isAtRest()) {
      this.pos = this.target;
      this.vel = 0;
    }
    return this.pos;
  }
}
