const debug = false;

export type Property = SimpleProperty | IntegerProperty | UIDProperty | RealProperty | DateProperty | DataProperty | StringProperty | ArrayProperty<Property> | DictionaryProperty;

export type SimpleProperty = boolean | null;

export type IntegerProperty = number | bigint;

export type UIDProperty = UID;

export type RealProperty = number;

export type DateProperty = Date;

export type DataProperty = Uint8Array;

export type StringProperty = string;

export interface ArrayProperty<T extends Property> extends Array<T> {}

export interface DictionaryProperty {
  [key: string]: Property;
}

const maxObjectSize = 100 ** 8; // 100Meg
const maxObjectCount = 32768;

// EPOCH = new SimpleDateFormat("yyyy MM dd zzz").parse("2001 01 01 GMT").getTime();
// ...but that's annoying in a static initializer because it can throw exceptions, ick.
// So we just hardcode the correct value.
const EPOCH = 978307200000;

const textDecoder = new TextDecoder();

// UID object definition
export class UID {
  public readonly UID: number;

  constructor(id: number) {
    this.UID = id;
  }
}

export function parseBuffer<T extends Property>(buffer: Uint8Array): T {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  // check header
  const header: string = textDecoder.decode(buffer.subarray(0, 'bplist'.length));
  if (header !== 'bplist') {
    throw new Error("Invalid binary plist. Expected 'bplist' at offset 0.");
  }

  // Handle trailer, last 32 bytes of the file
  const trailerOffset = buffer.byteLength - 32;
  // 6 null bytes (index 0 to 5)
  const offsetSize = view.getUint8(trailerOffset + 6);
  if (debug) {
    console.log("offsetSize: " + offsetSize);
  }
  const objectRefSize = view.getUint8(trailerOffset + 7);
  if (debug) {
    console.log("objectRefSize: " + objectRefSize);
  }
  const numObjects = Number(view.getBigUint64(trailerOffset + 8, false));
  if (debug) {
    console.log("numObjects: " + numObjects);
  }
  const topObject = Number(view.getBigUint64(trailerOffset + 16, false));
  if (debug) {
    console.log("topObject: " + topObject);
  }
  const offsetTableOffset = Number(view.getBigUint64(trailerOffset + 24, false));
  if (debug) {
    console.log("offsetTableOffset: " + offsetTableOffset);
  }

  if (numObjects > maxObjectCount) {
    throw new Error("maxObjectCount exceeded");
  }

  // Handle offset table
  const offsetTable: number[] = [];

  for (let i = 0; i < numObjects; i++) {
    const offsetBytes = buffer.subarray(offsetTableOffset + i * offsetSize, offsetTableOffset + (i + 1) * offsetSize);
    offsetTable[i] = readUInt(offsetBytes);
    if (debug) {
      console.log("Offset for Object #" + i + " is " + offsetTable[i] + " [" + offsetTable[i]!.toString(16) + "]");
    }
  }

  // Parses an object inside the currently parsed binary property list.
  // For the format specification check
  // <a href="https://www.opensource.apple.com/source/CF/CF-635/CFBinaryPList.c">
  // Apple's binary property list parser implementation</a>.
  function parseObject<T extends Property>(tableOffset: number): T;
  function parseObject(tableOffset: number): Property {
    const offset: number = offsetTable[tableOffset]!;
    const type: number = buffer[offset]!;
    const objType = (type & 0xF0) >> 4; //First  4 bits
    const objInfo = (type & 0x0F);      //Second 4 bits
    switch (objType) {
    case 0x0:
      return parseSimple();
    case 0x1:
      return parseInteger();
    case 0x8:
      return parseUID();
    case 0x2:
      return parseReal();
    case 0x3:
      return parseDate();
    case 0x4:
      return parseData();
    case 0x5: // ASCII
      return parsePlistString();
    case 0x6: // UTF-16
      return parsePlistString(true);
    case 0xA:
      return parseArray();
    case 0xD:
      return parseDictionary();
    default:
      throw new Error("Unhandled type 0x" + objType.toString(16));
    }

    function parseSimple(): SimpleProperty {
      //Simple
      switch (objInfo) {
      case 0x0: // null
        return null;
      case 0x8: // false
        return false;
      case 0x9: // true
        return true;
      case 0xF: // filler byte
        return null;
      default:
        throw new Error("Unhandled simple type 0x" + objType.toString(16));
      }
    }

    function bufferToHexString(buffer: Uint8Array): string {
      let str = '';
      let i: number;
      for (i = 0; i < buffer.length; i++) {
        if (buffer[i] != 0x00) {
          break;
        }
      }
      for (; i < buffer.length; i++) {
        const part = '00' + buffer[i]!.toString(16);
        str += part.substr(part.length - 2);
      }
      return str;
    }

    function parseInteger(): IntegerProperty {
      const length = Math.pow(2, objInfo);
      if (length < maxObjectSize) {
        const data = buffer.subarray(offset + 1, offset + 1 + length);
        if (length === 16) {
          const str = bufferToHexString(data);
          return BigInt(`0x${str}`);
        }
        return data.reduce((acc, curr) => {
          acc <<= 8;
          acc |= curr & 255;
          return acc;
        });
      }
        throw new Error("Too little heap space available! Wanted to read " + length + " bytes, but only " + maxObjectSize + " are available.");

    }

    function parseUID(): UIDProperty {
      const length = objInfo + 1;
      if (length < maxObjectSize) {
        return new UID(readUInt(buffer.subarray(offset + 1, offset + 1 + length)));
      }
      throw new Error("Too little heap space available! Wanted to read " + length + " bytes, but only " + maxObjectSize + " are available.");
    }

    function parseReal(): RealProperty {
      const length = Math.pow(2, objInfo);
      if (length < maxObjectSize) {
        const realBuffer = buffer.subarray(offset + 1, offset + 1 + length);
        const realBufferView = new DataView(realBuffer.buffer, realBuffer.byteOffset, realBuffer.byteLength);
        if (length === 4) {
          return realBufferView.getFloat32(0, false);
        }
        if (length === 8) {
          return realBufferView.getFloat64(0, false);
        }
        throw new Error(`Length for 'real' value should be '4' or '8', received ${length}`); // not sure if this can really happen
      } else {
        throw new Error("Too little heap space available! Wanted to read " + length + " bytes, but only " + maxObjectSize + " are available.");
      }
    }

    function parseDate(): DateProperty {
      if (objInfo != 0x3) {
        console.error("Unknown date type :" + objInfo + ". Parsing anyway...");
      }
      const dateBuffer = buffer.subarray(offset + 1, offset + 9);
      const dateBufferView = new DataView(dateBuffer.buffer, dateBuffer.byteOffset, dateBuffer.byteLength);
      return new Date(EPOCH + (1000 * dateBufferView.getFloat64(0, false)));
    }

    function parseData(): DataProperty {
      let dataoffset = 1;
      let length = objInfo;
      if (objInfo == 0xF) {
        const int_type: number = buffer[offset + 1]!;
        const intType = (int_type & 0xF0) / 0x10;
        if (intType != 0x1) {
          console.error("0x4: UNEXPECTED LENGTH-INT TYPE! " + intType);
        }
        const intInfo = int_type & 0x0F;
        const intLength = Math.pow(2, intInfo);
        dataoffset = 2 + intLength;
        if (intLength < 3) {
          length = readUInt(buffer.subarray(offset + 2, offset + 2 + intLength));
        } else {
          length = readUInt(buffer.subarray(offset + 2, offset + 2 + intLength));
        }
      }
      if (length < maxObjectSize) {
        return buffer.subarray(offset + dataoffset, offset + dataoffset + length);
      }
      throw new Error("Too little heap space available! Wanted to read " + length + " bytes, but only " + maxObjectSize + " are available.");
    }

    function parsePlistString (isUtf16: boolean = false): StringProperty {
      const charLength: number = isUtf16 ? 1 : 0;
      let enc: TextDecoder = textDecoder;
      let length = objInfo;
      let stroffset = 1;
      if (objInfo == 0xF) {
        const int_type: number = buffer[offset + 1]!;
        const intType = (int_type & 0xF0) / 0x10;
        if (intType != 0x1) {
          console.error("UNEXPECTED LENGTH-INT TYPE! " + intType);
        }
        const intInfo = int_type & 0x0F;
        const intLength = Math.pow(2, intInfo);
        stroffset = 2 + intLength;
        if (intLength < 3) {
          length = readUInt(buffer.subarray(offset + 2, offset + 2 + intLength));
        } else {
          length = readUInt(buffer.subarray(offset + 2, offset + 2 + intLength));
        }
      }
      // length is String length -> to get byte length multiply by 2, as 1 character takes 2 bytes in UTF-16
      length *= (charLength + 1);
      if (length < maxObjectSize) {
        let plistString = new Uint8Array(buffer.subarray(offset + stroffset, offset + stroffset + length));
        if (charLength) {
          enc = new TextDecoder("utf-16be");
        }
        return enc.decode(plistString);
      }
      throw new Error("Too little heap space available! Wanted to read " + length + " bytes, but only " + maxObjectSize + " are available.");
    }

    function parseArray<T extends Property>(): ArrayProperty<T> {
      let length = objInfo;
      let arrayoffset = 1;
      if (objInfo == 0xF) {
        const int_type: number = buffer[offset + 1]!;
        const intType = (int_type & 0xF0) / 0x10;
        if (intType != 0x1) {
          console.error("0xa: UNEXPECTED LENGTH-INT TYPE! " + intType);
        }
        const intInfo = int_type & 0x0F;
        const intLength = Math.pow(2, intInfo);
        arrayoffset = 2 + intLength;
        if (intLength < 3) {
          length = readUInt(buffer.subarray(offset + 2, offset + 2 + intLength));
        } else {
          length = readUInt(buffer.subarray(offset + 2, offset + 2 + intLength));
        }
      }
      if (length * objectRefSize > maxObjectSize) {
        throw new Error("Too little heap space available!");
      }
      const array: ArrayProperty<T> = [];
      for (let i = 0; i < length; i++) {
        const objRef = readUInt(buffer.subarray(offset + arrayoffset + i * objectRefSize, offset + arrayoffset + (i + 1) * objectRefSize));
        array[i] = parseObject(objRef);
      }
      return array;
    }

    function parseDictionary(): DictionaryProperty {
      let length = objInfo;
      let dictoffset = 1;
      if (objInfo == 0xF) {
        const int_type: number = buffer[offset + 1]!;
        const intType = (int_type & 0xF0) / 0x10;
        if (intType != 0x1) {
          console.error("0xD: UNEXPECTED LENGTH-INT TYPE! " + intType);
        }
        const intInfo = int_type & 0x0F;
        const intLength = Math.pow(2, intInfo);
        dictoffset = 2 + intLength;
        if (intLength < 3) {
          length = readUInt(buffer.subarray(offset + 2, offset + 2 + intLength));
        } else {
          length = readUInt(buffer.subarray(offset + 2, offset + 2 + intLength));
        }
      }
      if (length * 2 * objectRefSize > maxObjectSize) {
        throw new Error("Too little heap space available!");
      }
      if (debug) {
        console.log("Parsing dictionary #" + tableOffset);
      }
      const dict: DictionaryProperty = {};
      for (let i = 0; i < length; i++) {
        const keyRef = readUInt(buffer.subarray(offset + dictoffset + i * objectRefSize, offset + dictoffset + (i + 1) * objectRefSize));
        const valRef = readUInt(buffer.subarray(offset + dictoffset + (length * objectRefSize) + i * objectRefSize, offset + dictoffset + (length * objectRefSize) + (i + 1) * objectRefSize));
        const key = parseObject(keyRef);
        if (typeof key !== "string") {
          throw new Error("Parsed unexpected property key type, should be a string.");
        }
        const val = parseObject(valRef);
        if (debug) {
          console.log("  DICT #" + tableOffset + ": Mapped " + key + " to " + val);
        }
        dict[key] = val;
      }
      return dict;
    }
  }

  return parseObject(topObject);
}

function readUInt(buffer: Uint8Array): number {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  switch (buffer.byteLength) {
    case 1: return view.getUint8(0);
    case 2: return view.getUint16(0, false);
    default: throw new Error(`Unexpected Uint value length, support more than '1' or '2'? Received '${buffer.byteLength}'`);
  }
}
