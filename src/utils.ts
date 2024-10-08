import { world, Block, Player, Entity, ItemStack, Enchantment, EquipmentSlot, EnchantmentTypes, ItemComponentTypes, ItemCooldownComponent, ItemFoodComponent, ItemDurabilityComponent, ItemEnchantableComponent } from "@minecraft/server";
import * as ui from "@minecraft/server-ui";

/**
 * Generates a random tag string, this is used as "tag"
 * 
 * @returns {string} The generated random string.
 */
function generateRandomTag(): string {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let tag = '';
  for (let i = 0; i < 8; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    tag += characters[randomIndex];
  }
  return tag;
}

/**
 * Parses a selector string and returns the matched entities.
 * 
 * @param {Player} source - The source from where the target selector was provided.
 * @param {string} selector - The target selector string.
 * @returns {Entity[]} The matched entities.
 */
export function parseSelector(source: Player, selector: string): { entities?: Entity[], error?: string } {
  const tag = generateRandomTag();
  try {
    source.runCommand(`tag ${selector} add ${tag}`);
  } catch (e) {
    const error = (e as Error).toString().replace("CommandError: ", "").trim();
    if (error.includes("Syntax error:")) {
      return { error: "Syntax error in the selector. Please check your selector." };
    } else {
      return { error: error };
    }
  }

  const entities = world
    .getDimension(source.dimension.id)
    .getEntities()
    .filter((entity) => entity.hasTag(tag));

  if (entities.length > 0) {
    entities.forEach((entity) => {
      entity.removeTag(tag);
    });
    return { entities: entities };
  } else {
    return { error: "No entities matched the selector." };
  }
}

/**
 * Retrieves the name of an entity, block, or player.
 *
 * @param {Entity | Block | Player | ItemStack} source - The entity, block, item or player to retrieve the name for.
 * @return {string} The name of the entity, block, item or player.
 */
export function getName(source: Entity | Block | Player | ItemStack): string {
  if (source instanceof Player) {
    return source.name;
  }
  
  if (source instanceof Block || source instanceof Entity || source instanceof ItemStack) {
    if (source instanceof Entity) {
      if (source.nameTag) {
        return source.nameTag;
      }

      return idToName(source.typeId);
    } else if (source instanceof Block) {
      return idToName(source.typeId);
    } else if (source instanceof ItemStack) {
      if (source.nameTag) {
        return source.nameTag;
      }

      return idToName(source.typeId);
    }
  }

  throw new Error("Unsupported source type");
}

/**
 * Represents a three-dimensional vector.
 */
export class Vector3 {
  x: number;
  y: number;
  z: number;

  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  /**
   * Checks if this vector is equal to another vector.
   *
   * @param {Vector3} other - The other vector to compare.
   * @returns {boolean} - True if vectors are equal, false otherwise.
   */
  equals(other: Vector3): boolean {
    return this.x === other.x && this.y === other.y && this.z === other.z;
  }

  /**
   * Adds another Vector3 to this one.
   * 
   * @param {Vector3} other - The other vector to add.
   * @returns {Vector3} A new Vector3 that is the result of the addition.
   */
  add(other: Vector3): Vector3 {
    return new Vector3(this.x + other.x, this.y + other.y, this.z + other.z);
  }

  /**
   * Subtracts another Vector3 from this one.
   * 
   * @param {Vector3} other - The other vector to subtract.
   * @returns {Vector3} A new Vector3 that is the result of the subtraction.
   */
  subtract(other: Vector3): Vector3 {
    return new Vector3(this.x - other.x, this.y - other.y, this.z - other.z);
  }

  /**
   * Multiplies this Vector3 by a scalar value.
   * 
   * @param {number} scalar - The scalar to multiply by.
   * @returns {Vector3} A new Vector3 that is the result of the multiplication.
   */
  multiply(scalar: number): Vector3 {
    return new Vector3(this.x * scalar, this.y * scalar, this.z * scalar);
  }

