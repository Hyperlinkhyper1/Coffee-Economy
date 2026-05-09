export const shopItems = [
    {
        id: 'fishing_rod',
        name: 'Fishing Rod',
        emoji: '🎣',
        price: 500,
        description: 'Catch fish to sell for profit!',
        type: 'tool'
    },
    {
        id: 'hunting_rifle',
        name: 'Hunting Rifle',
        emoji: '🔫',
        price: 1000,
        description: 'Hunt animals for meat and fur!',
        type: 'tool'
    },
    {
        id: 'laptop',
        name: 'Laptop',
        emoji: '💻',
        price: 2000,
        description: 'Work as a programmer for higher pay!',
        type: 'tool',
        workMultiplier: 1.5
    },
    {
        id: 'bank_loan',
        name: 'Bank Loan',
        emoji: '🏦',
        price: 5000,
        description: 'Increases your bank capacity by 50,000!',
        type: 'upgrade',
        effect: 'bank_capacity',
        value: 50000
    },
    {
        id: 'lottery_ticket',
        name: 'Lottery Ticket',
        emoji: '🎫',
        price: 100,
        description: 'A chance to win big!',
        type: 'consumable',
        use: 'gamble'
    },
    {
        id: 'before_20k_card',
        name: 'Before 20k Trading Card',
        emoji: '🃏',
        price: 0,
        description: 'A rare collectible for early supporters!',
        type: 'collectible',
        purchasable: false
    }
];

export function getItemById(itemId) {
    return shopItems.find(item => item.id === itemId);
}

export function getItemsByType(type) {
    return shopItems.filter(item => item.type === type);
}

export function getItemPrice(itemId) {
    const item = getItemById(itemId);
    return (item && item.price !== undefined) ? item.price : 0;
}

export function validatePurchase(itemId, userData) {
    const item = getItemById(itemId);
    if (!item) {
        return { valid: false, reason: 'Item not found' };
    }

    if (item.purchasable === false) {
        return { valid: false, reason: 'This item cannot be purchased from the shop.' };
    }

    const inventory = userData.inventory || {};
    const upgrades = userData.upgrades || {};

    if (item.type === 'consumable' && item.maxQuantity) {
        const currentQuantity = inventory[itemId] || 0;
        if (currentQuantity >= item.maxQuantity) {
            return { 
                valid: false, 
                reason: `You can only have a maximum of ${item.maxQuantity} ${item.name}s` 
            };
        }
    }

    if (item.type === 'upgrade' && item.maxLevel) {
        if (upgrades[itemId]) {
            return { 
                valid: false, 
                reason: `You've already purchased ${item.name}` 
            };
        }
    }

    if (item.type === 'tool') {
        const currentQuantity = inventory[itemId] || 0;
        if (itemId !== 'bank_note' && currentQuantity > 0) {
            return { 
                valid: false, 
                reason: `You already have a ${item.name}` 
            };
        }
    }

    if (item.type === 'role' && item.roleId) {
        if (userData.roles?.includes(item.roleId)) {
            return { 
                valid: false, 
                reason: `You already have the ${item.name} role` 
            };
        }
    }

    return { valid: true };
}
