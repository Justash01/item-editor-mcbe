/**
 * Item Editor 
 * 
 * My Discord: jstash
 * My Github: https://github.com/Justash01
 * Github Repository: https://github.com/Justash01/item-editor-mcbe
*/


import { RawText, Block, ItemStack, ItemComponentTypes, ScriptEventCommandMessageAfterEvent, system, ItemLockMode, Player, Entity, EntityComponentTypes, Container, EntityInventoryComponent, Enchantment, BlockComponentTypes, BlockInventoryComponent, ItemDurabilityComponent, ItemEnchantableComponent, ItemFoodComponent, BlockTypes, world, GameMode, EntityEquippableComponent, EquipmentSlot } from "@minecraft/server";
import * as ui from "@minecraft/server-ui";
import { Vector3, parseCoords, parseSelector, isSameItem, getName, parseEnchantments, formatSlotName, convertToRomanNumerals, idToName, FormFieldManager } from "./utils";

/**
 * This will run onTick function every tick (20 ticks = 1 second)
 * Adjust this if it's causing lag in your world.
 * Though do note that it will then affect how often item's durability is reverted.
*/
var tickDelay = 1;

/**
 * Main menu for the item editor.
 * Displays a modal form menu to the player for selecting the source type and entity/block location.
 *
 * @param {Player} viewer - The player to display the menu to.
 */
function mainMenu(viewer: Player) {
  const menu = new ui.ModalFormData()
  .title(`§0Item Editor by §8JstAsh§r`)
  .dropdown("§fThis editor allows you to modify items from either an entity or a block container.\n\n§7Source type:", [ "Entity", "Block" ], 0)
  .textField("§7Entity selector or block location:", "e.g., \"@a[r=10]\" or \"~ ~-1 ~\"", "")
  .submitButton("Search for items")
  
  menu.show(viewer).then((result: ui.ModalFormResponse) => {
    if (result.canceled) return;

    const sourceType = result.formValues?.[0];
    if (sourceType === 0) {
      const targetSelector = result.formValues?.[1] as string;
      if (!targetSelector) {
        showErrorMessage(viewer, "No target selector was provided.", () => mainMenu(viewer));
        return;
      }
      const selector = parseSelector(viewer, targetSelector);
      if (selector.error) {
        showErrorMessage(viewer, selector.error, () => mainMenu(viewer));
        return;
      } else if (selector.entities) {
        if (selector.entities.length > 1) {
          listEntities(viewer, selector.entities);
        } else {
          getContainer(viewer, selector.entities[0]);
        }
      }
    } else if (sourceType === 1) {
      const location = result.formValues?.[1] as string;
      if (!location) {
        showErrorMessage(viewer, "No block location was provided.", () => mainMenu(viewer));
        return;
      }

      const playerCoords = parseCoords(viewer, location);
      if (typeof playerCoords === "string") {
        return;
      } else {
        const flooredX = Math.floor(playerCoords.x);
        const flooredY = Math.floor(playerCoords.y);
        const flooredZ = Math.floor(playerCoords.z);

        try {
          const block = viewer.dimension.getBlock(new Vector3(flooredX, flooredY, flooredZ));
          if (!block) {
            showErrorMessage(viewer, `Block at position ${flooredX} ${flooredY} ${flooredZ} does not exist`, () => mainMenu(viewer));
            return;
          }
  
          getContainer(viewer, block);
        } catch (e) {
          showErrorMessage(viewer, `Error occurred: ${e}`, () => mainMenu(viewer));
          return;
        }
      }
    }
  })
}

/**
 * Entity selector menu.
 * Displays an action form menu to the player to select an entity from a list of matched entities.
 * This menu is shown only when target selector returns multiple entities.
 *
 * @param {Player} viewer - The player to display the menu to.
 * @param {Entity[]} entities - The list of entities to display in the menu.
 */
function listEntities(viewer: Player, entities: Entity[]) {
  const menu = new ui.ActionFormData()
    .title("Entity Selector - Item Editor")
    .body("\n §7Multiple target's matched selector, \n select one to continue:")
    
    menu.button("Go back");

    entities.forEach((entity) => {
      menu.button(getName(entity));
    });

  menu.show(viewer).then((result: ui.ActionFormResponse) => {
    if (result.canceled) return;
    if (result.selection === undefined) return;

    if (result.selection === 0) {
      mainMenu(viewer);
    } else if (result.selection >= 1) {
      getContainer(viewer, entities[result.selection - 1], entities);
    }
  });
}

