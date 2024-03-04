import { attr } from '.';
import { Pod } from './pod';


class NodePod extends Pod {
  @attr()
  declare id: string;

};


export { NodePod };