

import { TirClient } from 'tir/client';


export default class <%= classifiedModuleName %> Client extends TirClient {

  endpoint: string = "";

    public headers: Record<string, string> = {};

    public dynamicHeaders = () => {
    return this.headers;
  }

}
