export interface BehaviorConfigPub {
  behaviorName: string;
  propertyValues: { [name: string]: { type: string; value: any } };
}

export default class BehaviorConfig extends SupCore.Data.Base.ComponentConfig {

  static schema: SupCore.Data.Schema = {
    behaviorName: { type: "string", mutable: true },
    propertyValues: {
      type: "hash",
      keys: { minLength: 1, maxLength: 80 },
      values: {
        type: "hash",
        properties: {
          type: { type: "string" },
          value: { type: "any" }
        }
      }
    }
  };

  static create() { return { behaviorName: "", propertyValues: {} }; }

  pub: BehaviorConfigPub;

  constructor(pub: BehaviorConfigPub) {
    if (pub.propertyValues == null) pub.propertyValues = {};
    super(pub, BehaviorConfig.schema);
  }

  server_setBehaviorPropertyValue(client: SupCore.RemoteClient, name: string, type: string, value: any, callback: (err: string, name: string, type: string, value: any) => any) {
    this.pub.propertyValues[name] = { type, value };
    callback(null, name, type, value);
  }

  client_setBehaviorPropertyValue(name: string, type: string, value: any) {
    this.pub.propertyValues[name] = { type, value };
  }

  server_clearBehaviorPropertyValue(client: SupCore.RemoteClient, name: string, callback: (err: string, name: string) => any) {
    delete this.pub.propertyValues[name];
    callback(null, name);
  }

  client_clearBehaviorPropertyValue(name: string) {
    delete this.pub.propertyValues[name];
  }
}
