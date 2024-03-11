import { attr } from './attr';
import { Pod } from './pod';

class NodePod extends Pod {
  @attr()
  declare id: string;
}

export { NodePod };