/**
 * Retrieves the container of a target entity or block and lists its items.
 * If the target does not have a container or its container is empty, an error message is displayed.
 *
 * @param {Player} viewer - The player to display the menu to.
 * @param {Entity | Block} target - The entity or block to retrieve the container from.
 * @param {Entity[]} [targetEntities] - Optional array of entities related to the target selector.
 */
function getContainer(viewer: Player, target: Entity | Block, targetEntities?: Entity[]) {
  if (target instanceof Entity) {
    const inventoryComp = target.getComponent(EntityComponentTypes.Inventory) as EntityInventoryComponent;
    const equippableComp = target.getComponent(EntityComponentTypes.Equippable) as EntityEquippableComponent;
    const container = inventoryComp?.container as Container;

    const isContainerEmpty = container.emptySlotsCount === container.size;

    let areEquipmentSlotsEmpty = true;

    if (equippableComp) {
      for (const slot of Object.values(EquipmentSlot)) {
        const equipment = equippableComp.getEquipment(slot);
        if (equipment) {
          areEquipmentSlotsEmpty = false;
          break;
        }
      }
    }

    if (!container) {
      showErrorMessage(viewer, {
        rawtext: [
          { translate: getName(target) },
          { text: " does not have an inventory." }
        ]
      }, () => (targetEntities?.length || 0) > 1 ? listEntities(viewer, targetEntities as Entity[]) : mainMenu(viewer));
      return;
    }

    if (isContainerEmpty && areEquipmentSlotsEmpty) {
      showErrorMessage(viewer, {
        rawtext: [
          { translate: getName(target) },
          { text: " has no items." }
        ]
      }, () => (targetEntities?.length || 0) > 1 ? listEntities(viewer, targetEntities as Entity[]) : mainMenu(viewer));
      return;
    }

    if (targetEntities?.length || 0 > 1) {
      listItems(viewer, container, target, targetEntities);
    } else {
      listItems(viewer, container, target);
    }
  } else if (target instanceof Block) {
    const inventoryComp = target.getComponent(BlockComponentTypes.Inventory) as BlockInventoryComponent;
    const container = inventoryComp?.container as Container;
    if (!container) {
      showErrorMessage(viewer, {
        rawtext: [
          { translate: getName(target) },
          { text: " is not a container." }
        ]
      }, () => mainMenu(viewer));
      return;
    }

    if (container.emptySlotsCount === container.size) {
      showErrorMessage(viewer, {
        rawtext: [
          { translate: getName(target) },
          { text: "'s container is empty." }
        ]
      }, () => mainMenu(viewer));
      return;
    }

    listItems(viewer, container, target);
  }
}

/**
 * Item selector menu.
 * Displays an action form menu of items in a container, allowing the viewer to select an item for further details or go back to the main menu.
 *
 * @param {Player} viewer - The player to display the menu to.
 * @param {Container} container - The container holding the items, will be used to get or set items.
 * @param {Entity | Block} target - The target entity or block that the container belongs to.
 * @param {Entity[]} [targetEntities] - Optional array of entities related to the target selector.
 */
