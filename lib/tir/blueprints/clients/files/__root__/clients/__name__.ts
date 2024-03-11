

import Client from 'tir/client';


export default class <%= classifiedModuleName %>Client extends Client {

    endpoint: string = "";

    public headers: Record<string, string> = {};

    public dynamicHeaders = () => {
      return this.headers;
    }
  
}