  /**
   * Divides this Vector3 by a scalar value.
   * 
   * @param {number} scalar - The scalar to divide by.
   * @returns {Vector3} A new Vector3 that is the result of the division.
   * @throws Will throw an error if dividing by zero.
   */
  divide(scalar: number): Vector3 {
    if (scalar !== 0) {
      return new Vector3(this.x / scalar, this.y / scalar, this.z / scalar);
    } else {
      throw new Error("Cannot divide by zero");
    }
  }

  /**
   * Calculates the magnitude (length) of the vector.
   * 
   * @returns {number} The magnitude of the vector.
   */
  magnitude(): number {
    return Math.sqrt(this.x ** 2 + this.y ** 2 + this.z ** 2);
  }

  /**
   * Normalizes the vector to a unit vector.
   * 
   * @returns {Vector3} A new Vector3 that is the normalized (unit) vector.
   * @throws Will throw an error if attempting to normalize a zero vector.
   */
  normalize(): Vector3 {
    const mag = this.magnitude();
    if (mag !== 0) {
      return this.divide(mag);
    } else {
      throw new Error("Cannot normalize a zero vector");
    }
  }

  /**
   * Calculates the dot product with another vector.
   * 
   * @param {Vector3} other - The other vector.
   * @returns {number} The dot product result.
   */
  dot(other: Vector3): number {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  /**
   * Calculates the cross product with another vector.
   * 
   * @param {Vector3} other - The other vector.
   * @returns {Vector3} A new Vector3 that is the result of the cross product.
   */
  cross(other: Vector3): Vector3 {
    return new Vector3(
      this.y * other.z - this.z * other.y,
      this.z * other.x - this.x * other.z,
      this.x * other.y - this.y * other.x
    );
  }

  /**
   * Calculates the distance between this vector and another vector.
   * 
   * @param {Vector3} other - The other vector.
   * @returns {number} The distance between the vectors.
   */
  distance(other: Vector3): number {
    return Math.sqrt(
      (this.x - other.x) ** 2 +
      (this.y - other.y) ** 2 +
      (this.z - other.z) ** 2
    );
  }

  /**
   * Returns a string representation of the vector.
   * 
   * @returns {string} The string representation.
   */
  toString(): string {
    return `Vector3(${this.x}, ${this.y}, ${this.z})`;
  }
}

/**
 * Converts degrees to radians.
 *
 * @param {number} degrees - The value in degrees.
 */
function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Converts an ID string (e.g., "minecraft:sharpness") to a more readable name (e.g., "Sharpness").
 * 
 * @param {string} id - The ID string to convert.
 * @returns {string} The converted name.
 */
export function idToName(id: string): string {
  const noNamespace = id.includes(":") ? id.split(":")[1] : id;
  const namePart = noNamespace.replace(/_/g, " ");
  const name = namePart
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return name;
}

/**
 * Converts a number to Roman numerals, up to 10.
 * 
 * @param {number} num - The number to convert.
 * @returns {string} The Roman numeral representation.
 */
export function convertToRomanNumerals(num: number): string {
  if (num > 10) {
    return num.toString();
  }

  const romanNumerals: { [key: number]: string } = {
    1: "I",
    4: "IV",
    5: "V",
    9: "IX",
    10: "X",
  };

  const keys = Object.keys(romanNumerals)
    .map(key => parseInt(key, 10))
    .sort((a, b) => b - a);

  let result = "";
  let remaining = num;

  for (const key of keys) {
    while (remaining >= key) {
      result += romanNumerals[key];
      remaining -= key;
    }
  }

  return result;
}

/**
 * Parses an enchantments string and returns the corresponding Enchantment objects or an error message.
 * 
 * @param {ItemStack} item - The item to enchant.
 * @param {string} enchantmentsStr - The string containing enchantment data.
 * @returns {{enchantments?: Enchantment[], error?: string}} The list of parsed Enchantments or an error message.
 */
export function parseEnchantments(item: ItemStack, enchantmentsStr: string): { enchantments?: Enchantment[], error?: string } {
  const enchantments: Enchantment[] = [];
  const enchantableComponent = item.getComponent(ItemComponentTypes.Enchantable) as ItemEnchantableComponent;

  if (!enchantableComponent) {
    return { error: "This item cannot be enchanted." };
  }

  const enchantmentEntries = enchantmentsStr.split(',').map(entry => entry.trim());

  for (const entry of enchantmentEntries) {
    const enchantmentPattern = /^([\w\s]+?)(?:\s+(\w+))?$/;
    const match = enchantmentPattern.exec(entry);

    if (!match) {
      return { error: `Invalid format: ${entry}` };
    }

    const [_, name, levelStr] = match;
    const level = levelStr ? romanToNumber(levelStr) : 1;
    const formattedName = name.trim().toLowerCase().replace(/ /g, '_');

    const type = EnchantmentTypes.get(formattedName);
    if (!type) {
      return { error: `Invalid enchantment identifier: ${name}` };
    }

    if (level > type.maxLevel) {
      return { error: `The enchantment level for ${name} is too high. Maximum allowed is ${convertToRomanNumerals(type.maxLevel)}.` };
    }

    const enchantment = { type, level };
    if (!enchantableComponent.canAddEnchantment(enchantment)) {
      return { error: `The ${name} enchantment is not compatible with ${item.typeId}.` };
    }

    enchantments.push(enchantment);
  }

  return { enchantments };
}

/**
 * Converts a Roman numeral string to a number.
 * 
 * @param {string} roman - The Roman numeral string.
 * @returns {number} The corresponding number.
 */
export function romanToNumber(roman: string): number {
  const romanNumerals: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let num = 0, prevValue = 0;
  
  for (let i = roman.length - 1; i >= 0; i--) {
    const value = romanNumerals[roman[i]];
    if (value < prevValue) {
      num -= value;
    } else {
      num += value;
    }
    prevValue = value;
  }
  
  return num;
}

/**
 * Formats a list of enchantments into a readable string. (e.g., "sharpness 2" to "Sharpness II") 
 * 
 * @param {Enchantment[]} enchantments - The list of enchantments to format.
 * @returns {string} The formatted enchantments string.
 */
export function formatEnchantments(enchantments: Enchantment[]): string {
  return enchantments.map(enchantment => {
    const enchantmentName = idToName(enchantment.type.id);
    const enchantmentLevel = convertToRomanNumerals(enchantment.level);
    return `${enchantmentName} ${enchantmentLevel}`;
  }).join(', ');
}

export class FormFieldManager {
  private fields: string[] = [];