function listItems(viewer: Player, container: Container | EntityEquippableComponent, target: Entity | Block, targetEntities?: Entity[]) {
  const menu = new ui.ActionFormData();
  const itemIndices: { type: 'container' | 'equippable', index: number }[] = [];

  menu.title(target instanceof Entity ? `${getName(target)}'s Inventory - Item Editor` : `${getName(target)}'s Container - Item Editor`);
  menu.button("Go back");

  const equippableComp = target.getComponent(EntityComponentTypes.Equippable) as EntityEquippableComponent;
  if (equippableComp) {
    for (const slot of Object.values(EquipmentSlot)) {
      const equipment = equippableComp.getEquipment(slot);
      if (equipment) {
        menu.button(`${getName(equipment)} (Equipped)`);
        itemIndices.push({ type: 'equippable', index: slot as unknown as number });
      }
    }
  }

  if (container instanceof Container) {
    const mainhandItem = target instanceof Entity && equippableComp ? equippableComp.getEquipment(EquipmentSlot.Mainhand) : null;
    for (let i = 0; i < container.size; i++) {
      const item = container.getItem(i);
      if (item) {
        if (
          mainhandItem &&
          isSameItem(item, mainhandItem)
        ) {
          continue; 
        }
        menu.button(getName(item));
        itemIndices.push({ type: 'container', index: i });
      }
    }
  }

  menu.show(viewer).then((result: ui.ActionFormResponse) => {
    if (result.canceled || result.selection === undefined) return;

    if (result.selection === 0) {
      if (targetEntities?.length || 0 > 1) {
        listEntities(viewer, targetEntities as Entity[]);
      } else {
        mainMenu(viewer);
      }
    } else {
      const selected = itemIndices[result.selection - 1];
      if (selected.type === 'container' && container instanceof Container) {
        const selectedItem = container.getItem(selected.index);
        if (selectedItem) {
          if (targetEntities?.length || 0 > 1) {
            itemDetails(viewer, container, selectedItem, selected.index, target, false, targetEntities);
          } else {
            itemDetails(viewer, container, selectedItem, selected.index, target, false);
          }
        }
      } else if (selected.type === 'equippable' && equippableComp) {
        const selectedItem = equippableComp.getEquipment(selected.index as unknown as EquipmentSlot);
        if (selectedItem) {
          if (targetEntities?.length || 0 > 1) {
            itemDetails(viewer, equippableComp, selectedItem, selected.index, target, true, targetEntities);
          } else {
            itemDetails(viewer, equippableComp, selectedItem, selected.index, target, true);
          }
        }
      }
    }
  });
}

/**
 * Item details menu.
 * Displays a message form menu for detailed information about an item, this allows the user to edit the item or go back.
 *
 * @param {Player} viewer - The player to display the menu to.
 * @param {Container} container - The container holding the items, will be used to get or set items.
 * @param {ItemStack} item - The item to display details for.
 * @param {number} slotIndex - The index of the item in the container.
 * @param {Entity | Block} target - The target entity or block that the container belongs to.
 * @param {boolean} isEquippable - Whether the item is from an equippable slot.
 * @param {Entity[]} [targetEntities] - Optional array of entities related to the target selector.
 */
function itemDetails(viewer: Player, container: Container | EntityEquippableComponent, item: ItemStack, slotIndex: number, target: Entity | Block, isEquippable = false, targetEntities?: Entity[]) {
  const title = isEquippable
    ? `${formatSlotName(slotIndex as unknown as EquipmentSlot)} - Item Editor`
    : `Slot ${slotIndex + 1} - Item Editor`;

  const menu = new ui.MessageFormData();
  menu.title(title);

  const durability = item.getComponent(ItemComponentTypes.Durability) as ItemDurabilityComponent;

  const rawText = [
    { text: `Item identifier: §7${item.typeId}§r\n` },
    ...(item.nameTag ? [{ text: `Nametag: §7${item.nameTag}§r\n` }] : []),
    ...(durability ? [{ text: `Durability: §7${durability.damage}§r/§7${durability.maxDurability}§r\n` }] : []),
    ...(!isEquippable ? [
      { text: `In slot: §7${slotIndex + 1}§r\n` }
    ] : [
      { text: `In slot: §7${formatSlotName(slotIndex as unknown as EquipmentSlot)}§r\n` }
    ]),
    ...(item.isStackable ? [
      { text: `Amount: §7${item.amount}§r\n` }
    ] : [
      { text: `Is unbreakable: §7${item.getDynamicProperty("item_editor:unbreakable") ? 'true' : 'false'}§r\n` }
    ]),
    { text: `Is a block: §7${BlockTypes.get(item.typeId) ? 'true' : 'false'}§r\n` }
  ];

  rawText.push({ text: `Keep on death: §7${item.keepOnDeath}§r\n` });
  rawText.push({ text: `Lock Mode: §7${item.lockMode}§r\n` });

  const lore = item.getLore();
  if (lore.length > 0) {
    rawText.push({ text: `Lore:\n${lore.map(line => ` - §7${line}§r`).join('\n')}\n` });
  }

  const enchantable = item.getComponent(ItemComponentTypes.Enchantable) as ItemEnchantableComponent;
  if (enchantable && enchantable.getEnchantments().length > 0) {
    const enchantmentsList: string[] = enchantable.getEnchantments().map(enchantment => {
      const enchantmentName = idToName(enchantment.type.id);
      const enchantmentLevel = convertToRomanNumerals(enchantment.level);
      return `§7${enchantmentName} ${enchantmentLevel}§r`;
    });
    rawText.push({ text: `Enchantments: ${enchantmentsList.join(', ')}\n` });
  }

  const food = item.getComponent(ItemComponentTypes.Food) as ItemFoodComponent;
  if (food) {
    rawText.push({ text: `Can always eat: §7${food.canAlwaysEat}§r\n` });
    rawText.push({ text: `Nutrition: §7${food.nutrition}§r\n` });
  }

  const canDestroy = item.getCanDestroy();
  if (canDestroy.length > 0) {
    rawText.push({ text: `Can destroy these blocks: §7${canDestroy.join(", ")}§r\n` });
  }

  const canPlaceOn = item.getCanPlaceOn();
  if (canPlaceOn.length > 0) {
    rawText.push({ text: `Can be placed on: §7${canPlaceOn.join(", ")}§r\n` });
  }

  menu.body({ rawtext: rawText });

  menu.button1("Edit Item");
  menu.button2("Go back");

  menu.show(viewer).then((result: ui.MessageFormResponse) => {
    if (result.canceled || result.selection === undefined) return;

    if (result.selection === 0) {
      if (targetEntities?.length || 0 > 1) {
        editItemDetails(viewer, item, container, slotIndex, target, isEquippable, targetEntities);
      } else {
        editItemDetails(viewer, item, container, slotIndex, target, isEquippable);
      }
    } else if (result.selection === 1) {
      if (targetEntities?.length || 0 > 1) {
        listItems(viewer, container, target, targetEntities);
      } else {
        listItems(viewer, container, target);
      }
    }
  });
}

