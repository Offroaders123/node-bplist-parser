export type Property = SimpleProperty | IntegerProperty | UIDProperty | RealProperty | DateProperty | StringProperty | ArrayProperty<Property> | DictionaryProperty;

export type SimpleProperty = boolean;

export type IntegerProperty = number | bigint;

export type UIDProperty = typeof import("./bplistParser.js").UID;

export type RealProperty = number;

export type DateProperty = Date;

export type DataProperty = Buffer;

export type StringProperty = string;

export interface ArrayProperty<T extends Property> extends Array<T> {}

export interface DictionaryProperty {
  [key: string]: Property;
}