/** 移动输入抽象：目前由键盘实现，未来可直接替换为触屏虚拟摇杆。 */
export interface MoveInput {
  x: number;
  y: number;
}

/** 触控输入占位实现（第一版未启用，仅预留接口）。 */
export class TouchControls {
  getMove(): MoveInput {
    return { x: 0, y: 0 };
  }
}