  addField(name: string): number {
    this.fields.push(name);
    return this.fields.length - 1;
  }

  getFieldIndex(name: string): number {
    return this.fields.indexOf(name);
  }

  getValue<T>(response: ui.ModalFormResponse, name: string, defaultValue: T): T {
    const index = this.getFieldIndex(name);
    if (response.formValues && index !== -1 && index < response.formValues.length) {
      return response.formValues[index] as T;
    }
    
    return defaultValue;
  }
}

/**
 * Parses a string for coordinates and supports relative (~) and local (^) positions.
 *
 * @param {Player} player - The player whose position and direction might be used for relative/local coordinates.
 * @param {string} input - The input string containing the coordinates.
 * @returns {Vector3 | string} - The parsed Vector3 coordinates or an error string if parsing fails.
 */
export function parseCoords(player: Player, input: string): Vector3 | string {
  const components = input.trim().split(/\s+/);

  if (components.length !== 3) {
    return "Error: Invalid coordinate input. Expected three components (x, y, z).";
  }

  try {
    const playerLocation = player.location; // Player's current location

    const isRelative = components.some(component => component.startsWith("~"));
    const isLocal = components.some(component => component.startsWith("^"));

    // Ensure ~ and ^ are not mixed
    if (isRelative && isLocal) {
      return "Error: Cannot mix relative (~) and local (^) coordinates.";
    }

    const x = parseCoordinateWithDirection(player, components[0], playerLocation.x, "x");
    const y = parseCoordinateWithDirection(player, components[1], playerLocation.y, "y");
    const z = parseCoordinateWithDirection(player, components[2], playerLocation.z, "z");

    if (typeof x === "string" || typeof y === "string" || typeof z === "string") {
      return "Error: One or more coordinates could not be parsed.";
    }

    return new Vector3(x, y, z);
  } catch (error: unknown) {
    if (error instanceof Error) {
      return `Error: ${error.message}`;
    } else {
      return "Error: An unknown error occurred.";
    }
  }
}

/**
 * Parses coordinate with support for relative (~) and local (^) coordinates.
 * Correctly handles local coordinates based on the player's view direction.
 *
 * @param {Player} player - The player to calculate relative and local coordinates.
 * @param {string} input - The coordinate as a string.
 * @param {number} base - The base value (usually the player's location) for relative coordinates.
 * @param {"x" | "y" | "z"} axis - The axis being calculated (x, y, or z).
 * @returns {number | string} - The parsed coordinate value or an error string.
 */
export function parseCoordinateWithDirection(player: Player, input: string, base: number, axis: "x" | "y" | "z"): number | string {
  if (input.startsWith("~")) {
    const relativeValue = parseFloat(input.slice(1));
    return isNaN(relativeValue) ? base : base + relativeValue;
  }
  
  if (input.startsWith("^")) {
    const localValue = parseFloat(input.slice(1)) || 0;
    const yawRadians = degreesToRadians(player.getRotation().y);
    if (axis === "x") {
      return base + (-Math.sin(yawRadians) * localValue);
    }
    if (axis === "z") {
      return base + (Math.cos(yawRadians) * localValue);
    }
    if (axis === "y") {
      return base + localValue;
    }
  }

  const absoluteValue = parseFloat(input);
  return isNaN(absoluteValue) ? "Error: Invalid coordinate value." : absoluteValue;
}


/**
 * Checks if two items are the same, considering various properties such as type, name tag, amount, and components.
 *
 * @param {ItemStack} item1 - The first item to compare.
 * @param {ItemStack} item2 - The second item to compare.
 * @returns {boolean} - Whether the two items are the same.
 */
export function isSameItem(item1: ItemStack, item2: ItemStack): boolean {
  if (item1.typeId !== item2.typeId) return false;
  if (item1.nameTag !== item2.nameTag) return false;
  if (item1.amount !== item2.amount) return false;
  if (item1.isStackable && item1.isStackableWith(item2)) return false;
  if (item1.getTags().length !== item2.getTags().length || !item1.getTags().every((tag) => item2.getTags().includes(tag))) return false;
  if (item1.getLore().length !== item2.getLore().length || !item1.getLore().every((lore) => item2.getLore().includes(lore))) return false;
  if (item1.getCanDestroy().length !== item2.getCanDestroy().length || !item1.getCanDestroy().every((block) => item2.getCanDestroy().includes(block))) return false;
  if (item1.getCanPlaceOn().length !== item2.getCanPlaceOn().length || !item1.getCanPlaceOn().every((block) => item2.getCanPlaceOn().includes(block))) return false;
  if (item1.keepOnDeath !== item2.keepOnDeath) return false;
  if (item1.lockMode !== item2.lockMode) return false;
  if (!compareComponents(item1, item2)) return false;
  if (!compareDynamicProperties(item1, item2)) return false;
  return true;
}

/**
 * Compare various components between two items, including cooldown, durability, food, and enchantable.
 */
function compareComponents(item1: ItemStack, item2: ItemStack): boolean {
  if (!compareComponent(item1, item2, ItemComponentTypes.Cooldown, compareCooldownComponents)) return false;
  if (!compareComponent(item1, item2, ItemComponentTypes.Durability, compareDurabilityComponents)) return false;
  if (!compareComponent(item1, item2, ItemComponentTypes.Food, compareFoodComponents)) return false;
  if (!compareComponent(item1, item2, ItemComponentTypes.Enchantable, compareEnchantableComponents)) return false;

  return true;
}

/**
 * Helper function to compare a specific component between two items.
 */
function compareComponent(
  item1: ItemStack,
  item2: ItemStack,
  componentType: string,
  compareFunction: (comp1: any, comp2: any) => boolean
): boolean {
  const hasComponent1 = item1.hasComponent(componentType);
  const hasComponent2 = item2.hasComponent(componentType);
  if (hasComponent1 !== hasComponent2) return false;
  if (hasComponent1 && hasComponent2) {
    const comp1 = item1.getComponent(componentType);
    const comp2 = item2.getComponent(componentType);
    return compareFunction(comp1, comp2);
  }
  return true;
}

/**
 * Compare cooldown components between two items.
 */
function compareCooldownComponents(comp1: ItemCooldownComponent, comp2: ItemCooldownComponent): boolean {
  return comp1.cooldownCategory === comp2.cooldownCategory && comp1.cooldownTicks === comp2.cooldownTicks;
}

/**
 * Compare durability components between two items.
 */
function compareDurabilityComponents(comp1: ItemDurabilityComponent, comp2: ItemDurabilityComponent): boolean {
  return comp1.maxDurability === comp2.maxDurability && comp1.damage === comp2.damage;
}

/**
 * Compare food components between two items.
 */
function compareFoodComponents(comp1: ItemFoodComponent, comp2: ItemFoodComponent): boolean {
  return (
    comp1.canAlwaysEat === comp2.canAlwaysEat &&
    comp1.nutrition === comp2.nutrition &&
    comp1.saturationModifier === comp2.saturationModifier &&
    comp1.usingConvertsTo === comp2.usingConvertsTo
  );
}

/**
 * Compare enchantable components between two items.
 */
function compareEnchantableComponents(comp1: ItemEnchantableComponent, comp2: ItemEnchantableComponent): boolean {
  const enchantments1 = comp1.getEnchantments();
  const enchantments2 = comp2.getEnchantments();
  if (enchantments1.length !== enchantments2.length) return false;
  for (let i = 0; i < enchantments1.length; i++) {
    if (enchantments1[i].type !== enchantments2[i].type || enchantments1[i].level !== enchantments2[i].level) {
      return false;
    }
  }
  return true;
}

/**
 * Compare dynamic properties between two items, including Vector3 comparisons.
 */
function compareDynamicProperties(item1: ItemStack, item2: ItemStack): boolean {
  const item1DynamicProperties = item1.getDynamicPropertyIds();
  const item2DynamicProperties = item2.getDynamicPropertyIds();
  if (!arraysEqual(item1DynamicProperties, item2DynamicProperties)) return false;

  for (const property of item1DynamicProperties) {
    const prop1 = item1.getDynamicProperty(property);
    const prop2 = item2.getDynamicProperty(property);

    if (typeof prop1 !== typeof prop2) return false;

    if (prop1 instanceof Vector3 && prop2 instanceof Vector3) {
      if (!prop1.equals(prop2)) return false;
    } else if (prop1 !== prop2) {
      return false;
    }
  }

  return true;
}

/**
 * Adds an equality check method to Vector3 for cleaner comparisons.
 */
Vector3.prototype.equals = function (other: Vector3): boolean {
  return this.x === other.x && this.y === other.y && this.z === other.z;
}

/**
 * Helper function to compare two arrays for equality.
 */
function arraysEqual(arr1: any[], arr2: any[]): boolean {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((item, index) => item === arr2[index]);
};

/**
 * Formats equipment slot names.
 * Converts slot names like "Mainhand" to "Main hand".
 *
 * @param {EquipmentSlot} slot - The equipment slot to format.
 * @returns {string} - A formatted slot name.
 */
export function formatSlotName(slot: EquipmentSlot): string {
  const slotNames: Record<EquipmentSlot, string> = {
    [EquipmentSlot.Mainhand]: "Main hand",
    [EquipmentSlot.Offhand]: "Off hand",
    [EquipmentSlot.Head]: "Head",
    [EquipmentSlot.Chest]: "Chest",
    [EquipmentSlot.Legs]: "Legs",
    [EquipmentSlot.Feet]: "Feet",
  };
  return slotNames[slot] || "Unknown Slot";
}