/**
 * Item Editor menu.
 * Displays a modal form menu to edit the item's name tag, amount, durability, keep on death, lock mode, lore, enchantments, and can destroy/can place on blocks.
 * Updates the item's properties based on the viewer's input and saves the changes to the container/item.
 *
 * @param {Player} viewer - The player to display the menu to.
 * @param {ItemStack} item - The item to edit.
 * @param {Container | EntityEquippableComponent} container - The container holding the items, will be used to get or set items.
 * @param {number} slotIndex - The index of the item in the container.
 * @param {Entity | Block} target - The target entity or block that the container belongs to.
 * @param {boolean} isEquippable - Whether the item is an equippable item.
 * @param {Entity[]} [targetEntities] - Optional array of entities related to the target selector.
 */
function editItemDetails(viewer: Player, item: ItemStack, container: Container | EntityEquippableComponent, slotIndex: number, target: Entity | Block, isEquippable = false, targetEntities?: Entity[]) {
  const editForm = new ui.ModalFormData();
  editForm.title("Edit Item - Item Editor");

  const formManager = new FormFieldManager();

  formManager.addField('nameTag');
  editForm.textField("\nNametag", "Enter new name", item.nameTag || "");

  if (item.isStackable) {
    formManager.addField('amount');
    editForm.slider("Amount", 1, item.maxAmount, 1, item.amount);
  }

  const durabilityComponent = item.getComponent(ItemComponentTypes.Durability) as ItemDurabilityComponent;
  if (durabilityComponent) {
    formManager.addField('durability');
    editForm.slider("Durability", 0, durabilityComponent.maxDurability, 1, durabilityComponent.damage);
  }

  formManager.addField('keepOnDeath');
  editForm.toggle("Keep on death", item.keepOnDeath);

  if (!item.isStackable) {
    formManager.addField('unbreakable');
    editForm.toggle("Unbreakable", item.getDynamicProperty("item_editor:unbreakable") as boolean || false);
  }

  const lockModeIndices: Record<ItemLockMode, number> = {
    [ItemLockMode.slot]: 0,
    [ItemLockMode.inventory]: 1,
    [ItemLockMode.none]: 2
  };
  const defaultLockModeValue = lockModeIndices[item.lockMode] ?? 0;
  formManager.addField('lockMode');
  editForm.dropdown("Lock mode", [ItemLockMode.slot, ItemLockMode.inventory, ItemLockMode.none], defaultLockModeValue);

  formManager.addField('lore');
  editForm.textField("Lore", "Use <b> for line breaks", item.getLore().join('<b>') || "");

  const enchantable = item.getComponent(ItemComponentTypes.Enchantable) as ItemEnchantableComponent;
  const currentEnchantments = enchantable ? enchantable.getEnchantments().map(e => `${idToName(e.type.id)} ${convertToRomanNumerals(e.level)}`).join(', ') : '';
  if (enchantable) {
    formManager.addField('enchantments');
    editForm.textField("Enchantments", "e.g., Sharpness III, Unbreaking II", currentEnchantments);
  }

  formManager.addField('canDestroy');
  const canDestroy = item.getCanDestroy();
  editForm.textField("Can destroy these blocks", "Use , for multiple blocks", canDestroy.join(', ') || "");
  
  formManager.addField('canPlaceOn');
  const canPlaceOn = item.getCanPlaceOn();
  editForm.textField("Can be placed on", "Use , for multiple blocks", canPlaceOn.join(', ') || "");

  editForm.submitButton("Update item");

  editForm.show(viewer).then((response: ui.ModalFormResponse) => {
    if (!response.canceled && response.formValues) {
      const nameTag = formManager.getValue(response, 'nameTag', item.nameTag);
      const amount = formManager.getValue(response, 'amount', item.amount);
      const durabilityValue = formManager.getValue(response, 'durability', durabilityComponent ? durabilityComponent.damage : 0);
      const keepOnDeath = formManager.getValue(response, 'keepOnDeath', item.keepOnDeath);
      const isUnbreakable = formManager.getValue(response, 'unbreakable', item.getDynamicProperty("item_editor:unbreakable") as boolean || false);
      const lockModeIndex = formManager.getValue(response, 'lockMode', defaultLockModeValue);
      const loreInput = formManager.getValue(response, 'lore', item.getLore().join('<b>'));
      const enchantmentsInput = formManager.getValue(response, 'enchantments', currentEnchantments);
      const canDestroyInput = formManager.getValue(response, 'canDestroy', item.getCanDestroy().join(', '));
      const canPlaceOnInput = formManager.getValue(response, 'canPlaceOn', item.getCanPlaceOn().join(', '));

      item.nameTag = nameTag;
      item.amount = amount;
      if (durabilityComponent) {
        durabilityComponent.damage = durabilityValue;
      }
      item.keepOnDeath = keepOnDeath;
      item.lockMode = Object.keys(lockModeIndices)[lockModeIndex] as ItemLockMode;

      if (isUnbreakable) {
        durabilityComponent.damage = 0;
        item.setDynamicProperty("item_editor:unbreakable", true);
      } else {
        item.setDynamicProperty("item_editor:unbreakable", undefined);
      }

      const loreLines = loreInput.split('<b>').map((line) => line.trim()).filter(line => line !== '');
      item.setLore(loreLines);

      if (enchantable) {
        try {
          if (enchantmentsInput) {
            enchantable.removeAllEnchantments();
            const newEnchantments = parseEnchantments(item, enchantmentsInput);
            if (newEnchantments.enchantments?.length === 0) return;
            if (newEnchantments.error) {
              if (targetEntities?.length || 0 > 1) {
                showErrorMessage(viewer, newEnchantments.error, () => itemDetails(viewer, container, item, slotIndex, target, isEquippable, targetEntities));
              } else {
                showErrorMessage(viewer, newEnchantments.error, () => itemDetails(viewer, container, item, slotIndex, target, isEquippable));
              }

              return;
            }
            enchantable.addEnchantments(newEnchantments.enchantments as Enchantment[]);
          } else {
            enchantable.removeAllEnchantments();
          }
        } catch (error) {
          const errorMessage = (error instanceof Error) ? error.message : 'Unknown error occurred';
          if (targetEntities?.length || 0 > 1) {
            showErrorMessage(viewer, `Failed to edit enchantments: ${errorMessage}`, () => itemDetails(viewer, container, item, slotIndex, target, isEquippable, targetEntities));
          } else {
            showErrorMessage(viewer, `Failed to edit enchantments: ${errorMessage}`, () => itemDetails(viewer, container, item, slotIndex, target, isEquippable));
          }
          return;
        }
      }

      const canDestroyInputList = canDestroyInput.split(',').map(block => block.trim()).filter(block => block !== '');
      const validCanDestroyBlocks: string[] = [];
      for (const block of canDestroyInputList) {
        if (BlockTypes.get(block)) {
          validCanDestroyBlocks.push(block);
        } else {
          if (targetEntities?.length || 0 > 1) {
            showErrorMessage(viewer, `Block type "${block}" is invalid, cannot be added to "Can Destroy" list.`, () => itemDetails(viewer, container, item, slotIndex, target, isEquippable, targetEntities));
          } else {
            showErrorMessage(viewer, `Block type "${block}" is invalid, cannot be added to "Can Destroy" list.`, () => itemDetails(viewer, container, item, slotIndex, target, isEquippable));
          }
          return;
        }
      }
      item.setCanDestroy(validCanDestroyBlocks);

      const canPlaceOnInputList = canPlaceOnInput.split(',').map(block => block.trim()).filter(block => block !== '');
      const validCanPlaceOnBlocks: string[] = [];
      for (const block of canPlaceOnInputList) {
        if (BlockTypes.get(block)) {
          validCanPlaceOnBlocks.push(block);
        } else {
          if (targetEntities?.length || 0 > 1) {
            showErrorMessage(viewer, `Block type "${block}" is invalid, cannot be added to "Can Place On" list.`, () => itemDetails(viewer, container, item, slotIndex, target, isEquippable, targetEntities));
          } else {
            showErrorMessage(viewer, `Block type "${block}" is invalid, cannot be added to "Can Place On" list.`, () => itemDetails(viewer, container, item, slotIndex, target, isEquippable));
          }
          return;
        }
      }
      item.setCanPlaceOn(validCanPlaceOnBlocks);

      if (isEquippable && container instanceof EntityEquippableComponent) {
        container.setEquipment(slotIndex as unknown as EquipmentSlot, item);
      } else if (!isEquippable && container instanceof Container) {
        container.setItem(slotIndex, item);
      }

      if (targetEntities?.length || 0 > 1) {
        itemDetails(viewer, container, item, slotIndex, target, isEquippable, targetEntities);
      } else {
        itemDetails(viewer, container, item, slotIndex, target, isEquippable);
      }
    }
  });
}

/**
 * Error menu.
 * Displays a message form menu for error message to the viewer with options to close or go back to the previous menu.
 *
 * @param {Player} viewer - The player to display the menu to.
 * @param {RawText|string} message - The error message to display.
 * @param {function} previousMenu - A callback function to call when the viewer chooses to go back to the previous menu.
 */
function showErrorMessage(viewer: Player, message: RawText | string, previousMenu: () => void) {
  const menu = new ui.MessageFormData()
    .title("Error - Item Editor")
    .body(message)
    .button1("Close")
    .button2("Go back");

  menu.show(viewer).then((result: ui.MessageFormResponse) => {
    if (result.canceled) return;

    if (result.selection === 0) {
      return;
    } else if (result.selection === 1) {
      previousMenu();
    }
  });
}

system.afterEvents.scriptEventReceive.subscribe((eventData: ScriptEventCommandMessageAfterEvent) => {
  if (eventData.id === "item:editor") {
    const player = eventData.sourceEntity as Player;
    mainMenu(player);
  }
})

function onTick() {
  for (const player of world.getPlayers()) {
    if (player.getGameMode() === GameMode.creative) continue;

    const inventory = player.getComponent(EntityComponentTypes.Inventory) as EntityInventoryComponent;
    const equippable = player.getComponent(EntityComponentTypes.Equippable) as EntityEquippableComponent;
    const container = inventory.container as Container;

    const containerSize = container.size;

    for (let i = 0; i < containerSize; i++) {
      const item = container.getItem(i);

      if (item && item.getDynamicProperty("item_editor:unbreakable")) {
        const durability = item.getComponent(ItemComponentTypes.Durability) as ItemDurabilityComponent;
        if (durability && durability.damage > 0) {
          if (i !== player.selectedSlotIndex) {
            durability.damage = 0;
            container.setItem(i, item);
            console.warn(`Reverted durability of item in slot ${i} to 0`);
          }
        }
      }
    }

    if (equippable) {
      for (const slot of Object.values(EquipmentSlot)) {
        const equipment = equippable.getEquipment(slot);
        if (equipment && equipment.getDynamicProperty("item_editor:unbreakable")) {
          const durability = equipment.getComponent(ItemComponentTypes.Durability) as ItemDurabilityComponent;
          if (
            (slot === EquipmentSlot.Head || 
             slot === EquipmentSlot.Chest || 
             slot === EquipmentSlot.Legs || 
             slot === EquipmentSlot.Feet) &&
            durability && 
            durability.damage >= durability.maxDurability - 10
          ) {
            durability.damage = 0;
            equippable.setEquipment(slot, equipment);
          } else if (
            (slot === EquipmentSlot.Mainhand || 
             slot === EquipmentSlot.Offhand) &&
            durability && 
            durability.damage > 0
          ) {
            durability.damage = 0;
            equippable.setEquipment(slot, equipment);
          }
        }
      }
    }
  }
}
system.runInterval(onTick, tickDelay);